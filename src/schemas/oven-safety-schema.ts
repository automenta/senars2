import { CognitiveSchema, SchemaDerivedData, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom } from '../types/data';
import { createAtomId } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

export const ovenSafetySchemaAtom: SemanticAtom = {
    id: 'safety-schema-atom',
    content: {
        pattern: {
            a: { type: 'BELIEF', 'atom.content.text': 'the oven is on' },
            b: { type: 'BELIEF', 'atom.content.text': 'the oven is on' }
        }
    },
    meta: {
        type: 'CognitiveSchema',
        source: 'system_definition',
        timestamp: new Date().toISOString(),
        author: 'system',
        trust_score: 1.0,
        domain: 'safety',
        license: 'internal',
        label: 'Oven Safety Schema'
    },
    embedding: []
};

export const ovenSafetySchema: CognitiveSchema = {
    atom_id: ovenSafetySchemaAtom.id,
    apply: async (a: CognitiveItem, b: CognitiveItem, wm: WorldModel): Promise<SchemaDerivedData> => {

        const goal_content = { command: 'log', message: 'Action: Turn off the oven.' };
        const goal_meta = {
            type: "Fact" as const,
            source: "reasoning:safety-schema",
            timestamp: new Date().toISOString(),
            author: "system" as const,
            trust_score: 1.0,
            domain: "safety",
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
            attention: { priority: 1.0, durability: 0.9 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [a.id],
                schema_id: ovenSafetySchemaAtom.id
            },
            goal_status: 'active',
            label: "Turn off oven"
        };

        return {
            atoms: [goal_atom],
            items: [goal_item]
        };
    }
};
