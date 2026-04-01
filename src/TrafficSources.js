import React from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './TrafficSources.css';

function TrafficSources({ videos }) {
    if (!videos || videos.length === 0) {
        return null;
    }

    // Filter videos that have traffic source data
    const videosWithTraffic = videos.filter(v => v.trafficSources && Object.keys(v.trafficSources).length > 0);

    if (videosWithTraffic.length === 0) {
        return (
            <div className="traffic-sources-section">
                <h2>Traffic Source Analysis</h2>
                <div className="pending-box">
                    <p className="pending-title">⏳ Traffic Data Collection Active</p>
                    <p className="pending-description">
                        Traffic source tracking is now running! Check back tomorrow to see where your views are coming from.
                        This will help you understand if Shorts are driving traffic to your Workouts.
                    </p>
                </div>
            </div>
        );
    }

    // Separate Shorts and Workouts (with and without traffic data)
    const allShorts = videos.filter(v => v.durationSeconds < 180);
    const allWorkouts = videos.filter(v => v.durationSeconds >= 180);

    const shorts = videosWithTraffic.filter(v => v.durationSeconds < 180);
    const workouts = videosWithTraffic.filter(v => v.durationSeconds >= 180);

    // Calculate coverage percentages
    const shortsCoverage = allShorts.length > 0 ? ((shorts.length / allShorts.length) * 100).toFixed(0) : 0;
    const workoutsCoverage = allWorkouts.length > 0 ? ((workouts.length / allWorkouts.length) * 100).toFixed(0) : 0;

    // Aggregate traffic sources for Shorts
    const shortsTraffic = {};
    shorts.forEach(video => {
        Object.entries(video.trafficSources).forEach(([source, views]) => {
            shortsTraffic[source] = (shortsTraffic[source] || 0) + views;
        });
    });

    // Aggregate traffic sources for Workouts
    const workoutsTraffic = {};
    workouts.forEach(video => {
        Object.entries(video.trafficSources).forEach(([source, views]) => {
            workoutsTraffic[source] = (workoutsTraffic[source] || 0) + views;
        });
    });

    // Format traffic source names
    const formatSourceName = (source) => {
        const nameMap = {
            'ADVERTISING': 'Ads',
            'ANNOTATION': 'Annotations',
            'CAMPAIGN_CARD': 'Campaign Card',
            'END_SCREEN': 'End Screen',
            'EXT_URL': 'External Links',
            'HASHTAGS': 'Hashtags',
            'NOTIFICATION': 'Notifications',
            'PLAYLIST': 'Playlists',
            'PRODUCT_PAGE': 'Product Page',
            'PROMOTED': 'Promoted',
            'RELATED_VIDEO': 'Suggested Videos',
            'SUBSCRIBER': 'Subscribers',
            'YT_CHANNEL': 'Channel Page',
            'YT_OTHER_PAGE': 'Other YT Page',
            'YT_SEARCH': 'YouTube Search',
            'NO_LINK_EMBEDDED': 'Embedded',
            'NO_LINK_OTHER': 'Direct/Unknown',
            'BROWSE': 'Browse Features',
            'SUGGESTED_VIDEO': 'Suggested Videos',
            'YT_PLAYLIST_PAGE': 'Playlist Page',
            'SHORTS': 'Shorts Feed'
        };
        return nameMap[source] || source.replace(/_/g, ' ');
    };

    // Convert to chart data format
    const shortsChartData = Object.entries(shortsTraffic)
        .map(([source, views]) => ({
            source: formatSourceName(source),
            views: views
        }))
        .sort((a, b) => b.views - a.views);

    const workoutsChartData = Object.entries(workoutsTraffic)
        .map(([source, views]) => ({
            source: formatSourceName(source),
            views: views
        }))
        .sort((a, b) => b.views - a.views);

    // Colors for pie charts
    const COLORS = [
        '#1A7EF7',  // Bright Blue (your brand)
        '#F7931A',  // Orange (your brand)
        '#e74c3c',  // Red
        '#9b59b6',  // Purple
        '#f1c40f',  // Yellow
        '#1abc9c',  // Turquoise/Teal
        '#34495e',  // Dark Gray/Charcoal
        '#00bcd4',  // Cyan/Light Blue
        '#795548',  // Brown
        '#2ecc71',  // Green
        '#e67e22',  // Darker Orange
        '#FFC0CB',  // Pink
        '#c0392b',  // Darker Red
        '#16a085',  // Darker Teal
        '#8e44ad'   // Darker Purple
    ];

    // Calculate total views for percentages
    const shortsTotal = shortsChartData.reduce((sum, item) => sum + item.views, 0);
    const workoutsTotal = workoutsChartData.reduce((sum, item) => sum + item.views, 0);

    // Custom label for pie chart
    const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        if (percent < 0.05) return null; // Don't show labels for slices < 5%
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * Math.PI / 180);
        const y = cy + radius * Math.sin(-midAngle * Math.PI / 180);
        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12" fontWeight="bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <div className="traffic-sources-section">
            <h2>Traffic Source Analysis: Shorts vs Workouts</h2>
            <p className="chart-description">
                Shows where your lifetime views come from (all-time data since publication). <strong>Shorts</strong> should get high "Shorts Feed" (the dedicated Shorts discovery feed).
                <strong> Workouts</strong> should get high "Suggested Videos" (your funnel working). This tells you if your
                Shorts strategy is driving traffic to Workouts.
            </p>

            {/* Pie Charts */}
            <div className="traffic-charts-grid">
                <div className="traffic-chart-container">
                    <h3>Shorts: Traffic Sources</h3>
                    {shortsChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={shortsChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomLabel}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="views"
                                    nameKey="source"
                                >
                                    {shortsChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => value.toLocaleString()} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="no-data">No traffic data available for Shorts yet</p>
                    )}
                </div>

                <div className="traffic-chart-container">
                    <h3>Workouts: Traffic Sources</h3>
                    {workoutsChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={workoutsChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={renderCustomLabel}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="views"
                                    nameKey="source"
                                >
                                    {workoutsChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => value.toLocaleString()} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="no-data">No traffic data available for Workouts yet</p>
                    )}
                </div>
            </div>

            {/* Bar Chart Comparison */}
            <div className="traffic-comparison">
                <h3>Side-by-Side Comparison</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                        data={prepareComparisonData(shortsTraffic, workoutsTraffic, formatSourceName).filter(item =>
                            item.source !== 'Shorts Feed' && item.source !== 'Ads'
                        )}
                        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="source" angle={-45} textAnchor="end" height={100} />
                        <YAxis label={{ value: 'Views', angle: -90, position: 'insideLeft' }} />
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                        <Legend verticalAlign="top" height={36} />
                        <Bar dataKey="shorts" fill="#1A7EF7" name="Shorts" />
                        <Bar dataKey="workouts" fill="#F7931A" name="Workouts" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Insights Box */}
            {workoutsChartData.length > 0 && (
                <div className="traffic-insights">
                    <h3>📊 Key Insights</h3>
                    {renderInsights(shortsChartData, workoutsChartData, shortsTotal, workoutsTotal)}
                </div>
            )}
        </div>
    );
}

