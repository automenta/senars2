import { logger } from '../lib/logger';
import { Agenda, WorldModel, ResonanceModule, SchemaMatcher, AttentionModule, GoalTreeManager, CognitiveItem } from '@cognitive-arch/types';
import { ActionSubsystem } from '../components/action';

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
        logger.info("Cognitive worker stopping...");
        this.running = false;
    }

    public async start() {
        logger.info("Cognitive worker started (async mode).");
        while (this.running) {
            const itemA = await this.agenda.pop_async();
            if (!this.running) break;
            await this.process_item(itemA);
        }
        logger.info("Cognitive worker stopped.");
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
        try {
            // 1. Contextualize
            const contextItems = await this.resonanceModule.find_context(itemA, this.worldModel, 10);

            // 2. Reason
            // The loop includes the trigger item (itemA) itself to allow for "unary" schemas
            // that might trigger based on a single item's properties.
            for (const itemB of [...contextItems, itemA]) {
                const schemas = await this.schemaMatcher.find_applicable(itemA, itemB, this.worldModel);
                for (const schema of schemas) {
                    try {
                        const derivedData = await schema.apply(itemA, itemB, this.worldModel);

                        // Add new atoms to the world model first
                        for (const newAtom of derivedData.atoms) {
                            await this.worldModel.add_atom(newAtom);
                        }

                        // Process derived items
                        for (const newItem of derivedData.items) {
                            const schemaAtom = await this.worldModel.get_atom(schema.atom_id);
                            const sourceTrust = schemaAtom?.meta.trust_score ?? 0.5;

                            // A. Assign provenance and attention
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

                            // B. Set goal hierarchy
                            if (newItem.type === 'GOAL') {
                                if (itemA.type === 'GOAL') newItem.goal_parent_id = itemA.id;
                                if (!newItem.goal_status) newItem.goal_status = 'active';
                            }

                            // C. Persist Goals/Queries and push all to Agenda
                            if (newItem.type === 'GOAL' || newItem.type === 'QUERY') {
                                // Persist operational items like goals immediately.
                                await this.worldModel.add_item(newItem);
                            }
                            // All new items are pushed to the agenda for further processing.
                            this.agenda.push(newItem);
                        }
                    } catch (e) {
                        logger.warn(`Schema ${schema.atom_id} failed to apply`, e);
                    }
                }
            }

            // 3. Act on Goals
            if (itemA.type === 'GOAL' && itemA.goal_status === 'active') {
                const actionResult = await this.actionSubsystem.execute_goal(itemA);
                if (actionResult) {
                    // The worker is responsible for orchestrating the result of an action.
                    // It adds the new atom to the world model and pushes the new belief to the agenda.
                    await this.worldModel.add_atom(actionResult.atom);
                    this.agenda.push(actionResult.belief);
                }
            }

            // 4. Memorize Beliefs
            if (itemA.type === "BELIEF") {
                const revisedItem = await this.worldModel.revise_belief(itemA);
                if (revisedItem && revisedItem.id !== itemA.id) {
                    // If revision created a new item or significantly changed it,
                    // it might need to be re-processed.
                    this.agenda.push(revisedItem);
                }
            }

            // 5. Reinforce Attention
            await this.attentionModule.update_on_access([itemA, ...contextItems], this.worldModel, this.agenda);

            // 6. Update Goal Tree
            if (itemA.type === "GOAL") {
                // This check might be simplified depending on how actions update status
                const currentItemState = await this.worldModel.get_item(itemA.id);
                if (currentItemState?.goal_status === "achieved") {
                    await this.goalTreeManager.mark_achieved(itemA.id, this.worldModel);
                } else if (currentItemState?.goal_status === "failed") {
                    await this.goalTreeManager.mark_failed(itemA.id, this.worldModel);
                }
            }
        } catch (e) {
            logger.error(`Worker failed processing item ${itemA.id}`, e);
        }
    }
}
