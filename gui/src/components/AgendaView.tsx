import React, { useState, useEffect } from 'react';
import { CognitiveItem, AppState, GoalTree } from '../types';
import { TargetIcon, CheckIcon, WarningIcon, XIcon, SearchIcon } from './Icons';

function AgendaView() {
  const [agendaItems, setAgendaItems] = useState<CognitiveItem[]>([]);
  const [goalTree, setGoalTree] = useState<GoalTree>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [goalType, setGoalType] = useState('Diagnose condition');
  const [contextText, setContextText] = useState('');
  const [detectedEntities, setDetectedEntities] = useState<string[]>([]);
  const [suggestedGoal, setSuggestedGoal] = useState('');
  const [worldModel, setWorldModel] = useState<SemanticAtom[]>([]);

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
        setWorldModel(data.worldModel || []);
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
    
    if (!suggestedGoal.trim()) return;
    
    try {
      const response = await fetch('http://localhost:3001/api/input', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: `GOAL: ${suggestedGoal}` }),
      });
      
      if (response.ok) {
        setContextText('');
        setDetectedEntities([]);
        setSuggestedGoal('');
      } else {
        console.error('Failed to submit input');
      }
    } catch (error) {
      console.error('Error submitting input:', error);
    }
  };

  const handleContextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContextText(value);

    // Simple entity detection
    const entities: string[] = [];
    const keywords = ['cat', 'dog', 'sick', 'chocolate', 'eat', 'verify', 'assess'];
    keywords.forEach(k => {
        if (value.toLowerCase().includes(k) && !entities.includes(k)) {
            entities.push(k);
        }
    });
    setDetectedEntities(entities);

    // Simple goal suggestion
    if (entities.includes('cat') && entities.includes('chocolate')) {
      setSuggestedGoal('Diagnose chocolate toxicity in cats');
    } else if (entities.includes('dog') && entities.includes('chocolate')) {
      setSuggestedGoal('Diagnose chocolate toxicity in dogs');
    } else if (entities.length > 0) {
      setSuggestedGoal(`Assess situation with: ${entities.join(', ')}`);
    }
    else {
      setSuggestedGoal('');
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

  const getStatusIcon = (item: CognitiveItem): React.ReactNode => {
    if (item.type === 'GOAL') {
      if (item.goal_status === 'achieved') return <CheckIcon />;
      if (item.goal_status === 'blocked') return <WarningIcon />;
      return <TargetIcon />;
    } else if (item.type === 'BELIEF') {
      if (item.truth?.confidence && item.truth.confidence >= 0.8) return <CheckIcon />;
      if (item.truth?.confidence && item.truth.confidence >= 0.5) return <WarningIcon />;
      return <XIcon />;
    } else if (item.type === 'QUERY') {
      return <SearchIcon />;
    }
    return null;
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

  return (
    <div className="agenda-view">
      <form onSubmit={handleSubmit} className="input-section-new">
        <h3>[+] New Goal</h3>

        <div className="form-row">
          <label>Goal Type:</label>
          <div className="goal-type-selector">
            {['Diagnose condition', 'Verify fact', 'Generate hypothesis', 'System maintenance'].map(type => (
              <button
                key={type}
                type="button"
                className={`goal-type-button ${goalType === type ? 'active' : ''}`}
                onClick={() => setGoalType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="context-input">Context:</label>
          <textarea
            id="context-input"
            value={contextText}
            onChange={handleContextChange}
            placeholder="e.g., My cat seems sick after eating chocolate"
            rows={3}
          />
        </div>

        <div className="intelligent-composition">
            <div className="detected-entities">
                Detected entities:
                {detectedEntities.length > 0
                    ? detectedEntities.map(e => <span key={e} className="entity-tag">{e}</span>)
                    : <span className="placeholder">None</span>
                }
            </div>
            <div className="suggested-goal">
                → Suggested goal:
                <input
                    type="text"
                    value={suggestedGoal}
                    onChange={(e) => setSuggestedGoal(e.target.value)}
                    placeholder="Diagnose chocolate toxicity in cats"
                />
            </div>
        </div>

        <div className="form-row">
            <label>Priority:</label>
            <div className="priority-display">
                Automatically calculated: <span className="priority-value">[0.95]</span>
                <span className="priority-factors">(Factors: Medical urgency, User symptoms, etc.)</span>
            </div>
        </div>

        <div className="form-row">
            <label>Trust Requirements:</label>
            <div className="trust-requirements">
              <span className="trust-badge high">vetdb.org • 0.95</span>
              <span className="trust-badge medium">Peer-reviewed • 0.85</span>
              <span className="trust-badge low">User • 0.60</span>
            </div>
        </div>

        <div className="form-actions">
            <button type="submit" className="submit-button">Create Goal</button>
            <button type="button" className="secondary-button">Save as Template</button>
            <button type="button" className="tertiary-button">Cancel</button>
        </div>
      </form>

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
            const atom = worldModel.find(a => a.id === item.atom_id);
            
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
                      <h4>Details</h4>
                      <ul>
                        <li><strong>Type:</strong> {item.type}</li>
                        <li><strong>Atom ID:</strong> {item.atom_id}</li>
                        {item.goal_parent_id && <li><strong>Parent Goal:</strong> {item.goal_parent_id.substring(0, 8)}</li>}
                      </ul>
                      {item.truth && (
                        <div>
                          <strong>Truth Value:</strong>
                          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                            <span>Confidence: {item.truth.confidence.toFixed(2)}</span>
                            {renderProgressBar(item.truth.confidence)}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="detail-section">
                        <div className="provenance-section">
                        <h4>Provenance</h4>
                        <div className="provenance-tree">
                            <div className="provenance-node">
                                <div className="provenance-content">
                                    <strong>Source:</strong> {atom?.meta.source || 'N/A'} (Trust: {atom?.meta.trust_score?.toFixed(2) || 'N/A'})
                                    <div className="provenance-sub-details">
                                    {typeof atom?.content === 'string' ? atom.content : JSON.stringify(atom?.content)}
                                    </div>
                                </div>
                            </div>
                            <div className="provenance-node">
                                <div className="provenance-content">
                                    <strong>Schema:</strong> {item.stamp.schema_id.substring(0,12)}...
                                </div>
                            </div>
                            {item.stamp.parent_ids.length > 0 && (
                                <div className="provenance-node">
                                    <div className="provenance-content">
                                        <strong>Parents:</strong>
                                        <div className="provenance-sub-details">
                                            {item.stamp.parent_ids.map(p => <div key={p}>{p.substring(0,12)}...</div>)}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
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
