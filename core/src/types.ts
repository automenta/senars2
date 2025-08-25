import { randomUUID } from 'crypto';

// Using a branded type for UUID for better type safety.
export type UUID = string & { readonly __brand: 'UUID' };

/**
 * Generates a new random UUID.
 * This is suitable for CognitiveItems, which are unique instances of thought.
 */
export const newCognitiveItemId = (): UUID => randomUUID() as UUID;

// --- Semantic Atom: Immutable Knowledge Unit ---

export type SemanticAtomType = 'Fact' | 'CognitiveSchema' | 'Observation' | 'Rule';

/**
 * Standardized metadata for a SemanticAtom.
 * Based on the specification in core.md.
 */
export type SemanticAtomMetadata = {
  type: SemanticAtomType;
  source?: string;
  timestamp?: string; // ISO 8601 format
  author?: string;
  trust_score?: number; // Range [0.0, 1.0]
  domain?: string;
  license?: string;
  // Allows for additional, non-standard fields.
  [key: string]: any;
};

/**
 * Represents a content-addressable, immutable piece of information.
 * The 'id' is a SHA-256 hash of its content and metadata.
 */
export type SemanticAtom = {
  id: UUID;
  content: any; // e.g., S-expression, JSON, text, URI
  embedding: number[]; // Dense vector
  meta: SemanticAtomMetadata;
};


// --- Cognitive Item: Contextualized Thought ---

/**
 * Represents the truthiness of a BELIEF item.
 */
export type TruthValue = {
  frequency: number;    // [0.0, 1.0] — empirical support
  confidence: number;   // [0.0, 1.0] — epistemic certainty
};

/**
 * Represents the salience and retention value of a CognitiveItem.
 */
export type AttentionValue = {
  priority: number;     // [0.0, 1.0] — short-term salience
  durability: number;   // [0.0, 1.0] — long-term retention value
};

/**
 * Records the provenance of a CognitiveItem, tracing how it was derived.
 */
export type DerivationStamp = {
  timestamp: number;           // Unix ms
  parent_ids: UUID[];          // Input CognitiveItem IDs
  schema_id: UUID;             // Rule/schema used
  module?: string;             // Optional: "resonance", "analogy"
};

/**
 * Represents a stance toward a SemanticAtom (a belief, goal, or query).
 * It is a mutable wrapper that adds context to an immutable atom.
 */
export type CognitiveItemType = 'BELIEF' | 'GOAL' | 'QUERY';

export type CognitiveItem = {
  id: UUID;
  atom_id: UUID;               // Reference to a SemanticAtom
  type: CognitiveItemType;
  truth?: TruthValue;          // Only for BELIEF items
  attention: AttentionValue;
  stamp: DerivationStamp;

  // Optional fields for goal management
  goal_parent_id?: UUID;
  goal_status?: 'active' | 'blocked' | 'achieved' | 'failed';

  // Optional, human-readable label
  label?: string;
};

// A partial item used for calculations where a full item is not yet available.
export type PartialCognitiveItem = Pick<CognitiveItem, 'type' | 'truth' | 'stamp'>;
