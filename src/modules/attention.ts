import { AttentionModule as IAttentionModule, CognitiveSchema, WorldModel, Agenda } from '../types/interfaces';
import { CognitiveItem, AttentionValue } from '../types/data';

export class AttentionModule implements IAttentionModule {
    calculate_initial(item: CognitiveItem): AttentionValue {
        return { priority: 0.5, durability: 0.5 };
    }

    calculate_derived(
        parents: CognitiveItem[],
        schema: CognitiveSchema,
        source_trust?: number
    ): AttentionValue {
        const avgParentPriority = parents.reduce((sum, p) => sum + p.attention.priority, 0) / parents.length;
        return { priority: avgParentPriority * (source_trust ?? 0.8), durability: 0.5 };
    }

    update_on_access(items: CognitiveItem[]): void {
        // Placeholder: In a real system, this would reinforce attention.
        items.forEach(item => {
            item.attention.priority = Math.min(1.0, item.attention.priority + 0.01);
        });
    }

    run_decay_cycle(world_model: WorldModel, agenda: Agenda): void {
        // Placeholder: In a real system, this would reduce attention over time.
        console.log("Running attention decay cycle...");
    }
}
