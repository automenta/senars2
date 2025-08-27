import { logger } from '../lib/logger';
import { CognitiveItem, Executor, ExecutorResult, WorldModel } from '@cognitive-arch/types';
import { WebSocketServer } from '../websocket-server';
import { createAtomId } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

export class WebSocketExecutor implements Executor {

    constructor(private webSocketServer: WebSocketServer) {}

    async can_execute(goal: CognitiveItem, worldModel: WorldModel): Promise<boolean> {
        // This executor handles goals that represent a websocket send action.
        // We'll identify them by looking at the goal's atom content.
        if (goal.type !== 'GOAL') {
            return false;
        }
        const atom = await worldModel.get_atom(goal.atom_id);
        return atom?.content?.type === 'action_websocket_send';
    }

    async execute(goal: CognitiveItem, worldModel: WorldModel): Promise<ExecutorResult> {
        const goalAtom = await worldModel.get_atom(goal.atom_id);
        if (!goalAtom) {
            throw new Error(`Could not find atom for goal ${goal.id}`);
        }

        const { clientId, requestId, payload } = goalAtom.content;

        if (!clientId) {
            throw new Error(`[WebSocketExecutor] Cannot execute goal ${goal.id}: missing clientId in atom content.`);
        }

        const response = {
            ...payload,
            requestId: requestId, // Echo back the request ID for correlation
        };

        this.webSocketServer.sendMessage(clientId, response);

        logger.info(`Sent message to client ${clientId}`);

        // The result of this execution is a belief that the message was sent.
        const result_atom_content = {
            type: "execution_result",
            action: "websocket_send",
            clientId: clientId,
            requestId: requestId,
        };
        const result_atom_meta = {
            type: "Fact" as const,
            source: "self",
            timestamp: new Date().toISOString(),
            author: 'system',
            trust_score: 1.0,
            domain: "interface",
            license: "internal"
        };
        const result_atom_id = createAtomId(result_atom_content, result_atom_meta);

        const resultAtom = {
            id: result_atom_id,
            content: result_atom_content,
            embedding: [],
            meta: result_atom_meta
        };

        const resultItem = {
            id: uuidv4(),
            atom_id: resultAtom.id,
            type: 'BELIEF' as const,
            truth: { frequency: 1.0, confidence: 1.0 },
            attention: { priority: 0.1, durability: 0.1 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [goal.id],
                schema_id: 'executor:websocket' as any,
            },
            label: `Belief: Sent message to ${clientId}`
        };

        return { atom: resultAtom, belief: resultItem };
    }
}
