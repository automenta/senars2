import {
    CognitiveItem,
    SemanticAtom,
    UUID,
    TruthValue
} from '../types/data';
import {
    WorldModel as IWorldModel,
    BeliefRevisionEngine as IBeliefRevisionEngine,
    CognitiveSchema
} from '../types/interfaces';
import { EventBus } from '../core/event-bus';

// HNSWLib for semantic search
import { HierarchicalNSW } from 'hnswlib-node';

// RxDB Imports
import {
    createRxDatabase,
    addRxPlugin,
    RxDatabase,
    RxCollection,
    RxJsonSchema
} from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';

addRxPlugin(RxDBDevModePlugin);

const EMBEDDING_DIM = 384; // From xenova/transformers all-MiniLM-L6-v2

// --- Schema Definitions ---
const atomSchema: RxJsonSchema<SemanticAtom> = {
    title: 'semantic atom schema',
    version: 0,
    description: 'A content-addressable unit of knowledge',
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        content: { type: 'object' },
        embedding: { type: 'array', items: { type: 'number' } },
        meta: { type: 'object' }
    },
    required: ['id', 'content', 'meta']
};

const itemSchema: RxJsonSchema<CognitiveItem> = {
    title: 'cognitive item schema',
    version: 0,
    description: 'A contextualized thought or stance towards an atom',
    primaryKey: 'id',
    type: 'object',
    properties: {
        id: { type: 'string', maxLength: 100 },
        atom_id: { type: 'string', maxLength: 100 },
        type: { type: 'string', maxLength: 10 },
        truth: { type: 'object' },
        attention: { type: 'object' },
        stamp: { type: 'object' },
        goal_parent_id: { type: 'string', maxLength: 100 },
        goal_status: { type: 'string', maxLength: 10 },
        label: { type: 'string' }
    },
    required: ['id', 'atom_id', 'type', 'attention', 'stamp'],
    indexes: ['atom_id', 'type', 'goal_parent_id', 'goal_status']
};

// --- Belief Revision Engine ---
export class BeliefRevisionEngine implements IBeliefRevisionEngine {
    merge(existing: TruthValue, newTruth: TruthValue): TruthValue {
        const w1 = existing.confidence;
        const w2 = newTruth.confidence;
        const totalW = w1 + w2;
        if (totalW === 0) return { frequency: 0, confidence: 0 };
        const frequency = (w1 * existing.frequency + w2 * newTruth.frequency) / totalW;
        const confidence = Math.min(0.99, (w1 + w2) / 2 + 0.1);
        return { frequency, confidence };
    }
    detect_conflict(a: TruthValue, b: TruthValue): boolean {
        return Math.abs(a.frequency - b.frequency) > 0.5 && a.confidence > 0.7 && b.confidence > 0.7;
    }
}

// --- World Model Implementation ---
export class WorldModel implements IWorldModel {
    private db!: RxDatabase;
    private atoms!: RxCollection<SemanticAtom>;
    private items!: RxCollection<CognitiveItem>;
    private beliefRevisionEngine = new BeliefRevisionEngine();
    private eventBus!: EventBus;

    // Semantic Search Index
    private semanticIndex!: HierarchicalNSW;
    private labelToAtomId = new Map<number, UUID>();
    private nextLabel = 0;

    private constructor() {}

    public static async create(eventBus: EventBus): Promise<WorldModel> {
        const model = new WorldModel();
        await model.initialize(eventBus);
        return model;
    }

    private async initialize(eventBus: EventBus) {
        this.eventBus = eventBus;
        this.db = await createRxDatabase({
            name: 'worldmodel_db',
            storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
        });
        const collections = await this.db.addCollections({
            atoms: { schema: atomSchema },
            items: { schema: itemSchema },
        });
        this.atoms = collections.atoms;
        this.items = collections.items;

        // Initialize HNSW index
        this.semanticIndex = new HierarchicalNSW('cosine', EMBEDDING_DIM);
        this.semanticIndex.initIndex(10000); // Max elements
    }

    public async close() {
        await this.db.close();
    }

