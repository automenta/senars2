import React from 'react';
import { CognitiveItem } from '../types';
import { GoalNode } from '../hooks/useAgentState';
import { Target, Search, CheckCircle, AlertTriangle, Clock, Link } from 'lucide-react';

interface CognitiveItemViewProps {
  node: GoalNode;
  allNodes: Record<string, GoalNode>;
}

const CognitiveItemView: React.FC<CognitiveItemViewProps> = ({ node, allNodes }) => {
  const { item, children } = node;

  const getStatusIcon = (item: CognitiveItem) => {
    switch (item.type) {
      case 'GOAL':
        return <Target size={18} className="status-goal" />;
      case 'QUERY':
        return <Search size={18} className="status-query" />;
      case 'BELIEF':
        if ((item.truth?.confidence ?? 0) > 0.7) {
          return <CheckCircle size={18} className="status-belief-high" />;
        }
        return <AlertTriangle size={18} className="status-belief-medium" />;
      default:
        return <Clock size={18} />;
    }
  };

  return (
    <div className="cognitive-item-view">
      <div className="item-details">
        <span className="status-icon">{getStatusIcon(item)}</span>
        <span>{item.label || 'Unnamed Item'}</span>
        {/* Placeholder for other details like priority, trust, etc. */}
      </div>
      {children.length > 0 && (
        <div className="item-children">
          {children.map(childId => {
            const childNode = allNodes[childId];
            return childNode ? <CognitiveItemView key={childId} node={childNode} allNodes={allNodes} /> : null;
          })}
        </div>
      )}
    </div>
  );
};

export default CognitiveItemView;
