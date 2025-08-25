import { CognitiveItem, SemanticAtom, UUID, newCognitiveItemId } from '../types';
import { WorldModel } from '../world-model';

export interface Executor {
    can_execute(goal: CognitiveItem, world_model: WorldModel): boolean;
    execute(goal: CognitiveItem, world_model: WorldModel): Promise<CognitiveItem>;
}

class WebSearchExecutor implements Executor {
    can_execute(goal: CognitiveItem, world_model: WorldModel): boolean {
        const goalAtom = world_model.get_atom(goal.atom_id);
        if (!goalAtom) return false;
        const content = goalAtom.content;
        return goal.type === 'GOAL' && Array.isArray(content) && content[0] === 'web_search';
    }

    async execute(goal: CognitiveItem, world_model: WorldModel): Promise<CognitiveItem> {
        const goalAtom = world_model.get_atom(goal.atom_id);
        const searchQuery = goalAtom?.content[1] ?? 'unknown query';
        console.log(`Executing web search for: ${searchQuery}`);

        // Simulate finding a result
        const resultAtom = world_model.find_or_create_atom(
            {
                source: 'simulated-web-search',
                query: searchQuery,
                result: `The result for "${searchQuery}" is that chocolate is indeed toxic to cats.`,
            },
            {
                type: 'Observation',
                source: 'WebSearchExecutor',
                trust_score: 0.85,
            }
        );

        const beliefItem: CognitiveItem = {
            id: newCognitiveItemId(),
            atom_id: resultAtom.id,
            type: 'BELIEF',
            truth: { frequency: 1.0, confidence: 0.85 },
            attention: { priority: 0.8, durability: 0.7 }, // High attention for new observations
            stamp: {
                timestamp: Date.now(),
                parent_ids: [goal.id],
                schema_id: 'executor-schema' as UUID, // Special ID for executions
            },
            goal_parent_id: goal.id, // Link the result back to the goal that triggered it
            label: `Observation from web search: ${searchQuery}`,
        };

        return beliefItem;
    }
}

export class ActionSubsystem {
    private executors: Executor[] = [];
    private world_model: WorldModel;

    constructor(world_model: WorldModel) {
        this.world_model = world_model;
        // Register default executors
        this.executors.push(new WebSearchExecutor());
    }

    public find_executor(goal: CognitiveItem): Executor | null {
        for (const executor of this.executors) {
            if (executor.can_execute(goal, this.world_model)) {
                return executor;
            }
        }
        return null;
    }
}
