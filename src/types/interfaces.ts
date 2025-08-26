import {
    CognitiveItem,
    SemanticAtom,
    UUID,
    AttentionValue,
    TruthValue
} from './data';

// Forward declaration for CognitiveSchema
export interface CognitiveSchema {
    atom_id: UUID;
    apply(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): CognitiveItem[];
}

export interface Agenda {
    push(item: CognitiveItem): void;
    pop(): CognitiveItem | null;
    pop_async(): Promise<CognitiveItem>;
    peek(): CognitiveItem | null;
    size(): number;
    updateAttention(id: UUID, newVal: AttentionValue): void;
    remove(id: UUID): boolean;
}

export interface BeliefRevisionEngine {
    merge(existing: TruthValue, newTruth: TruthValue): TruthValue;
    detect_conflict(a: TruthValue, b: TruthValue): boolean;
}

export interface WorldModel {
    add_atom(atom: SemanticAtom): UUID;
    add_item(item: CognitiveItem): void;
    get_atom(id: UUID): SemanticAtom | null;
    get_item(id: UUID): CognitiveItem | null;
    query_by_semantic(embedding: number[], k: number): CognitiveItem[];
    query_by_symbolic(pattern: any, k?: number): CognitiveItem[];
    query_by_structure(pattern: any, k?: number): CognitiveItem[];
    revise_belief(new_item: CognitiveItem): CognitiveItem | null;
    register_schema_atom(atom: SemanticAtom): CognitiveSchema;
    size(): number;
    getItemsByFilter(filter: (item: CognitiveItem) => boolean): CognitiveItem[];
}

export interface AttentionModule {
    calculate_initial(item: CognitiveItem): AttentionValue;
    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust?: number
    ): AttentionValue;
    update_on_access(items: CognitiveItem[]): void;
    run_decay_cycle(world_model: WorldModel, agenda: Agenda): void;
}

export interface ResonanceModule {
    find_context(item: CognitiveItem, world_model: WorldModel, k: number): CognitiveItem[];
}

export interface SchemaMatcher {
    register_schema(schema: SemanticAtom, world_model: WorldModel): CognitiveSchema;
    find_applicable(a: CognitiveItem, b: CognitiveItem, world_model: WorldModel): CognitiveSchema[];
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
    can_execute(goal: CognitiveItem, world_model: WorldModel): boolean;
    execute(goal: CognitiveItem, world_model: WorldModel): Promise<ExecutorResult>;
}
