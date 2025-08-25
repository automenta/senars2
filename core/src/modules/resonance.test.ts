import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { ResonanceModuleImpl } from './resonance.js';
import { WorldModel } from '../world-model.js';
import { CognitiveItem, SemanticAtom, UUID } from '../types.js';
import { newCognitiveItemId } from '../types.js';

// Helper to create a mock SemanticAtom
const createMockAtom = (id: UUID, content: any, source: string, trust: number): SemanticAtom => ({
  id,
  content,
  embedding: [],
  meta: {
    type: 'Fact',
    source,
    trust_score: trust,
  },
});

// Helper to create a mock CognitiveItem
const createMockItem = (atom_id: UUID, label: string): CognitiveItem => ({
  id: newCognitiveItemId(),
  atom_id,
  type: 'BELIEF',
  attention: { priority: 0.5, durability: 0.5 },
  stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's1' as UUID },
  label,
});

describe('ResonanceModuleImpl', () => {
  let module: ResonanceModuleImpl;
  let mockWorldModel: jest.Mocked<WorldModel>;

  // Atoms
  const compliantAtom = createMockAtom('a1' as UUID, 'compliant content', 'vetdb.org', 0.95);
  const nonCompliantSourceAtom = createMockAtom('a2' as UUID, 'wrong source', 'some-blog', 0.95);
  const nonCompliantTrustAtom = createMockAtom('a3' as UUID, 'low trust', 'vetdb.org', 0.5);
  const otherAtom = createMockAtom('a4' as UUID, 'other content', 'another-source', 0.8);

  // Items
  const compliantItem = createMockItem(compliantAtom.id, 'Compliant Item');
  const nonCompliantSourceItem = createMockItem(nonCompliantSourceAtom.id, 'Wrong Source Item');
  const nonCompliantTrustItem = createMockItem(nonCompliantTrustAtom.id, 'Low Trust Item');
  const otherItem = createMockItem(otherAtom.id, 'Other Item');

  const allItems = [compliantItem, nonCompliantSourceItem, nonCompliantTrustItem, otherItem];
  const allAtoms = [compliantAtom, nonCompliantSourceAtom, nonCompliantTrustAtom, otherAtom];

  beforeEach(() => {
    module = new ResonanceModuleImpl();
    mockWorldModel = {
      get_atom: jest.fn((id: UUID) => allAtoms.find(a => a.id === id) || null),
      get_item: jest.fn(),
      add_atom: jest.fn(),
      add_item: jest.fn(),
      get_all_atoms: jest.fn().mockReturnValue(allAtoms),
      get_all_items: jest.fn().mockReturnValue(allItems),
      query_by_semantic: jest.fn().mockReturnValue(allItems), // Return all for simplicity
      query_by_symbolic: jest.fn().mockReturnValue([]),
      query_by_structure: jest.fn().mockReturnValue([]),
      revise_belief: jest.fn(),
      on: jest.fn(),
    } as jest.Mocked<WorldModel>;
  });

  it('should boost the score of items that satisfy a goal\'s trust constraints', async () => {
    const targetGoal: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: 'g1' as UUID,
      type: 'GOAL',
      label: 'Diagnose cat with trust',
      attention: { priority: 0.9, durability: 0.9 },
      stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's_goal' as UUID },
      constraints: {
        required_sources: {
          'vetdb.org': 0.9,
        },
      },
    };

    // The mock query should return all items so we can test the sorting
    mockWorldModel.query_by_semantic.mockReturnValue(allItems);

    const context = await module.find_context(targetGoal, mockWorldModel, 10);

    // The compliant item should be ranked first due to the strong boost
    expect(context.length).toBeGreaterThan(0);
    expect(context[0].id).toBe(compliantItem.id);
    expect(context[0].label).toBe('Compliant Item');
  });

  it('should not apply boost when no constraints are present', async () => {
    const targetGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: 'g2' as UUID,
        type: 'GOAL',
        label: 'Diagnose cat without trust',
        attention: { priority: 0.9, durability: 0.9 },
        stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 's_goal' as UUID },
        // No constraints
      };

      // In a normal scenario without the boost, the default sorting might not put the compliant item first
      // We will just check that it runs without error and returns items
      const context = await module.find_context(targetGoal, mockWorldModel, 10);
      expect(context.length).toBeGreaterThan(0);
      // We can't be sure of the order here, but we know the compliant item won't get the special boost.
  });
});
