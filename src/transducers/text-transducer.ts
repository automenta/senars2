import { Transducer, TransducerResult } from "../types/interfaces";
import { CognitiveItem, SemanticAtom } from "../types/data";
import { v4 as uuidv4 } from "uuid";
import { createAtomId } from "../lib/utils";

export class TextTransducer implements Transducer {

    process(data: any, source: string): TransducerResult | null {
        if (typeof data !== 'string') {
            return null; // This transducer only handles strings.
        }

        const text = data;

        const atom_content = {
            type: "text_observation",
            text: text,
        };
        const atom_meta = {
            type: "Observation" as const,
            source: source,
            timestamp: new Date().toISOString(),
            author: source.startsWith('user') ? 'user' : 'external',
            trust_score: source.startsWith('user') ? 0.7 : 0.5, // User input is generally trusted more
            domain: "text",
            license: "unknown"
        };

        const atom_id = createAtomId(atom_content, atom_meta);

        const atom: SemanticAtom = {
            id: atom_id,
            content: atom_content,
            embedding: [], // Embeddings would be generated here in a real system
            meta: atom_meta
        };

        const item: CognitiveItem = {
            id: uuidv4(),
            atom_id: atom.id,
            type: 'BELIEF',
            truth: { frequency: 1.0, confidence: atom_meta.trust_score },
            // Initial attention is high for new perceptions
            attention: { priority: 0.9, durability: 0.7 },
            stamp: {
                timestamp: Date.now(),
                parent_ids: [],
                schema_id: 'transducer:text' as any,
            },
            label: `Observation: "${text.substring(0, 40)}..."`
        };

        return { atom, item };
    }
}
