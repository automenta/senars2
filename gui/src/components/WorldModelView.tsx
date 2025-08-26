import React, { useState } from 'react';
import { SemanticAtom, CognitiveItem, UUID } from '../types';

interface WorldModelViewProps {
  worldModelAtoms: SemanticAtom[];
  worldModelItems: Record<UUID, CognitiveItem[]>;
}

function WorldModelView({ worldModelAtoms, worldModelItems }: WorldModelViewProps) {
  const [expandedAtoms, setExpandedAtoms] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('all');

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedAtoms);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedAtoms(newExpanded);
  };

  const getTrustBadgeClass = (trustScore: number) => {
    if (trustScore >= 0.8) return 'high';
    if (trustScore >= 0.5) return 'medium';
    return 'low';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const filteredAtoms = worldModelAtoms.filter(atom => {
    if (filter === 'all') return true;
    return atom.meta.type === filter;
  });

  return (
    <div className="world-model-view">
      <div className="world-model-header">
        <h2>World Model</h2>
        <div className="filters">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="Fact">Facts</option>
            <option value="CognitiveSchema">Schemas</option>
            <option value="Observation">Observations</option>
            <option value="Rule">Rules</option>
          </select>
        </div>
      </div>

      <div className="atoms-list">
        {filteredAtoms.length === 0 ? (
          <p>No atoms found.</p>
        ) : (
          filteredAtoms.map(atom => {
            const isExpanded = expandedAtoms.has(atom.id);
            const trustScore = atom.meta.trust_score || 0.5;
            
            return (
              <div key={atom.id} className={`atom-item ${isExpanded ? 'expanded' : ''}`}>
                <div className="atom-header" onClick={() => toggleExpand(atom.id)}>
                  <div className="atom-main">
                    <span className="atom-type">[{atom.meta.type}]</span>
                    <span className="atom-content">
                      {typeof atom.content === 'string' 
                        ? atom.content 
                        : JSON.stringify(atom.content).substring(0, 100) + '...'}
                    </span>
                    {atom.meta.source && (
                      <span className={`trust-badge ${getTrustBadgeClass(trustScore)}`}>
                        {atom.meta.source} • {trustScore.toFixed(2)}
                      </span>
                    )}
                    <span className="atom-timestamp">{formatTime(atom.meta.timestamp || new Date().toISOString())}</span>
                  </div>
                  <div className="atom-actions">
                    <button className="expand-button">{isExpanded ? '▲' : '▼'}</button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="atom-details">
                    <div className="detail-section">
                      <h4>Full Content</h4>
                      <pre>{JSON.stringify(atom.content, null, 2)}</pre>
                    </div>

                    <div className="detail-section">
                      <h4>Cognitive Items ({ (worldModelItems[atom.id] || []).length})</h4>
                      <div className="cognitive-items-list">
                        {(worldModelItems[atom.id] || []).length > 0 ? (
                          (worldModelItems[atom.id] || []).map(item => (
                            <div key={item.id} className="cognitive-item-summary">
                              <span className={`item-type-badge ${item.type}`}>{item.type}</span>
                              <span className="item-label">{item.label || item.id}</span>
                              {item.truth && (
                                <span className="item-truth">
                                  Truth: {(item.truth.confidence * 100).toFixed(0)}%
                                </span>
                              )}
                              <span className="item-priority">
                                Prio: {item.attention.priority.toFixed(2)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p>No cognitive items directly reference this atom.</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="detail-section">
                      <h4>Metadata</h4>
                      <ul>
                        <li><strong>ID:</strong> {atom.id}</li>
                        <li><strong>Type:</strong> {atom.meta.type}</li>
                        <li><strong>Source:</strong> {atom.meta.source || 'N/A'}</li>
                        <li><strong>Trust Score:</strong> {trustScore.toFixed(2)}</li>
                        <li><strong>Timestamp:</strong> {formatTime(atom.meta.timestamp || new Date().toISOString())}</li>
                        <li><strong>Author:</strong> {atom.meta.author || 'N/A'}</li>
                        <li><strong>Domain:</strong> {atom.meta.domain || 'N/A'}</li>
                      </ul>
                    </div>
                    
                    <div className="detail-section">
                      <h4>Embedding</h4>
                      <p>Dimension: {atom.embedding.length}</p>
                      <p>Sample: [{atom.embedding.slice(0, 5).join(', ')}...]</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default WorldModelView;