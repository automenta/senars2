import { WorldModelImpl } from './world-model';
import { BruteForceVectorStore } from './vector-store';
import { jest } from '@jest/globals';
import { SemanticAtom, CognitiveItem } from './types';

jest.setTimeout(60000);

describe('WorldModelImpl', () => {
  it('should query by structure using JSONPath', () => {
    const vectorStore = new BruteForceVectorStore();
    const model = new WorldModelImpl(vectorStore);

    // Atom for the file
    const fileAtom: SemanticAtom = {
      id: 'atom1',
      content: { type: 'file', attributes: { path: '/test/file.txt', content: 'hello world' } },
      embedding: [],
      meta: { timestamp: new Date().toISOString() },
    };
    model.add_atom(fileAtom);

    // Item for the file
    const fileItem: CognitiveItem = {
      id: 'item1',
      atom_id: 'atom1',
      type: 'BELIEF',
      truth: { frequency: 1, confidence: 1 },
    };
    model.add_item(fileItem);

    // Atom for the directory
    const dirAtom: SemanticAtom = {
      id: 'atom2',
      content: { type: 'directory', attributes: { path: '/test' } },
      embedding: [],
      meta: { timestamp: new Date().toISOString() },
    };
    model.add_atom(dirAtom);

    // Item for the directory
    const dirItem: CognitiveItem = {
        id: 'item2',
        atom_id: 'atom2',
        type: 'BELIEF',
        truth: { frequency: 1, confidence: 1 },
    };
    model.add_item(dirItem);

    const results = model.query_by_structure("$.[?(@.type=='file')]");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('item1');
  });
});
