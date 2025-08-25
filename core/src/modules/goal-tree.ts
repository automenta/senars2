import { CognitiveItem, PartialCognitiveItem, UUID, newCognitiveItemId } from '../types';

import { AttentionModule } from './attention';
import { WorldModel } from '../world-model';
import { SchemaMatcher } from './schema';
import { GOAL_DECOMPOSITION_SCHEMA_ATOM } from '../utils';

export interface GoalTreeManager {
  decompose(goal: CognitiveItem): CognitiveItem[];

  mark_achieved(goal_id: UUID): CognitiveItem[];

  mark_failed(goal_id: UUID): void;

  get_ancestors(goal_id: UUID): UUID[];

  add_goal(goal: CognitiveItem): void;
  
  get_sub_goals(goal_id: UUID): UUID[];

  get_goal_tree(): Map<UUID, { item: CognitiveItem, children: Set<UUID> }>;
}

export class GoalTreeManagerImpl implements GoalTreeManager {
  private goal_nodes: Map<UUID, { item: CognitiveItem, children: Set<UUID> }> = new Map();
  private dependency_to_dependents_map: Map<UUID, Set<UUID>> = new Map();
  private worldModel: WorldModel;
  private attentionModule: AttentionModule;
  private schemaMatcher: SchemaMatcher;

  constructor(worldModel: WorldModel, attentionModule: AttentionModule, schemaMatcher: SchemaMatcher) {
    this.worldModel = worldModel;
    this.attentionModule = attentionModule;
    this.schemaMatcher = schemaMatcher;
  }

  decompose(goal: CognitiveItem): CognitiveItem[] {
    // In the next step, this method will be implemented in the schema matcher.
    const decompositionResults = this.schemaMatcher.find_and_apply_decomposition_schemas?.(goal, this.worldModel);

    if (!decompositionResults || decompositionResults.length === 0) {
      console.log(`No decomposition schema found for goal: "${goal.label ?? goal.id}"`);
      return [];
    }

    const allSubGoals: CognitiveItem[] = [];
    const createdGoalsById: Map<string, CognitiveItem> = new Map();

    // First pass: create all goals so they can be referenced by dependencies
    for (const result of decompositionResults) {
      const { partialItem } = result;
      const subGoal: CognitiveItem = {
        ...partialItem,
        id: newCognitiveItemId(),
        attention: this.attentionModule.calculate_derived(
          [goal],
          result.schema.atom_id,
          0.9 // High trust for system decomposition schemas
        ),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [goal.id],
          schema_id: result.schema.atom_id,
          module: 'GoalTreeManager',
        },
        goal_parent_id: goal.id,
        goal_status: 'active', // Will be updated by add_goal
        goal_dependencies: [], // Will be populated next
      };
      allSubGoals.push(subGoal);
      // Use a temporary ID from the partial item if available, otherwise label.
      const tempId = (partialItem as any).temp_id || partialItem.label;
      if (tempId) {
        createdGoalsById.set(tempId, subGoal);
      }
    }

    // Second pass: resolve dependencies and add goals to the tree
    for (const subGoal of allSubGoals) {
      const partialItem = decompositionResults.find(r => r.partialItem.label === subGoal.label)?.partialItem;
      const dependencyTempIds = (partialItem as any)?.dependencies || [];

      const dependencyIds = dependencyTempIds.map((tempId: string) => {
        const dependentGoal = createdGoalsById.get(tempId);
        return dependentGoal ? dependentGoal.id : null;
      }).filter((id: UUID | null): id is UUID => id !== null);

      subGoal.goal_dependencies = dependencyIds;
      this.add_goal(subGoal);
    }

