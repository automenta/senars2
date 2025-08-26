import { WorldModel } from '../src/components/world-model';
import { SemanticAtom, CognitiveItem, UUID, TruthValue } from '../src/types/data';
import { v4 as uuidv4 } from 'uuid';

const createMockAtom = (domain?: string): SemanticAtom => ({
    id: uuidv4() as UUID,
    content: { text: `Test content ${Math.random()}` },
    embedding: [0.1, 0.2, 0.3],
    meta: {
        type: 'Fact',
        source: 'test',
        timestamp: new Date().toISOString(),
        author: 'jest',
        trust_score: 0.8,
        domain: domain || 'test',
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


describe('WorldModel (Async)', () => {
    let worldModel: WorldModel;

    beforeAll(async () => {
        worldModel = await WorldModel.create();
    });

    afterAll(async () => {
        await worldModel.destroy();
    });

    it('should add and get an atom', async () => {
        const atom = createMockAtom();
        await worldModel.add_atom(atom);
        const retrieved = await worldModel.get_atom(atom.id);
        expect(retrieved).toEqual(atom);
    });

    it('should add and get an item', async () => {
        const item = createMockBelief(uuidv4() as UUID, { frequency: 1, confidence: 1 });
        await worldModel.add_item(item);
        const retrieved = await worldModel.get_item(item.id);
        expect(retrieved).toEqual(item);
    });

    it('should add a new belief if none exists for the atom', async () => {
        const atom = createMockAtom();
        await worldModel.add_atom(atom);
        const belief = createMockBelief(atom.id, { frequency: 0.9, confidence: 0.9 });

        await worldModel.revise_belief(belief);

        const retrieved = await worldModel.get_item(belief.id);
        expect(retrieved).toEqual(belief);
    });

    it('should revise an existing belief', async () => {
        const atom = createMockAtom();
        await worldModel.add_atom(atom);

        const initialBelief = createMockBelief(atom.id, { frequency: 0.8, confidence: 0.7 });
        await worldModel.add_item(initialBelief);

        const newBelief = createMockBelief(atom.id, { frequency: 0.4, confidence: 0.5 });
        await worldModel.revise_belief(newBelief);

        const revisedBelief = await worldModel.get_item(initialBelief.id);
        expect(revisedBelief?.truth?.frequency).toBeCloseTo(0.6333);
        expect(revisedBelief?.truth?.confidence).toBeCloseTo(0.7);
    });

    it('should get items by filter', async () => {
        const atom1 = createMockAtom();
        const atom2 = createMockAtom();
        await worldModel.add_atom(atom1);
        await worldModel.add_atom(atom2);

        const belief1 = createMockBelief(atom1.id, { frequency: 1, confidence: 1 });
        belief1.label = 'special-filter';
        const belief2 = createMockBelief(atom2.id, { frequency: 1, confidence: 1 });
        await worldModel.add_item(belief1);
        await worldModel.add_item(belief2);

        const results = await worldModel.getItemsByFilter(item => item.label === 'special-filter');
        expect(results.length).toBe(1);
        expect(results[0].id).toEqual(belief1.id);
    });

    it('should query by symbolic pattern', async () => {
        const atom1 = createMockAtom('weather-symbolic');
        const atom2 = createMockAtom('sports-symbolic');
        await worldModel.add_atom(atom1);
        await worldModel.add_atom(atom2);

        const belief1 = createMockBelief(atom1.id, { frequency: 1, confidence: 1 });
        const belief2 = createMockBelief(atom2.id, { frequency: 1, confidence: 1 });
        await worldModel.add_item(belief1);
        await worldModel.add_item(belief2);

        const allItems = await worldModel.getItemsByFilter(() => true);
        const weatherItems = [];
        for (const item of allItems) {
            const atom = await worldModel.get_atom(item.atom_id);
            if (atom?.meta.domain === 'weather-symbolic') {
                weatherItems.push(item);
            }
        }

        expect(weatherItems.length).toBe(1);
        expect(weatherItems[0].atom_id).toEqual(atom1.id);
    });
});
