import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './VideoScorecard.css';

function VideoScorecard({ videos, channelAvgDuration }) {
    const [sortBy, setSortBy] = useState('score'); // 'score', 'views', 'date'
    const [currentPage, setCurrentPage] = useState(1);
    const videosPerPage = 10;
    if (!videos || videos.length === 0) {
        return <div className="scorecard-container">No video data available</div>;
    }

    // Classify videos as Shorts vs Workouts using REAL video duration
    const classifiedVideos = videos.map(video => {
        // Use actual duration if available, otherwise fall back to estimation
        let videoDuration = 0;

        if (video.durationSeconds) {
            // Use real duration from YouTube API
            videoDuration = video.durationSeconds;
        } else if (video.avgViewDuration && video.avgViewPercentage && video.avgViewPercentage > 0) {
            // Fall back to estimation if duration not available
            videoDuration = video.avgViewDuration / (video.avgViewPercentage / 100);
        }

        // Classify: Under 2 minutes (120 seconds) = Short, over 2 minutes = Workout
        const videoType = videoDuration < 120 ? 'Short' : 'Workout';

        return {
            ...video,
            videoType,
            videoDuration: Math.round(videoDuration)
        };
    });

    // Calculate metrics by video type
    const shorts = classifiedVideos.filter(v => v.videoType === 'Short');
    const workouts = classifiedVideos.filter(v => v.videoType === 'Workout');

    const calculateMetrics = (videoList) => {
        const totalViews = videoList.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalWatchTime = videoList.reduce((sum, v) => sum + (v.watchTimeMinutes || 0), 0);
        const totalLikes = videoList.reduce((sum, v) => sum + (v.likes || 0), 0);
        const avgDuration = videoList.length > 0
            ? videoList.reduce((sum, v) => sum + (v.avgViewDuration || 0), 0) / videoList.length
            : 0;
        const watchTimePerView = totalViews > 0 ? (totalWatchTime * 60) / totalViews : 0;

        return {
            count: videoList.length,
            totalViews,
            totalWatchTime,
            totalLikes,
            avgDuration: Math.round(avgDuration),
            watchTimePerView: Math.round(watchTimePerView),
            engagementRate: totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(2) : 0
        };
    };

    const isNewVideo = (publishedDate) => {
        const hoursSincePublish = (Date.now() - new Date(publishedDate)) / (1000 * 60 * 60);
        return hoursSincePublish < 48;
    };

    const shortsMetrics = calculateMetrics(shorts);
    const workoutsMetrics = calculateMetrics(workouts);

    // Data for Shorts vs Workouts comparison chart
    const comparisonData = [
        {
            name: 'Total Views',
            Shorts: shortsMetrics.totalViews,
            Workouts: workoutsMetrics.totalViews
        },
        {
            name: 'Total Watch Time (min)',
            Shorts: shortsMetrics.totalWatchTime,
            Workouts: workoutsMetrics.totalWatchTime
        },
        {
            name: 'Avg Duration (sec)',
            Shorts: shortsMetrics.avgDuration,
            Workouts: workoutsMetrics.avgDuration
        },
        {
            name: 'Total Likes',
            Shorts: shortsMetrics.totalLikes,
            Workouts: workoutsMetrics.totalLikes
        }
    ];

    // Watch Time Efficiency data (seconds watched per view)
    // Filter to videos with at least 10 views for statistical significance
    const MIN_VIEWS_FOR_EFFICIENCY = 10;

    const efficiencyData = classifiedVideos
        .filter(video => video.views >= MIN_VIEWS_FOR_EFFICIENCY)
        .map(video => ({
            title: video.title.substring(0, 30) + '...',
            fullTitle: video.title,
            efficiency: video.views > 0 && video.watchTimeMinutes
                ? Math.round((video.watchTimeMinutes * 60) / video.views)
                : video.avgViewDuration || 0,
            type: video.videoType,
            views: video.views
        }))
        .sort((a, b) => b.efficiency - a.efficiency);

    // Original scoring logic
    const scoredVideos = classifiedVideos.map(video => {
        let score = 0;
        let scoreFactors = [];

        const viewScore = video.views ? Math.min((video.views / 100) * 30, 30) : 0;
        score += viewScore;

        const engagementRate = (video.views > 0 && video.likes) ? (video.likes / video.views) : 0;
        const engagementScore = engagementRate ? Math.min(engagementRate * 1000, 20) : 0;
        score += engagementScore;

        const watchScore = video.watchTimeMinutes ? Math.min((video.watchTimeMinutes / 50) * 25, 25) : 0;
        score += watchScore;

        if (video.avgViewDuration && channelAvgDuration && channelAvgDuration > 0) {
            const durationRatio = video.avgViewDuration / channelAvgDuration;
            const durationScore = durationRatio ? Math.min(durationRatio * 25, 25) : 0;
            score += durationScore;

            if (durationRatio > 1.2) {
                scoreFactors.push('High retention');
            } else if (durationRatio < 0.8) {
                scoreFactors.push('Low retention');
            }
        }

        if (video.avgViewPercentage && video.avgViewPercentage > 50) {
            scoreFactors.push('Great retention %');
        }
        if (video.views > 50) {
            scoreFactors.push('Good reach');
        }
        if (engagementRate > 0.02) {
            scoreFactors.push('High engagement');
        }

        const finalScore = isNaN(score) ? 0 : Math.round(score);

        return {
            ...video,
            score: finalScore,
            scoreFactors,
            engagementRate: engagementRate ? (engagementRate * 100).toFixed(2) : '0.00'
        };
    });

    // Get top performer by score (before any sorting)
    const topVideo = [...scoredVideos].sort((a, b) => b.score - a.score)[0];

    // Sort based on selected option
    if (sortBy === 'score') {
        scoredVideos.sort((a, b) => b.score - a.score);
    } else if (sortBy === 'views') {
        scoredVideos.sort((a, b) => b.views - a.views);
    } else if (sortBy === 'date') {
        scoredVideos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    // Pagination
    const indexOfLastVideo = currentPage * videosPerPage;
    const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
    const currentVideos = scoredVideos.slice(indexOfFirstVideo, indexOfLastVideo);
    const totalPages = Math.ceil(scoredVideos.length / videosPerPage);

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="scorecard-container">
            <h2>Content Performance Scorecard</h2>

            {/* Content Strategy Overview */}
            <div className="strategy-overview">
                <div className="strategy-card">
                    <h4>Shorts ({shortsMetrics.count})</h4>
                    <p>{shortsMetrics.totalViews} views</p>
                    <p>{shortsMetrics.totalWatchTime} min watch time</p>
                    <p className="efficiency-stat">{shortsMetrics.watchTimePerView}s per view</p>
                </div>
                <div className="strategy-card">
                    <h4>Workouts ({workoutsMetrics.count})</h4>
                    <p>{workoutsMetrics.totalViews} views</p>
                    <p>{workoutsMetrics.totalWatchTime} min watch time</p>
                    <p className="efficiency-stat">{workoutsMetrics.watchTimePerView}s per view</p>
                </div>
            </div>

            {/* Shorts vs Workouts Comparison Chart */}
            <div className="chart-section">
                <h3>Shorts vs Workouts Comparison</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Shorts" fill="#1A7EF7" />
                        <Bar dataKey="Workouts" fill="#F7931A" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Watch Time Efficiency Chart */}
            <div className="chart-section">
                <h3>Watch Time Efficiency (Seconds per View)</h3>
                <p className="chart-description">
                    Videos with 10+ views only • Higher is better - shows which videos keep viewers watching longest
                </p>
                {efficiencyData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={efficiencyData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="title" type="category" width={150} />
                            <Tooltip content={({ payload }) => {
                                if (payload && payload[0]) {
                                    return (
                                        <div className="custom-tooltip">
                                            <p className="tooltip-title">{payload[0].payload.fullTitle}</p>
                                            <p className="tooltip-value">{payload[0].value} seconds/view</p>
                                            <p className="tooltip-type">Type: {payload[0].payload.type}</p>
                                            <p className="tooltip-type">Views: {payload[0].payload.views}</p>
                                        </div>
                                    );
                                }
                                return null;
                            }} />
                            <Bar dataKey="efficiency" fill="#1A7EF7" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="no-data-message">No videos with 10+ views yet. Keep publishing and check back soon!</p>
                )}
            </div>

            {/* Top Performer */}
            {topVideo && (
                <div className="top-performer">
                    <h3>🏆 Top Performer</h3>
                    <p className="video-title">{topVideo.title}</p>
                    <div className="top-stats">
                        <span>Score: {topVideo.score}/100</span>
                        <span>{topVideo.views} views</span>
                        <span>{formatDuration(topVideo.avgViewDuration)} avg duration</span>
                        <span>Type: {topVideo.videoType}</span>
                    </div>
                </div>
            )}

            {/* Video Performance Table */}
            <div className="video-table">
                <div className="table-controls">
                    <h3>All Videos</h3>
                    <div className="sort-controls">
                        <label htmlFor="sort-select">Sort by: </label>
                        <select
                            id="sort-select"
                            value={sortBy}
                            onChange={(e) => {
                                setSortBy(e.target.value);
                                setCurrentPage(1); // Reset to page 1 when sorting changes
                            }}
                        >
                            <option value="score">Top Performing (Score)</option>
                            <option value="views">Most Views</option>
                            <option value="date">Recently Published</option>
                        </select>
                    </div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Video Length</th>
                            <th>Score</th>
                            <th>Views</th>
                            <th>Watch Time</th>
                            <th>Avg Duration</th>
                            <th>Efficiency</th>
                            <th>Insights</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentVideos.map(video => {
                            const efficiency = video.views > 0 && video.watchTimeMinutes
                                ? Math.round((video.watchTimeMinutes * 60) / video.views)
                                : video.avgViewDuration || 0;

                            return (
                                <tr key={video.videoId} className={video.score > 70 ? 'high-score' : video.score > 40 ? 'medium-score' : 'low-score'}>
                                    <td className="title-cell">{video.title}</td>
                                    <td className="type-badge">
                                        <span className={`badge-${video.videoType.toLowerCase()}`}>{video.videoType}</span>
                                    </td>
                                    <td>{formatDuration(video.videoDuration)}</td>
                                    <td className="score-cell">
                                        <div className="score-badge">{video.score}</div>
                                    </td>
                                    <td>{video.views}</td>
                                    <td>
                                        {isNewVideo(video.publishedAt) && (video.watchTimeMinutes === 0 || !video.watchTimeMinutes) ? (
                                            <span className="pending-data">Pending...</span>
                                        ) : (
                                            <span>{video.watchTimeMinutes || 0} min</span>
                                        )}
                                    </td>
                                    <td>{formatDuration(video.avgViewDuration)}</td>
                                    <td>{efficiency}s</td>
                                    <td className="insights-cell">
                                        {video.scoreFactors.length > 0 ? video.scoreFactors.join(', ') : 'Building data...'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {totalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="page-button"
                        >
                            Previous
                        </button>

                        <span className="page-info">
                            Page {currentPage} of {totalPages}
                        </span>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
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