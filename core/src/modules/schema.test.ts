import { SchemaMatcherImpl } from './schema.js';
import { WorldModelImpl } from '../world-model.js';
import { CognitiveItem, newCognitiveItemId, SemanticAtom, UUID } from '../types.js';
import { createSemanticAtomId } from '../utils.js';

// Helper to create a dummy SemanticAtom
const createAtom = (content: any, embedding: number[] = []): SemanticAtom => {
  const meta = { type: 'Fact' as const, source: 'test' };
  const id = createSemanticAtomId(content, meta);
  return {
    id,
    content,
    embedding,
    meta,
  };
};

// Helper for creating different item types
const createItem = (
  atom: SemanticAtom,
  type: 'GOAL' | 'BELIEF' | 'QUERY',
  label: string,
): CognitiveItem => ({
  id: newCognitiveItemId(),
  atom_id: atom.id,
  type,
  label,
  attention: { priority: 0.5, durability: 0.5 },
  truth: type === 'BELIEF' ? { frequency: 1, confidence: 1 } : undefined,
  stamp: {
    timestamp: Date.now(),
    parent_ids: [],
    schema_id: 'initial' as UUID,
  },
});

describe('SchemaMatcherImpl', () => {
    let worldModel: WorldModelImpl;
    let schemaMatcher: SchemaMatcherImpl;

    beforeEach(() => {
        worldModel = new WorldModelImpl();
        schemaMatcher = new SchemaMatcherImpl(worldModel);
    });

    const schemaDefinition = {
      if: {
        a: { type: 'GOAL' },
        b: { type: 'BELIEF' },
      },
      then: {
        type: 'BELIEF',
        label_template: 'Achieved: {{a.label}}',
        atom_id_from: 'b',
      },
    };

    const schemaAtom = createAtom(schemaDefinition);
    schemaAtom.meta.type = 'CognitiveSchema';


    it('should not register a non-schema atom', () => {
      const notASchemaAtom = createAtom({ info: 'fact' }); // type is 'Fact' by default
      schemaMatcher.register_schema(notASchemaAtom);
      const results = schemaMatcher.find_and_apply_schemas(createItem(createAtom({}), 'GOAL', 'g'), [createItem(createAtom({}), 'BELIEF', 'b')], worldModel);
      expect(results.length).toBe(0);
    });

    it('should not register a malformed schema definition', () => {
      const malformedAtom = createAtom({ if: {} /* no 'then' */ });
      malformedAtom.meta.type = 'CognitiveSchema';
      schemaMatcher.register_schema(malformedAtom);
      const results = schemaMatcher.find_and_apply_schemas(createItem(createAtom({}), 'GOAL', 'g'), [createItem(createAtom({}), 'BELIEF', 'b')], worldModel);
      expect(results.length).toBe(0);
    });

    it('should successfully register a valid schema', () => {
        schemaMatcher.register_schema(schemaAtom);
        // How to check it was registered? The schemas map is private.
        // I'll check by seeing if it gets applied.
        const goalAtom = createAtom({ task: 'do something' });
        const beliefAtom = createAtom({ state: 'it is done' });
        const goalItem = createItem(goalAtom, 'GOAL', 'My Goal');
        const beliefItem = createItem(beliefAtom, 'BELIEF', 'Confirmation');
        const results = schemaMatcher.find_and_apply_schemas(goalItem, [beliefItem], worldModel);
        expect(results.length).toBe(1);
    });

    it('should correctly apply a registered schema to matching items', () => {
      schemaMatcher.register_schema(schemaAtom);

      const goalAtom = createAtom({ task: 'do something' });
      const beliefAtom = createAtom({ state: 'it is done' });

      const goalItem = createItem(goalAtom, 'GOAL', 'My Goal');
      const beliefItem = createItem(beliefAtom, 'BELIEF', 'Confirmation');

      const derivationResults = schemaMatcher.find_and_apply_schemas(goalItem, [beliefItem], worldModel);

      expect(derivationResults).toHaveLength(1);
      const derived = derivationResults[0].partialItem;

      expect(derived.type).toBe('BELIEF');
      expect(derived.label).toBe('Achieved: My Goal');
      expect(derived.atom_id).toBe(beliefAtom.id);
    });

    it('should not apply a schema to non-matching items', () => {
      schemaMatcher.register_schema(schemaAtom);

      const goalAtom = createAtom({ task: 'do something' });
      const anotherGoalAtom = createAtom({ state: 'another goal' });

      const goalItem = createItem(goalAtom, 'GOAL', 'My Goal');
      // The schema expects a BELIEF as the second item, not another GOAL
      const anotherGoalItem = createItem(anotherGoalAtom, 'GOAL', 'Another Goal');

      const derivedItems = schemaMatcher.find_and_apply_schemas(goalItem, [anotherGoalItem], worldModel);

      expect(derivedItems).toHaveLength(0);
    });
});
