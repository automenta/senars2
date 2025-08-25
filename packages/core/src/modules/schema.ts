import { CognitiveItem, SemanticAtom, UUID, newCognitiveItemId, DerivationStamp, AttentionValue, CognitiveItemType } from '../types';
import { WorldModel, CognitiveSchema } from '../world-model';
import { isEqual, isMatch } from 'lodash';

// A simple representation of a schema's application logic
type CompiledSchema = (a: CognitiveItem, b: CognitiveItem, a_atom: SemanticAtom, b_atom: SemanticAtom) => Omit<CognitiveItem, 'id' | 'attention' | 'stamp'> | null;

// Augment CognitiveSchema to hold the compiled function
export type AppliableCognitiveSchema = CognitiveSchema & {
    apply: CompiledSchema;
};

export interface SchemaMatcher {
    register_schema(atom: SemanticAtom): void;
    find_and_apply_schemas(
        itemA: CognitiveItem,
        context: CognitiveItem[],
        world_model: WorldModel
    ): Omit<CognitiveItem, 'id' | 'attention' | 'stamp'>[];
}

// --- A more generic, but still simple, Schema Matcher ---

type VariableBindings = { [key: string]: any };

export class SchemaMatcherImpl implements SchemaMatcher {
    private schemas: AppliableCognitiveSchema[] = [];
    private world_model: WorldModel;

    constructor(world_model: WorldModel) {
        this.world_model = world_model;
    }

    register_schema(atom: SemanticAtom): void {
        if (atom.meta.type !== "CognitiveSchema") {
            throw new Error("Atom is not of type CognitiveSchema");
        }

        const compiledSchema = this.compileGenericSchema(atom);
        if (compiledSchema) {
            this.schemas.push({
                atom_id: atom.id,
                compiled: atom.content,
                apply: compiledSchema,
            });
            console.log(`Registered schema: ${atom.id}`);
        }
    }

    find_and_apply_schemas(
        itemA: CognitiveItem,
        context: CognitiveItem[],
        world_model: WorldModel
    ): Omit<CognitiveItem, 'id' | 'attention' | 'stamp'>[] {
        const derivedItems: Omit<CognitiveItem, 'id' | 'attention' | 'stamp'>[] = [];
        const itemA_atom = world_model.get_atom(itemA.atom_id);

        if (!itemA_atom) return [];

        for (const itemB of context) {
            const itemB_atom = world_model.get_atom(itemB.atom_id);
            if (!itemB_atom) continue;

            for (const schema of this.schemas) {
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
            for(const key in template) {
                newObj[key] = this.substituteVariables(template[key], bindings);
            }
            return newObj;
        }

        return template;
    }
}
