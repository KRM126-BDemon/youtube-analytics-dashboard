import json
import boto3
import os
import urllib.request
import urllib.parse
import re
import traceback
from datetime import datetime, timedelta
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor

# A video is a Short if it is 3 minutes (180 seconds) or less; anything longer is Long-form.
SHORT_MAX_SECONDS = 180

def is_short(video):
    return video.get('durationSeconds', 0) <= SHORT_MAX_SECONDS

def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]

# Initialize AWS services
dynamodb = boto3.resource('dynamodb')
bedrock = boto3.client('bedrock-runtime', region_name='us-west-1')

channel_table = dynamodb.Table('YouTubeChannelMetrics')
video_table = dynamodb.Table('YouTubeVideoMetrics')
insights_table = dynamodb.Table('YouTubeInsights')

def decimal_to_int(obj):
    """Helper for JSON serialization within the Bedrock prompt"""
    if isinstance(obj, Decimal):
        return int(obj)
    return str(obj)

def parse_duration(duration_str):
    """Parse ISO 8601 duration format to seconds"""
    pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
    match = re.match(pattern, duration_str)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds

def get_access_token():
    """Get fresh access token using refresh token"""
    token_url = 'https://oauth2.googleapis.com/token'
    data = {
        'client_id': os.environ['YOUTUBE_CLIENT_ID'],
        'client_secret': os.environ['YOUTUBE_CLIENT_SECRET'],
        'refresh_token': os.environ['YOUTUBE_REFRESH_TOKEN'],
        'grant_type': 'refresh_token'
    }
    data_encoded = urllib.parse.urlencode(data).encode('utf-8')
    req = urllib.request.Request(token_url, data=data_encoded, method='POST')
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        return result['access_token']

def get_channel_basic_stats(access_token):
    api_url = 'https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true'
    req = urllib.request.Request(api_url)
    req.add_header('Authorization', f'Bearer {access_token}')
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
    if not data.get('items'):
        return None, None, None
    stats = data['items'][0]['statistics']
    channel_id = data['items'][0]['id']
    uploads_playlist_id = data['items'][0]['contentDetails']['relatedPlaylists']['uploads']
    return {
        'subscribers': int(stats.get('subscriberCount', 0)),
        'totalViews': int(stats.get('viewCount', 0)),
        'totalVideos': int(stats.get('videoCount', 0))
    }, channel_id, uploads_playlist_id

def get_channel_videos(access_token, uploads_playlist_id):
    """List EVERY upload by paging through the channel's uploads playlist (1 quota unit/page)."""
    video_ids = []
    page_token = None
    while True:
        params = {'part': 'contentDetails', 'playlistId': uploads_playlist_id, 'maxResults': 50}
        if page_token:
            params['pageToken'] = page_token
        api_url = 'https://www.googleapis.com/youtube/v3/playlistItems?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(api_url)
        req.add_header('Authorization', f'Bearer {access_token}')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
        video_ids.extend(item['contentDetails']['videoId'] for item in data.get('items', []))
        page_token = data.get('nextPageToken')
        if not page_token:
            break
    return video_ids

def get_video_details(access_token, video_ids):
    if not video_ids: return []
    video_ids_str = ','.join(video_ids)
    api_url = f'https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id={video_ids_str}'
    req = urllib.request.Request(api_url)
    req.add_header('Authorization', f'Bearer {access_token}')
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
    videos = []
    for item in data.get('items', []):
        duration_seconds = parse_duration(item['contentDetails'].get('duration', 'PT0S'))
        videos.append({
            'videoId': item['id'],
            'title': item['snippet']['title'],
            'publishedAt': item['snippet']['publishedAt'],
            'views': int(item['statistics'].get('viewCount', 0)),
            'likes': int(item['statistics'].get('likeCount', 0)),
            'comments': int(item['statistics'].get('commentCount', 0)),
            'durationSeconds': duration_seconds
        })
    return videos

