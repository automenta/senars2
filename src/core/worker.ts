import { Agenda, WorldModel, ResonanceModule, SchemaMatcher, AttentionModule, GoalTreeManager } from '../types/interfaces';
import { ActionSubsystem } from '../components/action';
import { CognitiveItem } from '../types/data';

export class CognitiveWorker {
    private running: boolean = true;

    constructor(
        private agenda: Agenda,
        private worldModel: WorldModel,
        private resonanceModule: ResonanceModule,
        private schemaMatcher: SchemaMatcher,
        private attentionModule: AttentionModule,
        private goalTreeManager: GoalTreeManager,
        private actionSubsystem: ActionSubsystem
    ) {}

    public stop() {
        console.log("Cognitive worker stopping...");
        this.running = false;
    }

    public async start() {
        console.log("Cognitive worker started (async mode).");
        while (this.running) {
            const itemA = await this.agenda.pop_async();
            if (!this.running) break;
            await this.process_item(itemA);
        }
        console.log("Cognitive worker stopped.");
    }

    public async tick(): Promise<boolean> {
        const itemA = this.agenda.pop();
        if (!itemA) {
            return false;
        }
        await this.process_item(itemA);
        return true;
    }

    private async process_item(itemA: CognitiveItem): Promise<void> {
        console.log(`Processing item: ${itemA.label ?? itemA.id} (${itemA.type}, P:${itemA.attention.priority.toFixed(2)})`);

        // 1. Contextualize & Reason
        const contextItems = await this.resonanceModule.find_context(itemA, this.worldModel, 10);
        for (const itemB of [...contextItems, itemA]) {
            const schemas = await this.schemaMatcher.find_applicable(itemA, itemB, this.worldModel);
            for (const schema of schemas) {
                const derivedData = await this.apply_schema(schema, itemA, itemB);

                for (const newAtom of derivedData.atoms) {
                    await this.worldModel.add_atom(newAtom);
                }

                for (const newItem of derivedData.items) {
                    await this.worldModel.add_item(newItem);
                    this.agenda.push(newItem);
                    console.log(`Derived new item: ${newItem.label ?? newItem.id} (${newItem.type}) and added to WorldModel.`);
                }
            }
        }

        // 2. Act
        if (itemA.type === 'GOAL' && itemA.goal_status === 'active') {
            const belief_from_action = await this.actionSubsystem.execute_goal(itemA);
            if (belief_from_action) {
                await this.worldModel.add_item(belief_from_action);
                this.agenda.push(belief_from_action);
                console.log(`Pushed belief from action to agenda: ${belief_from_action.label ?? belief_from_action.id}`);
            }
        }

        // 3. Memorize
        if (itemA.type === "BELIEF") {
            await this.worldModel.revise_belief(itemA);
        }

        // 4. Reinforce
        await this.attentionModule.update_on_access([itemA, ...contextItems], this.worldModel);

        // 5. Update Goal Tree on Status Change
        if (itemA.type === "GOAL") {
            if (itemA.goal_status === "achieved") {
                await this.goalTreeManager.mark_achieved(itemA.id, this.worldModel);
            } else if (itemA.goal_status === "failed") {
                await this.goalTreeManager.mark_failed(itemA.id, this.worldModel);
            }
        }
    }

    private async apply_schema(schema: any, itemA: CognitiveItem, itemB: CognitiveItem) {
        try {
            const derivedData = schema.apply(itemA, itemB, this.worldModel);

            for (const newItem of derivedData.items) {
                const schemaAtom = await this.worldModel.get_atom(schema.atom_id);
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

                if (newItem.type === 'GOAL') {
                    if (itemA.type === 'GOAL') {
                        newItem.goal_parent_id = itemA.id;
                    }
                    if (!newItem.goal_status) {
                        newItem.goal_status = 'active';
                    }
                }
            }
            return derivedData;
        } catch (e) {
            console.warn(`Schema ${schema.atom_id} failed to apply`, e);
            return { items: [], atoms: [] };
        }
    }
}
