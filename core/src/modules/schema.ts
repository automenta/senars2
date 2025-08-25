import { CognitiveItem, CognitiveItemType, SemanticAtom, UUID } from '../types';
import { WorldModel } from '../world-model';
import { isEqual } from 'lodash';

// A simple representation of a schema's application logic
type CompiledSchema = (a: CognitiveItem, b: CognitiveItem, a_atom: SemanticAtom, b_atom: SemanticAtom) => Omit<CognitiveItem, 'id' | 'attention' | 'stamp'> | null;

// A self-contained type for a schema that has been compiled into an executable function.
export type AppliableCognitiveSchema = {
  atom_id: UUID;
  compiled_content: any;
  apply: CompiledSchema;
};

export interface SchemaMatcher {
  register_schema(atom: SemanticAtom): void;

  find_and_apply_schemas(
    itemA: CognitiveItem,
    context: CognitiveItem[],
    world_model: WorldModel,
  ): Omit<CognitiveItem, 'id' | 'attention' | 'stamp'>[];
}

// --- A more generic, but still simple, Schema Matcher ---

type VariableBindings = { [key: string]: any };

export class SchemaMatcherImpl implements SchemaMatcher {
  // A two-level map for efficient schema lookup.
  // First key: itemA.type, Second key: itemB.type
  private schemas: Map<CognitiveItemType, Map<CognitiveItemType, AppliableCognitiveSchema[]>> = new Map();
  private world_model: WorldModel;

  constructor(world_model: WorldModel) {
    this.world_model = world_model;
  }

  register_schema(atom: SemanticAtom): void {
    if (atom.meta.type !== 'CognitiveSchema') {
      throw new Error('Atom is not of type CognitiveSchema');
    }

    const { patternA, patternB } = atom.content;
    if (!patternA?.type || !patternB?.type) {
      console.warn(`Schema ${atom.id} is missing pattern types and cannot be indexed.`);
      return;
    }
    const typeA = patternA.type as CognitiveItemType;
    const typeB = patternB.type as CognitiveItemType;

    const compiledSchema = this.compileGenericSchema(atom);
    if (compiledSchema) {
      const appliableSchema: AppliableCognitiveSchema = {
        atom_id: atom.id,
        compiled_content: atom.content,
        apply: compiledSchema,
      };

      // Get or create the first-level map for typeA
      let innerMap = this.schemas.get(typeA);
      if (!innerMap) {
        innerMap = new Map<CognitiveItemType, AppliableCognitiveSchema[]>();
        this.schemas.set(typeA, innerMap);
      }

      // Get or create the schema list for typeB
      let schemaList = innerMap.get(typeB);
      if (!schemaList) {
        schemaList = [];
        innerMap.set(typeB, schemaList);
      }

      schemaList.push(appliableSchema);
      console.log(`Registered schema ${atom.id} for types (${typeA}, ${typeB})`);
    }
  }

  find_and_apply_schemas(
    itemA: CognitiveItem,
    context: CognitiveItem[],
    world_model: WorldModel,
  ): Omit<CognitiveItem, 'id' | 'attention' | 'stamp'>[] {
    const derivedItems: Omit<CognitiveItem, 'id' | 'attention' | 'stamp'>[] = [];
    const itemA_atom = world_model.get_atom(itemA.atom_id);
    if (!itemA_atom) return [];

    // Find potentially applicable schemas using the index
    const potentialSchemasMap = this.schemas.get(itemA.type);
    if (!potentialSchemasMap) {
      return [];
    }

    for (const itemB of context) {
      // Find the specific list of schemas for the (itemA.type, itemB.type) pair
      const schemaList = potentialSchemasMap.get(itemB.type);
      if (!schemaList || schemaList.length === 0) {
        continue; // No schemas for this type combination
      }

      const itemB_atom = world_model.get_atom(itemB.atom_id);
      if (!itemB_atom) continue;

      for (const schema of schemaList) {
        // The compiled schema already checks for type and pattern matches.
        const result = schema.apply(itemA, itemB, itemA_atom, itemB_atom);
        if (result) {
          derivedItems.push(result);
        }
      }
    }
    return derivedItems;
  }

  private compileGenericSchema(schemaAtom: SemanticAtom): CompiledSchema | null {
    const { patternA, patternB, derivation } = schemaAtom.content;
    if (!patternA || !patternB || !derivation) {
      return null;
    }

    return (itemA, itemB, atomA, atomB) => {
      const bindings: VariableBindings = {};

      // 1. Match item types
      if (itemA.type !== patternA.type || itemB.type !== patternB.type) {
        return null;
      }

      // 2. Match patterns and extract variables
      if (!this.matchPattern(atomA.content, patternA.content, bindings) ||
        !this.matchPattern(atomB.content, patternB.content, bindings)) {
        return null;
      }

      // 3. If match is successful, create the derived item
      const derivedContent = this.substituteVariables(derivation.content, bindings);
      const derivedAtom = this.world_model.find_or_create_atom(derivedContent, {
        type: 'Fact',
        source: 'inference',
        derivedFromSchema: schemaAtom.id,
      });

      const derivedTruth = (itemA.truth && itemB.truth)
        ? {
          frequency: (itemA.truth.frequency + itemB.truth.frequency) / 2,
          confidence: itemA.truth.confidence * itemB.truth.confidence * 0.9,
        }
        : undefined;

      return {
        atom_id: derivedAtom.id,
        type: derivation.type as CognitiveItemType,
        truth: derivedTruth,
        goal_parent_id: itemA.goal_parent_id ?? itemB.goal_parent_id,
        label: `Derived from ${schemaAtom.id}`,
      };
    };
  }

  private matchPattern(content: any, pattern: any, bindings: VariableBindings): boolean {
    if (typeof pattern === 'string' && pattern.startsWith('?')) {
      const varName = pattern.substring(1);
      if (bindings[varName] !== undefined) {
        return isEqual(bindings[varName], content);
      } else {
        bindings[varName] = content;
        return true;
      }
    }

    if (Array.isArray(pattern) && Array.isArray(content)) {
      if (pattern.length !== content.length) return false;
      for (let i = 0; i < pattern.length; i++) {
        if (!this.matchPattern(content[i], pattern[i], bindings)) {
          return false;
        }
      }
      return true;
    }

    return isEqual(content, pattern);
  }

  private substituteVariables(template: any, bindings: VariableBindings): any {
    if (typeof template === 'string' && template.startsWith('?')) {
      const varName = template.substring(1);
      return bindings[varName] ?? template;
    }

    if (Array.isArray(template)) {
      return template.map(t => this.substituteVariables(t, bindings));
    }

    if (typeof template === 'object' && template !== null) {
      const newObj: { [key: string]: any } = {};
      for (const key in template) {
        newObj[key] = this.substituteVariables(template[key], bindings);
      }
      return newObj;
    }

    return template;
  }
}
