import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';
import VideoScorecard from './VideoScorecard';
import AIInsights from './AIInsights';
import ContentLongevity from './ContentLongevity';
import TrafficSources from './TrafficSources';

function App() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [videoData, setVideoData] = useState([]);
  const [insightsData, setInsightsData] = useState(null);
  const [viewsTimeRange, setViewsTimeRange] = useState(30);

  const CHANNEL_API_URL = 'https://1mv3zp21qj.execute-api.us-west-1.amazonaws.com/prod/stats';
  const VIDEO_API_URL = 'https://1mv3zp21qj.execute-api.us-west-1.amazonaws.com/prod/videos';
  const INSIGHTS_API_URL = 'https://1mv3zp21qj.execute-api.us-west-1.amazonaws.com/prod/insights';

  useEffect(() => {
    fetch(CHANNEL_API_URL)
      .then(response => response.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });

    fetch(VIDEO_API_URL)
      .then(response => response.json())
      .then(data => {
        setVideoData(data);
      })
      .catch(err => console.error('Video data error:', err));

    fetch(INSIGHTS_API_URL)
      .then(response => response.json())
      .then(data => {
        setInsightsData(data);
      })
      .catch(err => console.error('Insights data error:', err));
  }, []);

  if (loading) return <div className="container">Loading...</div>;
  if (error) return <div className="container">Error: {error}</div>;

  const latest = data[data.length - 1] || {};
  const watchTimeHours = latest.watchTimeMinutes ? (latest.watchTimeMinutes / 60).toFixed(1) : 0;
  const avgDurationFormatted = latest.avgViewDuration
    ? `${Math.floor(latest.avgViewDuration / 60)}:${(latest.avgViewDuration % 60).toString().padStart(2, '0')}`
    : '0:00';

  const getFilteredViewsData = () => {
    if (viewsTimeRange === 'all') {
      return data;
    }
    return data.slice(-viewsTimeRange);
  };



  return (
    <div className="App">
      <header className="header">
        <h1>The Guitar Circuit - YouTube Dashboard</h1>
        <p className="subtitle">Growth Analytics & Performance Metrics</p>
        <p style={{
          fontSize: '0.85rem',
          opacity: 0.7,
          marginTop: '5px',
          textAlign: 'center'
        }}>
          Data last synced: {latest.timestamp ?
            new Date(latest.timestamp * 1000).toLocaleString('en-US', {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZone: 'America/Los_Angeles'
            }) : 'Loading...'}
        </p>
      </header>

      <div className="container">
        <AIInsights insights={insightsData} />

        <div className="basic-stats-section">
          <div className="basic-stat-card blue-card">
            <h3>Subscribers</h3>
            <p className="stat-number">{latest.subscribers?.toLocaleString() || 0}</p>
          </div>
          <div className="basic-stat-card orange-card">
            <h3>Total Views</h3>
            <p className="stat-number">{latest.totalViews?.toLocaleString() || 0}</p>
          </div>
          <div className="basic-stat-card blue-card">
            <h3>Total Videos</h3>
            <p className="stat-number">{latest.totalVideos || 0}</p>
          </div>
          <div className="basic-stat-card orange-card">
            <h3>Recent Views (28d)</h3>
            <p className="stat-number">{latest.recentViews?.toLocaleString() || 0}</p>
          </div>
        </div>

        <p className="chart-description" style={{ fontSize: '0.85rem', opacity: 0.7, fontStyle: 'italic', textAlign: 'center' }}>
          Note: Channel totals and video sums may differ slightly due to YouTube API data refresh timing (typically within 5%).
        </p>

        {videoData.videos && (
          <VideoScorecard
            videos={videoData.videos}
            channelAvgDuration={videoData.channelAvgDuration}
          />
        )}

        <div className="chart-container">
          <h2>Watch Time Trend (Minutes)</h2>
          <p className="chart-description">
            Total watch time across all your videos in the past 28 days. This is YouTube's #1 ranking signal -
            consistent upward trends mean the algorithm is promoting your content more.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend />
              <Line type="monotone" dataKey="watchTimeMinutes" stroke="#F7931A" strokeWidth={2} name="Watch Time (min)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="conversion-section">
          <h2>Subscriber Conversion Analysis</h2>
          <p className="chart-description">
            Shows how effectively your content converts viewers into subscribers over a rolling 28-day window.
            Calculation: (Subscribers gained in last 28 days ÷ Views in last 28 days) × 1,000.
            This measures overall subscriber growth efficiency - higher numbers mean viewers find your content valuable enough to subscribe.
            For funnel effectiveness (Shorts → Workouts), see the Traffic Sources section below. Industry benchmark: 2-5 for small channels.
          </p>

          <div className="conversion-content">
            <div className="stat-card highlight conversion-card">
              <h3>Current Rate</h3>
              <p className="stat-number">{latest.contentDebtRatio?.toFixed(2) || '0.00'}</p>
              <p className="stat-subtext">Subs gained in last 28 days per 1K views</p>
              {latest.avgConversionRate30d > 0 && latest.contentDebtRatio > 0 && (
                <p className="stat-subtext">
                  {latest.contentDebtRatio > latest.avgConversionRate30d ? '↑' : '↓'}{' '}
                  {Math.abs(((latest.contentDebtRatio - latest.avgConversionRate30d) / latest.avgConversionRate30d * 100)).toFixed(0)}%
                  vs 30-day avg ({latest.avgConversionRate30d.toFixed(2)})
                </p>
              )}
            </div>

            {data.length > 0 && (
              <div className="conversion-chart">
                <h3>30-Day Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.slice(-30)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis label={{ value: 'Subs per 1K views', angle: -90, position: 'insideLeft', dy: 50 }} />
                    <Tooltip
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value) => [value.toFixed(2), 'Conversion Rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="contentDebtRatio"
                      stroke="#1A7EF7"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Conversion Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Content Longevity Section */}
        {videoData.videos && (
          <ContentLongevity videos={videoData.videos} />
        )}

        {/* Traffic Sources Analysis */}
        {videoData.videos && (
          <TrafficSources videos={videoData.videos} />
        )}

        <div className="chart-container">
          <div className="chart-header">
            <h2>Views: Total vs Recent</h2>
            <select
              className="time-range-selector"
              value={viewsTimeRange}
              onChange={(e) => setViewsTimeRange(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>
          <p className="chart-description">
            Blue = lifetime views; Yellow = last 28 days. Look for yellow lines climbing or staying high -
            these videos are actively being recommended by YouTube right now.
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getFilteredViewsData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                labelStyle={{ fontWeight: 'bold' }}
              />
              <Legend />
              <Line type="monotone" dataKey="totalViews" stroke="#1A7EF7" strokeWidth={2} name="Total Views" />
              <Line type="monotone" dataKey="recentViews" stroke="#F7931A" strokeWidth={2} name="Recent Views" />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div >
  );
}

export default App;