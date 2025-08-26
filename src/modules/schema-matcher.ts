import { SchemaMatcher as ISchemaMatcher, CognitiveSchema, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom, UUID } from '../types/data';
import { itemMatchesPattern, createAtomId } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';

export class SchemaMatcher implements ISchemaMatcher {
    private schemas = new Map<UUID, CognitiveSchema>();

    register_schema(schemaAtom: SemanticAtom, world_model: WorldModel): CognitiveSchema {
        if (schemaAtom.meta.type !== 'CognitiveSchema') {
            throw new Error("Attempted to register an atom that is not a CognitiveSchema.");
        }
        if (typeof schemaAtom.content.apply_logic !== 'string') {
            throw new Error(`Schema ${schemaAtom.id} is missing 'apply_logic' string in its content.`);
        }
        if (!Array.isArray(schemaAtom.content.apply_args)) {
            throw new Error(`Schema ${schemaAtom.id} is missing 'apply_args' array in its content.`);
        }

        // Dynamically create the apply function from the schema's content.
        // This is powerful but requires trusting the schema source.
        const applyFn = new Function(...schemaAtom.content.apply_args, schemaAtom.content.apply_logic);

        const schema: CognitiveSchema = {
            atom_id: schemaAtom.id,
            apply: (a: CognitiveItem, b: CognitiveItem, wm: WorldModel): CognitiveItem[] => {
                try {
                    // The dynamically created function needs access to certain context and helpers.
                    const context = {
                        a,
                        b,
                        wm,
                        uuidv4,
                        createAtomId,
                        // Add any other helpers schemas might need here
                    };
                    return applyFn(context);
                } catch (e: any) {
                    console.error(`Error executing schema ${schemaAtom.id}: ${e.message}`, e);
                    return []; // Return empty array on failure
                }
            }
        };

        this.schemas.set(schema.atom_id, schema);
        console.log(`Successfully registered schema: ${schemaAtom.id} (${schemaAtom.meta.label ?? 'No label'})`);
        return schema;
    }

    find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): CognitiveSchema[] {
        const applicableSchemas: CognitiveSchema[] = [];
        const atomA = world_model.get_atom(a.atom_id);
        const atomB = world_model.get_atom(b.atom_id);

        if (!atomA || !atomB) {
            return [];
        }

        for (const schema of this.schemas.values()) {
            const schemaAtom = world_model.get_atom(schema.atom_id);
            if (!schemaAtom || !schemaAtom.content || !schemaAtom.content.pattern) continue;

            const pattern = schemaAtom.content.pattern;

            // Check both permutations: (a,b) and (b,a)
            if (itemMatchesPattern(a, atomA, pattern.a) && itemMatchesPattern(b, atomB, pattern.b)) {
                applicableSchemas.push(schema);
            } else if (itemMatchesPattern(b, atomB, pattern.a) && itemMatchesPattern(a, atomA, pattern.b)) {
                // If the schema is not symmetric, we need to pass arguments in the correct order.
                // For now, we assume schemas handle this, but a more robust system might need flags.
                applicableSchemas.push(schema);
            }
        }

        return applicableSchemas;
    }
}
