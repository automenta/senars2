import { GoalTreeManager as IGoalTreeManager } from '../types/interfaces';
import { CognitiveItem, UUID } from '../types/data';

export class GoalTreeManager implements IGoalTreeManager {
    decompose(goal: CognitiveItem): CognitiveItem[] {
        // Placeholder: Returns no sub-goals.
        console.log(`GoalTreeManager: Decomposing goal ${goal.id} (stub)`);
        return [];
    }

    mark_achieved(goal_id: UUID): void {
        console.log(`GoalTreeManager: Marking goal ${goal_id} as achieved (stub)`);
    }

    mark_failed(goal_id: UUID): void {
        console.log(`GoalTreeManager: Marking goal ${goal_id} as failed (stub)`);
    }

    get_ancestors(goal_id: UUID): UUID[] {
        console.log(`GoalTreeManager: Getting ancestors for goal ${goal_id} (stub)`);
        return [];
    }
}
