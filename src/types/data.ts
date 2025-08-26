import { v4 as uuidv4 } from 'uuid';

export type UUID = string;

export type SemanticAtom = {
    id: UUID;
    content: any;
    embedding: number[];
    meta: {
        type: "Fact" | "CognitiveSchema" | "Observation" | "Rule" | "Action";
        source: string;
        timestamp: string;
        author: string;
        trust_score: number;
        domain: string;
        license: string;
        [key: string]: any;
    };
}

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

export type GoalStatus = "active" | "blocked" | "achieved" | "failed";

export type CognitiveItem = {
    id: UUID;
    atom_id: UUID;
    type: 'BELIEF' | 'GOAL' | 'QUERY';
    truth?: TruthValue;
    attention: AttentionValue;
    stamp: DerivationStamp;

    goal_parent_id?: UUID;
    goal_status?: GoalStatus;

    label?: string;
}
