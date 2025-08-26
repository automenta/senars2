import { WorldModel, BeliefRevisionEngine } from '../src/components/world-model';
import { SemanticAtom, CognitiveItem, UUID, TruthValue } from '../src/types/data';
import { v4 as uuidv4 } from 'uuid';

const createMockAtom = (): SemanticAtom => ({
    id: uuidv4() as UUID,
    content: 'Test content',
    embedding: [0.1, 0.2, 0.3],
    meta: {
        type: 'Fact',
        source: 'test',
        timestamp: new Date().toISOString(),
        author: 'jest',
        trust_score: 0.8,
        domain: 'test',
        license: 'MIT',
    },
});

const createMockBelief = (atom_id: UUID, truth: TruthValue): CognitiveItem => ({
    id: uuidv4() as UUID,
    atom_id,
    type: 'BELIEF',
    truth,
    attention: { priority: 0.5, durability: 0.5 },
    stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: uuidv4() as UUID,
    },
});

describe('BeliefRevisionEngine', () => {
    const engine = new BeliefRevisionEngine();

    it('should merge two truth values correctly', () => {
        const existing: TruthValue = { frequency: 0.8, confidence: 0.7 };
        const newTruth: TruthValue = { frequency: 0.4, confidence: 0.5 };
        const merged = engine.merge(existing, newTruth);

        // w1=0.7, w2=0.5, totalW=1.2
        // freq = (0.7*0.8 + 0.5*0.4) / 1.2 = (0.56 + 0.2) / 1.2 = 0.76 / 1.2 = 0.6333
        // conf = min(0.99, (0.7+0.5)/2 + 0.1) = min(0.99, 0.6 + 0.1) = 0.7
        expect(merged.frequency).toBeCloseTo(0.6333);
        expect(merged.confidence).toBeCloseTo(0.7);
    });

    it('should detect a conflict', () => {
        const a: TruthValue = { frequency: 0.9, confidence: 0.8 };
        const b: TruthValue = { frequency: 0.1, confidence: 0.8 };
        expect(engine.detect_conflict(a, b)).toBe(true);
    });

    it('should not detect a conflict if confidence is low', () => {
        const a: TruthValue = { frequency: 0.9, confidence: 0.6 };
        const b: TruthValue = { frequency: 0.1, confidence: 0.8 };
        expect(engine.detect_conflict(a, b)).toBe(false);
    });

    it('should not detect a conflict if frequency difference is small', () => {
        const a: TruthValue = { frequency: 0.6, confidence: 0.8 };
        const b: TruthValue = { frequency: 0.4, confidence: 0.8 };
        expect(engine.detect_conflict(a, b)).toBe(false);
    });
});

describe('WorldModel', () => {
    let worldModel: WorldModel;

    beforeEach(() => {
        worldModel = new WorldModel();
    });

    it('should add and get an atom', () => {
        const atom = createMockAtom();
        worldModel.add_atom(atom);
        const retrieved = worldModel.get_atom(atom.id);
        expect(retrieved).toEqual(atom);
    });

    it('should add and get an item', () => {
        const item = createMockBelief(uuidv4() as UUID, { frequency: 1, confidence: 1 });
        worldModel.add_item(item);
        const retrieved = worldModel.get_item(item.id);
        expect(retrieved).toEqual(item);
    });

    it('should add a new belief if none exists for the atom', () => {
        const atom = createMockAtom();
        worldModel.add_atom(atom);
        const belief = createMockBelief(atom.id, { frequency: 0.9, confidence: 0.9 });

        worldModel.revise_belief(belief);

        const retrieved = worldModel.get_item(belief.id);
        expect(retrieved).toEqual(belief);
    });

    it('should revise an existing belief', () => {
        const atom = createMockAtom();
        worldModel.add_atom(atom);

        const initialBelief = createMockBelief(atom.id, { frequency: 0.8, confidence: 0.7 });
        worldModel.add_item(initialBelief);

        const newBelief = createMockBelief(atom.id, { frequency: 0.4, confidence: 0.5 });
        worldModel.revise_belief(newBelief);

        const revisedBelief = worldModel.get_item(initialBelief.id);
        expect(revisedBelief?.truth?.frequency).toBeCloseTo(0.6333);
        expect(revisedBelief?.truth?.confidence).toBeCloseTo(0.7);
    });
});
