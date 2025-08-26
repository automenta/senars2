import { CognitiveSchema, SchemaDerivedData, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom } from '../types/data';
import { createAtomId } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

export const testTriggerSchemaAtom: SemanticAtom = {
    id: 'test-schema-atom',
    content: {
        pattern: {
            a: { type: 'BELIEF', 'atom.content.text': 'initiate test' },
            b: { type: 'BELIEF', 'atom.content.text': 'initiate test' } // Schemas match pairs, so a needs to match b
        }
    },
    meta: {
        type: 'CognitiveSchema',
        source: 'system_definition',
        timestamp: new Date().toISOString(),
        author: 'system',
        trust_score: 1.0,
        domain: 'system.test',
        license: 'internal',
        label: 'Test Trigger Schema'
    },
    embedding: []
};

export const testTriggerSchema: CognitiveSchema = {
    atom_id: testTriggerSchemaAtom.id,
    apply: (a: CognitiveItem, b: CognitiveItem, wm: WorldModel): SchemaDerivedData => {

        const goal_content = { command: 'log', message: 'System test successful' };
        const goal_meta = {
            type: "Fact" as const,
            source: "reasoning:test-schema",
            timestamp: new Date().toISOString(),
            author: "system" as const,
            trust_score: 1.0,
            domain: "system.test",
            license: "internal"
        };

        const goal_atom: SemanticAtom = {
            id: createAtomId(goal_content, goal_meta),
            content: goal_content,
            embedding: [],
            meta: goal_meta
        };

        const goal_item: CognitiveItem = {
            id: uuidv4(),
            atom_id: goal_atom.id,
            type: 'GOAL',
            attention: { priority: 0.95, durability: 0.8 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [a.id, b.id],
                schema_id: testTriggerSchemaAtom.id
            },
            goal_status: 'active',
            label: "Goal: Log system test message"
        };

        return {
            atoms: [goal_atom],
            items: [goal_item]
        };
    }
};
