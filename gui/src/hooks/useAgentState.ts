import { useState, useEffect } from 'react';
import { CognitiveItem, UUID, SemanticAtom } from '../types';

// Define the structure of the goal tree as received from the server
export interface GoalNode {
  item: CognitiveItem;
  children: UUID[];
}

export interface AgentState {
  agenda: CognitiveItem[];
  worldModel: SemanticAtom[];
  goalTree: Record<UUID, GoalNode>;
  worldModelItems: Record<UUID, CognitiveItem[]>;
}

const WEBSOCKET_URL = 'ws://localhost:3001';

export function useAgentState() {
  const [state, setState] = useState<AgentState>({
    agenda: [],
    worldModel: [],
    goalTree: {},
    worldModelItems: {},
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
            const { worldModelItems: items, ...restOfPayload } = payload;
            const itemsByAtom = (items || []).reduce((acc: Record<UUID, CognitiveItem[]>, item: CognitiveItem) => {
              const atomId = item.atom_id;
              if (!acc[atomId]) {
                acc[atomId] = [];
              }
              acc[atomId].push(item);
              return acc;
            }, {});
            setState({ ...restOfPayload, worldModelItems: itemsByAtom });
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
          case 'world_model_atom_updated':
            setState(prevState => ({
              ...prevState,
              worldModel: prevState.worldModel.map(atom =>
                atom.id === payload.id ? payload : atom
              ),
            }));
            break;
          case 'world_model_atom_removed':
            setState(prevState => ({
              ...prevState,
              worldModel: prevState.worldModel.filter(atom => atom.id !== payload.id),
            }));
            break;
          case 'world_model_item_added':
            setState(prevState => {
              const { atom_id, id } = payload;
              const newItemsForAtom = [...(prevState.worldModelItems[atom_id] || [])];
              // Avoid duplicates
              if (!newItemsForAtom.some(item => item.id === id)) {
                newItemsForAtom.push(payload);
              }
              return {
                ...prevState,
                worldModelItems: {
                  ...prevState.worldModelItems,
                  [atom_id]: newItemsForAtom,
                },
              };
            });
            break;
          case 'world_model_item_updated':
            setState(prevState => {
              const { atom_id, id } = payload;
              const newItemsForAtom = (prevState.worldModelItems[atom_id] || []).map(item =>
                item.id === id ? payload : item
              );
              return {
                ...prevState,
                worldModelItems: {
                  ...prevState.worldModelItems,
                  [atom_id]: newItemsForAtom,
                },
              };
            });
            break;
          case 'world_model_item_removed':
            setState(prevState => {
                const { atom_id, id } = payload;
                const newItemsForAtom = (prevState.worldModelItems[atom_id] || []).filter(item => item.id !== id);
                return {
                    ...prevState,
                    worldModelItems: {
                        ...prevState.worldModelItems,
                        [atom_id]: newItemsForAtom,
                    },
                };
            });
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