// Helper function to prepare comparison data
function prepareComparisonData(shortsTraffic, workoutsTraffic, formatSourceName) {
    const allSources = new Set([...Object.keys(shortsTraffic), ...Object.keys(workoutsTraffic)]);
    return Array.from(allSources).map(source => ({
        source: formatSourceName(source),
        shorts: shortsTraffic[source] || 0,
        workouts: workoutsTraffic[source] || 0
    })).sort((a, b) => (b.shorts + b.workouts) - (a.shorts + a.workouts));
}

// Helper function to generate insights
function renderInsights(shortsData, workoutsData, shortsTotal, workoutsTotal) {
    const insights = [];

    // Check if Workouts have high "Suggested Videos" traffic
    const workoutsSuggested = workoutsData.find(d => d.source === 'Suggested Videos');
    if (workoutsSuggested) {
        const suggestedPercent = ((workoutsSuggested.views / workoutsTotal) * 100).toFixed(0);
        if (suggestedPercent >= 30) {
            insights.push(
                <p key="suggested-good">✅ <strong>Your funnel is working!</strong> {suggestedPercent}% of Workout views come from Suggested Videos - YouTube is recommending your Workouts after viewers watch other content (likely your Shorts).</p>
            );
        } else {
            insights.push(
                <p key="suggested-low">⚠️ Only {suggestedPercent}% of Workout views come from Suggested Videos. Consider adding more calls-to-action in your Shorts to drive viewers to watch full Workouts.</p>
            );
        }
    }

    // Check Shorts feed
    const shortsFeed = shortsData.find(d => d.source === 'Shorts Feed');
    if (shortsFeed) {
        const feedPercent = ((shortsFeed.views / shortsTotal) * 100).toFixed(0);
        if (feedPercent >= 40) {
            insights.push(
                <p key="shorts-feed-good">✅ <strong>Strong discovery!</strong> {feedPercent}% of Short views come from the Shorts Feed - YouTube is actively promoting your Shorts in the discovery feed.</p>
            );
        }
    }

    // Check for YouTube Search traffic
    const workoutsSearch = workoutsData.find(d => d.source === 'YouTube Search');
    if (workoutsSearch) {
        const searchPercent = ((workoutsSearch.views / workoutsTotal) * 100).toFixed(0);
        if (searchPercent >= 20) {
            insights.push(
                <p key="search-good">🔍 {searchPercent}% of Workout views come from YouTube Search - your titles and descriptions are SEO-optimized. Keep using searchable keywords!</p>
            );
        }
    }

    if (insights.length === 0) {
        insights.push(
            <p key="default">Keep building content! As you publish more Shorts and Workouts, these traffic patterns will become clearer and show you what's working.</p>
        );
    }

    return insights;
}

export default TrafficSources;