import { Transducer, TransducerResult } from "../types/interfaces";
import { CognitiveItem, SemanticAtom } from "../types/data";
import { v4 as uuidv4 } from "uuid";
import { createAtomId } from "../lib/utils";

export class WebSocketTransducer implements Transducer {

    process(data: any, source: string): TransducerResult | null {
        // This transducer only handles structured data from our websocket source
        if (source !== 'websocket_input' || !data || typeof data.type !== 'string' || !data.clientId) {
            return null;
        }

        const { type, payload, clientId, requestId } = data;

        // Special hook for end-to-end testing
        if (type === 'INITIATE_TEST') {
            const test_atom_content = { text: 'initiate test' };
            const test_atom_meta = {
                type: "Observation" as const,
                source: "test_client",
                timestamp: new Date().toISOString(),
                author: "system" as const,
                trust_score: 1.0,
                domain: "system.test",
                license: "internal"
            };
            const test_atom_id = createAtomId(test_atom_content, test_atom_meta);
            const test_atom: SemanticAtom = {
                id: test_atom_id,
                content: test_atom_content,
                embedding: [],
                meta: test_atom_meta
            };
            const test_item: CognitiveItem = {
                id: uuidv4(),
                atom_id: test_atom.id,
                type: 'BELIEF',
                truth: { frequency: 1.0, confidence: 1.0 },
                attention: { priority: 1.0, durability: 1.0 },
                stamp: {
                    timestamp: Date.now(),
                    parent_ids: [],
                    schema_id: 'transducer:websocket:test' as any,
                },
                label: `Test Trigger Belief`
            };
            return { atom: test_atom, item: test_item };
        }

        // The content of the atom represents the request in a structured way for schema matching
        const atom_content = {
            type: "websocket_request",
            request_type: type,
            // We can add more structured data here if needed for matching
        };

        const atom_meta = {
            type: "Observation" as const,
            source: source,
            timestamp: new Date().toISOString(),
            author: 'user', // All websocket actions are initiated by a user
            trust_score: 0.9, // We trust the user's requests
            domain: "interface",
            license: "internal",
            // Pass along client and request IDs in metadata so actions can use them
            clientId: clientId,
            requestId: requestId,
            payload: payload // The actual payload of the request
        };

        const atom_id = createAtomId(atom_content, atom_meta);

        const atom: SemanticAtom = {
            id: atom_id,
            content: atom_content,
            embedding: [], // No embedding for this kind of abstract concept yet
            meta: atom_meta
        };

        const item: CognitiveItem = {
            id: uuidv4(),
            atom_id: atom.id,
            type: 'BELIEF',
            truth: { frequency: 1.0, confidence: atom_meta.trust_score },
            // Initial attention is high for new perceptions
            attention: { priority: 0.95, durability: 0.2 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [],
                schema_id: 'transducer:websocket' as any,
            },
            label: `Request: ${type}`
        };

        return { atom, item };
    }
}