def get_video_analytics(access_token, video_ids):
    if not video_ids: return {}
    video_ids_str = ','.join(video_ids)
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=28)).strftime('%Y-%m-%d')
    # subscribersGained added March 27 2026
    metrics = 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained'
    params = f'?ids=channel==MINE&startDate={start_date}&endDate={end_date}&metrics={metrics}&dimensions=video&filters=video=={video_ids_str}'
    api_url = f'https://youtubeanalytics.googleapis.com/v2/reports{params}'
    req = urllib.request.Request(api_url)
    req.add_header('Authorization', f'Bearer {access_token}')
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
        return {row[0]: {
            'recentViews': int(row[1]),
            'watchTimeMinutes': int(row[2]),
            'avgViewDuration': int(row[3]),
            'avgViewPercentage': int(row[4]),
            'subscribersGained': int(row[5])
        } for row in data.get('rows', [])}
    except Exception as e:
        print(f"Video analytics error: {e}")
        return {}

def get_video_lifetime_analytics(access_token, video_ids, start_date, end_date):
    """Lifetime retention for each video (since the channel's first upload).
    The 28-day query above returns nothing for a video with no views in that window,
    which left those videos with no retention data at all. This fills that gap."""
    if not video_ids: return {}
    video_ids_str = ','.join(video_ids)
    metrics = 'averageViewDuration,averageViewPercentage'
    params = f'?ids=channel==MINE&startDate={start_date}&endDate={end_date}&metrics={metrics}&dimensions=video&filters=video=={video_ids_str}'
    api_url = f'https://youtubeanalytics.googleapis.com/v2/reports{params}'
    req = urllib.request.Request(api_url)
    req.add_header('Authorization', f'Bearer {access_token}')
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
        return {row[0]: {
            'lifetimeAvgViewDuration': int(round(row[1])),
            'lifetimeAvgViewPercentage': int(round(row[2]))
        } for row in data.get('rows', [])}
    except Exception as e:
        print(f"Lifetime analytics error: {e}")
        return {}

def get_channel_analytics(access_token):
    """Get channel analytics - we'll only use avgViewDuration from this"""
    end_date = datetime.now().strftime('%Y-%m-%d')
    start_date = (datetime.now() - timedelta(days=28)).strftime('%Y-%m-%d')
    metrics = 'views,estimatedMinutesWatched,averageViewDuration'
    api_url = f'https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate={start_date}&endDate={end_date}&metrics={metrics}'
    req = urllib.request.Request(api_url)
    req.add_header('Authorization', f'Bearer {access_token}')
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
        if data.get('rows'):
            row = data['rows'][0]
            return {'avgViewDuration': int(row[2])}
    except Exception as e:
        print(f"Channel analytics error: {e}")
    return {'avgViewDuration': 0}

def get_existing_video_data(video_id):
    try:
        response = video_table.query(
            KeyConditionExpression='videoId = :vid',
            ExpressionAttributeValues={':vid': video_id}
        )
        milestones = {}
        for item in response.get('Items', []):
            for m in ['viewsAt7Days', 'viewsAt30Days', 'viewsAt60Days']:
                if m in item: milestones[m] = int(item[m])
        return milestones
    except Exception as e:
        print(f"Error querying DynamoDB for {video_id}: {e}")
        return {}

def calculate_evergreen_score(current_views, views_at_30_days):
    if not current_views or not views_at_30_days or current_views <= views_at_30_days:
        return 0.0
    return round(((current_views - views_at_30_days) / current_views) * 100, 2)

def get_traffic_sources(access_token, video_id):
    try:
        end_date = datetime.now().strftime('%Y-%m-%d')
        start_date = (datetime.now() - timedelta(days=28)).strftime('%Y-%m-%d')
        api_url = f'https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate={start_date}&endDate={end_date}&metrics=views&dimensions=insightTrafficSourceType&filters=video=={video_id}&sort=-views'
        req = urllib.request.Request(api_url)
        req.add_header('Authorization', f'Bearer {access_token}')
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
        return {row[0]: int(row[1]) for row in data.get('rows', [])} if 'rows' in data else {}
    except Exception as e:
        print(f"Traffic source error for {video_id}: {e}")
        return {}

