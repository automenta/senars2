import { CognitiveItem } from '../types/data';
import { Executor, ExecutorResult, WorldModel } from '../types/interfaces';

export class ActionSubsystem {
    private executors: Executor[] = [];

    constructor(private worldModel: WorldModel) {}

    register_executor(executor: Executor): void {
        this.executors.push(executor);
        console.log(`ActionSubsystem: Registered executor: ${executor.constructor.name}`);
    }

    async execute_goal(goal: CognitiveItem): Promise<CognitiveItem | null> {
        if (goal.type !== 'GOAL') {
            return null;
        }

        const executor = this.executors.find(e => e.can_execute(goal, this.worldModel));

        if (!executor) {
            // It's normal for some goals not to have an executor (e.g., abstract goals)
            return null;
        }

        try {
            console.log(`ActionSubsystem: Executing goal ${goal.label ?? goal.id} with ${executor.constructor.name}`);
            const result = await executor.execute(goal, this.worldModel);

            // Add the new atom from the action's result to the world model
            this.worldModel.add_atom(result.atom);

            // Mark the original goal as achieved
            goal.goal_status = 'achieved';

            console.log(`ActionSubsystem: Goal ${goal.label ?? goal.id} executed successfully.`);

            // Return the belief about the action's success to be added to the agenda
            return result.belief;
        } catch (error) {
            console.error(`ActionSubsystem: Executor ${executor.constructor.name} failed for goal ${goal.label ?? goal.id}`, error);
            // Mark the goal as failed
            goal.goal_status = 'failed';
            return null;
        }
    }
}
