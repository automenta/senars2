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
            <strong>Truth:</strong> F: {truth.frequency.toFixed(2)}, C: {truth.confidence.toFixed(2)}
          </div>
        )}
        <div className="item-attention">
          <strong>Attention:</strong> P: {attention.priority.toFixed(2)}, D: {attention.durability.toFixed(2)}
        </div>
      </div>
      <div className="card-ids">
        <span className="item-id">ID: {item.id}</span>
        <span className="atom-id">Atom ID: {item.atom_id}</span>
      </div>
    </div>
  );
};

export default CognitiveItemCard;