def should_generate_insights():
    """
    Fixed March 29 2026: was using Limit=1 which returned a random item,
    causing insights to regenerate daily instead of weekly.
    Now scans all items and sorts to find the true most recent date.
    """
    try:
        response = insights_table.scan()
        if not response.get('Items'): return True
        items = sorted(response['Items'], key=lambda x: x['analysisDate'], reverse=True)
        last_date = datetime.strptime(items[0]['analysisDate'], '%Y-%m-%d')
        return (datetime.now() - last_date).days >= 7
    except Exception:
        return True

def generate_ai_insights(channel_data, video_data):
    try:
        # Separate Shorts vs Long-form: Short = 3 minutes (180 seconds) or less
        shorts = [v for v in video_data if is_short(v)]
        longform = [v for v in video_data if not is_short(v)]

        # Calculate funnel metrics
        shorts_views = sum(v.get('views', 0) for v in shorts)
        longform_views = sum(v.get('views', 0) for v in longform)

        # Get traffic source insights
        longform_suggested = sum(
            v.get('trafficSources', {}).get('SUGGESTED_VIDEO', 0) +
            v.get('trafficSources', {}).get('RELATED_VIDEO', 0)
            for v in longform
        )

        TOP_VIDEOS = [
            {
                'title': v.get('title', 'Unknown'),
                'type': 'Short' if is_short(v) else 'Long-form',
                'views': v.get('views', 0),
                'watchTime': v.get('watchTimeMinutes', 0),
                'retention': v.get('avgViewPercentage', 0)
            } for v in sorted(video_data, key=lambda x: x.get('views', 0), reverse=True)[:5]
        ]

        prompt = f"""You are a YouTube growth consultant specializing in educational content creators and content funnel strategy.

CHANNEL CONTEXT:
- Name: "The Guitar Circuit"
- Niche: Guitar lessons and jam tracks for beginner-to-intermediate students
- Creator background: Marketing professional with social media experience, looking for YouTube-specific expertise
- Target audience: Guitar students seeking structured, educational content (not entertainment-focused)

CONTENT STRATEGY:
- Shorts (3 min or less): Quick tips, technique wisdom, motivational snippets
  Purpose: Top-of-funnel discovery via YouTube Shorts algorithm
  Current count: {len(shorts)} videos | Total views: {shorts_views:,}

- Long-form (over 3 min): Full lessons, practice routines, jam tracks
  Purpose: Educational depth, viewer retention, subscriber conversion
  Current count: {len(longform)} videos | Total views: {longform_views:,}

STRATEGIC GOALS (in priority order):
1. Use Shorts to attract new viewers via discovery algorithm
2. Convert Short viewers into Long-form watchers (funnel effectiveness)
3. Build loyal subscriber base for long-form guitar education
4. Reach 1,000 subscribers and 4,000 watch hours for monetization
5. Focus on sustainable growth over viral chasing

CURRENT PERFORMANCE:
- Subscribers: {channel_data['subscribers']:,}
- 28-day watch time: {channel_data['watchTimeMinutes']:,} minutes
- Subscriber conversion rate: {float(channel_data.get('contentDebtRatio', 0)):.2f} subs per 1K views (28-day window)
- Long-form videos getting {longform_suggested:,} views from Suggested Videos (funnel indicator)

TOP PERFORMING VIDEOS:
{json.dumps(TOP_VIDEOS, indent=2, default=decimal_to_int)}

YOUR TASK:
Provide 2-3 specific, actionable insights (150-200 words total). Focus on:
1. Is the Shorts-to-Long-form funnel working? (Check if Long-form videos are getting Suggested Video traffic)
2. What content is performing best and why? (Retention, watch time efficiency)
3. One specific next step to improve subscriber conversion or long-term engagement

IMPORTANT:
- Be specific to guitar education content (avoid generic social media advice)
- Do not recommend chasing trends irrelevant to guitar students
- Focus on metrics that matter: watch time, retention, funnel effectiveness
- Speak to someone with marketing knowledge who needs YouTube platform expertise
- The channel has {len(video_data)} published videos total — always acknowledge existing content"""

        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-sonnet-4-5-20250929-v1:0',
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 1000,
                'messages': [{'role': 'user', 'content': prompt}]
            })
        )
        insights_text = json.loads(response['body'].read())['content'][0]['text']
        insights_table.put_item(Item={
    'id': 'latest',
    'analysisDate': datetime.now().strftime('%Y-%m-%d'),
    'insights': insights_text,
    'subscribers': channel_data['subscribers'],
    'totalViews': channel_data['totalViews'],
    'timestamp': int(datetime.now().timestamp())
})
        return insights_text
    except Exception as e:
        print(f"Bedrock Error: {e}")
        return None

