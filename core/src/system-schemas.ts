import { SemanticAtom, SemanticAtomMetadata } from './types.js';
import { CognitiveSchemaContent } from './modules/schema.js';
import { createSemanticAtomId } from './utils.js';

// --- Decomposition Schema for Diagnosing Toxicity ---

const DIAGNOSE_TOXICITY_SCHEMA_CONTENT: CognitiveSchemaContent = {
  if: {
    a: {
      type: 'GOAL',
      label_pattern: 'Diagnose ?toxin toxicity in ?animal',
    },
  },
  then: {
    type: 'GOAL', // Placeholder, the real action is in sub_goals
    sub_goals: [
      {
        temp_id: 'gather_info',
        label: 'Gather information about ?toxin and ?animal',
        type: 'GOAL',
      },
      {
        temp_id: 'analyze_symptoms',
        label: 'Analyze symptoms for ?animal',
        type: 'GOAL',
        dependencies: ['gather_info'],
      },
      {
        temp_id: 'formulate_conclusion',
        label: 'Formulate a conclusion for ?animal toxicity case',
        type: 'GOAL',
        dependencies: ['analyze_symptoms'],
      },
    ],
  },
};

const DIAGNOSE_TOXICITY_SCHEMA_META: Omit<SemanticAtomMetadata, 'id'> = {
    type: 'CognitiveSchema',
    source: 'system',
    trust_score: 1.0,
    domain: 'reasoning.decomposition',
    description: 'Decomposes a diagnosis goal into a chain of information gathering, analysis, and conclusion.',
};

export const DIAGNOSE_TOXICITY_SCHEMA_ATOM: SemanticAtom = {
  id: createSemanticAtomId(DIAGNOSE_TOXICITY_SCHEMA_CONTENT, DIAGNOSE_TOXICITY_SCHEMA_META),
  content: DIAGNOSE_TOXICITY_SCHEMA_CONTENT,
  embedding: [],
  meta: DIAGNOSE_TOXICITY_SCHEMA_META,
};


// --- Reasoning Schema for Suggesting Recipes ---

const RECIPE_SUGGESTION_SCHEMA_CONTENT: CognitiveSchemaContent = {
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

const RECIPE_SUGGESTION_SCHEMA_META: Omit<SemanticAtomMetadata, 'id'> = {
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

// --- Array of all system schemas for easy registration ---
export const ALL_SYSTEM_SCHEMAS = [
    DIAGNOSE_TOXICITY_SCHEMA_ATOM,
    RECIPE_SUGGESTION_SCHEMA_ATOM,
];
