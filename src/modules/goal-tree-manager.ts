import { GoalTreeManager as IGoalTreeManager, WorldModel } from '../types/interfaces';
import { CognitiveItem, UUID } from '../types/data';

export class GoalTreeManager implements IGoalTreeManager {
    decompose(goal: CognitiveItem, world_model: WorldModel): CognitiveItem[] {
        // In a real system, this might look for a "decomposition" schema and apply it.
        // For now, decomposition is handled by the main worker loop finding relevant schemas.
        return [];
    }

    async mark_achieved(goal_id: UUID, world_model: WorldModel): Promise<void> {
        const goal = await world_model.get_item(goal_id);
        if (!goal || goal.type !== 'GOAL' || goal.goal_status === 'achieved') return;

        await world_model.update_item(goal_id, { goal_status: 'achieved' });

        const parent_id = goal.goal_parent_id;
        if (!parent_id) return; // No parent to update

        const sibling_goals = await world_model.query_by_symbolic({ goal_parent_id: parent_id });

        const all_siblings_achieved = sibling_goals.every(
            sibling => sibling.goal_status === 'achieved'
        );

        if (all_siblings_achieved) {
            await this.mark_achieved(parent_id, world_model);
        }
    }

    async mark_failed(goal_id: UUID, world_model: WorldModel): Promise<void> {
        const goal = await world_model.get_item(goal_id);
        if (!goal || goal.type !== 'GOAL' || goal.goal_status === 'failed') return;

        await world_model.update_item(goal_id, { goal_status: 'failed' });

        const parent_id = goal.goal_parent_id;
        if (!parent_id) return;

        const parent_goal = await world_model.get_item(parent_id);
        if (parent_goal && parent_goal.type === 'GOAL') {
            await world_model.update_item(parent_id, { goal_status: 'blocked' });
        }
    }

    async get_ancestors(goal_id: UUID, world_model: WorldModel): Promise<UUID[]> {
        const ancestors: UUID[] = [];
        let current_item = await world_model.get_item(goal_id);

        while (current_item && current_item.goal_parent_id) {
            const parent_id = current_item.goal_parent_id;
            ancestors.push(parent_id);
            current_item = await world_model.get_item(parent_id);
        }

        return ancestors;
    }
}
