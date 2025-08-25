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

    // More general decomposition logic
    if (goal.label?.includes('Diagnose')) {
      // Sub-goal 1: Verify chocolate toxicity
      const verifyToxicityAtom = worldModel.find_or_create_atom(
        '(verify chocolate toxicity)',
        { type: 'Fact', source: 'system_schema' }
      );
      const verifyToxicityGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: verifyToxicityAtom.id,
        type: 'GOAL',
        attention: attentionModule.calculate_initial({
          id: newCognitiveItemId(), // Temporary ID for attention calculation
          atom_id: verifyToxicityAtom.id,
          type: 'GOAL',
          label: 'Verify chocolate toxicity',
          attention: { priority: 0, durability: 0 }, // Placeholder attention
          stamp: {
            timestamp: Date.now(),
            parent_ids: [goal.id],
            schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          },
        }),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [goal.id],
          schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          module: 'GoalTreeManager',
        },
        goal_parent_id: goal.id,
        goal_status: 'active',
        label: 'Verify chocolate toxicity',
      };
      subGoals.push(verifyToxicityGoal);
      this.add_goal(verifyToxicityGoal); // Add to the goal tree

      // Sub-goal 2: Assess symptoms
      const assessSymptomsAtom = worldModel.find_or_create_atom(
        '(assess symptoms)',
        { type: 'Fact', source: 'system_schema' }
      );
      const assessSymptomsGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: assessSymptomsAtom.id,
        type: 'GOAL',
        attention: attentionModule.calculate_initial({
          id: newCognitiveItemId(), // Temporary ID for attention calculation
          atom_id: assessSymptomsAtom.id,
          type: 'GOAL',
          label: 'Assess symptoms',
          attention: { priority: 0, durability: 0 }, // Placeholder attention
          stamp: {
            timestamp: Date.now(),
            parent_ids: [goal.id],
            schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          },
        }),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [goal.id],
          schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          module: 'GoalTreeManager',
        },
        goal_parent_id: goal.id,
        goal_status: 'active',
        label: 'Assess symptoms',
      };
      subGoals.push(assessSymptomsGoal);
      this.add_goal(assessSymptomsGoal); // Add to the goal tree

      // Sub-goal 3: Recommend treatment
      const recommendTreatmentAtom = worldModel.find_or_create_atom(
        '(recommend treatment)',
        { type: 'Fact', source: 'system_schema' }
      );
      const recommendTreatmentGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: recommendTreatmentAtom.id,
        type: 'GOAL',
        attention: attentionModule.calculate_initial({
          id: newCognitiveItemId(), // Temporary ID for attention calculation
          atom_id: recommendTreatmentAtom.id,
          type: 'GOAL',
          label: 'Recommend treatment',
          attention: { priority: 0, durability: 0 }, // Placeholder attention
          stamp: {
            timestamp: Date.now(),
            parent_ids: [goal.id],
            schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          },
        }),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [goal.id],
          schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          module: 'GoalTreeManager',
        },
        goal_parent_id: goal.id,
        goal_status: 'active',
        label: 'Recommend treatment',
      };
      subGoals.push(recommendTreatmentGoal);
      this.add_goal(recommendTreatmentGoal); // Add to the goal tree

      console.log(`Decomposed goal "${goal.label}" into ${subGoals.length} sub-goals.`);
    } else if (goal.label?.includes('Verify')) {
      // For verification goals, create a query
      const queryAtom = worldModel.find_or_create_atom(
        `(is_toxic_to chocolate cat)`,
        { type: 'Fact', source: 'system_schema' }
      );
      const queryItem: CognitiveItem = {
        id: newCognitiveItemId(),
        atom_id: queryAtom.id,
        type: 'QUERY',
        attention: attentionModule.calculate_initial({
          id: newCognitiveItemId(),
          atom_id: queryAtom.id,
          type: 'QUERY',
          label: 'Is chocolate toxic to cats?',
          attention: { priority: 0, durability: 0 },
          stamp: {
            timestamp: Date.now(),
            parent_ids: [goal.id],
            schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          },
        }),
        stamp: {
          timestamp: Date.now(),
          parent_ids: [goal.id],
          schema_id: GOAL_DECOMPOSITION_SCHEMA_ATOM.id,
          module: 'GoalTreeManager',
        },
        goal_parent_id: goal.id,
        label: 'Is chocolate toxic to cats?',
      };
      subGoals.push(queryItem);
      console.log(`Decomposed verification goal "${goal.label}" into a query.`);
    } else {
      console.log(`Goal decomposition not implemented for goal: ${goal.label ?? goal.id}`);
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
