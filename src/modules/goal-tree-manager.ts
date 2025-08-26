import { GoalTreeManager as IGoalTreeManager, WorldModel } from '../types/interfaces';
import { CognitiveItem, UUID } from '../types/data';

export class GoalTreeManager implements IGoalTreeManager {
    decompose(goal: CognitiveItem, world_model: WorldModel): CognitiveItem[] {
        // In a real system, this might look for a "decomposition" schema and apply it.
        // For now, decomposition is handled by the main worker loop finding relevant schemas.
        console.log(`GoalTreeManager: Decomposing goal ${goal.id} (stub)`);
        return [];
    }

    async mark_achieved(goal_id: UUID, world_model: WorldModel): Promise<void> {
        const goal = world_model.get_item(goal_id);
        if (!goal || goal.type !== 'GOAL') return;

        goal.goal_status = 'achieved';
        console.log(`GoalTreeManager: Marked goal ${goal_id} as achieved.`);

        const parent_id = goal.goal_parent_id;
        if (!parent_id) return; // No parent to update

        const sibling_goals = world_model.query_by_symbolic({ 'item.goal_parent_id': parent_id });

        // Check if all siblings are now in the "achieved" state
        const all_siblings_achieved = sibling_goals.every(
            sibling => sibling.goal_status === 'achieved'
        );

        if (all_siblings_achieved) {
            console.log(`GoalTreeManager: All sub-goals of ${parent_id} are achieved. Marking parent as achieved.`);
            await this.mark_achieved(parent_id, world_model);
        }
    }

    async mark_failed(goal_id: UUID, world_model: WorldModel): Promise<void> {
        const goal = world_model.get_item(goal_id);
        if (!goal || goal.type !== 'GOAL') return;

        goal.goal_status = 'failed';
        console.log(`GoalTreeManager: Marked goal ${goal_id} as failed.`);

        const parent_id = goal.goal_parent_id;
        if (!parent_id) return;

        const parent_goal = world_model.get_item(parent_id);
        if (parent_goal && parent_goal.type === 'GOAL') {
            parent_goal.goal_status = 'blocked';
            console.log(`GoalTreeManager: Marked parent goal ${parent_id} as blocked due to sub-goal failure.`);
        }
    }

    async get_ancestors(goal_id: UUID, world_model: WorldModel): Promise<UUID[]> {
        const ancestors: UUID[] = [];
        let current_item = world_model.get_item(goal_id);

        while (current_item && current_item.goal_parent_id) {
            const parent_id = current_item.goal_parent_id;
            ancestors.push(parent_id);
            current_item = world_model.get_item(parent_id);
        }

        return ancestors;
    }
}