def lambda_handler(event, context):
    try:
        token = get_access_token()
        today = datetime.now().strftime('%Y-%m-%d')

        stats, channel_id, uploads_playlist_id = get_channel_basic_stats(token)
        if not stats: return {'statusCode': 404, 'body': 'Channel not found'}

        channel_analytics = get_channel_analytics(token)
        avg_view_duration_channel = channel_analytics.get('avgViewDuration', 0)

        # Sub Gained Calculation (using yesterday's data)
        sub_gained = 0
        try:
            yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
            yesterday_response = channel_table.get_item(Key={'date': yesterday})
            if 'Item' in yesterday_response:
                yesterday_subscribers = int(yesterday_response['Item'].get('subscribers', 0))
                sub_gained = stats['subscribers'] - yesterday_subscribers
        except Exception as e:
            print(f"Could not calculate new subscribers: {e}")
            sub_gained = 0

        # Get all video data
        video_ids = get_channel_videos(token, uploads_playlist_id)
        print(f"Found {len(video_ids)} videos in uploads playlist")
        video_data_list = []

        total_watch_time_from_videos = 0
        total_recent_views_from_videos = 0

        if video_ids:
            # YouTube APIs accept at most 50 video IDs per call, so work in batches
            details = []
            v_analytics = {}
            for batch in chunked(video_ids, 50):
                details.extend(get_video_details(token, batch))
                v_analytics.update(get_video_analytics(token, batch))

            # Lifetime retention (covers videos that had no views in the last 28 days)
            lifetime_start = min(d['publishedAt'][:10] for d in details) if details else today
            v_lifetime = {}
            for batch in chunked(video_ids, 50):
                v_lifetime.update(get_video_lifetime_analytics(token, batch, lifetime_start, today))
            print(f"Lifetime retention found for {len(v_lifetime)} of {len(details)} videos")

            # Traffic sources need one API call per video; run a few in parallel to stay well under the timeout
            with ThreadPoolExecutor(max_workers=5) as pool:
                traffic_results = list(pool.map(lambda d: get_traffic_sources(token, d['videoId']), details))
            traffic_by_video = {d['videoId']: t for d, t in zip(details, traffic_results)}

            for v in details:
                v_id = v['videoId']
                days_old = (datetime.now() - datetime.strptime(v['publishedAt'][:10], '%Y-%m-%d')).days
                milestones = get_existing_video_data(v_id)

                # Merge analytics data
                v.update(v_analytics.get(v_id, {}))
                v.update(v_lifetime.get(v_id, {}))
                v.update({'date': today, 'daysOld': days_old, 'timestamp': int(datetime.now().timestamp())})
                v['trafficSources'] = traffic_by_video.get(v_id, {})

                # Accumulate totals from individual videos
                total_watch_time_from_videos += v.get('watchTimeMinutes', 0)
                total_recent_views_from_videos += v.get('recentViews', 0)

                # ===== MILESTONE CAPTURE LOGIC =====
                milestone_windows = {
                    'viewsAt7Days': (6, 8),
                    'viewsAt30Days': (28, 32),
                    'viewsAt60Days': (58, 62)
                }

                for milestone_key, (min_days, max_days) in milestone_windows.items():
                    if milestone_key not in milestones and min_days <= days_old <= max_days:
                        v[milestone_key] = v['views']
                        print(f"📸 Captured {milestone_key} for {v['title'][:30]}... (day {days_old}): {v['views']} views")
                    elif milestone_key in milestones:
                        v[milestone_key] = milestones[milestone_key]
                # ===================================

                # Calculate evergreen score if we have day 30 snapshot
                if 'viewsAt30Days' in v:
                    v['evergreenScore'] = Decimal(str(calculate_evergreen_score(v['views'], v['viewsAt30Days'])))

                # Save to video metrics table
                video_table.put_item(Item=json.loads(json.dumps(v, default=str), parse_float=Decimal))

                video_data_list.append(v)

        print(f"Saved {len(video_data_list)} of {len(video_ids)} videos for {today}")

        # Calculate 28-day rolling conversion rate
        debt_ratio = Decimal('0.00')
        if total_recent_views_from_videos > 0:
            try:
                twenty_eight_days_ago = (datetime.now() - timedelta(days=28)).strftime('%Y-%m-%d')
                old_response = channel_table.get_item(Key={'date': twenty_eight_days_ago})

                if 'Item' in old_response:
                    old_subscribers = int(old_response['Item'].get('subscribers', 0))
                    subs_gained_28_days = stats['subscribers'] - old_subscribers

                    if subs_gained_28_days > 0:
                        debt_ratio = Decimal(str(round((subs_gained_28_days / total_recent_views_from_videos) * 1000, 2)))
            except Exception as e:
                print(f"Could not calculate 28-day rolling conversion: {e}")
                debt_ratio = Decimal('0.00')

        # Calculate 30-day average conversion rate
        avg_conversion_rate = Decimal('0.00')
        try:
            thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
            response = channel_table.scan(
                FilterExpression='#d >= :start_date AND attribute_exists(contentDebtRatio)',
                ExpressionAttributeNames={'#d': 'date'},
                ExpressionAttributeValues={':start_date': thirty_days_ago}
            )

            if response['Items'] and len(response['Items']) > 0:
                rates = [Decimal(str(item['contentDebtRatio'])) for item in response['Items'] if 'contentDebtRatio' in item]
                if rates:
                    avg_conversion_rate = sum(rates) / len(rates)
                    avg_conversion_rate = Decimal(str(round(float(avg_conversion_rate), 2)))
        except Exception as e:
            print(f"Could not calculate 30-day average: {e}")
            avg_conversion_rate = Decimal('0.00')

        # Store channel data
        channel_item = {
            'date': today,
            'subscribers': stats['subscribers'],
            'totalViews': stats['totalViews'],
            'totalVideos': stats['totalVideos'],
            'recentViews': total_recent_views_from_videos,
            'watchTimeMinutes': total_watch_time_from_videos,
            'avgViewDuration': avg_view_duration_channel,
            'newSubscribers': sub_gained,
            'contentDebtRatio': debt_ratio,
            'avgConversionRate30d': avg_conversion_rate,
            'timestamp': int(datetime.now().timestamp())
        }
        channel_table.put_item(Item=channel_item)

        # Generate AI insights if needed
        if should_generate_insights():
            generate_ai_insights(channel_item, video_data_list)

        return {'statusCode': 200, 'body': json.dumps('Data collection successful')}

    except Exception as e:
        print(traceback.format_exc())
        return {'statusCode': 500, 'body': json.dumps(f"Error: {str(e)}")}