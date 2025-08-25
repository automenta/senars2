import { WorldModelImpl } from './world-model.js';
import { BruteForceVectorStore } from './vector-store.js';
import { jest } from '@jest/globals';
import { SemanticAtom, CognitiveItem, UUID } from './types.js';

jest.setTimeout(60000);

describe('WorldModelImpl', () => {
  it('should query by structure using JSONPath', () => {
    const vectorStore = new BruteForceVectorStore();
    const model = new WorldModelImpl(vectorStore);

    // Atom for the file
    const fileAtom: SemanticAtom = {
      id: 'atom1' as UUID,
      content: { type: 'file', attributes: { path: '/test/file.txt', content: 'hello world' } },
      embedding: [],
      meta: { type: 'Fact', timestamp: new Date().toISOString() },
    };
    model.add_atom(fileAtom);

    // Item for the file
    const fileItem: CognitiveItem = {
      id: 'item1' as UUID,
      atom_id: 'atom1' as UUID,
      type: 'BELIEF',
      attention: { priority: 0.5, durability: 0.5 },
      stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 'test' as UUID },
      truth: { frequency: 1, confidence: 1 },
    };
    model.add_item(fileItem);

    // Atom for the directory
    const dirAtom: SemanticAtom = {
      id: 'atom2' as UUID,
      content: { type: 'directory', attributes: { path: '/test' } },
      embedding: [],
      meta: { type: 'Fact', timestamp: new Date().toISOString() },
    };
    model.add_atom(dirAtom);

    // Item for the directory
    const dirItem: CognitiveItem = {
        id: 'item2' as UUID,
        atom_id: 'atom2' as UUID,
        type: 'BELIEF',
        attention: { priority: 0.5, durability: 0.5 },
        stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 'test' as UUID },
        truth: { frequency: 1, confidence: 1 },
    };
    model.add_item(dirItem);

    const results = model.query_by_structure("$.[?(@.type=='file')]");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('item1');
  });
});
