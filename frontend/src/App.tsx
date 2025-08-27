import { logger } from '../../src/lib/logger';
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';
import EventLog from './EventLog';
import { CognitiveItem as CoreCognitiveItem } from '@cognitive-arch/types';

type CognitiveItem = CoreCognitiveItem & {
    raw_data: string;
};

type Goal = {
  id: string;
  label: string;
  status: string;
};

type ConnectionStatusType = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

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
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('disconnected');
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      logger.debug("WebSocket is already connected.");
      return;
    }

    setConnectionStatus('connecting');
    const websocket = new WebSocket('ws://localhost:8080');
    ws.current = websocket;

    websocket.onopen = () => {
      logger.info('WebSocket connected');
      setConnectionStatus('connected');
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      const requestId = uuidv4();
      const message = {
        request_type: 'GET_ALL_GOALS',
        requestId: requestId,
      };
      websocket.send(JSON.stringify(message));
    };

    websocket.onmessage = (event) => {
      logger.debug('WebSocket message received:', event.data);
      try {
        const message = JSON.parse(event.data);

        // All messages are treated as cognitive items and added to the stream
        // This is a simplification for now. In a real app, we might have
        // different message types (e.g., control messages vs. data messages).
        if (message.id && message.type && message.atom_id) {
           const newItem: CognitiveItem = { ...message, raw_data: event.data };
           setItems(prevItems => [...prevItems, newItem]);
        }

      // Handle direct responses from requests
      if (message.status === 'success') {
        if (Array.isArray(message.goals)) {
          setGoals(message.goals);
        } else if (message.goalId) {
          logger.info(`Goal creation acknowledged for goalId: ${message.goalId}`);
        }
        return;
      }

        // Handle broadcasted events for the goal list
        if (message.type === 'item_added' && message.data?.type === 'GOAL' && message.data?.label) {
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

      } catch (error) {
        logger.error("Failed to parse WebSocket message:", error);
      }
    };

    websocket.onerror = (error) => {
      logger.error('WebSocket error:', error);
      setConnectionStatus('error');
    };

    websocket.onclose = () => {
      logger.info('WebSocket disconnected');
      if (reconnectTimer.current) {
        // Avoid setting multiple timers
        return;
      }
      setConnectionStatus('reconnecting');
      reconnectTimer.current = setTimeout(() => {
        logger.info('Attempting to reconnect...');
        connect();
      }, 3000);
    };
  };

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const requestId = uuidv4();
    const message = {
      request_type: 'CREATE_GOAL',
      requestId: requestId,
      payload: {
        text: newGoal,
      },
    };

    ws.current.send(JSON.stringify(message));
    setNewGoal('');
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
            {goals.map(goal => (
              <li key={goal.id} className={`goal-item status-${goal.status}`}>
                <span className="goal-label">{goal.label}</span>
                <span className="goal-status">{goal.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <form className="add-goal-form" onSubmit={handleAddGoal}>
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Enter a new goal"
          />
          <button type="submit">Add Goal</button>
        </form>
        <EventLog items={items} />
      </main>
    </div>
  );
}

export default App;
