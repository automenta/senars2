export type UUID = string;

export type TruthValue = {
    frequency: number;
    confidence: number;
}

export type AttentionValue = {
    priority: number;
    durability: number;
}

export type DerivationStamp = {
    timestamp: number;
    parent_ids: UUID[];
    schema_id: UUID;
    module?: string;
}

export type CognitiveItem = {
    id: UUID;
    atom_id: UUID;
    type: 'BELIEF' | 'GOAL' | 'QUERY';
    truth?: TruthValue;
    attention: AttentionValue;
    stamp: DerivationStamp;

    goal_parent_id?: UUID;
    goal_status?: "active" | "blocked" | "achieved" | "failed";

    label?: string;
    // This is not in the backend type, but will be added in App.tsx
    // after parsing the websocket message
    raw_data?: string;
};
