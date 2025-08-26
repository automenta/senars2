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

// --- Software Development: Schema to read a file ---

const READ_FILE_SCHEMA_CONTENT: CognitiveSchemaContent = {
  if: {
    a: { type: 'QUERY', label_pattern: 'content of file ?path' },
  },
  then: {
    type: 'GOAL',
    label_template: 'action: read_file ?path',
    content_template: '(action: read_file (path ?path))',
  },
};

const READ_FILE_SCHEMA_META: Omit<SemanticAtomMetadata, 'id'> = {
  type: 'CognitiveSchema',
  source: 'system',
  trust_score: 1.0,
  domain: 'software_development',
  description: 'When a query asks for the content of a file, this schema creates a goal for the action subsystem to read that file.',
};

export const READ_FILE_SCHEMA_ATOM: SemanticAtom = {
  id: createSemanticAtomId(READ_FILE_SCHEMA_CONTENT, READ_FILE_SCHEMA_META),
  content: READ_FILE_SCHEMA_CONTENT,
  embedding: [],
  meta: READ_FILE_SCHEMA_META,
};


// --- Software Development: Schema to scan the codebase ---

const SCAN_CODEBASE_SCHEMA_CONTENT: CognitiveSchemaContent = {
  if: {
    a: { type: 'GOAL', label_pattern: 'scan codebase' },
  },
  then: {
    type: 'GOAL',
    sub_goals: [
      {
        temp_id: 'read_package_json',
        label: 'content of file package.json',
        type: 'QUERY',
      },
      {
        temp_id: 'read_cognitive_core',
        label: 'content of file core/src/cognitive-core.ts',
        type: 'QUERY',
      },
      {
        temp_id: 'read_agenda_view',
        label: 'content of file gui/src/components/AgendaView.tsx',
        type: 'QUERY',
      },
    ],
  },
};

const SCAN_CODEBASE_SCHEMA_META: Omit<SemanticAtomMetadata, 'id'> = {
    type: 'CognitiveSchema',
    source: 'system',
    trust_score: 1.0,
    domain: 'software_development.decomposition',
    description: 'Decomposes the high-level goal of scanning the codebase into specific queries to read key files.',
};

export const SCAN_CODEBASE_SCHEMA_ATOM: SemanticAtom = {
  id: createSemanticAtomId(SCAN_CODEBASE_SCHEMA_CONTENT, SCAN_CODEBASE_SCHEMA_META),
  content: SCAN_CODEBASE_SCHEMA_CONTENT,
  embedding: [],
  meta: SCAN_CODEBASE_SCHEMA_META,
};


// --- Software Development: Schema to modify a file based on a high-level goal ---

const MODIFY_CODE_SCHEMA_CONTENT: CognitiveSchemaContent = {
  if: {
    a: { type: 'GOAL', label_pattern: 'Improve ?feature in file ?path by making change ?change' },
  },
  then: {
    type: 'GOAL',
    sub_goals: [
      {
        temp_id: 'read_file',
        label: 'content of file ?path',
        type: 'QUERY',
      },
      {
        temp_id: 'modify_file',
        label: 'action: replace_in_file ?path with change ?change', // This implies a new action type
        type: 'GOAL',
        dependencies: ['read_file'],
      },
    ],
  },
};

const MODIFY_CODE_SCHEMA_META: Omit<SemanticAtomMetadata, 'id'> = {
    type: 'CognitiveSchema',
    source: 'system',
    trust_score: 1.0,
    domain: 'software_development.decomposition',
    description: 'Decomposes a high-level code modification goal into reading and then modifying the file.',
};

export const MODIFY_CODE_SCHEMA_ATOM: SemanticAtom = {
  id: createSemanticAtomId(MODIFY_CODE_SCHEMA_CONTENT, MODIFY_CODE_SCHEMA_META),
  content: MODIFY_CODE_SCHEMA_CONTENT,
  embedding: [],
  meta: MODIFY_CODE_SCHEMA_META,
};


// --- Array of all system schemas for easy registration ---
export const ALL_SYSTEM_SCHEMAS = [
    DIAGNOSE_TOXICITY_SCHEMA_ATOM,
    RECIPE_SUGGESTION_SCHEMA_ATOM,
    READ_FILE_SCHEMA_ATOM,
    SCAN_CODEBASE_SCHEMA_ATOM,
    MODIFY_CODE_SCHEMA_ATOM,
];
