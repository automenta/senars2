import { AttentionModule as IAttentionModule, CognitiveSchema, WorldModel, Agenda } from '../types/interfaces';
import { CognitiveItem, AttentionValue } from '../types/data';

const DECAY_FACTOR = 0.98; // Keep 98% of attention each cycle
const ACCESS_BOOST = 0.1;
const DURABILITY_BOOST = 0.05;

export class AttentionModule implements IAttentionModule {

    calculate_initial(item: CognitiveItem): AttentionValue {
        // New perceptions get high priority but medium durability
        return { priority: 0.9, durability: 0.5 };
    }

    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust: number = 0.5
    ): AttentionValue {
        if (parents.length === 0) {
            return { priority: 0.5, durability: 0.5 };
        }

        const avgParentPriority = parents.reduce((sum, p) => sum + p.attention.priority, 0) / parents.length;
        const avgParentDurability = parents.reduce((sum, p) => sum + p.attention.durability, 0) / parents.length;

        // Derived priority is based on parents' priority, modulated by the schema's trust
        const newPriority = avgParentPriority * (0.5 + (source_trust * 0.5));

        return {
            priority: Math.max(0, Math.min(1.0, newPriority)),
            durability: Math.max(0, Math.min(1.0, avgParentDurability))
        };
    }

    async update_on_access(items: CognitiveItem[], world_model: WorldModel): Promise<void> {
        for (const item of items) {
            const new_priority = Math.min(1.0, item.attention.priority + ACCESS_BOOST);
            const new_durability = Math.min(1.0, item.attention.durability + DURABILITY_BOOST);
            await world_model.update_item(item.id, {
                attention: {
                    ...item.attention,
                    priority: new_priority,
                    durability: new_durability
                }
            });
        }
    }

    async run_decay_cycle(world_model: WorldModel, agenda: Agenda): Promise<void> {
        console.log("AttentionModule: Running attention decay cycle...");
        let decayedItems = 0;

        // Decay items in the WorldModel
        const allItems = await world_model.getItemsByFilter(_ => true);
        allItems.forEach(item => {
            // Priority decays faster than durability
            item.attention.priority *= DECAY_FACTOR;
            item.attention.durability *= (DECAY_FACTOR + 0.01); // Durability decays slower

            if (item.attention.priority < 0.01) {
                item.attention.priority = 0;
            }
            decayedItems++;
        });

        // The agenda will be resorted on the next push, so we don't need to do it here.
        // If the agenda implementation was more complex, we might need to trigger a resort.

        console.log(`AttentionModule: Decayed attention for ${decayedItems} items.`);
    }
}
