import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './VideoScorecard.css';

function VideoScorecard({ videos, channelAvgDuration }) {
    const [shortsSortBy, setShortsSortBy] = useState('views'); // 'views', 'date'
    const [workoutsSortBy, setWorkoutsSortBy] = useState('watchTime'); // 'watchTime', 'views', 'retention', 'evergreen', 'date'
    const [shortsPage, setShortsPage] = useState(1);
    const [workoutsPage, setWorkoutsPage] = useState(1);
    const videosPerPage = 10;

    if (!videos || videos.length === 0) {
        return <div className="scorecard-container">No video data available</div>;
    }

    // Classify videos as Shorts vs Workouts using REAL video duration
    const classifiedVideos = videos.map(video => {
        let videoDuration = 0;

        if (video.durationSeconds) {
            videoDuration = video.durationSeconds;
        } else if (video.avgViewDuration && video.avgViewPercentage && video.avgViewPercentage > 0) {
            videoDuration = video.avgViewDuration / (video.avgViewPercentage / 100);
        }

        const videoType = videoDuration < 180 ? 'Short' : 'Workout';

        return {
            ...video,
            videoType,
            videoDuration: Math.round(videoDuration)
        };
    });

    // Separate Shorts and Workouts
    const shorts = classifiedVideos.filter(v => v.videoType === 'Short');
    const workouts = classifiedVideos.filter(v => v.videoType === 'Workout');

    const calculateMetrics = (videoList) => {
        const totalViews = videoList.reduce((sum, v) => sum + (v.views || 0), 0);
        const totalWatchTime = videoList.reduce((sum, v) => sum + (v.watchTimeMinutes || 0), 0);
        const totalLikes = videoList.reduce((sum, v) => sum + (v.likes || 0), 0);
        const avgDuration = videoList.length > 0
            ? videoList.reduce((sum, v) => sum + (v.avgViewDuration || 0), 0) / videoList.length
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
    const workoutsMetrics = calculateMetrics(workouts);

    // Format seconds as m:ss
    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

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

    // Build insight string based on retention only
    // avgViewPercentage = % of the video viewers watched on average
    const buildInsight = (video) => {
        if (video.avgViewPercentage) {
            const pct = Math.round(video.avgViewPercentage);
            return `Viewers watched ${pct}% of this video on average`;
        }
        return 'Retention data building...';
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

    // Separate and sort Workouts
    let sortedWorkouts = processedVideos.filter(v => v.videoType === 'Workout');
    if (workoutsSortBy === 'watchTime') {
        sortedWorkouts.sort((a, b) => (b.watchTimeMinutes || 0) - (a.watchTimeMinutes || 0));
    } else if (workoutsSortBy === 'views') {
        sortedWorkouts.sort((a, b) => b.views - a.views);
    } else if (workoutsSortBy === 'retention') {
        sortedWorkouts.sort((a, b) => (b.avgViewPercentage || 0) - (a.avgViewPercentage || 0));
    } else if (workoutsSortBy === 'evergreen') {
        sortedWorkouts.sort((a, b) => (parseFloat(b.evergreenScore) || 0) - (parseFloat(a.evergreenScore) || 0));
    } else if (workoutsSortBy === 'date') {
        sortedWorkouts.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    }

    // Pagination for Shorts
    const shortsTotalPages = Math.ceil(sortedShorts.length / videosPerPage);
    const shortsIndexOfLast = shortsPage * videosPerPage;
    const shortsIndexOfFirst = shortsIndexOfLast - videosPerPage;
    const currentShorts = sortedShorts.slice(shortsIndexOfFirst, shortsIndexOfLast);

    // Pagination for Workouts
    const workoutsTotalPages = Math.ceil(sortedWorkouts.length / videosPerPage);
    const workoutsIndexOfLast = workoutsPage * videosPerPage;
    const workoutsIndexOfFirst = workoutsIndexOfLast - videosPerPage;
    const currentWorkouts = sortedWorkouts.slice(workoutsIndexOfFirst, workoutsIndexOfLast);

    return (
        <div className="scorecard-container">
            <h2>Content Performance Scorecard</h2>

            {/* Content Strategy Overview */}
            <div className="strategy-overview">
                <div className="strategy-card">
                    <h4>Shorts ({shortsMetrics.count})</h4>
                    <p>{shortsMetrics.totalViews.toLocaleString()} lifetime views</p>
                    <p>{shortsMetrics.totalWatchTime.toLocaleString()} min watch time</p>

                </div>
                <div className="strategy-card">
                    <h4>Workouts ({workoutsMetrics.count})</h4>
                    <p>{workoutsMetrics.totalViews.toLocaleString()} lifetime views</p>
                    <p>{workoutsMetrics.totalWatchTime.toLocaleString()} min watch time</p>
                </div>
            </div>

            {/* Shorts vs Workouts Comparison Chart */}
            <div className="chart-section">
                <h3>Shorts vs Workouts Comparison</h3>
                <p className="chart-description">
                    Side-by-side totals across both content types. Shorts drive discovery; Workouts build the
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
                        <Bar dataKey="Workouts" fill="#F7931A" />
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
                    <strong>Avg View Duration</strong> = how long viewers watched on average &nbsp;|&nbsp;
                    <strong>Insight</strong> = % of the video's total length viewers watched (retention)
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
                                <td>{formatDuration(video.avgViewDuration)}</td>
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

            {/* Workouts Table */}
            <div className="video-table workouts-table">
                <div className="table-controls">
                    <h3>🎸 Workout Performance (Monetization Engine)</h3>
                    <div className="sort-controls">
                        <label htmlFor="workouts-sort-select">Sort by: </label>
                        <select
                            id="workouts-sort-select"
                            value={workoutsSortBy}
                            onChange={(e) => {
                                setWorkoutsSortBy(e.target.value);
                                setWorkoutsPage(1);
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
                    <strong>Evergreen Score</strong> = % of total views that came after day 30 (higher = longer lasting content) &nbsp;|&nbsp;
                    <strong>Insight</strong> = % of the video's total length viewers watched (retention)
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
                        {currentWorkouts.map(video => (
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
                                <td>{formatDuration(video.avgViewDuration)}</td>
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

                {/* Workouts Pagination */}
                {workoutsTotalPages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => setWorkoutsPage(prev => Math.max(prev - 1, 1))}
                            disabled={workoutsPage === 1}
                            className="page-button"
                        >
                            Previous
                        </button>
                        {[...Array(workoutsTotalPages)].map((_, index) => (
                            <button
                                key={index + 1}
                                onClick={() => setWorkoutsPage(index + 1)}
                                className={`page-button ${workoutsPage === index + 1 ? 'active' : ''}`}
                            >
                                {index + 1}
                            </button>
                        ))}
                        <button
                            onClick={() => setWorkoutsPage(prev => Math.min(prev + 1, workoutsTotalPages))}
                            disabled={workoutsPage === workoutsTotalPages}
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