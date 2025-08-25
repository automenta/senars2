import { CognitiveItem, newCognitiveItemId, SemanticAtomMetadata, UUID } from '../types';
import { WorldModel } from '../world-model';

// Assuming google_web_search is a globally available function provided by the environment.
declare const google_web_search: (query: string) => Promise<{ output: string }>;

export interface Executor {
  can_execute(goal: CognitiveItem): boolean;

  execute(goal: CognitiveItem): Promise<CognitiveItem | null>;
}

export class WebSearchExecutor implements Executor {
  private worldModel: WorldModel;

  constructor(worldModel: WorldModel) {
    this.worldModel = worldModel;
  }

  can_execute(goal: CognitiveItem): boolean {
    // Example: Can execute if the goal content is a web search query
    return goal.type === 'GOAL' && typeof goal.label === 'string' && goal.label.startsWith('WebSearch:');
  }

  async execute(goal: CognitiveItem): Promise<CognitiveItem | null> {
    if (!this.can_execute(goal)) {
      return null;
    }

    const query = goal.label?.substring('WebSearch:'.length).trim();
    if (!query) {
      console.warn(`WebSearchExecutor: Goal label is empty or malformed for goal ${goal.id}`);
      return null;
    }

    console.log(`Executing web search for: "${query}"`);
    try {
      const searchResult = await google_web_search(query);
      const content = searchResult.output; // Assuming the output contains the search results

      const meta: SemanticAtomMetadata = {
        type: 'Observation',
        source: 'web_search',
        timestamp: new Date().toISOString(),
        trust_score: 0.7, // Initial trust for web search results
        domain: 'information_retrieval',
      };

      const resultAtom = this.worldModel.find_or_create_atom(content, meta);

      const resultBelief: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: resultAtom.id,
        type: 'BELIEF',
        truth: { frequency: 1.0, confidence: 0.7 },
        attention: { priority: 0.6, durability: 0.7 },
        stamp: {
          timestamp: Date.now(),
          parent_ids: [goal.id],
          schema_id: 'web-search-result-schema' as UUID, // Placeholder schema ID
          module: 'ActionSubsystem',
        },
        goal_parent_id: goal.id,
        label: `Web search result for "${query}"`,
      };
      return resultBelief;
    } catch (error) {
      console.error(`Error during web search for goal ${goal.id}:`, error);
      return null;
    }
  }
}

export class ActionSubsystem {
  private executors: Executor[] = [];
  private worldModel: WorldModel;

  constructor(worldModel: WorldModel) {
    this.worldModel = worldModel;
    this.registerExecutor(new WebSearchExecutor(this.worldModel));
    // Register other executors here as they are implemented
  }

  public registerExecutor(executor: Executor): void {
    this.executors.push(executor);
  }

  public async initialize(): Promise<void> {
    console.log('ActionSubsystem initialized.');
  }

  public async cleanup(): Promise<void> {
    console.log('ActionSubsystem cleaned up.');
  }

  public async executeGoal(goal: CognitiveItem): Promise<CognitiveItem | null> {
    for (const executor of this.executors) {
      if (executor.can_execute(goal)) {
        const result = await executor.execute(goal);
        if (result) {
          return result;
        }
      }
    }
    console.warn(`No executor found or able to execute goal: ${goal.label ?? goal.id}`);
    return null;
  }
}