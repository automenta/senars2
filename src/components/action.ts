import { logger } from '../lib/logger';
import { CognitiveItem, Executor, ExecutorResult, WorldModel } from '@cognitive-arch/types';

export class ActionSubsystem {
    private executors: Executor[] = [];

    constructor(private worldModel: WorldModel) {}

    register_executor(executor: Executor): void {
        this.executors.push(executor);
        logger.info(`Registered executor: ${executor.constructor.name}`);
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

        const goalIdentifier = goal.label ?? goal.id;
        try {
            logger.info(`Executing goal ${goalIdentifier} with ${executor.constructor.name}`);
            const result = await executor.execute(goal, this.worldModel);

            // Mark the original goal as achieved
            await this.worldModel.update_item(goal.id, { goal_status: 'achieved' });
            logger.info(`Goal ${goalIdentifier} executed successfully.`);

            // Return the full result to the worker for orchestration
            return result;
        } catch (error) {
            logger.error(`Executor ${executor.constructor.name} failed for goal ${goalIdentifier}`, error);
            // Mark the goal as failed
            await this.worldModel.update_item(goal.id, { goal_status: 'failed' });
            return null;
        }
    }
}
