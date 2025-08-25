import { CognitiveCore } from './cognitive-core.js';
import { Agenda, AgendaImpl } from './agenda.js';
import { WorldModel, WorldModelImpl } from './world-model.js';
import { CognitiveItem, UUID } from './types.js';

export type SandboxHypothesis = {
    type: 'add_item' | 'update_item' | 'remove_item';
    item?: CognitiveItem;
    itemId?: UUID;
    update?: Partial<CognitiveItem>;
};

export type SandboxResult = {
    impactedItems: CognitiveItem[];
    newItems: CognitiveItem[];
};

export class SandboxService {
    private mainWorldModel: WorldModel;
    private mainAgenda: Agenda;

    constructor(worldModel: WorldModel, agenda: Agenda) {
        this.mainWorldModel = worldModel;
        this.mainAgenda = agenda;
    }

    public async run_what_if(hypothesis: SandboxHypothesis, steps: number = 10): Promise<SandboxResult> {
        // 1. Clone the main world model and agenda
        const sandboxWorldModel = this.mainWorldModel.clone();
        const sandboxAgenda = this.mainAgenda.clone();

        // 2. Create a new CognitiveCore with the cloned components
        const sandboxCore = new CognitiveCore(sandboxAgenda, sandboxWorldModel);
        await sandboxCore.initialize();

        // 3. Apply the hypothesis
        if (hypothesis.type === 'add_item' && hypothesis.item) {
            sandboxAgenda.push(hypothesis.item);
        } else if (hypothesis.type === 'update_item' && hypothesis.itemId && hypothesis.update) {
            const item = sandboxWorldModel.get_item(hypothesis.itemId);
            if (item) {
                const updatedItem = { ...item, ...hypothesis.update };
                sandboxWorldModel.update_item(item.id, updatedItem);
            }
        } else if (hypothesis.type === 'remove_item' && hypothesis.itemId) {
            // This is more complex, as it might involve removing from world model and agenda
            // For now, we'll just remove from agenda
            sandboxAgenda.remove(hypothesis.itemId);
        }

        // 4. Run the sandboxed core for a fixed number of steps
        for (let i = 0; i < steps; i++) {
            const item = await sandboxAgenda.pop();
            if (!item) break; // Stop if agenda is empty
            // This is a simplified run loop. A real implementation would use the full cognitive core worker loop.
            // For now, we'll just log the processing.
            console.log(`[Sandbox] Processing item: ${item.label}`);
        }

        // 5. Return the results
        const impactedItems = []; // Logic to determine impacted items
        const newItems = sandboxAgenda.getItems(); // Items left on the agenda

        return {
            impactedItems,
            newItems,
        };
    }
}
