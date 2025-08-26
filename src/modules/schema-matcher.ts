import { SchemaMatcher as ISchemaMatcher, CognitiveSchema, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom } from '../types/data';

export class SchemaMatcher implements ISchemaMatcher {
    register_schema(schema: SemanticAtom, world_model: WorldModel): CognitiveSchema {
        // Placeholder: Does not actually register anything.
        console.log(`SchemaMatcher: Registering schema ${schema.id} (stub)`);
        return {
            atom_id: schema.id,
            apply: (a: CognitiveItem, b: CognitiveItem, world_model: WorldModel) => {
                console.log(`Applying stub schema ${schema.id}`);
                return [];
            }
        };
    }

    find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): CognitiveSchema[] {
        // Placeholder: Returns no schemas.
        console.log(`SchemaMatcher: Finding applicable schemas for items ${a.id} and ${b.id} (stub)`);
        return [];
    }
}
