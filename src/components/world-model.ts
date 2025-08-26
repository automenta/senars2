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

export class WorldModel implements IWorldModel {
    private atoms = new Map<UUID, SemanticAtom>();
    private items = new Map<UUID, CognitiveItem>();
    private beliefRevisionEngine = new BeliefRevisionEngine();

    add_atom(atom: SemanticAtom): UUID {
        this.atoms.set(atom.id, atom);
        return atom.id;
    }

    add_item(item: CognitiveItem): void {
        this.items.set(item.id, item);
    }

    get_atom(id: UUID): SemanticAtom | null {
        return this.atoms.get(id) || null;
    }

    get_item(id: UUID): CognitiveItem | null {
        return this.items.get(id) || null;
    }

    query_by_semantic(embedding: number[], k: number): CognitiveItem[] {
        // Semantic search not implemented in this version
        console.warn("Semantic search not implemented.");
        return [];
    }

    query_by_symbolic(pattern: any, k?: number): CognitiveItem[] {
        // Symbolic search not implemented in this version
        console.warn("Symbolic search not implemented.");
        return [];
    }

    query_by_structure(pattern: any, k?: number): CognitiveItem[] {
        // Structure search not implemented in this version
        console.warn("Structure search not implemented.");
        return [];
    }

    revise_belief(new_item: CognitiveItem): CognitiveItem | null {
        if (new_item.type !== 'BELIEF' || !new_item.truth) {
            return null;
        }

        const existing_item = Array.from(this.items.values()).find(
            item => item.atom_id === new_item.atom_id && item.type === 'BELIEF'
        );

        if (existing_item && existing_item.truth) {
            if (this.beliefRevisionEngine.detect_conflict(existing_item.truth, new_item.truth)) {
                // For now, just log conflict. A real implementation might create a GOAL to resolve it.
                console.warn(`Conflict detected for atom ${new_item.atom_id}`);
            }
            const newTruth = this.beliefRevisionEngine.merge(existing_item.truth, new_item.truth);
            existing_item.truth = newTruth;
            // Optionally, return a new item representing the revision act
            return null;
        } else {
            this.add_item(new_item);
        }
        return null;
    }

    register_schema_atom(atom: SemanticAtom): CognitiveSchema {
        // This is a placeholder. The actual implementation will be in the SchemaMatcher.
        throw new Error("Schema registration not implemented in WorldModel. See SchemaMatcher.");
    }
}
