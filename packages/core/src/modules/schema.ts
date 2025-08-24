import { CognitiveItem, SemanticAtom, UUID, newUUID, DerivationStamp, AttentionValue } from '../types';
import { WorldModel, CognitiveSchema } from '../world-model';

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

export class SchemaMatcherImpl implements SchemaMatcher {
    private schemas: AppliableCognitiveSchema[] = [];

    register_schema(atom: SemanticAtom): void {
        if (atom.meta.type !== "CognitiveSchema") {
            throw new Error("Atom is not of type CognitiveSchema");
        }

        // This is where a real system would have a complex compilation step.
        // We will hardcode a simple "implication" schema compiler.
        if (atom.content?.type === 'implication') {
            const compiledSchema = this.compileImplicationSchema();
            this.schemas.push({
                atom_id: atom.id,
                compiled: atom.content,
                apply: compiledSchema,
            });
            console.log(`Registered schema: ${atom.content.type}`);
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
                const result = schema.apply(itemA, itemB, itemA_atom, itemB_atom, world_model);
                if (result) {
                    derivedItems.push(result);
                }
            }
        }
        return derivedItems;
    }

    private compileImplicationSchema(): (itemA: CognitiveItem, itemB: CognitiveItem, atomA: SemanticAtom, atomB: SemanticAtom, world_model: WorldModel) => Omit<CognitiveItem, 'id' | 'attention' | 'stamp'> | null {
        // Matches:
        // A = BELIEF about atom `['implies', X, Y]`
        // B = BELIEF about atom `X`
        // Derives:
        // C = BELIEF about atom `Y`
        return (itemA, itemB, atomA, atomB, world_model) => {
            if (itemA.type !== 'BELIEF' || itemB.type !== 'BELIEF' || !itemA.truth || !itemB.truth) return null;

            const contentA = atomA.content;
            if (Array.isArray(contentA) && contentA[0] === 'implies' && contentA.length === 3) {
                const X = contentA[1];
                const Y = contentA[2];
                const contentB = atomB.content;

                if (JSON.stringify(X) === JSON.stringify(contentB)) {
                    console.log(`Implication schema matched: (${JSON.stringify(X)} implies ${JSON.stringify(Y)}) and (${JSON.stringify(contentB)}) -> deriving (${JSON.stringify(Y)})`);

                    const derivedAtom = world_model.find_or_create_atom(Y);

                    return {
                        atom_id: derivedAtom.id,
                        type: 'BELIEF',
                        truth: {
                            frequency: (itemA.truth.frequency + itemB.truth.frequency) / 2,
                            confidence: itemA.truth.confidence * itemB.truth.confidence * 0.9,
                        },
                        goal_parent_id: itemA.goal_parent_id ?? itemB.goal_parent_id,
                        label: `Derived: ${JSON.stringify(Y)}`,
                    };
                }
            }
            return null;
        };
    }
}
