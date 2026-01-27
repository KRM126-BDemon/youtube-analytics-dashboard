import React from 'react';
import './ContentLongevity.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const ContentLongevity = ({ videos }) => {
    // Filter videos that have evergreen scores (30+ days old)
    const evergreenVideos = videos.filter(v => v.evergreenScore !== undefined && v.evergreenScore !== null);

    // Separate by content type
    const shorts = evergreenVideos.filter(v => v.durationSeconds < 120);
    const workouts = evergreenVideos.filter(v => v.durationSeconds >= 120);

    // Calculate averages
    const avgShortScore = shorts.length > 0
        ? (shorts.reduce((sum, v) => sum + parseFloat(v.evergreenScore), 0) / shorts.length).toFixed(1)
        : 0;

    const avgWorkoutScore = workouts.length > 0
        ? (workouts.reduce((sum, v) => sum + parseFloat(v.evergreenScore), 0) / workouts.length).toFixed(1)
        : 0;

    // Prepare chart data - top 10 evergreen videos
    const chartData = evergreenVideos
        .sort((a, b) => parseFloat(b.evergreenScore) - parseFloat(a.evergreenScore))
        .slice(0, 10)
        .map(v => ({
            title: v.title.length > 30 ? v.title.substring(0, 30) + '...' : v.title,
            score: parseFloat(v.evergreenScore),
            type: v.durationSeconds < 120 ? 'Short' : 'Workout',
            views: v.views
        }));

    // Comparison data
    const comparisonData = [
        { type: 'Shorts', avgScore: parseFloat(avgShortScore), count: shorts.length },
        { type: 'Workouts', avgScore: parseFloat(avgWorkoutScore), count: workouts.length }
    ];

    if (evergreenVideos.length === 0) {
        return (
            <div className="longevity-section">
                <h2>Content Longevity Analysis</h2>
                <div className="longevity-pending">
                    <p>📊 <strong>Evergreen tracking is active!</strong></p>
                    <p>Data will appear once your videos reach 30 days old. The system is capturing view milestones at day 7 and day 30 to calculate which content has lasting appeal.</p>
                    <p className="longevity-explanation">
                        <strong>What this will show: Videos with high evergreen scores continue attracting views long after publication,
                            indicating valuable, searchable content that compounds over time. This helps identify which topics and formats
                            have the most long-term growth potential. </strong>
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="longevity-section">
            <h2>Content Longevity Analysis</h2>
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
                    <h3>Shorts Evergreen</h3>
                    <p className="stat-number">{avgShortScore}%</p>
                    <p className="stat-subtext">{shorts.length} videos analyzed</p>
                </div>

                <div className="longevity-card highlight">
                    <h3>Workouts Evergreen</h3>
                    <p className="stat-number">{avgWorkoutScore}%</p>
                    <p className="stat-subtext">{workouts.length} videos analyzed</p>
                </div>
            </div>

            {/* Charts */}
            <div className="longevity-charts">
                {/* Top Evergreen Videos */}
                <div className="chart-container">
                    <h3>Top Evergreen Videos</h3>
                    <p className="chart-description">
                        Videos with the highest percentage of views coming after day 30
                    </p>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" label={{ value: 'Evergreen Score (%)', position: 'bottom' }} />
                            <YAxis dataKey="title" type="category" width={150} />
                            <Tooltip
                                formatter={(value, name, props) => {
                                    if (name === 'score') return [`${value}%`, 'Evergreen Score'];
                                    return [value, name];
                                }}
                                labelFormatter={(label) => `Video: ${label}`}
                            />
                            <Bar dataKey="score" name="Evergreen Score">
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.type === 'Short' ? '#8884d8' : '#82ca9d'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Shorts vs Workouts Comparison */}
                {shorts.length > 0 && workouts.length > 0 && (
                    <div className="chart-container">
                        <h3>Content Type Comparison</h3>
                        <p className="chart-description">
                            Average evergreen performance by content format
                        </p>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={comparisonData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="type" />
                                <YAxis label={{ value: 'Avg Evergreen Score (%)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip
                                    formatter={(value) => `${value}%`}
                                    labelFormatter={(label) => `${label}`}
                                />
                                <Legend />
                                <Bar dataKey="avgScore" name="Evergreen Score" fill="#8884d8" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Explanation */}
            <div className="longevity-explanation">
                <h3>📈 Understanding Evergreen Scores</h3>
                <p>
                    <strong>What it measures:</strong> The percentage of total views that came <em>after</em> the first 30 days.
                    Higher scores indicate content that continues attracting new viewers long after publication.
                </p>
                <p>
                    <strong>Why it matters:</strong> Evergreen content compounds over time, providing sustained growth without constant
                    new uploads. Videos with 40%+ evergreen scores are exceptional performers that should inform your content strategy.
                </p>
                <p>
                    <strong>How it's calculated:</strong> (Current Views - Views at Day 30) ÷ Current Views × 100
                </p>
                <p className="longevity-insight">
                    {avgWorkoutScore > avgShortScore && workouts.length > 0 ? (
                        <span>💡 <strong>Insight:</strong> Your workout videos ({avgWorkoutScore}% avg) show stronger evergreen performance
                            than Shorts ({avgShortScore}% avg), suggesting long-form guitar lessons have better long-term discovery potential.</span>
                    ) : avgShortScore > avgWorkoutScore && shorts.length > 0 ? (
                        <span>💡 <strong>Insight:</strong> Your Shorts ({avgShortScore}% avg) show stronger evergreen performance
                            than workouts ({avgWorkoutScore}% avg), suggesting bite-sized content continues attracting viewers over time.</span>
                    ) : (
                        <span>💡 <strong>Insight:</strong> Both content formats show similar evergreen performance. Continue monitoring
                            as more data accumulates to identify clear patterns.</span>
                    )}
                </p>
            </div>
        </div>
    );
};

export default ContentLongevity;