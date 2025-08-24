import { SemanticAtom, CognitiveItem, UUID, TruthValue, newUUID } from './types';

export interface BeliefRevisionEngine {
    merge(existing: TruthValue, neu: TruthValue): TruthValue;
    detect_conflict(a: TruthValue, b: TruthValue): boolean;
}

export class DefaultBeliefRevisionEngine implements BeliefRevisionEngine {
    merge(existing: TruthValue, neu: TruthValue): TruthValue {
        const w1 = existing.confidence;
        const w2 = neu.confidence;
        const totalWeight = w1 + w2;

        if (totalWeight === 0) {
            return {
                frequency: (existing.frequency + neu.frequency) / 2,
                confidence: 0,
            };
        }

        const frequency = (w1 * existing.frequency + w2 * neu.frequency) / totalWeight;
        const confidence = Math.min(0.99, (w1 + w2) / 2 + 0.1);

        return { frequency, confidence };
    }

    detect_conflict(a: TruthValue, b: TruthValue): boolean {
        return Math.abs(a.frequency - b.frequency) > 0.5 && a.confidence > 0.7 && b.confidence > 0.7;
    }
}

// Opaque type for a compiled schema for better type safety.
export type CognitiveSchema = {
    atom_id: UUID;
    // In a real implementation, this would be a compiled/JITed function
    // or a structured object for pattern matching.
    compiled: any;
};

export interface WorldModel {
    add_atom(atom: SemanticAtom): UUID;
    find_or_create_atom(content: any, embedding?: number[]): SemanticAtom;
    add_item(item: CognitiveItem): void;
    update_item(id: UUID, item: CognitiveItem): boolean;

    get_atom(id: UUID): SemanticAtom | null;
    get_item(id: UUID): CognitiveItem | null;

    query_by_semantic(embedding: number[], k: number): CognitiveItem[];
    query_by_symbolic(pattern: any, k?: number): CognitiveItem[];
    query_by_structure(pattern: any, k?: number): CognitiveItem[];

    revise_belief(new_item: CognitiveItem): CognitiveItem | null;
    register_schema_atom(atom: SemanticAtom): CognitiveSchema;
}

export class WorldModelImpl implements WorldModel {
    private atoms: Map<UUID, SemanticAtom> = new Map();
    private items: Map<UUID, CognitiveItem> = new Map();
    private beliefRevisionEngine: BeliefRevisionEngine;
    private schemas: Map<UUID, CognitiveSchema> = new Map();

    constructor(revisionEngine?: BeliefRevisionEngine) {
        this.beliefRevisionEngine = revisionEngine || new DefaultBeliefRevisionEngine();
    }

    add_atom(atom: SemanticAtom): UUID {
        this.atoms.set(atom.id, atom);
        return atom.id;
    }

    find_or_create_atom(content: any, embedding: number[] = []): SemanticAtom {
        // Inefficient linear scan. A production system would use a hash-based index on content.
        const contentStr = JSON.stringify(content);
        for (const atom of this.atoms.values()) {
            if (JSON.stringify(atom.content) === contentStr) {
                return atom;
            }
        }

        // Not found, create a new one
        const newAtom: SemanticAtom = {
            id: newUUID(), // In a real system, this would be a hash of the content
            content,
            embedding,
            meta: {
                type: 'Fact',
                source: 'derived',
                timestamp: new Date().toISOString(),
            },
        };
        this.add_atom(newAtom);
        return newAtom;
    }

    add_item(item: CognitiveItem): void {
        this.items.set(item.id, item);
    }

    update_item(id: UUID, item: CognitiveItem): boolean {
        if (!this.items.has(id)) {
            return false;
        }
        // Ensure the ID is not changed
        if (id !== item.id) {
            console.error("Cannot change the ID of an item during update.");
            return false;
        }
        this.items.set(id, item);
        return true;
    }

    get_atom(id: UUID): SemanticAtom | null {
        return this.atoms.get(id) ?? null;
    }

    get_item(id: UUID): CognitiveItem | null {
        return this.items.get(id) ?? null;
    }

    query_by_semantic(embedding: number[], k: number): CognitiveItem[] {
        // Naive implementation: linear scan and cosine similarity
        // This is very inefficient and should be replaced with an ANN index (e.g., HNSW)
        console.warn("Warning: Using naive O(n) semantic query. Do not use in production.");
        const allItems = Array.from(this.items.values());
        const scoredItems = allItems.map(item => {
            const atom = this.get_atom(item.atom_id);
            if (!atom || !atom.embedding) return { item, score: -1 };
            const score = this.cosineSimilarity(embedding, atom.embedding);
            return { item, score };
        });

        return scoredItems
            .filter(si => si.score > -1)
            .sort((a, b) => b.score - a.score)
            .slice(0, k)
            .map(si => si.item);
    }

    query_by_symbolic(pattern: any, k?: number): CognitiveItem[] {
        // Naive implementation: linear scan and simple equality check
        console.warn("Warning: Using naive O(n) symbolic query. Do not use in production.");
        const results: CognitiveItem[] = [];
        for (const item of this.items.values()) {
            const atom = this.get_atom(item.atom_id);
            // This is a placeholder for a real symbolic matching engine (e.g., S-expressions)
            if (atom && JSON.stringify(atom.content) === JSON.stringify(pattern)) {
                results.push(item);
                if (k && results.length >= k) {
                    break;
                }
            }
        }
        return results;
    }

    query_by_structure(pattern: any, k?: number): CognitiveItem[] {
        // For now, this is an alias for symbolic query. A real implementation
        // would use a more sophisticated structural matching (e.g., JSONPath, GraphQL-like queries)
        return this.query_by_symbolic(pattern, k);
    }

    revise_belief(new_item: CognitiveItem): CognitiveItem | null {
        if (new_item.type !== 'BELIEF' || !new_item.truth) {
            return null; // Can only revise beliefs
        }

        // Find existing belief about the same atom
        const existingItem = Array.from(this.items.values()).find(
            item => item.atom_id === new_item.atom_id && item.type === 'BELIEF'
        );

        if (!existingItem || !existingItem.truth) {
            this.add_item(new_item);
            return null; // No existing belief, just add the new one
        }

        // Merge truth values
        const mergedTruth = this.beliefRevisionEngine.merge(existingItem.truth, new_item.truth);

        // Update the existing item with the new truth value
        const updatedItem: CognitiveItem = {
            ...existingItem,
            truth: mergedTruth,
        };
        this.add_item(updatedItem);

        // Optional: Check for conflict and return a new GOAL/QUERY if needed.
        // This is part of the Reflection loop's responsibility, but a hook could exist here.
        if (this.beliefRevisionEngine.detect_conflict(existingItem.truth, new_item.truth)) {
            console.log(`Conflict detected for atom ${new_item.atom_id}`);
            // In a full implementation, this might push a new goal to the agenda
            // e.g., GOAL:("(resolve_conflict " + new_item.atom_id + ")")
        }

        return updatedItem;
    }

    register_schema_atom(atom: SemanticAtom): CognitiveSchema {
        if (atom.meta.type !== "CognitiveSchema") {
            throw new Error("Atom is not of type CognitiveSchema");
        }
        const schema: CognitiveSchema = {
            atom_id: atom.id,
            // Placeholder for a real schema compilation step
            compiled: atom.content,
        };
        this.schemas.set(atom.id, schema);
        this.add_atom(atom);
        return schema;
    }

    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (vecA.length !== vecB.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
