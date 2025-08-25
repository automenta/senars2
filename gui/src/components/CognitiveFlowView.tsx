import React, { useState } from 'react';
import { useAgentState } from '../hooks/useAgentState';
import CognitiveItemView from './CognitiveItemView';
import NewGoalForm from './NewGoalForm';
import { UUID } from '../types';

const CognitiveFlowView: React.FC = () => {
  const { state, isConnected, error } = useAgentState();
  const { goalTree, agenda } = state;
  const [isNewGoalFormOpen, setIsNewGoalFormOpen] = useState(false);

  // Find root goals (goals without a parent in the tree)
  const rootGoalIds = Object.keys(goalTree).filter(
    (id) => !goalTree[id].item.goal_parent_id
  ) as UUID[];

  // Get items from the agenda that are not part of any goal tree
  const standaloneAgendaItems = agenda.filter(
    (item) => !goalTree[item.id] && !Object.values(goalTree).some(node => node.children.includes(item.id))
  );

  return (
    <>
      {isNewGoalFormOpen && <NewGoalForm onClose={() => setIsNewGoalFormOpen(false)} />}
      <div className="cognitive-flow-view">
        <header className="view-header">
          <h1>Cognitive Flow</h1>
          <div className="view-actions">
            <button onClick={() => setIsNewGoalFormOpen(true)} className="new-goal-button">
              + New Goal
            </button>
            <div className="connection-status">
              <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </header>
        <div className="item-list">
          {error && <div className="error-message">{error}</div>}

          {/* Render the goal tree */}
          {rootGoalIds.map((id) => (
            <CognitiveItemView key={id} node={goalTree[id]} allNodes={goalTree} />
          ))}

          {/* Render standalone agenda items */}
          {standaloneAgendaItems.map((item) => (
            <div key={item.id} className="cognitive-item-view standalone">
              <div className="item-details">
                <span>{item.label || 'Unnamed Agenda Item'}</span>
              </div>
            </div>
          ))}

          {!isConnected && !error && <p>Connecting to agent...</p>}
        </div>
      </div>
    </>
  );
};

export default CognitiveFlowView;
