import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';
import EventLog from './EventLog';
import { CognitiveItem } from './types';
import { useWebSocket, ConnectionStatusType } from './hooks/useWebSocket';

type Goal = {
  id: string;
  label: string;
  status: string;
};

const ConnectionStatus: React.FC<{ status: ConnectionStatusType }> = ({ status }) => {
  const statusMessages = {
    connecting: 'Connecting to agent...',
    connected: 'Connected',
    reconnecting: 'Connection lost. Reconnecting...',
    disconnected: 'Disconnected',
    error: 'Connection error',
  };
  return (
    <div className={`connection-status ${status}`}>
      Status: {statusMessages[status]}
    </div>
  );
};

function App() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [items, setItems] = useState<CognitiveItem[]>([]);
  const [newGoal, setNewGoal] = useState('');

  const handleMessage = useCallback((message: any) => {
    // All messages are treated as cognitive items and added to the stream
    if (message.id && message.type && message.atom_id) {
      const newItem: CognitiveItem = { ...message, raw_data: JSON.stringify(message, null, 2) };
      setItems(prevItems => [newItem, ...prevItems]);
    }

    // Handle direct responses from requests
    if (message.status === 'success' && Array.isArray(message.goals)) {
      setGoals(message.goals);
    } else if (message.type === 'item_added' && message.data?.type === 'GOAL' && message.data?.label) {
      setGoals(prevGoals => {
        if (prevGoals.find(g => g.id === message.data.id)) {
          return prevGoals;
        }
        const newGoalToAdd: Goal = { id: message.data.id, label: message.data.label, status: message.data.goal_status };
        return [...prevGoals, newGoalToAdd];
      });
    } else if (message.type === 'item_updated' && message.data?.type === 'GOAL') {
      setGoals(prevGoals =>
        prevGoals.map(g =>
          g.id === message.data.id ? { ...g, status: message.data.goal_status } : g
        )
      );
    }
  }, []);

  const { connectionStatus, sendMessage } = useWebSocket('ws://localhost:8080', { onMessage: handleMessage });

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    sendMessage({
      request_type: 'CREATE_GOAL',
      requestId: uuidv4(),
      payload: { text: newGoal },
    });
    setNewGoal('');
  };

  const handleCancelGoal = (goalId: string) => {
    if (window.confirm('Are you sure you want to cancel this goal?')) {
      sendMessage({ request_type: 'CANCEL_GOAL', payload: { goalId } });
    }
  };

  const handlePrioritizeGoal = (goalId: string) => {
    sendMessage({ request_type: 'PRIORITIZE_GOAL', payload: { goalId } });
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Cognitive Agent Workspace</h1>
        <ConnectionStatus status={connectionStatus} />
      </header>
      <main>
        <div className="goal-list">
          <h2>Goals</h2>
          <ul>
            {goals.length === 0 ? (
              <li className="goal-item-empty">No goals yet. Add one below to get started!</li>
            ) : (
              goals.map(goal => (
                <li key={goal.id} className={`goal-item status-${goal.status}`}>
                  <span className="goal-label">{goal.label}</span>
                  <div className="goal-actions">
                    <span className={`goal-status status-${goal.status}`}>{goal.status}</span>
                    <button
                      onClick={() => handlePrioritizeGoal(goal.id)}
                      disabled={connectionStatus !== 'connected' || goal.status !== 'active'}
                    >
                      Prioritize
                    </button>
                    <button
                      onClick={() => handleCancelGoal(goal.id)}
                      disabled={connectionStatus !== 'connected' || goal.status !== 'active'}
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <form className="add-goal-form" onSubmit={handleAddGoal}>
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Enter a new goal"
          />
          <button type="submit" disabled={connectionStatus !== 'connected'}>Add Goal</button>
        </form>
        <EventLog items={items} />
      </main>
    </div>
  );
}

export default App;
