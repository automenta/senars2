import React, { useState, useEffect } from 'react';

function ReflectionView() {
  const [activeTab, setActiveTab] = useState('paths');
  const [healthScore, setHealthScore] = useState(92);

  // Mock data for demonstration
  const cognitiveHealth = {
    activeGoals: 12,
    optimalRange: "10-20",
    memoryUtilization: "1.2M atoms",
    compactionRecommended: true,
    contradictionRate: 0.02,
    safeThreshold: 0.05
  };

  const recommendedActions = [
    {
      type: "warning",
      title: "Memory Optimization",
      description: "Compact memory: 15% space savings (1.2M → 1.02M atoms)",
      details: "Will deprecate 12 unused schemas",
      actions: ["Schedule for tonight", "Run now", "Dismiss"]
    },
    {
      type: "error",
      title: "Trust Anomaly",
      description: 'Source "petblog.com" shows 7 contradictions (confidence >0.7)',
      details: "Recommended: Reduce trust from 0.45 → 0.30",
      actions: ["Apply", "Investigate", "Maintain current"]
    }
  ];

  const cognitiveInsights = [
    'Schema "SpeciesToxicityTransfer" used in 87% of pet health diagnoses',
    "Query resolution time average: 2.3m (target: <3m)",
    "User confirmation increases belief confidence by average 0.18"
  ];

  const renderHealthBar = () => {
    const segments = 100;
    const filledSegments = healthScore;
    
    return (
      <div className="health-bar">
        {Array.from({ length: segments }).map((_, index) => (
          <div 
            key={index} 
            className={`health-segment ${index < filledSegments ? 'filled' : ''}`}
          />
        ))}
        <span className="health-text">...... {healthScore}%</span>
      </div>
    );
  };

  return (
    <div className="reflection-view">
      <div className="reflection-header">
        <div className="reflection-tabs">
          <button 
            className={activeTab === 'paths' ? 'active' : ''}
            onClick={() => setActiveTab('paths')}
          >
            🔍 ACTIVE COGNITIVE PATHS
          </button>
          <button 
            className={activeTab === 'memory' ? 'active' : ''}
            onClick={() => setActiveTab('memory')}
          >
            Memory
          </button>
          <button 
            className={activeTab === 'trust' ? 'active' : ''}
            onClick={() => setActiveTab('trust')}
          >
            Trust
          </button>
          <button 
            className={activeTab === 'system' ? 'active' : ''}
            onClick={() => setActiveTab('system')}
          >
            System
          </button>
          <button 
            className={activeTab === 'settings' ? 'active' : ''}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      </div>

      <div className="reflection-content">
        <div className="health-section">
          <h3>COGNITIVE HEALTH: {renderHealthBar()}</h3>
          <div className="health-details">
            <p>• Active goals: {cognitiveHealth.activeGoals} (optimal range: {cognitiveHealth.optimalRange})</p>
            <p>• Memory utilization: {cognitiveHealth.memoryUtilization} {cognitiveHealth.compactionRecommended && "(compaction recommended)"}</p>
            <p>• Contradiction rate: {cognitiveHealth.contradictionRate} (safe threshold: {cognitiveHealth.safeThreshold})</p>
          </div>
        </div>

        <div className="actions-section">
          <h3>RECOMMENDED ACTIONS</h3>
          {recommendedActions.map((action, index) => (
            <div key={index} className={`action-item ${action.type}`}>
              <h4>{action.type === 'warning' ? '🟡' : '🔴'} {action.title}</h4>
              <p>• {action.description}</p>
              <p>• {action.details}</p>
              <div className="action-buttons">
                {action.actions.map((btn, btnIndex) => (
                  <button key={btnIndex} className="action-button">{btn}</button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="insights-section">
          <h3>COGNITIVE INSIGHTS</h3>
          {cognitiveInsights.map((insight, index) => (
            <p key={index}>• {insight}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReflectionView;