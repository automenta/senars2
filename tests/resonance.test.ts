import { ResonanceModule } from '../src/modules/resonance';
import { WorldModel, CognitiveItem } from '@cognitive-arch/types';

const mockWorldModel: jest.Mocked<WorldModel> = {
  add_atom: jest.fn(),
  get_atom: jest.fn(),
  add_item: jest.fn(),
  get_item: jest.fn(),
  revise_belief: jest.fn(),
  update_item: jest.fn(),
  query_by_semantic: jest.fn(),
  query_by_symbolic: jest.fn(),
  query_by_structure: jest.fn(),
  register_schema_atom: jest.fn(),
  size: jest.fn(),
  getItemsByFilter: jest.fn(),
};

describe('ResonanceModule', () => {
  let resonanceModule: ResonanceModule;

  beforeEach(() => {
    jest.clearAllMocks();
    resonanceModule = new ResonanceModule();
  });

  it('should be defined', () => {
    expect(resonanceModule).toBeDefined();
  });

  describe('find_context', () => {
    it('should return an empty array if the source atom is not found', async () => {
      const item = { id: '1', atom_id: 'a1' } as CognitiveItem;
      mockWorldModel.get_atom.mockResolvedValue(null);

      const result = await resonanceModule.find_context(item, mockWorldModel, 5);

      expect(result).toEqual([]);
    });

    it('should find context without semantic search if embedding is missing', async () => {
        const item = { id: '1', atom_id: 'a1' } as CognitiveItem;
        const sourceAtom = { id: 'a1' } as any;
        const symbolicMatches = [{ id: '2' }, { id: '3' }] as any;

        mockWorldModel.get_atom.mockResolvedValue(sourceAtom);
        mockWorldModel.query_by_symbolic.mockResolvedValue(symbolicMatches);
        (resonanceModule as any).calculate_resonance_score = jest.fn().mockResolvedValue(0.5);

        const result = await resonanceModule.find_context(item, mockWorldModel, 1);

        expect(mockWorldModel.query_by_semantic).not.toHaveBeenCalled();
        expect(mockWorldModel.query_by_symbolic).toHaveBeenCalled();
        expect(result.length).toBe(1);
      });

      it('should find context with semantic search if embedding is present', async () => {
        const item = { id: '1', atom_id: 'a1' } as CognitiveItem;
        const sourceAtom = { id: 'a1', embedding: [1, 2, 3] } as any;
        const semanticMatches = [{ id: '4' }, { id: '5' }] as any;
        const symbolicMatches = [{ id: '2' }, { id: '3' }] as any;

        mockWorldModel.get_atom.mockResolvedValue(sourceAtom);
        mockWorldModel.query_by_semantic.mockResolvedValue(semanticMatches);
        mockWorldModel.query_by_symbolic.mockResolvedValue(symbolicMatches);
        (resonanceModule as any).calculate_resonance_score = jest.fn().mockResolvedValue(0.5);

        const result = await resonanceModule.find_context(item, mockWorldModel, 3);

        expect(mockWorldModel.query_by_semantic).toHaveBeenCalled();
        expect(mockWorldModel.query_by_symbolic).toHaveBeenCalled();
        expect(result.length).toBe(3);
      });

    it('should correctly score and rank candidates', async () => {
        const item = { id: '1', atom_id: 'a1' } as CognitiveItem;
        const sourceAtom = { id: 'a1', embedding: [1, 1, 1] } as any;
        const candidate1 = { id: 'c1', atom_id: 'ca1', attention: { priority: 0.8, durability: 0.8 } } as any;
        const candidate2 = { id: 'c2', atom_id: 'ca2', attention: { priority: 0.2, durability: 0.2 } } as any;
        const candidateAtom1 = { id: 'ca1', embedding: [1, 1, 1], meta: { trust_score: 0.9 } } as any;
        const candidateAtom2 = { id: 'ca2', embedding: [0, 0, 0], meta: { trust_score: 0.4 } } as any;

        mockWorldModel.get_atom.mockImplementation(id => {
            if (id === 'a1') return Promise.resolve(sourceAtom);
            if (id === 'ca1') return Promise.resolve(candidateAtom1);
            if (id === 'ca2') return Promise.resolve(candidateAtom2);
            return Promise.resolve(null);
        });
        mockWorldModel.query_by_semantic.mockResolvedValue([]);
        mockWorldModel.query_by_symbolic.mockResolvedValue([candidate1, candidate2]);

        const result = await resonanceModule.find_context(item, mockWorldModel, 2);

        expect(result.length).toBe(2);
        expect(result[0].id).toBe('c1');
        expect(result[1].id).toBe('c2');
      });
  });
});
