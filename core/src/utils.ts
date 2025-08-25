import { createHash } from 'crypto';
import stableStringify from 'json-stable-stringify';
import { SemanticAtom, SemanticAtomMetadata, UUID } from './types';

/**
 * Creates a deterministic, content-addressable ID for a SemanticAtom.
 * The ID is the SHA-256 hash of the atom's content and its metadata
 * (excluding the ID itself).
 * @param content - The content of the atom.
 * @param meta - The metadata of the atom.
 * @returns A UUID representing the hash.
 */
export const createSemanticAtomId = (
  content: any,
  meta: Omit<SemanticAtom['meta'], 'id'>,
): UUID => {
  const hash = createHash('sha256');

  // Use a stable stringify to ensure consistent hash across different object key orders.
  const contentString = stableStringify(content);
  const metaString = stableStringify(meta);

  if (contentString === undefined || metaString === undefined) {
    // This can happen if the content or meta contains functions or other non-serializable data.
    // A robust system might have a more graceful way to handle this.
    console.error('Attempted to create an ID for non-serializable content.', { content, meta });
    throw new Error('Cannot create ID for non-serializable content or metadata.');
  }

  hash.update(contentString + metaString);
  return hash.digest('hex') as UUID;
};

/**
 * Calculates the cosine similarity between two vectors.
 * @param vecA - The first vector.
 * @param vecB - The second vector.
 * @returns The cosine similarity, a value between -1 and 1.
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    // Or throw an error, depending on desired behavior
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecA[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) {
    return 0; // Avoid division by zero
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// --- System Schemas ---

export const GOAL_DECOMPOSITION_SCHEMA_CONTENT = {
  if: {
    a: { type: 'GOAL', label_pattern: '.* illness' },
    b: null,
  },
  then: {
    type: 'GOAL',
    label_template: 'Decomposed goal for {{a.label}}',
    sub_goals: [
      { label: 'Verify toxicity', type: 'GOAL' },
      { label: 'Assess symptoms', type: 'GOAL' },
    ],
  },
};

export const GOAL_DECOMPOSITION_SCHEMA_META: SemanticAtomMetadata = {
  type: 'CognitiveSchema',
  source: 'system',
  author: 'system',
  trust_score: 1.0,
  domain: 'metacognition',
  license: 'MIT',
};

export const GOAL_DECOMPOSITION_SCHEMA_ATOM: SemanticAtom = {
  id: createSemanticAtomId(GOAL_DECOMPOSITION_SCHEMA_CONTENT, GOAL_DECOMPOSITION_SCHEMA_META),
  content: GOAL_DECOMPOSITION_SCHEMA_CONTENT,
  embedding: [], // Will be filled by embedding service
  meta: GOAL_DECOMPOSITION_SCHEMA_META,
};

export const RECIPE_SUGGESTION_SCHEMA_CONTENT = {
  if: {
    a: { "type": "BELIEF", "content_pattern": "(ingredient_available ?ing1)" },
    b: { "type": "BELIEF", "content_pattern": "(ingredient_available ?ing2)" }
  },
  then: {
    type: "GOAL",
    content_template: "(find_recipe_with ?ing1 ?ing2)",
    label_template: "Find recipe with ?ing1 and ?ing2"
  }
};

export const RECIPE_SUGGESTION_SCHEMA_META: SemanticAtomMetadata = {
  type: 'CognitiveSchema',
  source: 'system',
  author: 'system',
  trust_score: 1.0,
  domain: 'cooking',
  license: 'MIT',
};

export const RECIPE_SUGGESTION_SCHEMA_ATOM: SemanticAtom = {
  id: createSemanticAtomId(RECIPE_SUGGESTION_SCHEMA_CONTENT, RECIPE_SUGGESTION_SCHEMA_META),
  content: RECIPE_SUGGESTION_SCHEMA_CONTENT,
  embedding: [], // Will be filled by embedding service
  meta: RECIPE_SUGGESTION_SCHEMA_META,
};