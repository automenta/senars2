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
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        switch (type) {
          case 'full_state':
            setState(payload);
            break;

          // Agenda updates
          case 'agenda_item_added':
            setState(prevState => ({
              ...prevState,
              agenda: [...prevState.agenda, payload].sort((a, b) => b.attention.priority - a.attention.priority),
            }));
            break;
          case 'agenda_item_removed':
            setState(prevState => ({
              ...prevState,
              agenda: prevState.agenda.filter(item => item.id !== payload.id),
            }));
            break;
          case 'agenda_item_updated':
            setState(prevState => ({
              ...prevState,
              agenda: prevState.agenda.map(item => item.id === payload.id ? payload : item).sort((a, b) => b.attention.priority - a.attention.priority),
            }));
            break;

          // World Model updates
          case 'world_model_atom_added':
             setState(prevState => ({
              ...prevState,
              worldModel: [...prevState.worldModel, payload],
            }));
            break;
           case 'world_model_item_added':
            // This is complex because items are not directly in the world model view
            // For now, we can just log it. A better implementation might update a separate item list.
            console.log('World model item added:', payload);
            break;
          case 'world_model_item_updated':
            console.log('World model item updated:', payload);
            break;

          // Goal Tree updates
          case 'goal_tree_goal_added':
            setState(prevState => ({
              ...prevState,
              goalTree: {
                ...prevState.goalTree,
                [payload.id]: { item: payload, children: [] }
              }
            }));
            break;
          case 'goal_tree_goal_updated':
            setState(prevState => ({
              ...prevState,
              goalTree: {
                ...prevState.goalTree,
                [payload.id]: { ...prevState.goalTree[payload.id], item: payload }
              }
            }));
            break;
          case 'goal_tree_decomposed':
            setState(prevState => {
                const newGoalTree = { ...prevState.goalTree };
                const parentNode = newGoalTree[payload.parent.id];
                if (parentNode) {
                    parentNode.children = payload.children.map((c: CognitiveItem) => c.id);
                }
                payload.children.forEach((child: CognitiveItem) => {
                    newGoalTree[child.id] = { item: child, children: [] };
                });
                return { ...prevState, goalTree: newGoalTree };
            });
            break;

          default:
            console.warn(`Unknown WebSocket message type: ${type}`);
        }

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
