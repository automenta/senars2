import { SchemaMatcher as ISchemaMatcher, CognitiveSchema, WorldModel } from '../types/interfaces';
import { CognitiveItem, SemanticAtom, UUID } from '../types/data';
import { itemMatchesPattern } from '../lib/utils';

export class SchemaMatcher implements ISchemaMatcher {
    private schemas = new Map<UUID, CognitiveSchema>();
    // Hashed index for performance: "TYPE_A:TYPE_B" -> [schema1, schema2]
    private schemaIndex = new Map<string, CognitiveSchema[]>();

    private generateIndexKey(typeA: string, typeB: string): string {
        // Canonical key ordering
        return [typeA, typeB].sort().join(':');
    }

    async register_schema(schema: CognitiveSchema, world_model: WorldModel): Promise<CognitiveSchema> {
        if (!schema || !schema.atom_id || typeof schema.apply !== 'function') {
            throw new Error("Attempted to register an invalid schema object.");
        }

        this.schemas.set(schema.atom_id, schema);

        // Index the schema for faster lookup
        const schemaAtom = await world_model.get_atom(schema.atom_id);
        if (schemaAtom?.content?.pattern) {
            const pattern = schemaAtom.content.pattern;
            const typeA = pattern.a?.type;
            const typeB = pattern.b?.type;

            if (typeA && typeB) {
                const key = this.generateIndexKey(typeA, typeB);
                const entries = this.schemaIndex.get(key) || [];
                entries.push(schema);
                this.schemaIndex.set(key, entries);
            }
        }

        console.log(`Successfully registered and indexed schema for: ${schema.atom_id}`);
        return schema;
    }

    async find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): Promise<CognitiveSchema[]> {
        const applicableSchemas: CognitiveSchema[] = [];
        const atomA = await world_model.get_atom(a.atom_id);
        const atomB = await world_model.get_atom(b.atom_id);

        if (!atomA || !atomB) {
            return [];
        }

        // Use the index to get a small list of candidate schemas
        const indexKey = this.generateIndexKey(a.type, b.type);
        const candidateSchemas = this.schemaIndex.get(indexKey) || [];

        for (const schema of candidateSchemas) {
            const schemaAtom = await world_model.get_atom(schema.atom_id);
            if (!schemaAtom?.content?.pattern) continue;

            const pattern = schemaAtom.content.pattern;

            // Check both permutations since the key is canonical
            if (itemMatchesPattern(a, atomA, pattern.a) && itemMatchesPattern(b, atomB, pattern.b)) {
                applicableSchemas.push(schema);
            } else if (itemMatchesPattern(b, atomB, pattern.a) && itemMatchesPattern(a, atomA, pattern.b)) {
                applicableSchemas.push(schema);
            }
        }

        return applicableSchemas;
    }
}
