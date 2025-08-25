import { Agenda } from './agenda';
import { WorldModel } from './world-model';
import { AttentionModule } from './modules/attention';
import { ResonanceModule } from './modules/resonance';
import { SchemaMatcher } from './modules/schema';
import { GoalTreeManager, GoalTreeManagerImpl } from './modules/goal-tree';
import { ActionSubsystem } from './modules/action';
import { CognitiveItem, newCognitiveItemId, DerivationStamp } from './types';

type CognitiveCoreModules = {
    attention: AttentionModule;
    resonance: ResonanceModule;
    matcher: SchemaMatcher;
    goalTree: GoalTreeManager;
    action: ActionSubsystem;
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
            const current_item = await this.agenda.pop();
            console.log(`Processing item: ${current_item.label ?? current_item.id}`);

            try {
                // 1. Contextualize
                const contextItems = await this.modules.resonance.find_context(current_item, this.worldModel, 10);

                // 2. Action
                if (current_item.type === 'GOAL') {
                    const executor = this.modules.action.find_executor(current_item);
                    if (executor) {
                        console.log(`Found executor for goal: ${current_item.label ?? current_item.id}`);
                        const result_item = await executor.execute(current_item, this.worldModel);
                        this.agenda.push(result_item);
                        // Mark goal as achieved since an action produced a result for it
                        this.modules.goalTree.mark_achieved(current_item.id);
                        continue; // Move to next item in agenda
                    } else {
                        // If no executor, just track it for now
                        (this.modules.goalTree as GoalTreeManagerImpl).add_goal(current_item);
                    }
                }

                // 3. Reason
                const derivedItems = this.modules.matcher.find_and_apply_schemas(current_item, contextItems, this.worldModel);
                for (const derived of derivedItems) {
                    const schemaAtom = this.worldModel.get_atom((derived as any).schema_id);
                    const sourceTrust = schemaAtom?.meta.trust_score ?? 0.5;

                    const attention = this.modules.attention.calculate_derived(
                        [current_item], // Simplified parent tracking
                        { atom_id: schemaAtom.id, compiled: null }, // Placeholder
                        sourceTrust
                    );

                    const stamp: DerivationStamp = {
                        timestamp: Date.now(),
                        parent_ids: [current_item.id], // Simplified parent tracking
                        schema_id: schemaAtom.id,
                        module: 'SchemaMatcher'
                    };

                    const newItem: CognitiveItem = {
                        ...derived,
                        id: newCognitiveItemId(),
                        attention,
                        stamp,
                    };

                    this.agenda.push(newItem);
                    console.log(`Pushed derived item to agenda: ${newItem.label ?? newItem.id}`);

                    if (newItem.type === 'BELIEF' && newItem.goal_parent_id) {
                        this.modules.goalTree.mark_achieved(newItem.goal_parent_id);
                    }
                }

                // 4. Memorize
                if (current_item.type === "BELIEF") {
                    const revisedItem = this.worldModel.revise_belief(current_item);
                    if (revisedItem) {
                        revisedItem.attention = this.modules.attention.calculate_initial(revisedItem);
                        this.agenda.push(revisedItem);
                    }
                }

                // 5. Reinforce
                this.modules.attention.update_on_access([current_item, ...contextItems], this.worldModel);

            } catch (e) {
                console.error(`Worker failed while processing item ${current_item.id}`, e);
            }
        }
    }
}
