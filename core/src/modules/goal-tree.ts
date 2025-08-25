import { CognitiveItem, UUID } from '../types';

export interface GoalTreeManager {
  decompose(goal: CognitiveItem): CognitiveItem[];

  mark_achieved(goal_id: UUID): void;

  mark_failed(goal_id: UUID): void;

  get_ancestors(goal_id: UUID): UUID[];
}

export class GoalTreeManagerImpl implements GoalTreeManager {
  // We'll use a simple map to store goal relationships and statuses.
  // A more robust implementation might use a graph structure.
  private goal_nodes: Map<UUID, { item: CognitiveItem, children: Set<UUID> }> = new Map();

  decompose(goal: CognitiveItem): CognitiveItem[] {
    // For now, decomposition logic is not implemented.
    // A real system would have schemas or LLM calls to break down a goal.
    console.log(`Goal decomposition not implemented for goal: ${goal.label ?? goal.id}`);
    return [];
  }

  mark_achieved(goal_id: UUID): void {
    const node = this.goal_nodes.get(goal_id);
    if (node) {
      node.item.goal_status = 'achieved';
      console.log(`Goal ${node.item.label ?? goal_id} marked as ACHIEVED.`);
      // This is where logic to propagate status to parent goals would go.
    }
  }

  mark_failed(goal_id: UUID): void {
    const node = this.goal_nodes.get(goal_id);
    if (node) {
      node.item.goal_status = 'failed';
      console.log(`Goal ${node.item.label ?? goal_id} marked as FAILED.`);
      // This is where logic to propagate status to parent goals would go.
    }
  }

  get_ancestors(goal_id: UUID): UUID[] {
    // This is a simplified implementation. A real one would traverse the tree.
    const goal = this.goal_nodes.get(goal_id)?.item;
    if (goal?.goal_parent_id) {
      return [goal.goal_parent_id, ...this.get_ancestors(goal.goal_parent_id)];
    }
    return [];
  }

  // Helper method to register a goal in the tree
  public add_goal(goal: CognitiveItem): void {
    if (goal.type !== 'GOAL') return;

    this.goal_nodes.set(goal.id, {
      item: goal,
      children: new Set(),
    });

    if (goal.goal_parent_id) {
      const parentNode = this.goal_nodes.get(goal.goal_parent_id);
      if (parentNode) {
        parentNode.children.add(goal.id);
      }
    }
  }
}
