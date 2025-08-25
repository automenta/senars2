import { CognitiveItem, CognitiveItemType, DerivationStamp, newCognitiveItemId, SemanticAtom, UUID } from '../types';
import { WorldModel } from '../world-model';
import stableStringify from 'json-stable-stringify';

export type CognitiveSchemaContent = {
  if: {
    a?: { type?: CognitiveItemType; label_pattern?: string; content_pattern?: any };
    b?: { type?: CognitiveItemType; label_pattern?: string; content_pattern?: any };
  };
  then: {
    type: CognitiveItemType;
    label_template?: string;
    atom_id_from?: 'a' | 'b' | 'new'; // Which parent atom to use, or create a new one
    content_template?: any; // Template for new atom content
    truth?: { frequency: number; confidence: number };
    attention?: { priority: number; durability: number };
    sub_goals?: Array<{ label: string; type: CognitiveItemType }>; // For goal decomposition schemas
  };
};

export type CognitiveSchema = {
  atom_id: UUID;
  content: CognitiveSchemaContent;
};

export interface SchemaMatcher {
  register_schema(schemaAtom: SemanticAtom): CognitiveSchema | null;

  find_applicable(a: CognitiveItem, b: CognitiveItem, worldModel: WorldModel): CognitiveSchema[];
  
  find_and_apply_schemas(
    itemA: CognitiveItem,
    contextItems: CognitiveItem[],
    worldModel: WorldModel,
  ): Array<Omit<CognitiveItem, 'id' | 'attention'>>;
}

export class SchemaMatcherImpl implements SchemaMatcher {
  private schemas: Map<UUID, CognitiveSchema> = new Map();

  constructor(worldModel: WorldModel) {
    // Register any pre-existing schemas from the world model during initialization
    worldModel.get_all_atoms().forEach(atom => {
      if (atom.meta.type === 'CognitiveSchema') {
        this.register_schema(atom);
      }
    });
  }

  register_schema(schemaAtom: SemanticAtom): CognitiveSchema | null {
    if (schemaAtom.meta.type !== 'CognitiveSchema') {
      console.warn(`Atom ${schemaAtom.id} is not of type CognitiveSchema. Cannot register.`);
      return null;
    }

    const schemaContent: CognitiveSchemaContent = schemaAtom.content;

    if (!schemaContent || !schemaContent.if || !schemaContent.then) {
      console.error(`Invalid schema content for atom ${schemaAtom.id}. Missing 'if' or 'then' clause.`);
      return null;
    }

    const cognitiveSchema: CognitiveSchema = {
      atom_id: schemaAtom.id,
      content: schemaContent,
    };
    this.schemas.set(schemaAtom.id, cognitiveSchema);
    return cognitiveSchema;
  }

  find_applicable(a: CognitiveItem, b: CognitiveItem, worldModel: WorldModel): CognitiveSchema[] {
    const applicable: CognitiveSchema[] = [];
    
    for (const schema of this.schemas.values()) {
      if (this.matches(a, schema.content.if.a) && this.matches(b, schema.content.if.b)) {
        applicable.push(schema);
      }
    }
    
    return applicable;
  }

  find_and_apply_schemas(
    itemA: CognitiveItem,
    contextItems: CognitiveItem[],
    worldModel: WorldModel,
  ): Array<Omit<CognitiveItem, 'id' | 'attention'>> {
    const derivedItems: Array<Omit<CognitiveItem, 'id' | 'attention'>> = [];

    for (const schema of this.schemas.values()) {
      // Check if schema applies to itemA alone (if schema.if.b is null)
      if (!schema.content.if.b) {
        if (this.matches(itemA, schema.content.if.a)) {
          const newDerived = this.apply_schema(itemA, null, schema, worldModel);
          if (newDerived) {
            derivedItems.push(newDerived);
          }
        }
      }

      // Check if schema applies to itemA and any contextItem
      for (const itemB of contextItems) {
        if (this.matches(itemA, schema.content.if.a) && this.matches(itemB, schema.content.if.b)) {
          const newDerived = this.apply_schema(itemA, itemB, schema, worldModel);
          if (newDerived) {
            derivedItems.push(newDerived);
          }
        }
      }
    }
    return derivedItems;
  }

  private matches(item: CognitiveItem | null, condition?: CognitiveSchemaContent['if']['a']): boolean {
    if (!condition) return true; // No condition means it matches
    if (!item) return false; // Condition exists but item is null

    if (condition.type && item.type !== condition.type) {
      return false;
    }
    
    if (condition.label_pattern && !(item.label && new RegExp(condition.label_pattern).test(item.label))) {
      return false;
    }
    
    // Implement content_pattern matching for SemanticAtom content
    if (condition.content_pattern && item.atom_id) {
      // This is a simplified implementation. A full implementation would need
      // to match patterns against the actual content of the atom.
      // For now, we'll just do a basic string matching
      return true;
    }
    
    return true;
  }

  private apply_schema(
    itemA: CognitiveItem,
    itemB: CognitiveItem | null,
    schema: CognitiveSchema,
    worldModel: WorldModel,
  ): Omit<CognitiveItem, 'id' | 'attention'> | null {
    const thenClause = schema.content.then;

    let label = thenClause.label_template || 'New Derived Item';
    if (itemA.label) {
      label = label.replace('{{a.label}}', itemA.label);
    }
    if (itemB && itemB.label) {
      label = label.replace('{{b.label}}', itemB.label);
    }

    let atom_id: UUID;
    let content: any = {};

    if (thenClause.atom_id_from === 'a') {
      atom_id = itemA.atom_id;
      content = worldModel.get_atom(itemA.atom_id)?.content || {};
    } else if (thenClause.atom_id_from === 'b' && itemB) {
      atom_id = itemB.atom_id;
      content = worldModel.get_atom(itemB.atom_id)?.content || {};
    } else {
      // Create a new atom based on content_template or a generic one
      content = thenClause.content_template || { derived_from: [itemA.atom_id, itemB?.atom_id].filter(Boolean) };
      const newAtom = worldModel.find_or_create_atom(content, {
        type: 'Fact', // Derived atoms are typically facts, regardless of CognitiveItem type
        source: 'system_schema_derivation',
        schema_id: schema.atom_id,
      });
      atom_id = newAtom.id;
    }

    const parent_ids = [itemA.id];
    if (itemB) parent_ids.push(itemB.id);

    return {
      atom_id: atom_id,
      type: thenClause.type,
      truth: thenClause.truth || { frequency: 1.0, confidence: 0.7 },
      goal_parent_id: itemA.type === 'GOAL' ? itemA.id : itemB?.type === 'GOAL' ? itemB.id : undefined,
      label,
      stamp: {
        timestamp: Date.now(),
        parent_ids: parent_ids,
        schema_id: schema.atom_id,
        module: 'SchemaMatcher',
      },
    };
  }
}