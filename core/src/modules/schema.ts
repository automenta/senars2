import { CognitiveItem, CognitiveItemType, PartialCognitiveItem, SemanticAtom, UUID } from '../types';
import { WorldModel } from '../world-model';

export type SubGoal = {
  temp_id: string; // A temporary, schema-local ID like "step1"
  label: string;
  type: CognitiveItemType;
  dependencies?: string[]; // References to other temp_ids
};

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
    sub_goals?: SubGoal[]; // For goal decomposition schemas
  };
};

export type CognitiveSchema = {
  atom_id: UUID;
  content: CognitiveSchemaContent;
};

export type DerivationResult = {
  partialItem: PartialCognitiveItem;
  parentItems: [CognitiveItem, CognitiveItem];
  schema: CognitiveSchema;
};

export type DecompositionResult = {
  partialItem: PartialCognitiveItem;
  schema: CognitiveSchema;
};

export interface SchemaMatcher {
  register_schema(schemaAtom: SemanticAtom): void;
  find_and_apply_schemas(
    itemA: CognitiveItem,
    contextItems: CognitiveItem[],
    worldModel: WorldModel,
  ): DerivationResult[];
  find_and_apply_decomposition_schemas(
    goal: CognitiveItem,
    worldModel: WorldModel,
  ): DecompositionResult[];
}

export class SchemaMatcherImpl implements SchemaMatcher {
  private schemas: Map<UUID, CognitiveSchema> = new Map();

  public register_schema(schemaAtom: SemanticAtom): void {
    if (schemaAtom.meta.type !== 'CognitiveSchema') return;
    const schemaContent: CognitiveSchemaContent = schemaAtom.content;
    if (!schemaContent?.if || !schemaContent?.then) return;
    this.schemas.set(schemaAtom.id, { atom_id: schemaAtom.id, content: schemaContent });
  }

  public find_and_apply_schemas(
    itemA: CognitiveItem,
    contextItems: CognitiveItem[],
    worldModel: WorldModel,
  ): DerivationResult[] {
    const results: DerivationResult[] = [];
    for (const schema of this.schemas.values()) {
      // Skip decomposition schemas
      if (schema.content.then.sub_goals) continue;

      for (const itemB of contextItems) {
        const bindings = this.getBinaryBindings(itemA, itemB, schema, worldModel);
        if (bindings) {
          results.push({
            partialItem: this.apply_schema(schema, bindings, worldModel),
            parentItems: [itemA, itemB],
            schema,
          });
        }
      }
    }
    return results;
  }

  public find_and_apply_decomposition_schemas(
    goal: CognitiveItem,
    worldModel: WorldModel,
  ): DecompositionResult[] {
    const results: DecompositionResult[] = [];
    for (const schema of this.schemas.values()) {
      // Only consider schemas with a `sub_goals` clause
      if (!schema.content.then.sub_goals) continue;

      const bindings = this.getUnaryBindings(goal, schema, worldModel);
      if (bindings) {
        const partialItems = this.apply_decomposition_schema(schema, bindings, worldModel);
        for (const partialItem of partialItems) {
          results.push({
            partialItem,
            schema,
          });
        }
      }
    }
    return results;
  }

  private getUnaryBindings(item: CognitiveItem, schema: CognitiveSchema, worldModel: WorldModel): Record<string, any> | null {
    const atom = worldModel.get_atom(item.atom_id);
    if (!atom) return null;

    const pattern = schema.content.if.a;
    // Ensure it's a unary schema (no 'b' condition)
    if (!pattern || schema.content.if.b) return null;

    if (pattern.type && item.type !== pattern.type) return null;

    const bindings = pattern.content_pattern ? this.matchPattern(pattern.content_pattern, atom.content) : {};
    if (!bindings) return null;

    // Also try to match against the label
    const labelBindings = pattern.label_pattern ? this.matchPattern(pattern.label_pattern, item.label || "") : {};
    if(!labelBindings) return null;

    return { ...bindings, ...labelBindings };
  }

