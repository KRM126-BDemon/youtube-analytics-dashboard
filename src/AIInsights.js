import React from 'react';
import './AIInsights.css';

function AIInsights({ insights }) {
    // This part handles the "Loading" state
    if (!insights) {
        return (
            <div className="insights-container loading-state">
                <h2>🤖 AI Marketing Analysis</h2>
                <p className="loading-message">Loading insights...</p>
            </div>
        );
    }

    // This is the main display
    return (
        /* We use a specific ID here to give this box the HIGHEST priority */
        <div className="insights-container" id="marketing-analysis-section">
            <div className="insights-header">
                <h2>🤖 AI Marketing Analysis</h2>
                <p className="analysis-date">
                    Analysis from {new Date(insights.analysisDate).toLocaleDateString()}
                </p>
                <p className="update-note">Updates weekly</p>
            </div>

            <div className="insights-content">
                {insights.insights.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="insight-paragraph">{paragraph}</p>
                ))}
            </div>

            <div className="insights-stats">
                <div className="stat-item">
                    <span className="stat-label">Subscribers at analysis:</span>
                    <span className="stat-value">{insights.subscribers}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Total views at analysis:</span>
                    <span className="stat-value">{insights.totalViews}</span>
                </div>
            </div>
        </div>
    );
}

export default AIInsights;