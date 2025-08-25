import { CognitiveItem, CognitiveItemType, PartialCognitiveItem, SemanticAtom, UUID } from '../types';
import { WorldModel } from '../world-model';

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

export type DerivationResult = {
  partialItem: PartialCognitiveItem;
  parentItems: [CognitiveItem, CognitiveItem];
  schema: CognitiveSchema;
};

export interface SchemaMatcher {
  register_schema(schemaAtom: SemanticAtom): void;
  find_and_apply_schemas(
    itemA: CognitiveItem,
    contextItems: CognitiveItem[],
    worldModel: WorldModel,
  ): DerivationResult[];
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
      for (const itemB of contextItems) {
        const bindings = this.getBindings(itemA, itemB, schema, worldModel);
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

  private getBindings(a: CognitiveItem, b: CognitiveItem, schema: CognitiveSchema, worldModel: WorldModel): Record<string, any> | null {
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