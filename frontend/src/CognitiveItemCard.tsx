import React from 'react';
import { CognitiveItem } from './types';
import './CognitiveItemCard.css';

type CognitiveItemCardProps = {
  item: CognitiveItem;
};

const getIconForItemType = (type: CognitiveItem['type']) => {
  switch (type) {
    case 'BELIEF':
      return '✅';
    case 'GOAL':
      return '🎯';
    case 'QUERY':
      return '🔍';
    default:
      return '📄';
  }
};

const CognitiveItemCard: React.FC<CognitiveItemCardProps> = ({ item }) => {
  const { type, label, truth, attention, goal_status } = item;

  return (
    <div className={`cognitive-item-card type-${type.toLowerCase()}`}>
      <div className="card-header">
        <span className="item-icon">{getIconForItemType(type)}</span>
        <span className="item-type">{type}</span>
        {type === 'GOAL' && goal_status && (
          <span className={`goal-status status-${goal_status}`}>{goal_status}</span>
        )}
      </div>
      <div className="card-body">
        <p className="item-label">{label || 'No label provided'}</p>
      </div>
      <div className="card-footer">
        {truth && (
          <div className="item-truth">
            <span>T: (F: {truth.frequency.toFixed(2)}, C: {truth.confidence.toFixed(2)})</span>
          </div>
        )}
        <div className="item-attention">
          <span>A: (P: {attention.priority.toFixed(2)}, D: {attention.durability.toFixed(2)})</span>
        </div>
      </div>
    </div>
  );
};

export default CognitiveItemCard;
