# YouTube Analytics Dashboard
## 📊 Project Overview

Serverless analytics platform that collects YouTube channel metrics daily, calculates custom performance indicators not available in YouTube Studio, and generates weekly AI-powered marketing insights—all. I'm a marketing professional developing my cloud skills to stretch into technical marketing. This project was created with guidance from LLM's such as Claude.

**Live Demo:** [dl4ii479k5yyn.cloudfront.net](http://theguitarcircuit-youtubedashboard.s3-website-us-west-1.amazonaws.com)

**The Business Problem:** YouTube Studio provides basic analytics, but lacks critical metrics for data-driven content strategy:
- Subscriber conversion efficiency (subscribers gained per 1,000 views)
- Content longevity tracking (which videos remain valuable 30+ days post-publication)
- Traffic source analysis by content type (Shorts vs long-form)
- Evergreen content scoring for long-term growth

I created a new YouTube channel called [The Guitar Circuit](https://www.youtube.com/@TheGuitarCircuit/shorts), which offers educational guitar lesson videos. This dashboard collects data from that channel to provide unique analytics and actionable insights to help it grow.

**The Solution:** This automated dashboard collects data via YouTube APIs, stores it in DynamoDB, and surfaces actionable insights through a React interface—enabling strategic content decisions based on real performance data.

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ EventBridge │────▶│   Lambda     │────▶│  DynamoDB   │
│  (Daily)    │     │  Collector   │     │  (3 Tables) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                      │
                           ▼                      ▼
                    ┌──────────────┐     ┌──────────────┐
                    │   Bedrock    │     │ API Gateway  │
                    │ (AI Insights)│     │   (REST)     │
                    └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
                                         ┌──────────────┐
                                         │    React     │
                                         │  Dashboard   │
                                         └──────────────┘
```

---

## 🚀 Features

### Custom Metrics Not Available in YouTube Studio

#### 1. **Subscriber Conversion Rate**
- Measures subscribers gained per 1,000 views 
- 30-day trend analysis to identify improving/declining conversion
- Helps optimize content for subscriber growth vs. pure view count

#### 2. **Evergreen Content Scoring**
- Tracks view snapshots at days 7, 30, and 60 post-publication
- Calculates percentage of views occurring after day 30
- Identifies content with long-term value vs. flash-in-the-pan videos

#### 3. **Traffic Source Analysis by Content Type**
- Compares Shorts (< 2 min) vs. Workouts (2+ min) traffic patterns
- Shows Browse Features, Search, Suggested Videos breakdown
- Data coverage metrics indicate analysis completeness (90%+ = comprehensive)

#### 4. **Watch Time Efficiency**
- (Total watch time in seconds) / total views
- Identifies which content keeps viewers engaged longest
- Key metric for YouTube algorithm favorability

#### 5. **AI-Powered Marketing Insights**
- Weekly automated analysis using Claude Sonnet 4.5 via Bedrock
- Identifies growth opportunities based on performance trends
- Provides actionable recommendations in plain language

### Data Quality Transparency

In real-world analytics, platform APIs never align perfectly. Rather than forcing artificial reconciliation that introduces errors, this dashboard documents sources and limitations—demonstrating data literacy and stakeholder communication skills.

---

## 🛠️ Technology Stack

### Backend (AWS)
- **Lambda (Python 3.12):** Data collection, API endpoints
- **DynamoDB:** NoSQL storage (3 tables)
- **API Gateway:** REST API with CORS-enabled endpoints
- **EventBridge:** Daily data collection trigger (2 AM PST)
- **Bedrock:** AI insights generation (Claude Sonnet 4.5)
- **IAM:** Least-privilege role permissions

### Frontend
- **React 18:** Component-based UI
- **Recharts:** Line, bar, and pie chart visualizations
- **Custom CSS:** Responsive design with brand colors

### External APIs
- **YouTube Data API v3:** Channel and video metadata
- **YouTube Analytics API:** Advanced metrics (watch time, traffic sources)
- **OAuth 2.0:** Secure authentication with refresh tokens

---

## 📂 Project Structure

```
youtube-dashboard/
├── src/
│   ├── App.js                    # Main dashboard component
│   ├── App.css                   # Global styles
│   ├── VideoScorecard.js         # Video performance table
│   ├── VideoScorecard.css
│   ├── ContentLongevity.js       # Evergreen content tracking
│   ├── ContentLongevity.css
│   ├── TrafficSources.js         # Traffic analysis component
│   ├── TrafficSources.css
│   ├── AIInsights.js             # AI-generated insights
│   └── AIInsights.css
├── public/
├── package.json
└── README.md

lambda/
├── YouTubeDataCollector.py       # Daily data collection + AI insights
├── GetYouTubeStats.py            # Channel metrics endpoint
├── GetVideoPerformance.py        # Video data endpoint
└── GetYouTubeInsights.py         # AI insights endpoint

infrastructure/
└── get_youtube_token.py          # OAuth token generator
```


## 💰 Cost Breakdown

| Service | Monthly Cost | Notes |
|---------|-------------|-------|
| Lambda | ~$0.50 | 4 functions, daily execution |
| DynamoDB | ~$1-2 | Pay-per-request, ~10k reads/month |
| API Gateway | ~$0.50 | REST API calls |
| Bedrock | ~$0.10 | Weekly AI insights (Claude Sonnet 4.5) |
| S3/CloudFront | ~$1 | Static hosting (when deployed) |
| **Total** | **~$3.50-4.50** | Production analytics platform |

**Cost Optimization Strategies:**
- Serverless architecture eliminates idle compute costs
- DynamoDB on-demand pricing (vs. provisioned capacity)
- EventBridge schedule (vs. always-running cron)
- Weekly (not daily) AI insights generation

---

## 📈 Roadmap

### Completed ✅
- Serverless AWS architecture with Lambda, DynamoDB, API Gateway, EventBridge
- YouTube API integration with OAuth authentication
- Weekly AI-powered marketing insights using Amazon Bedrock
- React dashboard with charts and video performance scorecard
- Subscriber conversion rate tracking with 30-day trends
- Evergreen content scoring with milestone snapshots
- Traffic source analysis with data coverage metrics
- Data quality transparency features

---

## 🐛 Troubleshooting

### Lambda Fails to Collect Data
**Symptom:** No new data in DynamoDB after 2 AM PST  
**Solution:**
1. Check CloudWatch Logs for error details
2. Verify EventBridge rule is enabled
3. Confirm IAM role has DynamoDB + Bedrock permissions

### API Returns CORS Errors
**Symptom:** Browser console shows CORS policy errors  
**Solution:**
1. Verify CORS enabled on all API Gateway resources
2. Check OPTIONS method is configured
3. Ensure Access-Control-Allow-Origin header is set

### OAuth HTTP 400: Bad Request
**Symptom:** Lambda logs show "invalid_grant" error  
**Solution:**
1. Refresh token has expired
2. Run `python3 get_youtube_token.py` to generate new token
3. Update Lambda environment variable `YOUTUBE_REFRESH_TOKEN`

### Conversion Rate Shows 0.00
**Symptom:** Subscriber conversion displays as 0.00  
**Solution:**
- Need at least 2 days of data (today + yesterday) for calculation
- First run shows 0 because there's no yesterday data to compare

### Traffic Sources Missing for Some Videos
**Symptom:** Some videos show "No data available"  
**Solution:**
- YouTube doesn't provide traffic data for all videos immediately
- New videos (< 24-48 hours) typically lack traffic data
- Very low-view videos may not have breakdown available
- Check data coverage percentage in summary cards

---

## 🎯 Why This Project Stands Out

**1. Real Business Problem + Technical Solution**
- A tutorial project—built to solve an actual need (YouTube channel growth)
- Demonstrates ability to identify problems and architect solutions

**2. Production-Ready Code**
- Error handling, logging, data validation
- Cost optimization (~$4/month vs. $50+ for EC2)
- Security best practices (IAM, OAuth, encryption)

**3. Data Quality Transparency**
- Acknowledges real-world analytics challenges (API discrepancies)
- Shows data coverage metrics and source labeling
- Demonstrates stakeholder communication skills

**4. Full-Stack Capabilities**
- AWS backend (5 services)
- React frontend with visualizations
- API integrations (YouTube, Bedrock)
- DevOps (EventBridge scheduling, IAM)

**5. AI Integration**
- Practical use of generative AI (weekly insights via Bedrock)
- Not just "AI for AI's sake"—adds real value

### Quantifiable Results
- **Cost Efficiency:** $4/month for enterprise-grade analytics
- **Automation:** 100% automated daily data collection and weekly AI insights
- **Data Coverage:** Tracking 90%+ of videos with traffic source data
- **Response Time:** API responses under 500ms
- **Scalability:** Architecture handles unlimited channel growth with no code changes
