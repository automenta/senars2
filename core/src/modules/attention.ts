import { AttentionValue, CognitiveItem, UUID } from '../types';
import { WorldModel } from '../world-model';
import { Agenda } from '../agenda';

export interface AttentionModule {
  calculate_initial(item: CognitiveItem): AttentionValue;

  calculate_derived(
    parents: CognitiveItem[],
    schema_id: UUID,
    source_trust?: number,
  ): AttentionValue;

  update_on_access(items: CognitiveItem[], world_model: WorldModel): void;

  run_decay_cycle(world_model: WorldModel, agenda: Agenda): void;
}

export class AttentionModuleImpl implements AttentionModule {
  // These would be configurable parameters in a real system
  private readonly GOAL_INITIAL_PRIORITY = 0.8;
  private readonly BELIEF_INITIAL_PRIORITY = 0.5;
  private readonly QUERY_INITIAL_PRIORITY = 0.7;
  private readonly DURABILITY_ON_ACCESS_INCREASE = 0.05;
  private readonly DECAY_FACTOR = 0.01; // How much priority/durability decays per cycle
  private readonly MIN_PRIORITY_THRESHOLD = 0.1; // Items below this priority are removed from agenda

  calculate_initial(item: CognitiveItem): AttentionValue {
    let priority = 0.5;
    let durability = 0.5;
    
    switch (item.type) {
      case 'GOAL':
        priority = this.GOAL_INITIAL_PRIORITY;
        // Goals might have higher durability if they're important
        durability = 0.7;
        break;
      case 'BELIEF':
        priority = this.BELIEF_INITIAL_PRIORITY;
        // Durability for beliefs could be based on confidence
        durability = item.truth?.confidence ?? 0.5;
        break;
      case 'QUERY':
        priority = this.QUERY_INITIAL_PRIORITY;
        // Queries might have lower durability as they're often temporary
        durability = 0.3;
        break;
    }
    
    // Adjust based on source trust if available
    // This would require access to the atom, but we can approximate
    if (item.stamp.module === 'user_input') {
      priority = Math.min(0.99, priority + 0.1); // User input gets a boost
    }
    
    return { priority, durability };
  }

  calculate_derived(
    parents: CognitiveItem[],
    schema_id: UUID,
    source_trust: number = 0.5,
  ): AttentionValue {
    if (parents.length === 0) {
      return { priority: this.BELIEF_INITIAL_PRIORITY * source_trust, durability: 0.5 };
    }

    // Calculate weighted average of parent priorities
    let weightedPrioritySum = 0;
    let weightedDurabilitySum = 0;
    let totalWeight = 0;
    
    parents.forEach(parent => {
      // Weight by parent's durability (more durable parents have more influence)
      const weight = parent.attention.durability;
      weightedPrioritySum += parent.attention.priority * weight;
      weightedDurabilitySum += parent.attention.durability * weight;
      totalWeight += weight;
    });
    
    if (totalWeight === 0) {
      return { priority: this.BELIEF_INITIAL_PRIORITY, durability: 0.5 };
    }
    
    const avgParentPriority = weightedPrioritySum / totalWeight;
    const avgParentDurability = weightedDurabilitySum / totalWeight;

    // Derived priority is influenced by parents' priority and the trust in the schema/source
    // Higher trust increases the derived priority
    const priority = Math.min(0.99, avgParentPriority * (0.7 + source_trust * 0.3));

    // Durability is mostly inherited from parents but slightly reduced
    const durability = Math.min(0.99, avgParentDurability * 0.9);

    return { priority, durability };
  }

  update_on_access(items: CognitiveItem[], world_model: WorldModel): void {
    items.forEach(item => {
      // When an item is accessed, increase its durability
      const newDurability = Math.min(0.99, item.attention.durability + this.DURABILITY_ON_ACCESS_INCREASE);
      
      // Slightly increase priority as well when accessed
      const newPriority = Math.min(0.99, item.attention.priority + 0.02);
      
      const updatedItem: CognitiveItem = {
        ...item,
        attention: {
          priority: newPriority,
          durability: newDurability,
        },
      };
      world_model.update_item(item.id, updatedItem);
    });
  }

  run_decay_cycle(world_model: WorldModel, agenda: Agenda): void {
    console.log('Running attention decay cycle...');
    const allItems = world_model.get_all_items();

    allItems.forEach(item => {
      // Apply decay based on time since last access
      const timeSinceLastAccess = Date.now() - item.stamp.timestamp;
      const decayMultiplier = Math.max(0.5, 1 - (timeSinceLastAccess / (7 * 24 * 60 * 60 * 1000))); // 1 week
      
      const decayAmount = this.DECAY_FACTOR * decayMultiplier;
      
      const newPriority = Math.max(0, item.attention.priority - decayAmount);
      const newDurability = Math.max(0, item.attention.durability - decayAmount * 0.5); // Durability decays slower

      const updatedItem: CognitiveItem = {
        ...item,
        attention: {
          priority: newPriority,
          durability: newDurability,
        },
      };
      world_model.update_item(item.id, updatedItem);

      // If priority drops too low, remove from agenda
      if (newPriority < this.MIN_PRIORITY_THRESHOLD) {
        if (agenda.remove(item.id)) {
          console.log(`Item ${item.label ?? item.id} removed from agenda due to low priority.`);
        }
      }

      // If durability drops too low, consider for archival/removal from WorldModel
      if (newDurability < 0.1) {
        console.log(`Item ${item.label ?? item.id} has very low durability. Consider archiving.`);
      }
    });
  }
}
