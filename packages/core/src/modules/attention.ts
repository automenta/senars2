import { CognitiveItem, AttentionValue } from '../types';
import { WorldModel, CognitiveSchema } from '../world-model';
import { Agenda } from '../agenda';

export interface AttentionModule {
    calculate_initial(item: CognitiveItem): AttentionValue;
    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust?: number
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

    calculate_initial(item: CognitiveItem): AttentionValue {
        let priority = 0.5;
        switch (item.type) {
            case 'GOAL':
                priority = this.GOAL_INITIAL_PRIORITY;
                break;
            case 'BELIEF':
                priority = this.BELIEF_INITIAL_PRIORITY;
                break;
            case 'QUERY':
                priority = this.QUERY_INITIAL_PRIORITY;
                break;
        }
        // Initial durability could be based on the item's source trust or other metadata
        const durability = item.truth?.confidence ?? 0.5;
        return { priority, durability };
    }

    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust: number = 0.5
    ): AttentionValue {
        if (parents.length === 0) {
            return { priority: this.BELIEF_INITIAL_PRIORITY * source_trust, durability: 0.5 };
        }

        const avgParentPriority = parents.reduce((sum, p) => sum + p.attention.priority, 0) / parents.length;
        const avgParentDurability = parents.reduce((sum, p) => sum + p.attention.durability, 0) / parents.length;

        // Derived priority is influenced by parents' priority and the trust in the schema/source
        const priority = Math.min(0.99, avgParentPriority * (0.5 + source_trust * 0.5));

        // Durability is inherited from parents
        const durability = Math.min(0.99, avgParentDurability);

        return { priority, durability };
    }

    update_on_access(items: CognitiveItem[], world_model: WorldModel): void {
        items.forEach(item => {
            const newDurability = Math.min(0.99, item.attention.durability + this.DURABILITY_ON_ACCESS_INCREASE);
            const updatedItem: CognitiveItem = {
                ...item,
                attention: {
                    ...item.attention,
                    durability: newDurability,
                },
            };
            world_model.update_item(item.id, updatedItem);
        });
    }

    run_decay_cycle(world_model: WorldModel, agenda: Agenda): void {
        // This would iterate through all items in the WorldModel and reduce their
        // durability. If durability falls below a threshold, the item could be removed.
        // This is a complex process that is out of scope for the initial implementation.
        console.log("Attention decay cycle not implemented.");
    }
}