    console.log(`Decomposed goal "${goal.label}" into ${allSubGoals.length} sub-goals.`);
    return allSubGoals;
  }

  mark_achieved(goal_id: UUID): CognitiveItem[] {
    const node = this.goal_nodes.get(goal_id);
    if (!node) return [];

    node.item.goal_status = 'achieved';
    console.log(`Goal ${node.item.label ?? goal_id} marked as ACHIEVED.`);

    // Propagate status to parent goals
    this.checkAndPropagateStatus(goal_id);

    // Check for dependent goals that can now be unblocked
    return this.update_dependents(goal_id);
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

    // Check dependencies to determine initial status
    let isBlocked = false;
    if (goal.goal_dependencies && goal.goal_dependencies.length > 0) {
      for (const depId of goal.goal_dependencies) {
        const depNode = this.goal_nodes.get(depId);
        if (depNode?.item.goal_status !== 'achieved') {
          isBlocked = true;
          break;
        }
      }
    }

    goal.goal_status = isBlocked ? 'blocked' : 'active';
    console.log(`Adding goal '${goal.label}' with status: ${goal.goal_status}`);

    // Add to main goal nodes map
    this.goal_nodes.set(goal.id, {
      item: goal,
      children: new Set(),
    });

    // Add to parent's children set
    if (goal.goal_parent_id) {
      const parentNode = this.goal_nodes.get(goal.goal_parent_id);
      if (parentNode) {
        parentNode.children.add(goal.id);
      }
    }

    // Populate the reverse dependency map
    if (goal.goal_dependencies) {
      for (const depId of goal.goal_dependencies) {
        if (!this.dependency_to_dependents_map.has(depId)) {
          this.dependency_to_dependents_map.set(depId, new Set());
        }
        this.dependency_to_dependents_map.get(depId)!.add(goal.id);
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

  private update_dependents(achieved_goal_id: UUID): CognitiveItem[] {
    const unblocked_goals: CognitiveItem[] = [];
    const dependents = this.dependency_to_dependents_map.get(achieved_goal_id);

    if (!dependents) return [];

    for (const dependentId of dependents) {
      const dependentNode = this.goal_nodes.get(dependentId);
      if (dependentNode && dependentNode.item.goal_status === 'blocked') {
        let all_deps_achieved = true;
        for (const depId of dependentNode.item.goal_dependencies || []) {
          const depNode = this.goal_nodes.get(depId);
          if (depNode?.item.goal_status !== 'achieved') {
            all_deps_achieved = false;
            break;
          }
        }

        if (all_deps_achieved) {
          dependentNode.item.goal_status = 'active';
          unblocked_goals.push(dependentNode.item);
          console.log(`Goal ${dependentNode.item.label ?? dependentId} UNBLOCKED and set to active.`);
        }
      }
    }
    return unblocked_goals;
  }

  private checkAndPropagateStatus(goal_id: UUID): void {
    const node = this.goal_nodes.get(goal_id);
    if (!node?.item.goal_parent_id) return;

    const parentNode = this.goal_nodes.get(node.item.goal_parent_id);
    if (!parentNode) return;

    const childrenStatuses = Array.from(parentNode.children).map(childId => {
      return this.goal_nodes.get(childId)?.item.goal_status;
    });

    const parentItem = parentNode.item;
    const currentParentStatus = parentItem.goal_status;
    let newParentStatus = currentParentStatus;

    // Rule 1: If any child has failed, the parent fails.
    if (childrenStatuses.some(status => status === 'failed')) {
      newParentStatus = 'failed';
    }
    // Rule 2: If all children are achieved, the parent is achieved.
    else if (childrenStatuses.every(status => status === 'achieved')) {
      newParentStatus = 'achieved';
    }

    // If the status has changed, update it and propagate the change upwards.
    if (newParentStatus !== currentParentStatus) {
      parentItem.goal_status = newParentStatus;
      console.log(`Parent goal ${parentItem.label ?? parentItem.id} marked as ${newParentStatus}.`);
      // Continue propagating up the tree
      this.checkAndPropagateStatus(parentItem.id);
    }
  }
}
