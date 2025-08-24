import { WorldModelImpl, DefaultBeliefRevisionEngine } from './world-model';
import { SemanticAtom, CognitiveItem, newUUID, UUID, TruthValue } from './types';

// Helper to create a dummy SemanticAtom
const createAtom = (content: any, id: UUID = newUUID()): SemanticAtom => ({
    id,
    content,
    embedding: [],
    meta: { type: 'Fact', source: 'test' },
});

// Helper to create a dummy CognitiveItem (Belief)
const createBelief = (atom_id: UUID, truth: TruthValue, id: UUID = newUUID()): CognitiveItem => ({
    id,
    atom_id,
    type: 'BELIEF',
    truth,
    attention: { priority: 0.5, durability: 0.5 },
    stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: newUUID(),
    },
});

describe('WorldModelImpl', () => {
    let worldModel: WorldModelImpl;

    beforeEach(() => {
        worldModel = new WorldModelImpl();
    });

    it('should add and get atoms and items', () => {
        const atom = createAtom({ data: 'test' });
        const belief = createBelief(atom.id, { frequency: 1.0, confidence: 0.9 });

        worldModel.add_atom(atom);
        worldModel.add_item(belief);

        const retrievedAtom = worldModel.get_atom(atom.id);
        const retrievedItem = worldModel.get_item(belief.id);

        expect(retrievedAtom).toEqual(atom);
        expect(retrievedItem).toEqual(belief);
    });

    it('should return null for non-existent ids', () => {
        expect(worldModel.get_atom('non-existent' as UUID)).toBeNull();
        expect(worldModel.get_item('non-existent' as UUID)).toBeNull();
    });

    describe('Belief Revision', () => {
        const atomId = newUUID();

        beforeEach(() => {
            const atom = createAtom({ data: 'some fact' }, atomId);
            worldModel.add_atom(atom);
        });

        it('should add a new belief if none exists for that atom', () => {
            const belief1 = createBelief(atomId, { frequency: 0.8, confidence: 0.7 });
            const result = worldModel.revise_belief(belief1);

            expect(result).toBeNull();
            const retrieved = worldModel.query_by_symbolic({ data: 'some fact' });
            expect(retrieved.length).toBe(1);
            expect(retrieved[0].id).toBe(belief1.id);
        });

        it('should revise an existing belief with a new one', () => {
            const initialBelief = createBelief(atomId, { frequency: 1.0, confidence: 0.5 });
            worldModel.add_item(initialBelief);

            const newBelief = createBelief(atomId, { frequency: 0.0, confidence: 0.9 });
            const revisedItem = worldModel.revise_belief(newBelief);

            expect(revisedItem).not.toBeNull();
            expect(revisedItem?.id).toBe(initialBelief.id);

            const finalTruth = revisedItem?.truth;
            expect(finalTruth?.confidence).toBeCloseTo(0.8); // (0.5+0.9)/2 + 0.1
            expect(finalTruth?.frequency).toBeCloseTo(0.3571); // (0.5*1.0 + 0.9*0.0) / 1.4
        });
    });
});

describe('DefaultBeliefRevisionEngine', () => {
    let engine: DefaultBeliefRevisionEngine;

    beforeEach(() => {
        engine = new DefaultBeliefRevisionEngine();
    });

    it('should merge two truth values correctly', () => {
        const existing: TruthValue = { frequency: 1.0, confidence: 0.6 };
        const neu: TruthValue = { frequency: 0.8, confidence: 0.8 };
        const merged = engine.merge(existing, neu);
        expect(merged.frequency).toBeCloseTo((0.6 * 1.0 + 0.8 * 0.8) / 1.4);
        expect(merged.confidence).toBeCloseTo((0.6 + 0.8) / 2 + 0.1);
    });

    it('should detect a conflict', () => {
        const a: TruthValue = { frequency: 1.0, confidence: 0.8 };
        const b: TruthValue = { frequency: 0.0, confidence: 0.9 };
        expect(engine.detect_conflict(a, b)).toBe(true);
    });

    it('should not detect a conflict if confidence is low', () => {
        const a: TruthValue = { frequency: 1.0, confidence: 0.6 };
        const b: TruthValue = { frequency: 0.0, confidence: 0.9 };
        expect(engine.detect_conflict(a, b)).toBe(false);
    });

    it('should not detect a conflict if frequencies are close', () => {
        const a: TruthValue = { frequency: 0.8, confidence: 0.8 };
        const b: TruthValue = { frequency: 0.9, confidence: 0.9 };
        expect(engine.detect_conflict(a, b)).toBe(false);
    });
});
