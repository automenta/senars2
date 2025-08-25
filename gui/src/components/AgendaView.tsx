import React, { useState, useEffect } from 'react';
import { CognitiveItem, AppState, GoalTree } from '../types';

function AgendaView() {
  const [agendaItems, setAgendaItems] = useState<CognitiveItem[]>([]);
  const [goalTree, setGoalTree] = useState<GoalTree>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState('');
  const [goalSuggestions, setGoalSuggestions] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
      try {
        const data: AppState = JSON.parse(event.data);
        setAgendaItems(data.agenda || []);
        setGoalTree(data.goalTree || {});
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from WebSocket server');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputText.trim()) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: `GOAL: ${inputText}` }),
      });
      
      if (response.ok) {
        setInputText('');
        setGoalSuggestions([]);
      } else {
        console.error('Failed to submit input');
      }
    } catch (error) {
      console.error('Error submitting input:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);
    
    // Generate goal suggestions based on input
    if (value.includes('cat') && value.includes('chocolate')) {
      setGoalSuggestions(['Diagnose chocolate toxicity in cats', 'Assess cat symptoms', 'Verify chocolate toxicity']);
    } else if (value.includes('dog') && value.includes('chocolate')) {
      setGoalSuggestions(['Diagnose chocolate toxicity in dogs', 'Assess dog symptoms', 'Verify chocolate toxicity']);
    } else {
      setGoalSuggestions([]);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getStatusIcon = (item: CognitiveItem) => {
    if (item.type === 'GOAL') {
      if (item.goal_status === 'achieved') return '✅';
      if (item.goal_status === 'blocked') return '⚠️';
      return '🎯';
    } else if (item.type === 'BELIEF') {
      // High confidence beliefs get checkmark, medium get warning, low get cross
      if (item.truth?.confidence && item.truth.confidence >= 0.8) return '✅';
      if (item.truth?.confidence && item.truth.confidence >= 0.5) return '⚠️';
      return '❌';
    } else if (item.type === 'QUERY') {
      return '🔍';
    }
    return '';
  };

  const getStatusClass = (item: CognitiveItem) => {
    if (item.type === 'GOAL') {
      if (item.goal_status === 'achieved') return 'status-achieved';
      if (item.goal_status === 'blocked') return 'status-blocked';
      return 'status-goal';
    } else if (item.type === 'BELIEF') {
      if (item.truth?.confidence && item.truth.confidence >= 0.8) return 'status-belief-high';
      if (item.truth?.confidence && item.truth.confidence >= 0.5) return 'status-belief-medium';
      return 'status-belief-low';
    } else if (item.type === 'QUERY') {
      return 'status-query';
    }
    return '';
  };

  const getTrustInfo = (item: CognitiveItem) => {
    const source = item.stamp.module || 'System';
    const trustScore = item.truth?.confidence ? item.truth.confidence.toFixed(2) : 'N/A';
    return `${source} • ${trustScore}`;
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const renderProgressBar = (value: number) => {
    const percentage = Math.round(value * 100);
    return (
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        ></div>
        <span className="progress-text">{percentage}%</span>
      </div>
    );
  };

  const renderSubGoals = (parentId: string, currentGoalTree: GoalTree) => {
    const parentNode = currentGoalTree[parentId];
    if (!parentNode || !parentNode.children || parentNode.children.length === 0) {
      return null;
    }

    return (
      <div className="sub-goals-container">
        {parentNode.children.map(childId => {
          // The full sub-goal item should be in the agendaItems list
          const subGoal = agendaItems.find(item => item.id === childId);
          if (!subGoal) {
            return (
              <div key={childId} className="sub-goal-item-missing">
                Sub-goal {childId.substring(0, 8)} not found in current agenda.
              </div>
            );
          }

          return (
            <div key={subGoal.id} className="sub-goal-item">
              <div className="sub-goal-header" onClick={() => toggleExpand(subGoal.id)}>
                <span className={`status-icon ${getStatusClass(subGoal)}`}>{getStatusIcon(subGoal)}</span>
                <span className="sub-goal-label">{subGoal.label || `Sub-goal ${subGoal.id.substring(0, 8)}`}</span>
                <span className="sub-goal-priority">[{subGoal.attention.priority.toFixed(2)}]</span>
                <span className="sub-goal-trust">[{getTrustInfo(subGoal)}]</span>
              </div>
              {expandedItems.has(subGoal.id) && (
                <div className="sub-goal-details">
                  <p>Status: {subGoal.goal_status || 'active'}</p>
                  {subGoal.goal_status === 'blocked' && <p>Dependencies: [Blocked by other goals]</p>}
                  {subGoal.goal_status === 'active' && <p>Dependencies: [Waiting for execution]</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderGoalSuggestions = () => {
    if (goalSuggestions.length === 0) return null;
    
    return (
      <div className="goal-suggestions">
        <h4>Suggested Goals:</h4>
        {goalSuggestions.map((suggestion, index) => (
          <div 
            key={index} 
            className="suggestion-item"
            onClick={() => setInputText(suggestion)}
          >
            {suggestion}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="agenda-view">
      <div className="input-section">
        <h3>[+] New Goal</h3>
        <div className="goal-type-selector">
          <button className="goal-type-button active">Diagnose condition</button>
          <button className="goal-type-button">Verify fact</button>
          <button className="goal-type-button">Generate hypothesis</button>
          <button className="goal-type-button">System maintenance</button>
        </div>
        
        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-group">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              placeholder="Context: My cat seems sick after eating chocolate"
              className="input-text"
            />
            <button type="submit" className="submit-button">Create Goal</button>
          </div>
        </form>
        
        {renderGoalSuggestions()}
        
        <div className="priority-info">
          <p>Priority is calculated by the backend based on various factors.</p>
        </div>
        
        <div className="trust-requirements">
          <span>Trust Requirements:</span>
          <span className="trust-badge high">vetdb.org • 0.95</span>
          <span className="trust-badge medium">Peer-reviewed • 0.85</span>
          <span className="trust-badge low">User • 0.60</span>
        </div>
      </div>

      <div className="toolbar">
        <button className="primary-button">[+] New Goal</button>
        <div className="filters">
          <select>
            <option>Priority: High ▼</option>
            <option>Priority: Low ▲</option>
          </select>
          <select>
            <option>All Domains</option>
            <option>Pet Health</option>
          </select>
          <select>
            <option>Trust: All</option>
            <option>Trust: 0.7+</option>
          </select>
        </div>
        <div className="stats">🎯 {agendaItems.filter(item => item.type === 'GOAL').length}</div>
      </div>

      <div className="agenda-list">
        {agendaItems.filter(item => !item.goal_parent_id).length === 0 ? (
          <p>No active agenda items.</p>
        ) : (
          agendaItems.filter(item => !item.goal_parent_id).map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const children = goalTree[item.id]?.children || [];
            
            return (
              <div key={item.id} className={`agenda-item ${isExpanded ? 'expanded' : ''}`}>
                <div className="item-header" onClick={() => toggleExpand(item.id)}>
                  <div className="item-main">
                    <span className={`status-icon ${getStatusClass(item)}`}>{getStatusIcon(item)}</span>
                    <span className="item-label">{item.label || `Item ${item.id.substring(0, 8)}`}</span>
                    <span className="item-priority">[{item.attention.priority.toFixed(2)}]</span>
                    <span className="item-trust">[{getTrustInfo(item)}]</span>
                    <span className="item-time">{formatTimeAgo(item.stamp.timestamp)}</span>
                    {item.goal_status && <span className="item-status">{item.goal_status}</span>}
                    {children.length > 0 && <span className="sub-goal-count">🔗 {children.length} sub-goals</span>}
                  </div>
                  <div className="item-actions">
                    <button className="expand-button">{isExpanded ? '▲' : '▼'}</button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="item-details">
                    <div className="detail-section">
                      <h4>Type: {item.type}</h4>
                      {item.truth && (
                        <div>
                          <p>Truth Value: Frequency {item.truth.frequency.toFixed(2)}, Confidence {item.truth.confidence.toFixed(2)}</p>
                          {renderProgressBar(item.truth.confidence)}
                        </div>
                      )}
                      <p>Atom ID: {item.atom_id}</p>
                      <p>Schema ID: {item.stamp.schema_id}</p>
                      {item.goal_parent_id && <p>Parent Goal: {item.goal_parent_id.substring(0, 8)}</p>}
                      
                      <div className="provenance-section">
                        <h4>Provenance</h4>
                        <p>Source Module: {item.stamp.module || 'N/A'}</p>
                        <p>Schema ID: {item.stamp.schema_id}</p>
                        <p>Parent IDs: {item.stamp.parent_ids.join(', ')}</p>
                      </div>
                    </div>
                    
                    {children.length > 0 && (
                      <div className="sub-goals-section">
                        <h4>Sub-Goals</h4>
                        {renderSubGoals(item.id, goalTree)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      
      <div className="agenda-footer">
        <button>[▼ 23 more items]</button>
        <button>🔄 Refresh</button>
        <button>📊 Visualize</button>
        <button>🧪 Sandbox</button>
      </div>
    </div>
  );
}

export default AgendaView;
