import { CognitiveItem } from '../types/data';
import { Executor, ExecutorResult, WorldModel } from '../types/interfaces';

export class ActionSubsystem {
    private executors: Executor[] = [];

    constructor(private worldModel: WorldModel) {}

    register_executor(executor: Executor): void {
        this.executors.push(executor);
        console.log(`ActionSubsystem: Registered executor: ${executor.constructor.name}`);
    }

    private async find_executor(goal: CognitiveItem): Promise<Executor | null> {
        for (const executor of this.executors) {
            if (await executor.can_execute(goal, this.worldModel)) {
                return executor;
            }
        }
        return null;
    }

    async execute_goal(goal: CognitiveItem): Promise<ExecutorResult | null> {
        if (goal.type !== 'GOAL') {
            return null;
        }

        const executor = await this.find_executor(goal);

        if (!executor) {
            return null;
        }

        try {
            console.log(`ActionSubsystem: Executing goal ${goal.label ?? goal.id} with ${executor.constructor.name}`);
            const result = await executor.execute(goal, this.worldModel);

            // Mark the original goal as achieved
            await this.worldModel.update_item(goal.id, { goal_status: 'achieved' });
            console.log(`ActionSubsystem: Goal ${goal.label ?? goal.id} executed successfully.`);

            // Return the full result to the worker for orchestration
            return result;
        } catch (error) {
            console.error(`ActionSubsystem: Executor ${executor.constructor.name} failed for goal ${goal.label ?? goal.id}`, error);
            // Mark the goal as failed
            await this.worldModel.update_item(goal.id, { goal_status: 'failed' });
            return null;
        }
    }
}
