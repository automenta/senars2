import { Agenda, WorldModel, ResonanceModule, SchemaMatcher, AttentionModule, GoalTreeManager } from '../types/interfaces';
import { DerivationStamp } from '../types/data';
import { v4 as uuidv4 } from 'uuid';

export class CognitiveWorker {
    constructor(
        private agenda: Agenda,
        private worldModel: WorldModel,
        private resonanceModule: ResonanceModule,
        private schemaMatcher: SchemaMatcher,
        private attentionModule: AttentionModule,
        private goalTreeManager: GoalTreeManager,
        private running: boolean = true
    ) {}

    public stop() {
        this.running = false;
    }

    public async start() {
        console.log("Cognitive worker started.");
        while (this.running) {
            try {
                await this.cognitive_cycle();
            } catch (error) {
                console.error("Error in cognitive cycle:", error);
                // In a real system, add more robust error handling, maybe a circuit breaker.
                await new Promise(resolve => setTimeout(resolve, 1000)); // wait a bit before retrying
            }
        }
        console.log("Cognitive worker stopped.");
    }

    private async cognitive_cycle(): Promise<void> {
        const itemA = await this.agenda.pop();
        if (!this.running) return;

        console.log(`Processing item: ${itemA.id} (${itemA.type})`);

        // 1. Contextualize
        const contextItems = this.resonanceModule.find_context(itemA, this.worldModel, 10);

        // 2. Reason
        for (const itemB of contextItems) {
            const schemas = this.schemaMatcher.find_applicable(itemA, itemB, this.worldModel);
            for (const schema of schemas) {
                try {
                    const derivedItems = schema.apply(itemA, itemB, this.worldModel);
                    for (const newItem of derivedItems) {
                        const schemaAtom = this.worldModel.get_atom(schema.atom_id);
                        const sourceTrust = schemaAtom?.meta.trust_score ?? 0.5;

                        newItem.attention = this.attentionModule.calculate_derived(
                            [itemA, itemB],
                            schema,
                            sourceTrust
                        );

                        newItem.stamp = {
                            timestamp: Date.now(),
                            parent_ids: [itemA.id, itemB.id],
                            schema_id: schema.atom_id,
                        };

                        this.agenda.push(newItem);
                        console.log(`Derived new item: ${newItem.id} (${newItem.type})`);
                    }
                } catch (e) {
                    console.warn(`Schema ${schema.atom_id} failed to apply`, e);
                }
            }
        }

        // 3. Memorize
        if (itemA.type === "BELIEF") {
            const revisedItem = this.worldModel.revise_belief(itemA);
            if (revisedItem) {
                this.agenda.push(revisedItem);
            }
        }

        // 4. Reinforce
        this.attentionModule.update_on_access([itemA, ...contextItems]);

        // 5. Update goal tree
        if (itemA.type === "GOAL" && itemA.goal_status === "achieved") { // Assuming status is set elsewhere
            this.goalTreeManager.mark_achieved(itemA.id);
        }
    }
}
