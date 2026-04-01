import React, { useState } from 'react';
import './ContentLongevity.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const ContentLongevity = ({ videos }) => {
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const videosPerPage = 5;

    // Filter videos that have evergreen scores (30+ days old)
    // Show ALL videos with scores, including 0% - we want to see the full picture
    const evergreenVideos = videos.filter(v =>
        v.evergreenScore !== undefined &&
        v.evergreenScore !== null
    );

    // Separate by content type
    const shorts = evergreenVideos.filter(v => v.durationSeconds < 180);
    const workouts = evergreenVideos.filter(v => v.durationSeconds >= 180);

    // Helper function to categorize evergreen scores
    const categorizeScore = (score) => {
        const numScore = parseFloat(score);
        if (numScore >= 20) return { label: '🔥 Strong', color: '#2ecc71', category: 'strong' };
        if (numScore >= 5) return { label: '✅ Moderate', color: '#3498db', category: 'moderate' };
        if (numScore >= 1) return { label: '⚠️ Low', color: '#f39c12', category: 'low' };
        return { label: '❌ None', color: '#e74c3c', category: 'none' };
    };

    // Calculate averages
    const avgShortScore = shorts.length > 0
        ? (shorts.reduce((sum, v) => sum + parseFloat(v.evergreenScore), 0) / shorts.length).toFixed(1)
        : 0;

    const avgWorkoutScore = workouts.length > 0
        ? (workouts.reduce((sum, v) => sum + parseFloat(v.evergreenScore), 0) / workouts.length).toFixed(1)
        : 0;

    // Count videos by category
    const categoryBreakdown = {
        strong: evergreenVideos.filter(v => parseFloat(v.evergreenScore) >= 20).length,
        moderate: evergreenVideos.filter(v => parseFloat(v.evergreenScore) >= 5 && parseFloat(v.evergreenScore) < 20).length,
        low: evergreenVideos.filter(v => parseFloat(v.evergreenScore) >= 1 && parseFloat(v.evergreenScore) < 5).length,
        none: evergreenVideos.filter(v => parseFloat(v.evergreenScore) < 1).length
    };

    // Prepare chart data - all evergreen videos sorted
    const allEvergreenChartData = evergreenVideos
        .sort((a, b) => parseFloat(b.evergreenScore) - parseFloat(a.evergreenScore))
        .map(v => {
            const category = categorizeScore(v.evergreenScore);
            return {
                title: v.title.length > 30 ? v.title.substring(0, 30) + '...' : v.title,
                score: parseFloat(v.evergreenScore),
                type: v.durationSeconds < 180 ? 'Short' : 'Workout',
                views: v.views,
                categoryLabel: category.label,
                color: category.color
            };
        });

    // Calculate pagination
    const totalPages = Math.ceil(allEvergreenChartData.length / videosPerPage);
    const indexOfLastVideo = currentPage * videosPerPage;
    const indexOfFirstVideo = indexOfLastVideo - videosPerPage;
    const chartData = allEvergreenChartData.slice(indexOfFirstVideo, indexOfLastVideo);

    // Comparison data
    const comparisonData = [
        { type: 'Shorts', avgScore: parseFloat(avgShortScore), count: shorts.length },
        { type: 'Workouts', avgScore: parseFloat(avgWorkoutScore), count: workouts.length }
    ];

    if (evergreenVideos.length === 0) {
        return (
            <div className="longevity-section">
                <h2 style={{ textAlign: 'center' }}>Content Longevity & Evergreen Scores</h2>
                <div className="longevity-pending">
                    <p>📊 <strong>Evergreen tracking is active!</strong></p>
                    <p>Data will appear once your videos reach 30 days old. The system is capturing view milestones at day 7 and day 30 to calculate which content has lasting appeal beyond the initial viral window.</p>
                    <p className="longevity-explanation">
                        <strong>What you'll see when data arrives:</strong> Videos will be categorized as 🔥 Strong (20%+), ✅ Moderate (5-20%), ⚠️ Low (1-5%), or ❌ None (0-1%).
                        For guitar lessons, <strong>Shorts should show 0-5%</strong> (normal - they're viral content), but <strong>Workouts should aim for 10-30%+</strong>
                        (searchable lessons that YouTube recommends long-term). If your lessons show 0-5%, that's a signal to improve SEO and content quality.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="longevity-section">
            <h2 style={{ textAlign: 'center' }}>Content Longevity & Evergreen Scores</h2>
            <p className="longevity-subtitle">
                Tracking which videos continue generating views beyond their first 30 days
            </p>

            {/* Summary Cards */}
            <div className="longevity-summary">
                <div className="longevity-card">
                    <h3>Videos Tracked</h3>
                    <p className="stat-number">{evergreenVideos.length}</p>
                    <p className="stat-subtext">30+ days old</p>
                </div>

                <div className="longevity-card highlight">
                    <h3>🔥 Strong Evergreen</h3>
                    <p className="stat-number">{categoryBreakdown.strong}</p>
                    <p className="stat-subtext">20%+ staying power</p>
                </div>

                <div className="longevity-card highlight">
                    <h3>✅ Moderate</h3>
                    <p className="stat-number">{categoryBreakdown.moderate}</p>
                    <p className="stat-subtext">5-20% staying power</p>
                </div>

                <div className="longevity-card">
                    <h3>⚠️ Low / ❌ None</h3>
                    <p className="stat-number">{categoryBreakdown.low + categoryBreakdown.none}</p>
                    <p className="stat-subtext">Under 5%</p>
                </div>
            </div>

            {/* Charts */}
            <div className="longevity-charts">
                {/* What This Means Box */}
                <div className="evergreen-explainer">
                    <h4>📊 What "Evergreen Score" Means</h4>
                    <p><strong>Formula:</strong> (Current Views - Views at Day 30) ÷ Current Views × 100</p>
                    <p><strong>Translation:</strong> The percentage of a video's total views that came <em>after</em> the first 30 days.</p>
                    <p><strong>Example:</strong> A video with 6% evergreen score got 94% of its views in the first month, then only 6% after that.</p>
                    <p style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                        <strong>Your targets:</strong> Shorts = 0-5% (normal), Workouts = 10-30%+ (goal)
                    </p>
                </div>

                {/* Top Evergreen Videos */}
                <div className="chart-container full-width">
                    <h3>All Videos Ranked by Evergreen Score</h3>
                    <p className="chart-description">
                        🔥 Strong (20%+) | ✅ Moderate (5-20%) | ⚠️ Low (1-5%) | ❌ None (0-1%) — Page {currentPage} of {totalPages}
                    </p>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" label={{ value: 'Evergreen Score (%)', position: 'bottom' }} />
                            <YAxis dataKey="title" type="category" width={200} tick={{ fontSize: 11 }} />
                            <Tooltip
                                formatter={(value, name, props) => {
                                    if (name === 'score') return [`${value.toFixed(1)}%`, 'Evergreen Score'];
                                    return [value, name];
                                }}
                                labelFormatter={(label, payload) => {
                                    if (payload && payload[0]) {
                                        return `${payload[0].payload.categoryLabel} - ${payload[0].payload.type}: ${label}`;
                                    }
                                    return label;
                                }}
                            />
                            <Bar dataKey="score" name="Evergreen Score">
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="pagination-btn"
                            >
                                Previous
                            </button>
                            {[...Array(totalPages)].map((_, index) => (
                                <button
                                    key={index + 1}
                                    onClick={() => setCurrentPage(index + 1)}
                                    className={`pagination-btn ${currentPage === index + 1 ? 'active' : ''}`}
                                >
                                    {index + 1}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="pagination-btn"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Explanation */}
            <div className="longevity-explanation">
                <h3>📈 Understanding Evergreen Scores for Your Channel</h3>

                <p>
                    <strong>What it measures:</strong> The percentage of total views that came <em>after</em> the first 30 days.
                    Only videos 30+ days old have scores.
                </p>

                <p>
                    <strong>Score Categories:</strong>
                </p>
                <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                    <li>🔥 <strong>Strong (20%+):</strong> Exceptional evergreen content - these videos continue getting discovered months later</li>
                    <li>✅ <strong>Moderate (5-20%):</strong> Decent long-term performance - steady trickle of views</li>
                    <li>⚠️ <strong>Low (1-5%):</strong> Minimal staying power - most views came in first month</li>
                    <li>❌ <strong>None (0-1%):</strong> No longevity - viral burst then died</li>
                </ul>

                <p>
                    <strong>What's NORMAL for guitar lessons:</strong>
                </p>
                <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
                    <li><strong>Shorts:</strong> Expected to show 0-5% evergreen. They're designed for viral bursts, not long-term discovery. Don't worry if Shorts are red/orange.</li>
                    <li><strong>Workouts (guitar lessons):</strong> Should aim for 10-30%+ evergreen if optimized for search. If your lessons are showing 0-5%, it means YouTube isn't recommending them after the first month - that's a RED FLAG to improve titles, descriptions, or content quality.</li>
                </ul>

                <p className="longevity-insight">
                    {workouts.length > 0 && avgWorkoutScore < 10 ? (
                        <span>⚠️ <strong>Action Needed:</strong> Your workout videos average {avgWorkoutScore}% evergreen - below the 10-30% target for guitar lessons. This suggests they're not being found in search or suggested videos long-term. Consider: (1) More searchable titles with specific techniques/songs, (2) Better descriptions with timestamps and keywords, (3) Stronger hooks in first 30 seconds to boost retention.</span>
                    ) : workouts.length > 0 && avgWorkoutScore >= 20 ? (
                        <span>🔥 <strong>You're crushing it!</strong> Your workout videos average {avgWorkoutScore}% evergreen - well above the 10-30% target. YouTube is actively recommending your lessons months after upload. Double down on whatever topics/formats these winning videos use!</span>
                    ) : workouts.length > 0 ? (
                        <span>✅ <strong>On track:</strong> Your workout videos average {avgWorkoutScore}% evergreen - within the healthy 10-30% range for guitar lessons. Keep optimizing titles and descriptions to push this higher.</span>
                    ) : (
                        <span>⏳ <strong>Not enough data yet:</strong> Need more workout videos to reach 30 days old before meaningful patterns emerge. Keep publishing and check back in 2-4 weeks.</span>
                    )}
                </p>
            </div>
        </div>
    );
};

export default ContentLongevity;