import { CognitiveItem, newCognitiveItemId, SemanticAtomMetadata, UUID } from '../types.js';
import { WorldModel } from '../world-model.js';
import { PerceptionSubsystem } from './perception.js';

// The environment provides these functions. In a real scenario, these would be
// tool calls to the underlying system (e.g., the agent's own tools).
declare const google_web_search: (query: string) => Promise<{ output: string }>;
declare const read_file: (path: string) => Promise<string>;
declare const replace_with_git_merge_diff: (path: string, search: string, replace: string) => Promise<string>;


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

export class ReadFileExecutor implements Executor {
  private perception: PerceptionSubsystem;

  constructor(perception: PerceptionSubsystem) {
    this.perception = perception;
  }

  can_execute(goal: CognitiveItem): boolean {
    return goal.type === 'GOAL' && typeof goal.label === 'string' && goal.label.startsWith('action: read_file');
  }

  async execute(goal: CognitiveItem): Promise<CognitiveItem | null> {
    if (!this.can_execute(goal)) return null;

    const filePath = goal.label?.substring('action: read_file'.length).trim();
    if (!filePath) {
      console.warn(`ReadFileExecutor: File path is missing in goal ${goal.id}`);
      return null;
    }

    try {
      console.log(`Executing read_file for: "${filePath}"`);
      const content = await read_file(filePath);
      const beliefItems = await this.perception.perceiveFile(filePath, content);

      // Return the first created belief item. This loop is just to safely get the first element.
      for (const item of beliefItems) {
        return item;
      }
      return null; // Should not happen if perceiveFile works as expected

    } catch (error) {
      console.error(`Error reading file ${filePath} for goal ${goal.id}:`, error);
      // Future work: Create a BELIEF that the file could not be read.
      return null;
    }
  }
}

export class ReplaceInFileExecutor implements Executor {
  can_execute(goal: CognitiveItem): boolean {
    return goal.type === 'GOAL' && typeof goal.label === 'string' && goal.label.startsWith('action: replace_in_file');
  }

  async execute(goal: CognitiveItem): Promise<CognitiveItem | null> {
    if (!this.can_execute(goal)) return null;

    const pattern = /action: replace_in_file\s+(?<path>\S+)\s+with change\s+(?<change>.+)/;
    const match = goal.label?.match(pattern);

    if (!match?.groups) {
      console.warn(`ReplaceInFileExecutor: Could not parse goal label: ${goal.label}`);
      return null;
    }

    const { path, change } = match.groups;
    const [search, replace] = change.split('===');

    if (!path || !search || !replace) {
      console.warn(`ReplaceInFileExecutor: Invalid change format in goal: ${goal.label}`);
      return null;
    }

    try {
      console.log(`Executing replace_in_file for: "${path}"`);
      await replace_with_git_merge_diff(path, search, replace);
      // For now, we don't create a belief about the change, we assume it worked.
      // A more robust system would read the file again to confirm the change.
      return null;
    } catch (error) {
      console.error(`Error replacing content in file ${path} for goal ${goal.id}:`, error);
      return null;
    }
  }
}

export class ActionSubsystem {
  private executors: Executor[] = [];
  private worldModel: WorldModel;
  private perception: PerceptionSubsystem;

  constructor(worldModel: WorldModel, perception: PerceptionSubsystem) {
    this.worldModel = worldModel;
    this.perception = perception;
    this.registerExecutor(new WebSearchExecutor(this.worldModel));
    this.registerExecutor(new ReadFileExecutor(this.perception));
    this.registerExecutor(new ReplaceInFileExecutor());
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