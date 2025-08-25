
export type UUID = string;

export type SemanticAtomType = 'Fact' | 'CognitiveSchema' | 'Observation' | 'Rule';

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

export type SemanticAtom = {
    id: UUID;
    content: any;
    embedding: number[];
    meta: SemanticAtomMetadata;
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

export type CognitiveItemType = 'BELIEF' | 'GOAL' | 'QUERY';

export type CognitiveItem = {
    id: UUID;
    atom_id: UUID;
    type: CognitiveItemType;
    truth?: TruthValue;
    attention: AttentionValue;
    stamp: DerivationStamp;
    goal_parent_id?: UUID;
    goal_status?: "active" | "blocked" | "achieved" | "failed";
    label?: string;
}

export type GoalTree = {
    [goalId: UUID]: {
        item: CognitiveItem;
        children: UUID[];
    };
};

export type AppState = {
    agenda: CognitiveItem[];
    worldModel: SemanticAtom[];
    goalTree: GoalTree;
};
