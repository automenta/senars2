import {
    CognitiveItem,
    SemanticAtom,
    UUID,
    TruthValue
} from '../types/data';
import {
    WorldModel as IWorldModel,
    BeliefRevisionEngine as IBeliefRevisionEngine,
    CognitiveSchema
} from '../types/interfaces';

export class BeliefRevisionEngine implements IBeliefRevisionEngine {
    merge(existing: TruthValue, newTruth: TruthValue): TruthValue {
        const w1 = existing.confidence;
        const w2 = newTruth.confidence;
        const totalW = w1 + w2;

        if (totalW === 0) {
            return { frequency: 0, confidence: 0 };
        }

        const frequency = (w1 * existing.frequency + w2 * newTruth.frequency) / totalW;
        const confidence = Math.min(0.99, (w1 + w2) / 2 + 0.1);

        return { frequency, confidence };
    }

    detect_conflict(a: TruthValue, b: TruthValue): boolean {
        return Math.abs(a.frequency - b.frequency) > 0.5 && a.confidence > 0.7 && b.confidence > 0.7;
    }
}

// Helper functions for querying
function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length || vecA.length === 0) {
        return 0;
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) {
        return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function getProperty(obj: any, path: string): any {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
}

export class WorldModel implements IWorldModel {
    private atoms = new Map<UUID, SemanticAtom>();
    private items = new Map<UUID, CognitiveItem>();
    private beliefRevisionEngine = new BeliefRevisionEngine();
    private belief_by_atom_id = new Map<UUID, UUID>(); // Index for faster belief revision

    add_atom(atom: SemanticAtom): UUID {
        this.atoms.set(atom.id, atom);
        return atom.id;
    }

    add_item(item: CognitiveItem): void {
        this.items.set(item.id, item);
        if (item.type === 'BELIEF') {
            this.belief_by_atom_id.set(item.atom_id, item.id);
        }
    }

    get_atom(id: UUID): SemanticAtom | null {
        return this.atoms.get(id) || null;
    }

    get_item(id: UUID): CognitiveItem | null {
        return this.items.get(id) || null;
    }

    query_by_semantic(embedding: number[], k: number): CognitiveItem[] {
        const scoredItems = Array.from(this.items.values()).map(item => {
            const atom = this.get_atom(item.atom_id);
            if (!atom || !atom.embedding || atom.embedding.length === 0) {
                return { item, score: -1 };
            }
            const score = cosineSimilarity(embedding, atom.embedding);
            return { item, score };
        });

        scoredItems.sort((a, b) => b.score - a.score);

        return scoredItems.slice(0, k).map(si => si.item);
    }

    query_by_symbolic(pattern: any, k?: number): CognitiveItem[] {
        const results: CognitiveItem[] = [];
        for (const item of this.items.values()) {
            const atom = this.get_atom(item.atom_id);
            if (!atom) continue;

            let isMatch = true;
            for (const key in pattern) {
                const expectedValue = pattern[key];
                // Support checks on the item itself or its atom
                const actualValue = getProperty({item, atom}, key);
                if (actualValue !== expectedValue) {
                    isMatch = false;
                    break;
                }
            }

            if (isMatch) {
                results.push(item);
                if (k && results.length >= k) {
                    break;
                }
            }
        }
        return results;
    }

    query_by_structure(pattern: any, k?: number): CognitiveItem[] {
        // For now, this is an alias for symbolic search. A more advanced
        // implementation could handle complex graph or S-expression patterns.
        return this.query_by_symbolic(pattern, k);
    }

    revise_belief(new_item: CognitiveItem): CognitiveItem | null {
        if (new_item.type !== 'BELIEF' || !new_item.truth) {
            return null;
        }

        const existing_item_id = this.belief_by_atom_id.get(new_item.atom_id);
        const existing_item = existing_item_id ? this.items.get(existing_item_id) : undefined;

        if (existing_item && existing_item.truth) {
            if (this.beliefRevisionEngine.detect_conflict(existing_item.truth, new_item.truth)) {
                // In a real system, this might create a GOAL to resolve the conflict.
                console.warn(`Conflict detected for atom ${new_item.atom_id}. Merging truth values.`);
            }
            const newTruth = this.beliefRevisionEngine.merge(existing_item.truth, new_item.truth);
            existing_item.truth = newTruth;
            // The existing item is updated in place.
            return null;
        } else {
            // This is a new belief, so we add and index it.
            this.add_item(new_item);
        }
        return null;
    }

    size(): number {
        return this.atoms.size;
    }

    register_schema_atom(atom: SemanticAtom): CognitiveSchema {
        // This is a placeholder. The actual implementation will be in the SchemaMatcher.
        throw new Error("Schema registration not implemented in WorldModel. See SchemaMatcher.");
    }
}
