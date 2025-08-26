import {
    CognitiveItem,
    SemanticAtom,
    UUID,
    AttentionValue,
    TruthValue
} from './data';

export type SchemaDerivedData = {
    items: CognitiveItem[];
    atoms: SemanticAtom[];
}

// Forward declaration for CognitiveSchema
export interface CognitiveSchema {
    atom_id: UUID;
    apply(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): SchemaDerivedData;
}

export interface Agenda {
    push(item: CognitiveItem): void;
    pop(): CognitiveItem | null;
    pop_async(): Promise<CognitiveItem>;
    peek(): CognitiveItem | null;
    size(): number;
    updateAttention(id: UUID, newVal: AttentionValue): void;
    remove(id: UUID): boolean;
    getAllItems(): CognitiveItem[];
    get(id: UUID): CognitiveItem | null;
}

export interface BeliefRevisionEngine {
    merge(existing: TruthValue, newTruth: TruthValue): TruthValue;
    detect_conflict(a: TruthValue, b: TruthValue): boolean;
}

export interface WorldModel {
    add_atom(atom: SemanticAtom): Promise<UUID>;
    add_item(item: CognitiveItem): Promise<void>;
    update_item(id: UUID, patch: Partial<CognitiveItem>): Promise<void>;
    get_atom(id: UUID): Promise<SemanticAtom | null>;
    get_item(id: UUID): Promise<CognitiveItem | null>;
    query_by_semantic(embedding: number[], k: number): Promise<CognitiveItem[]>;
    query_by_symbolic(pattern: any, k?: number): Promise<CognitiveItem[]>;
    query_by_structure(pattern: any, k?: number): Promise<CognitiveItem[]>;
    revise_belief(new_item: CognitiveItem): Promise<CognitiveItem | null>;
    register_schema_atom(atom: SemanticAtom): CognitiveSchema;
    size(): Promise<number>;
    getItemsByFilter(filter: (item: CognitiveItem) => boolean): Promise<CognitiveItem[]>;
}

export interface AttentionModule {
    calculate_initial(item: CognitiveItem): AttentionValue;
    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust?: number
    ): AttentionValue;
    update_on_access(items: CognitiveItem[], world_model: WorldModel, agenda: Agenda): Promise<void>;
    run_decay_cycle(world_model: WorldModel, agenda: Agenda): Promise<void>;
}

export interface ResonanceModule {
    find_context(item: CognitiveItem, world_model: WorldModel, k: number): Promise<CognitiveItem[]>;
}

export interface SchemaMatcher {
    register_schema(schema: CognitiveSchema, world_model: WorldModel): Promise<CognitiveSchema>;
    find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): Promise<CognitiveSchema[]>;
}

export interface GoalTreeManager {
    decompose(goal: CognitiveItem, world_model: WorldModel): CognitiveItem[];
    mark_achieved(goal_id: UUID, world_model: WorldModel): Promise<void>;
    mark_failed(goal_id: UUID, world_model: WorldModel): Promise<void>;
    get_ancestors(goal_id: UUID, world_model: WorldModel): Promise<UUID[]>;
}

export interface TransducerResult {
    atom: SemanticAtom;
    item: CognitiveItem;
}

export interface Transducer {
    process(data: any, source: string): TransducerResult | null;
}

export interface ExecutorResult {
    belief: CognitiveItem;
    atom: SemanticAtom;
}

export interface Executor {
    can_execute(goal: CognitiveItem, world_model: WorldModel): Promise<boolean>;
    execute(goal: CognitiveItem, world_model: WorldModel): Promise<ExecutorResult>;
}
