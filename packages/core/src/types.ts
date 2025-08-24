import { randomUUID } from 'crypto';

// Using a branded type for UUID for better type safety.
export type UUID = string & { readonly __brand: 'UUID' };

export const newUUID = (): UUID => randomUUID() as UUID;

export type TruthValue = {
    frequency: number;    // [0.0, 1.0] — empirical support
    confidence: number;   // [0.0, 1.0] — epistemic certainty
};

export type AttentionValue = {
    priority: number;     // [0.0, 1.0] — short-term salience
    durability: number;   // [0.0, 1.0] — long-term retention value
};

export type DerivationStamp = {
    timestamp: number;           // Unix ms
    parent_ids: UUID[];          // Input CognitiveItem IDs
    schema_id: UUID;             // Rule/schema used
    module?: string;             // Optional: "resonance", "analogy"
};

export type SemanticAtom = {
    id: UUID;              // SHA-256(Content + Metadata)
    content: any;          // e.g., S-expr, JSON, text, URI
    embedding: number[];   // Dense vector (e.g., 768-dim)
    meta: Record<string, any>;  // Enhanced with provenance and schema
};

export type CognitiveItem = {
    id: UUID;
    atom_id: UUID;               // Reference to SemanticAtom
    type: 'BELIEF' | 'GOAL' | 'QUERY';
    truth?: TruthValue;          // Only for BELIEF
    attention: AttentionValue;
    stamp: DerivationStamp;

    // Goal hierarchy
    goal_parent_id?: UUID;
    goal_status?: "active" | "blocked" | "achieved" | "failed";

    // Optional: user-facing label
    label?: string;
};
