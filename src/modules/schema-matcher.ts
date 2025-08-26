import { SchemaMatcher as ISchemaMatcher, CognitiveSchema, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom, UUID } from '../types/data';

// Helper to check if an item/atom pair matches a simple pattern object.
function itemMatchesPattern(item: CognitiveItem, atom: SemanticAtom, pattern: any): boolean {
    if (!pattern) return true; // No pattern means it always matches.
    for (const key in pattern) {
        const expectedValue = pattern[key];
        // Check item properties (e.g., "type") or atom properties (e.g., "atom.meta.domain")
        const path = key.startsWith('atom.') ? key.substring(5) : key;
        const targetObj = key.startsWith('atom.') ? atom : item;
        const actualValue = getProperty(targetObj, path);

        if (actualValue !== expectedValue) {
            return false;
        }
    }
    return true;
}

// A simple property getter.
function getProperty(obj: any, path: string): any {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : undefined), obj);
}

export class SchemaMatcher implements ISchemaMatcher {
    private schemas = new Map<UUID, CognitiveSchema>();

    register_schema(schemaAtom: SemanticAtom, world_model: WorldModel): CognitiveSchema {
        if (schemaAtom.meta.type !== 'CognitiveSchema') {
            throw new Error("Attempted to register an atom that is not a CognitiveSchema.");
        }

        const schema: CognitiveSchema = {
            atom_id: schemaAtom.id,
            // The `apply` function is where the magic happens.
            // In a real system, this would be dynamically created based on the schema's content.
            apply: (a: CognitiveItem, b: CognitiveItem, wm: WorldModel): CognitiveItem[] => {
                console.log(`Applying schema ${schemaAtom.id} to items ${a.id} and ${b.id}`);
                // This is where the derivation logic would go, creating new CognitiveItems.
                // For now, it's a placeholder.
                return [];
            }
        };

        this.schemas.set(schema.atom_id, schema);
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
                applicableSchemas.push(schema);
            }
        }

        return applicableSchemas;
    }
}
