import React from 'react';
import { useReflectionData } from '../hooks/useReflectionData';

function ReflectionView() {
  const { data, isLoading, error } = useReflectionData();

  if (isLoading) {
    return <div>Loading Reflection Data...</div>;
  }

  if (error) {
    return <div className="error">Error loading reflection data: {error}</div>;
  }

  if (!data) {
    return <div>No reflection data available.</div>;
  }

  const { kpis, recommendations, insights } = data;

  const healthScore = 100 - (kpis.memoryUtilization / 2) - (kpis.contradictionRate * 50);

  const renderHealthBar = () => {
    const segments = 100;
    const filledSegments = Math.round(healthScore);
    
    return (
      <div className="health-bar">
        {Array.from({ length: segments }).map((_, index) => (
          <div 
            key={index} 
            className={`health-segment ${index < filledSegments ? 'filled' : ''}`}
          />
        ))}
        <span className="health-text">...... {filledSegments}%</span>
      </div>
    );
  };

  return (
    <div className="reflection-view">
      <div className="reflection-content">
        <div className="health-section">
          <h3>COGNITIVE HEALTH: {renderHealthBar()}</h3>
          <div className="health-details">
            <p>• Active goals: {kpis.activeGoals}</p>
            <p>• Memory utilization: {kpis.memoryUtilization}%</p>
            <p>• Contradiction rate: {kpis.contradictionRate}%</p>
          </div>
        </div>

        <div className="actions-section">
          <h3>RECOMMENDED ACTIONS</h3>
          {recommendations.map((action, index) => (
            <div key={index} className={`action-item warning`}>
              <h4>🟡 {action.title}</h4>
              <p>• {action.description}</p>
              <div className="action-buttons">
                  <button className="action-button">{action.action}</button>
              </div>
            </div>
          ))}
        </div>

        <div className="insights-section">
          <h3>COGNITIVE INSIGHTS</h3>
          {insights.map((insight, index) => (
            <p key={index}>• {insight}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ReflectionView;