import { useState, useEffect } from 'react';
import { CognitiveItem, UUID } from '../types';

// Define the structure of the goal tree as received from the server
export interface GoalNode {
  item: CognitiveItem;
  children: UUID[];
}

export interface AgentState {
  agenda: CognitiveItem[];
  worldModel: any[]; // Define a proper type if needed
  goalTree: Record<UUID, GoalNode>;
}

const WEBSOCKET_URL = 'ws://localhost:3001';

export function useAgentState() {
  const [state, setState] = useState<AgentState>({
    agenda: [],
    worldModel: [],
    goalTree: {},
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setState(data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
        setError('Failed to parse data from server.');
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('WebSocket connection error. Is the core server running?');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []); // Empty dependency array means this effect runs once on mount

  return { state, isConnected, error };
}
