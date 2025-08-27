import { CognitiveSchema, SchemaDerivedData, WorldModel, CognitiveItem, SemanticAtom } from '@cognitive-arch/types';
import { createAtomId } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

// --- Schema for Handling 'CREATE_GOAL' requests ---

const createGoalPattern = {
    a: { type: 'BELIEF', 'atom.content.request_type': 'CREATE_GOAL' },
    b: { type: 'BELIEF', 'atom.content.request_type': 'CREATE_GOAL' }
};

export const createGoalSchemaAtom: SemanticAtom = {
    id: 'schema-atom:websocket:create-goal',
    content: { pattern: createGoalPattern },
    meta: {
        type: 'CognitiveSchema',
        source: 'system_definition',
        timestamp: new Date().toISOString(),
        author: 'system',
        trust_score: 1.0,
        domain: 'system.interface',
        license: 'internal',
        label: 'Create Goal from WebSocket Request'
    },
    embedding: []
};

export const createGoalSchema: CognitiveSchema = {
    atom_id: createGoalSchemaAtom.id,
    apply: async (item: CognitiveItem, b: CognitiveItem, worldModel: WorldModel): Promise<SchemaDerivedData> => {
        const requestAtom = await worldModel.get_atom(item.atom_id);
        if (!requestAtom) return { atoms: [], items: [] };

        const { clientId, requestId, payload } = requestAtom.meta;
        if (!payload || typeof payload.text !== 'string') return { atoms: [], items: [] };

        // 1. Create the new Goal
        const goal_content = {
            type: "user_goal",
            text: payload.text,
        };
        const goal_meta = {
            type: "Fact" as const,
            source: `websocket:${clientId}`,
            timestamp: new Date().toISOString(),
            author: "user" as const,
            trust_score: 0.9,
            domain: "user_input",
            license: "internal"
        };
        const goal_atom_id = createAtomId(goal_content, goal_meta);
        const goal_atom: SemanticAtom = { id: goal_atom_id, content: goal_content, meta: goal_meta, embedding: [] };

        const goal_item: CognitiveItem = {
            id: uuidv4(),
            atom_id: goal_atom.id,
            type: 'GOAL',
            attention: { priority: 0.8, durability: 0.9 }, // User goals are important
            stamp: { timestamp: Date.now(), parent_ids: [item.id], schema_id: createGoalSchemaAtom.id },
            goal_status: 'active',
            label: `User Goal: ${payload.text}`
        };

        // 2. Create an Action to send a confirmation response
        const response_payload = { status: 'success', message: 'Goal created', goalId: goal_item.id };
        const response_atom_content = {
            type: "action_websocket_send",
            clientId,
            requestId,
            payload: response_payload
        };
        const response_atom_meta = {
            type: "Action" as const,
            source: "self",
            timestamp: new Date().toISOString(),
            author: "system" as const,
            trust_score: 1.0,
            domain: "system.interface",
            license: "internal"
        };
        const response_atom_id = createAtomId(response_atom_content, response_atom_meta);
        const response_atom: SemanticAtom = { id: response_atom_id, content: response_atom_content, meta: response_atom_meta, embedding: [] };

        const response_item: CognitiveItem = {
            id: uuidv4(),
            atom_id: response_atom.id,
            type: 'GOAL',
            attention: { priority: 1.0, durability: 0.1 }, // Send response immediately
            stamp: { timestamp: Date.now(), parent_ids: [item.id], schema_id: createGoalSchemaAtom.id },
            goal_status: 'active',
            label: `Action: Send WebSocket Message`
        };

        return {
            atoms: [goal_atom, response_atom],
            items: [goal_item, response_item]
        };
    }
};


// --- Schema for Handling 'GET_ALL_GOALS' requests ---

const getAllGoalsPattern = {
    a: { type: 'BELIEF', 'atom.content.request_type': 'GET_ALL_GOALS' },
    b: { type: 'BELIEF', 'atom.content.request_type': 'GET_ALL_GOALS' }
};

export const getAllGoalsSchemaAtom: SemanticAtom = {
    id: 'schema-atom:websocket:get-all-goals',
    content: { pattern: getAllGoalsPattern },
    meta: {
        type: 'CognitiveSchema',
        source: 'system_definition',
        timestamp: new Date().toISOString(),
        author: 'system',
        trust_score: 1.0,
        domain: 'system.interface',
        license: 'internal',
        label: 'Get All Goals from WebSocket Request'
    },
    embedding: []
};

export const getAllGoalsSchema: CognitiveSchema = {
    atom_id: getAllGoalsSchemaAtom.id,
    apply: async (item: CognitiveItem, b: CognitiveItem, worldModel: WorldModel): Promise<SchemaDerivedData> => {
        const requestAtom = await worldModel.get_atom(item.atom_id);
        if (!requestAtom) return { atoms: [], items: [] };

        const { clientId, requestId } = requestAtom.meta;

        // 1. Query the world model for all goals
        const allGoals = await worldModel.getItemsByFilter(i => i.type === 'GOAL' && !!i.label && !i.label.startsWith('Action:'));

        // 2. Format the response payload
        const response_payload = {
            status: 'success',
            goals: allGoals.map(g => ({
                id: g.id,
                label: g.label,
                status: g.goal_status
            }))
        };

        // 3. Create an Action to send the response
        const response_atom_content = {
            type: "action_websocket_send",
            clientId,
            requestId,
            payload: response_payload
        };
        const response_atom_meta = {
            type: "Action" as const,
            source: "self",
            timestamp: new Date().toISOString(),
            author: "system" as const,
            trust_score: 1.0,
            domain: "system.interface",
            license: "internal"
        };
        const response_atom_id = createAtomId(response_atom_content, response_atom_meta);
        const response_atom: SemanticAtom = { id: response_atom_id, content: response_atom_content, meta: response_atom_meta, embedding: [] };

        const response_item: CognitiveItem = {
            id: uuidv4(),
            atom_id: response_atom.id,
            type: 'GOAL',
            attention: { priority: 1.0, durability: 0.1 },
            stamp: { timestamp: Date.now(), parent_ids: [item.id], schema_id: getAllGoalsSchemaAtom.id },
            goal_status: 'active',
            label: `Action: Send WebSocket Message`
        };

        return {
            atoms: [response_atom],
            items: [response_item]
        };
    }
};
