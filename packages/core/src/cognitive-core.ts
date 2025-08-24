import { Agenda } from './agenda';
import { WorldModel } from './world-model';
import { AttentionModule } from './modules/attention';
import { ResonanceModule } from './modules/resonance';
import { SchemaMatcher } from './modules/schema'; // Assuming it will exist
import { CognitiveItem } from './types';

type CognitiveCoreModules = {
    attention: AttentionModule;
    resonance: ResonanceModule;
    matcher: SchemaMatcher; // Will be used in the next step
};

export class CognitiveCore {
    private agenda: Agenda;
    private worldModel: WorldModel;
    private modules: CognitiveCoreModules;
    private running: boolean = false;

    constructor(agenda: Agenda, worldModel: WorldModel, modules: CognitiveCoreModules) {
        this.agenda = agenda;
        this.worldModel = worldModel;
        this.modules = modules;
    }

    public start(): void {
        if (this.running) {
            console.log("CognitiveCore is already running.");
            return;
        }
        this.running = true;
        console.log("CognitiveCore started.");
        this.worker_loop().catch(err => {
            console.error("CognitiveCore worker loop crashed:", err);
            this.running = false;
        });
    }

    public stop(): void {
        this.running = false;
        console.log("CognitiveCore stopped.");
    }

    private async worker_loop(): Promise<void> {
        while (this.running) {
            const itemA = await this.agenda.pop();
            console.log(`Processing item: ${itemA.label ?? itemA.id}`);

            try {
                // 1. Contextualize
                const contextItems = await this.modules.resonance.find_context(itemA, this.worldModel, 10);
                console.log(`Found ${contextItems.length} context items.`);

                // 2. Reason
                const derivedItems = this.modules.matcher.find_and_apply_schemas(itemA, contextItems, this.worldModel);
                console.log(`Derived ${derivedItems.length} new items.`);

                for (const derived of derivedItems) {
                    const schema = { atom_id: 'implication-schema-id' as any }; // Placeholder
                    const sourceTrust = this.worldModel.get_atom(schema.atom_id)?.meta.trust_score ?? 0.5;

                    const attention = this.modules.attention.calculate_derived(
                        [itemA, ...contextItems], // This is not quite right, should be just the parents
                        schema,
                        sourceTrust
                    );

                    const stamp: import('./types').DerivationStamp = {
                        timestamp: Date.now(),
                        parent_ids: [itemA.id, ...contextItems.map(i => i.id)], // Also not quite right
                        schema_id: schema.atom_id,
                        module: 'SchemaMatcher'
                    };

                    const newItem: CognitiveItem = {
                        ...derived,
                        id: import('./types').newUUID(),
                        attention,
                        stamp,
                    };

                    this.agenda.push(newItem);
                    console.log(`Pushed derived item to agenda: ${newItem.label ?? newItem.id}`);
                }

                // 3. Memorize
                if (itemA.type === "BELIEF") {
                    const revisedItem = this.worldModel.revise_belief(itemA);
                    if (revisedItem) {
                        console.log(`Belief ${itemA.id} was revised. Pushing update to agenda.`);
                        // Push the revised item back to the agenda with updated attention
                        revisedItem.attention = this.modules.attention.calculate_initial(revisedItem);
                        this.agenda.push(revisedItem);
                    }
                }

                // 4. Reinforce
                this.modules.attention.update_on_access([itemA, ...contextItems], this.worldModel);

            } catch (e) {
                console.error(`Worker failed while processing item ${itemA.id}`, e);
            }
        }
    }
}
