import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './VideoScorecard.css';

// A video is a Short if it is 3 minutes (180 seconds) or less; anything longer is Long-form.
const SHORT_MAX_SECONDS = 180;

function VideoScorecard({ videos, channelAvgDuration }) {
    const [shortsSortBy, setShortsSortBy] = useState('views'); // 'views', 'date'
    const [longformSortBy, setLongformSortBy] = useState('watchTime'); // 'watchTime', 'views', 'retention', 'evergreen', 'date'
    const [shortsPage, setShortsPage] = useState(1);
    const [longformPage, setLongformPage] = useState(1);
    const videosPerPage = 10;

    if (!videos || videos.length === 0) {
        return <div className="scorecard-container">No video data available</div>;
    }

    // Classify videos as Shorts vs Long-form using REAL video duration
    const classifiedVideos = videos.map(video => {
        let videoDuration = 0;

        if (video.durationSeconds) {
            videoDuration = video.durationSeconds;
        } else if (video.avgViewDuration && video.avgViewPercentage && video.avgViewPercentage > 0) {
            videoDuration = video.avgViewDuration / (video.avgViewPercentage / 100);
        }

        const videoType = videoDuration <= SHORT_MAX_SECONDS ? 'Short' : 'Long-form';

        return {
            ...video,
            videoType,
            videoDuration: Math.round(videoDuration)
        };
    });

    // Separate Shorts and Long-form
    const shorts = classifiedVideos.filter(v => v.videoType === 'Short');
    const longform = classifiedVideos.filter(v => v.videoType === 'Long-form');

    // Retention numbers: prefer LIFETIME values (the collector saves them for every video, even
    // ones with no views in the last 28 days). Fall back to the 28-day values for videos the
    // collector hasn't refreshed yet.
    const getRetention = (video) => {
        const duration = video.lifetimeAvgViewDuration > 0 ? video.lifetimeAvgViewDuration
            : (video.avgViewDuration > 0 ? video.avgViewDuration : null);
        const percent = video.lifetimeAvgViewPercentage > 0 ? video.lifetimeAvgViewPercentage
            : (video.avgViewPercentage > 0 ? video.avgViewPercentage : null);
        return { duration, percent };
    };

    const calculateMetrics = (videoList) => {
        const totalViews = videoList.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalWatchTime = videoList.reduce((sum, v) => sum + (v.watchTimeMinutes || 0), 0);
        const totalLikes = videoList.reduce((sum, v) => sum + (v.likes || 0), 0);
        // Average only over videos that have retention data, so missing data doesn't drag the average to zero
        const videosWithDuration = videoList.filter(v => getRetention(v).duration);
        const avgDuration = videosWithDuration.length > 0
            ? videosWithDuration.reduce((sum, v) => sum + getRetention(v).duration, 0) / videosWithDuration.length
            : 0;

        return {
            count: videoList.length,
            totalViews,
            totalWatchTime,
            totalLikes,
            avgDuration: Math.round(avgDuration),
            engagementRate: totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : 0
        };
    };

    const isNewVideo = (publishedDate) => {
        const hoursSincePublish = (Date.now() - new Date(publishedDate)) / (1000 * 60 * 60);
        return hoursSincePublish < 48;
    };

    const shortsMetrics = calculateMetrics(shorts);
    const longformMetrics = calculateMetrics(longform);

    // Format seconds as m:ss
    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Data for Shorts vs Long-form comparison chart
    const comparisonData = [
        {
            name: 'Total Views',
            Shorts: shortsMetrics.totalViews,
            LongForm: longformMetrics.totalViews
        },
        {
            name: 'Watch Time, last 28d (min)',
            Shorts: shortsMetrics.totalWatchTime,
            LongForm: longformMetrics.totalWatchTime
        },
        {
            name: 'Avg View Duration (sec)',
            Shorts: shortsMetrics.avgDuration,
            LongForm: longformMetrics.avgDuration
        },
        {
            name: 'Total Likes',
            Shorts: shortsMetrics.totalLikes,
            LongForm: longformMetrics.totalLikes
        }
    ];

    // Build insight string based on retention only
    // percent = % of the video viewers watched on average (over 100% means rewatches/loops)
    const buildInsight = (video) => {
        const { percent } = getRetention(video);
        if (percent) {
            const pct = Math.round(percent);
            return pct > 100
                ? `Viewers watched ${pct}% of this video on average (rewatches count)`
                : `Viewers watched ${pct}% of this video on average`;
        }
        return isNewVideo(video.publishedAt)
            ? 'Retention data pending (new video)'
            : 'No retention data available from YouTube';
    };

    // Process videos — add insight string
    const processedVideos = classifiedVideos.map(video => ({
        ...video,
        insight: buildInsight(video)
    }));

    // Separate and sort Shorts
    let sortedShorts = processedVideos.filter(v => v.videoType === 'Short');
    if (shortsSortBy === 'views') {
        sortedShorts.sort((a, b) => b.views - a.views);
    } else if (shortsSortBy === 'date') {
        sortedShorts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    // Separate and sort Long-form
    let sortedLongform = processedVideos.filter(v => v.videoType === 'Long-form');
    if (longformSortBy === 'watchTime') {
        sortedLongform.sort((a, b) => (b.watchTimeMinutes || 0) - (a.watchTimeMinutes || 0));
    } else if (longformSortBy === 'views') {
        sortedLongform.sort((a, b) => b.views - a.views);
    } else if (longformSortBy === 'retention') {
        sortedLongform.sort((a, b) => (getRetention(b).percent || 0) - (getRetention(a).percent || 0));
    } else if (longformSortBy === 'evergreen') {
        sortedLongform.sort((a, b) => (parseFloat(b.evergreenScore) || 0) - (parseFloat(a.evergreenScore) || 0));
    } else if (longformSortBy === 'date') {
        sortedLongform.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    // Pagination for Shorts
    const shortsTotalPages = Math.ceil(sortedShorts.length / videosPerPage);
    const shortsIndexOfLast = shortsPage * videosPerPage;
    const shortsIndexOfFirst = shortsIndexOfLast - videosPerPage;
    const currentShorts = sortedShorts.slice(shortsIndexOfFirst, shortsIndexOfLast);

    // Pagination for Long-form
    const longformTotalPages = Math.ceil(sortedLongform.length / videosPerPage);
    const longformIndexOfLast = longformPage * videosPerPage;
    const longformIndexOfFirst = longformIndexOfLast - videosPerPage;
    const currentLongform = sortedLongform.slice(longformIndexOfFirst, longformIndexOfLast);

    return (
        <div className="scorecard-container">
            <h2>Content Performance Scorecard</h2>

            {/* Content Strategy Overview */}
            <div className="strategy-overview">
                <div className="strategy-card">
                    <h4>Shorts ({shortsMetrics.count})</h4>
                    <p>{shortsMetrics.totalViews.toLocaleString()} lifetime views</p>
                    <p>{shortsMetrics.totalWatchTime.toLocaleString()} min watch time (last 28 days)</p>

                </div>
                <div className="strategy-card">
                    <h4>Long-form ({longformMetrics.count})</h4>
                    <p>{longformMetrics.totalViews.toLocaleString()} lifetime views</p>
                    <p>{longformMetrics.totalWatchTime.toLocaleString()} min watch time (last 28 days)</p>
                </div>
            </div>

            {/* Shorts vs Long-form Comparison Chart */}
            <div className="chart-section">
                <h3>Shorts vs Long-form Comparison</h3>
                <p className="chart-description">
                    Side-by-side totals across both content types. Shorts drive discovery; Long-form videos build the
                    watch hours needed for monetization (goal: 4,000 hours = 240,000 minutes).
                </p>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Shorts" fill="#1A7EF7" />
                        <Bar dataKey="LongForm" name="Long-form" fill="#F7931A" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Shorts Table */}
            <div className="video-table shorts-table">
                <div className="table-controls">
                    <h3>🎯 Shorts Performance (Discovery Funnel)</h3>
                    <div className="sort-controls">
                        <label htmlFor="shorts-sort-select">Sort by: </label>
                        <select
                            id="shorts-sort-select"
                            value={shortsSortBy}
                            onChange={(e) => {
                                setShortsSortBy(e.target.value);
                                setShortsPage(1);
                            }}
                        >
                            <option value="views">Most Views</option>
                            <option value="date">Recently Published</option>
                        </select>
                    </div>
                </div>

                {/* Column legend */}
                <p className="table-note">
                    📌 <strong>Lifetime Views</strong> = total views since upload &nbsp;|&nbsp;
                    <strong>Recent Views</strong> = last 28 days (what YouTube is actively pushing) &nbsp;|&nbsp;
                    <strong>Avg View Duration</strong> = how long viewers watched on average, lifetime &nbsp;|&nbsp;
                    <strong>Insight</strong> = % of the video's total length viewers watched (retention, lifetime)
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Lifetime Views</th>
                            <th>Recent Views (28d)</th>
                            <th>Avg View Duration</th>
                            <th>Insight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentShorts.map(video => (
                            <tr key={video.videoId}>
                                <td className="title-cell">{video.title}</td>
                                <td>{(video.views || 0).toLocaleString()}</td>
                                <td>
                                    {isNewVideo(video.publishedAt) && !video.recentViews ? (
                                        <span className="pending-data">Pending...</span>
                                    ) : (
                                        (video.recentViews || 0).toLocaleString()
                                    )}
                                </td>
                                <td>{formatDuration(getRetention(video).duration)}</td>
                                <td className="insights-cell">{video.insight}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Shorts Pagination */}
                {shortsTotalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => setShortsPage(prev => Math.max(prev - 1, 1))}
                            disabled={shortsPage === 1}
                            className="page-button"
                        >
                            Previous
                        </button>
                        {[...Array(shortsTotalPages)].map((_, index) => (
                            <button
                                key={index + 1}
                                onClick={() => setShortsPage(index + 1)}
                                className={`page-button ${shortsPage === index + 1 ? 'active' : ''}`}
                            >
                                {index + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setShortsPage(prev => Math.min(prev + 1, shortsTotalPages))}
                            disabled={shortsPage === shortsTotalPages}
                            className="page-button"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {/* Long-form Table */}
            <div className="video-table longform-table">
                <div className="table-controls">
                    <h3>🎸 Long-form Performance (Monetization Engine)</h3>
                    <div className="sort-controls">
                        <label htmlFor="longform-sort-select">Sort by: </label>
                        <select
                            id="longform-sort-select"
                            value={longformSortBy}
                            onChange={(e) => {
                                setLongformSortBy(e.target.value);
                                setLongformPage(1);
                            }}
                        >
                            <option value="watchTime">Most Watch Time</option>
                            <option value="views">Most Views</option>
                            <option value="retention">Best Retention</option>
                            <option value="evergreen">Highest Evergreen</option>
                            <option value="date">Recently Published</option>
                        </select>
                    </div>
                </div>

                {/* Column legend */}
                <p className="table-note">
                    📌 <strong>Lifetime Views</strong> = total views since upload &nbsp;|&nbsp;
                    <strong>Recent Views</strong> = last 28 days &nbsp;|&nbsp;
                    <strong>Watch Time</strong> = minutes watched in last 28 days (counts toward 4,000hr goal) &nbsp;|&nbsp;
                    <strong>Avg View Duration</strong> = how long viewers watched on average, lifetime &nbsp;|&nbsp;
                    <strong>Evergreen Score</strong> = % of total views that came after day 30 (higher = longer lasting content) &nbsp;|&nbsp;
                    <strong>Insight</strong> = % of the video's total length viewers watched (retention, lifetime)
                </p>

                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Lifetime Views</th>
                            <th>Recent Views (28d)</th>
                            <th>Watch Time (28d)</th>
                            <th>Avg View Duration</th>
                            <th>Evergreen Score</th>
                            <th>Insight</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentLongform.map(video => (
                            <tr key={video.videoId}>
                                <td className="title-cell">{video.title}</td>
                                <td>{(video.views || 0).toLocaleString()}</td>
                                <td>
                                    {isNewVideo(video.publishedAt) && !video.recentViews ? (
                                        <span className="pending-data">Pending...</span>
                                    ) : (
                                        (video.recentViews || 0).toLocaleString()
                                    )}
                                </td>
                                <td>
                                    {isNewVideo(video.publishedAt) && (video.watchTimeMinutes === 0 || !video.watchTimeMinutes) ? (
                                        <span className="pending-data">Pending...</span>
                                    ) : (
                                        `${(video.watchTimeMinutes || 0).toLocaleString()} min`
                                    )}
                                </td>
                                <td>{formatDuration(getRetention(video).duration)}</td>
                                <td>
                                    {video.evergreenScore !== undefined && video.evergreenScore !== null
                                        ? `${parseFloat(video.evergreenScore).toFixed(1)}%`
                                        : 'N/A'}
                                </td>
                                <td className="insights-cell">{video.insight}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Long-form Pagination */}
                {longformTotalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => setLongformPage(prev => Math.max(prev - 1, 1))}
                            disabled={longformPage === 1}
                            className="page-button"
                        >
                            Previous
                        </button>
                        {[...Array(longformTotalPages)].map((_, index) => (
                            <button
                                key={index + 1}
                                onClick={() => setLongformPage(index + 1)}
                                className={`page-button ${longformPage === index + 1 ? 'active' : ''}`}
                            >
                                {index + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setLongformPage(prev => Math.min(prev + 1, longformTotalPages))}
                            disabled={longformPage === longformTotalPages}
                            className="page-button"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default VideoScorecard;