  private getBinaryBindings(a: CognitiveItem, b: CognitiveItem, schema: CognitiveSchema, worldModel: WorldModel): Record<string, any> | null {
  private getBinaryBindings(a: CognitiveItem, b: CognitiveItem, schema: CognitiveSchema, worldModel: WorldModel): Record<string, any> | null {
    const atomA = worldModel.get_atom(a.atom_id);
    const atomB = worldModel.get_atom(b.atom_id);
    if (!atomA || !atomB) return null;

    const patternA = schema.content.if.a;
    const patternB = schema.content.if.b;
    if (!patternA || !patternB) return null; // Only supports 2-item schemas for now

    if (patternA.type && a.type !== patternA.type) return null;
    if (patternB.type && b.type !== patternB.type) return null;

    const bindingsA = patternA.content_pattern ? this.matchPattern(patternA.content_pattern, atomA.content) : {};
    if (!bindingsA) return null;

    const bindingsB = patternB.content_pattern ? this.matchPattern(patternB.content_pattern, atomB.content, bindingsA) : {};
    if (!bindingsB) return null;

    return { ...bindingsA, ...bindingsB };
  }

  private apply_schema(schema: CognitiveSchema, bindings: Record<string, any>, worldModel: WorldModel): PartialCognitiveItem {
    const thenClause = schema.content.then;
    const newContent = this.applyTemplate(thenClause.content_template, bindings);
    const newAtom = worldModel.find_or_create_atom(newContent, {
      type: 'Fact',
      source: `schema:${schema.atom_id}`,
      trust_score: 0.8,
    });
    return {
      atom_id: newAtom.id,
      type: thenClause.type,
      label: this.applyTemplate(thenClause.label_template || '', bindings),
      truth: thenClause.truth || { frequency: 1.0, confidence: 0.8 },
    };
  }

  private apply_decomposition_schema(schema: CognitiveSchema, bindings: Record<string, any>, worldModel: WorldModel): PartialCognitiveItem[] {
    const thenClause = schema.content.then;
    if (!thenClause.sub_goals) return [];

    const partialItems: PartialCognitiveItem[] = [];
    for (const subGoalTemplate of thenClause.sub_goals) {
      const newLabel = this.applyTemplate(subGoalTemplate.label, bindings);
      const newAtomContent = `(goal: "${newLabel}")`; // Simple content for now
      const newAtom = worldModel.find_or_create_atom(newAtomContent, {
        type: 'Fact',
        source: `schema:${schema.atom_id}`,
      });

      const partialItem: PartialCognitiveItem & { temp_id: string, dependencies?: string[] } = {
        atom_id: newAtom.id,
        type: subGoalTemplate.type,
        label: newLabel,
        goal_status: 'active', // Initial status
        temp_id: subGoalTemplate.temp_id,
        dependencies: subGoalTemplate.dependencies,
      };
      partialItems.push(partialItem);
    }

    return partialItems;
  }

  private matchPattern(pattern: string, value: any, initialBindings: Record<string, any> = {}): Record<string, any> | null {
    if (typeof value !== 'string' || typeof pattern !== 'string') return null;
    const patternTokens = pattern.split(/\s+/);
    const valueTokens = value.split(/\s+/);
    if (patternTokens.length !== valueTokens.length) return null;
    const bindings = { ...initialBindings };
    for (let i = 0; i < patternTokens.length; i++) {
      const pToken = patternTokens[i];
      const vToken = valueTokens[i];
      if (pToken.startsWith('?')) {
        if (bindings[pToken] && bindings[pToken] !== vToken) return null;
        bindings[pToken] = vToken;
      } else if (pToken !== vToken) {
        return null;
      }
    }
    return bindings;
  }

  private applyTemplate(template: string, bindings: Record<string, any>): string {
    if (!template) return '';
    let result = template;
    for (const key in bindings) {
      result = result.replace(new RegExp(`\\${key}`, 'g'), bindings[key]);
    }
    return result;
  }
}