    async add_atom(atom: SemanticAtom): Promise<UUID> {
        await this.atoms.insert(atom);
        if (atom.embedding && atom.embedding.length === EMBEDDING_DIM) {
            const label = this.nextLabel++;
            this.labelToAtomId.set(label, atom.id);
            this.semanticIndex.addPoint(atom.embedding, label);
        }
        return atom.id;
    }

    async add_item(item: CognitiveItem): Promise<void> {
        await this.items.insert(item);
        this.eventBus.publish('item_added', { item });
        if (item.type === 'GOAL') {
            this.eventBus.publish('goal_added', { goal: item });
        }
    }

    async update_item(id: UUID, patch: Partial<CognitiveItem>): Promise<void> {
        const doc = await this.items.findOne(id).exec();
        if (doc) {
            const oldStatus = doc.get('goal_status');
            await doc.incrementalPatch(patch);
            const newStatus = doc.get('goal_status');
            if (patch.goal_status && oldStatus !== newStatus) {
                this.eventBus.publish('goal_status_changed', { goalId: id, oldStatus, newStatus });
            }
        }
    }

    async get_atom(id: UUID): Promise<SemanticAtom | null> {
        const doc = await this.atoms.findOne(id).exec();
        return doc ? doc.toMutableJSON() : null;
    }

    async get_item(id: UUID): Promise<CognitiveItem | null> {
        const doc = await this.items.findOne(id).exec();
        return doc ? doc.toMutableJSON() : null;
    }

    async query_by_symbolic(pattern: any, k?: number): Promise<CognitiveItem[]> {
        const query = this.items.find({ selector: pattern, limit: k });
        const docs = await query.exec();
        return docs.map(doc => doc.toMutableJSON());
    }

    async query_by_structure(pattern: any, k?: number): Promise<CognitiveItem[]> {
        return this.query_by_symbolic(pattern, k);
    }

    async query_by_semantic(embedding: number[], k: number): Promise<CognitiveItem[]> {
        if (this.semanticIndex.getCurrentCount() === 0) {
            return [];
        }

        const result = this.semanticIndex.searchKnn(embedding, k);
        const atomIds = result.neighbors.map(label => this.labelToAtomId.get(label)).filter(id => id) as UUID[];

        if (atomIds.length === 0) {
            return [];
        }

        const items = await this.query_by_symbolic({ atom_id: { $in: atomIds } }, k);

        // Optional: Re-rank based on distance, though HNSW order is generally good
        return items;
    }

    async revise_belief(new_item: CognitiveItem): Promise<CognitiveItem | null> {
        if (new_item.type !== 'BELIEF' || !new_item.truth) return null;

        const existing_items = await this.query_by_symbolic({ atom_id: new_item.atom_id, type: 'BELIEF' }, 1);
        const existing_item = existing_items[0] ?? null;

        if (existing_item && existing_item.truth) {
            // An item with this atom already exists, so revise it
            if (this.beliefRevisionEngine.detect_conflict(existing_item.truth, new_item.truth)) {
                console.warn(`Conflict detected for atom ${new_item.atom_id}. Merging truth values.`);
            }
            const newTruth = this.beliefRevisionEngine.merge(existing_item.truth, new_item.truth);
            await this.update_item(existing_item.id, { truth: newTruth });

            // Return the updated item to be pushed back on the agenda
            const updated_item = await this.get_item(existing_item.id);
            return updated_item;
        } else {
            // This is a new belief, just add it
            await this.add_item(new_item);
            // Returning the new item allows the worker to know it was successfully added
            return new_item;
        }
    }

    async size(): Promise<number> {
        const allDocs = await this.atoms.find().exec();
        return allDocs.length;
    }

    register_schema_atom(atom: SemanticAtom): CognitiveSchema {
        throw new Error("Schema registration not implemented in WorldModel. See SchemaMatcher.");
    }

    async getItemsByFilter(filter: (item: CognitiveItem) => boolean): Promise<CognitiveItem[]> {
        const allItems = await this.items.find().exec();
        const mutableItems = allItems.map(doc => doc.toMutableJSON());
        return mutableItems.filter(filter);
    }
}
