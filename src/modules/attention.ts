import { logger } from '../lib/logger';
import { AttentionModule as IAttentionModule, CognitiveSchema, WorldModel, Agenda, CognitiveItem, AttentionValue } from '@cognitive-arch/types';

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

    async update_on_access(items: CognitiveItem[], world_model: WorldModel, agenda: Agenda): Promise<void> {
        for (const item of items) {
            const new_priority = Math.min(1.0, item.attention.priority + ACCESS_BOOST);
            const new_durability = Math.min(1.0, item.attention.durability + DURABILITY_BOOST);

            const newAttention: AttentionValue = {
                priority: new_priority,
                durability: new_durability
            };

            const itemInAgenda = agenda.get(item.id);

            if (itemInAgenda) {
                agenda.updateAttention(item.id, newAttention);
            } else {
                await world_model.update_item(item.id, { attention: newAttention });
            }
        }
    }

    async run_decay_cycle(world_model: WorldModel, agenda: Agenda): Promise<void> {
        logger.info("Running attention decay cycle...");
        let decayedItems = 0;

        // Decay items in the WorldModel
        const allWorldModelItems = await world_model.getItemsByFilter(_ => true);
        const wmUpdatePromises: Promise<void>[] = [];

        allWorldModelItems.forEach(item => {
            const newPriority = item.attention.priority * DECAY_FACTOR;
            const newAttention: AttentionValue = {
                priority: newPriority < 0.01 ? 0 : newPriority,
                durability: item.attention.durability, // Let's not decay durability for now
            };
            wmUpdatePromises.push(world_model.update_item(item.id, { attention: newAttention }));
            decayedItems++;
        });

        await Promise.all(wmUpdatePromises);

        // Decay items in the Agenda
        const allAgendaItems = agenda.getAllItems();
        allAgendaItems.forEach((item: CognitiveItem) => {
            const newPriority = item.attention.priority * DECAY_FACTOR;
            const newAttention: AttentionValue = {
                priority: newPriority < 0.01 ? 0 : newPriority,
                durability: item.attention.durability,
            };
            agenda.updateAttention(item.id, newAttention);
            decayedItems++;
        });

        logger.info(`Decayed attention for ${decayedItems} total items.`);
    }
}
