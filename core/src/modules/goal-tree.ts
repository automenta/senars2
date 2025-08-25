import { CognitiveItem, UUID, newCognitiveItemId } from '../types';

import { AttentionModule } from './attention';
import { WorldModel } from '../world-model';
import { GOAL_DECOMPOSITION_SCHEMA_ATOM } from '../utils';

export interface GoalTreeManager {
  decompose(goal: CognitiveItem, worldModel: WorldModel, attentionModule: AttentionModule): CognitiveItem[];

  mark_achieved(goal_id: UUID): void;

  mark_failed(goal_id: UUID): void;

  get_ancestors(goal_id: UUID): UUID[];

  add_goal(goal: CognitiveItem): void;
  
  get_sub_goals(goal_id: UUID): UUID[];

  get_goal_tree(): Map<UUID, { item: CognitiveItem, children: Set<UUID> }>;
}

export class GoalTreeManagerImpl implements GoalTreeManager {
  private goal_nodes: Map<UUID, { item: CognitiveItem, children: Set<UUID> }> = new Map();
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;

  constructor(worldModel: WorldModel, attentionModule: AttentionModule) {
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
  }

  decompose(goal: CognitiveItem, worldModel: WorldModel, attentionModule: AttentionModule): CognitiveItem[] {
    const subGoals: CognitiveItem[] = [];
    const goalLabel = goal.label || '';

    // A simple, more generic decomposition strategy based on keywords.
    if (goalLabel.toLowerCase().startsWith('diagnose')) {
      const entity = goalLabel.substring('diagnose'.length).trim();
      const subGoalLabels = [
        `Gather information about ${entity}`,
        `Analyze symptoms for ${entity}`,
        `Formulate a conclusion for ${entity}`,
      ];

      for (const label of subGoalLabels) {
        const atom = worldModel.find_or_create_atom(
          `(goal: "${label}")`,
          { type: 'Fact', source: 'system_schema_decomposition' }
        );

        const subGoal: CognitiveItem = {
          id: newCognitiveItemId(),
          atom_id: atom.id,
          type: 'GOAL',
          attention: attentionModule.calculate_derived(
            [goal],
            GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
            0.9 // High trust for system decomposition schemas
          ),
          stamp: {
            timestamp: Date.now(),
            parent_ids: [goal.id],
            schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
            module: 'GoalTreeManager',
          },
          goal_parent_id: goal.id,
          goal_status: 'active',
          label: label,
        };
        subGoals.push(subGoal);
        this.add_goal(subGoal); // Register the new sub-goal in the tree
      }
      console.log(`Decomposed goal "${goalLabel}" into ${subGoals.length} sub-goals.`);
    } else {
      console.log(`No generic decomposition strategy found for goal: "${goalLabel}"`);
    }

    return subGoals;
  }

  mark_achieved(goal_id: UUID): void {
    const node = this.goal_nodes.get(goal_id);
    if (node) {
      node.item.goal_status = 'achieved';
      console.log(`Goal ${node.item.label ?? goal_id} marked as ACHIEVED.`);
      
      // Propagate status to parent goals
      this.checkAndPropagateStatus(goal_id);
    }
  }

  mark_failed(goal_id: UUID): void {
    const node = this.goal_nodes.get(goal_id);
    if (node) {
      node.item.goal_status = 'failed';
      console.log(`Goal ${node.item.label ?? goal_id} marked as FAILED.`);
      
      // Propagate status to parent goals
      this.checkAndPropagateStatus(goal_id);
    }
  }

  get_ancestors(goal_id: UUID): UUID[] {
    const ancestors: UUID[] = [];
    let currentId = goal_id;
    
    while (true) {
      const goal = this.goal_nodes.get(currentId)?.item;
      if (goal?.goal_parent_id) {
        ancestors.push(goal.goal_parent_id);
        currentId = goal.goal_parent_id;
      } else {
        break;
      }
    }
    
    return ancestors;
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

  public get_sub_goals(goal_id: UUID): UUID[] {
    const node = this.goal_nodes.get(goal_id);
    return node ? Array.from(node.children) : [];
  }

  public get_goal_tree(): Map<UUID, { item: CognitiveItem, children: Set<UUID> }> {
    return this.goal_nodes;
  }

  private checkAndPropagateStatus(goal_id: UUID): void {
    const node = this.goal_nodes.get(goal_id);
    if (!node) return;
    
    // If this goal has a parent, check if all siblings have the same status
    if (node.item.goal_parent_id) {
      const parentNode = this.goal_nodes.get(node.item.goal_parent_id);
      if (parentNode) {
        // Check if all children have the same status
        const childrenStatuses = Array.from(parentNode.children).map(childId => {
          const childNode = this.goal_nodes.get(childId);
          return childNode?.item.goal_status;
        });
        
        // If all children have the same status, propagate to parent
        const uniqueStatuses = [...new Set(childrenStatuses)];
        if (uniqueStatuses.length === 1 && uniqueStatuses[0]) {
          // All children have the same status
          const parentItem = parentNode.item;
          parentItem.goal_status = uniqueStatuses[0];
          console.log(`Parent goal ${parentItem.label ?? parentItem.id} marked as ${uniqueStatuses[0]}.`);
          
          // Continue propagating up the tree
          this.checkAndPropagateStatus(parentItem.id);
        }
      }
    }
  }
}
