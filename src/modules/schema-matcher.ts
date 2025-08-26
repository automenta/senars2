import { SchemaMatcher as ISchemaMatcher, CognitiveSchema, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom, UUID } from '../types/data';
import { itemMatchesPattern } from '../lib/utils';

export class SchemaMatcher implements ISchemaMatcher {
    private schemas = new Map<UUID, CognitiveSchema>();

    register_schema(schema: CognitiveSchema, world_model: WorldModel): CognitiveSchema {
        // The world_model argument is no longer strictly needed here but is kept for interface consistency.
        // A future implementation might use it to validate the schema against the DB.
        if (!schema || !schema.atom_id || typeof schema.apply !== 'function') {
            throw new Error("Attempted to register an invalid schema object.");
        }

        this.schemas.set(schema.atom_id, schema);
        console.log(`Successfully registered schema logic for: ${schema.atom_id}`);
        return schema;
    }

    async find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): Promise<CognitiveSchema[]> {
        const applicableSchemas: CognitiveSchema[] = [];
        const atomA = await world_model.get_atom(a.atom_id);
        const atomB = await world_model.get_atom(b.atom_id);

        if (!atomA || !atomB) {
            return [];
        }

        for (const schema of this.schemas.values()) {
            const schemaAtom = await world_model.get_atom(schema.atom_id);
            if (!schemaAtom || !schemaAtom.content || !schemaAtom.content.pattern) continue;

            const pattern = schemaAtom.content.pattern;

            // Check both permutations: (a,b) and (b,a)
            // Note: The `itemMatchesPattern` utility checks the item's atom against the pattern.
            if (itemMatchesPattern(a, atomA, pattern.a) && itemMatchesPattern(b, atomB, pattern.b)) {
                applicableSchemas.push(schema);
            } else if (itemMatchesPattern(b, atomB, pattern.a) && itemMatchesPattern(a, atomA, pattern.b)) {
                // If the schema is not symmetric, we need to pass arguments in the correct order.
                // For now, we assume the schema's apply function can handle either order.
                applicableSchemas.push(schema);
            }
        }

        return applicableSchemas;
    }
}
