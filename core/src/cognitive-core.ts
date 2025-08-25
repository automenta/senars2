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

    public async initialize(): Promise<void> {
        console.log("Initializing CognitiveCore modules...");
        await this.modules.action.initialize();
        console.log("CognitiveCore modules initialized.");
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

    public async stop(): Promise<void> {
        if (!this.running) return;
        this.running = false;
        await this.modules.action.cleanup();
        console.log("CognitiveCore stopped and cleaned up.");
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
                    const tools = this.modules.action.getTools();
                    const toolToExecute = tools.find(t => t.name === current_item.label);

                    if (toolToExecute) {
                        console.log(`Executing tool: ${toolToExecute.name}`);
                        const goalAtom = this.worldModel.get_atom(current_item.atom_id);
                        const toolInput = goalAtom?.content ?? {};

                        try {
                            const output = await toolToExecute.invoke(toolInput);
                            const resultAtom = this.worldModel.find_or_create_atom(
                                { result: output },
                                {
                                    type: 'Observation',
                                    source: toolToExecute.name,
                                }
                            );

                            const beliefItem: CognitiveItem = {
                                id: newCognitiveItemId(),
                                atom_id: resultAtom.id,
                                type: 'BELIEF',
                                truth: { frequency: 1.0, confidence: 1.0 }, // Tool outputs are treated as facts for now
                                attention: this.modules.attention.calculate_initial({ type: 'BELIEF' } as CognitiveItem),
                                stamp: {
                                    timestamp: Date.now(),
                                    parent_ids: [current_item.id],
                                    schema_id: 'tool-execution' as any, // Special ID for tool execution
                                },
                                goal_parent_id: current_item.id,
                                label: `Result from ${toolToExecute.name}`,
                            };

                            this.agenda.push(beliefItem);
                            this.modules.goalTree.mark_achieved(current_item.id);
                            console.log(`Tool ${toolToExecute.name} executed successfully.`);
                            // Continue to the next item, as this goal has been handled.
                            continue;
                        } catch (error) {
                            console.error(`Tool ${toolToExecute.name} failed to execute:`, error);
                            this.modules.goalTree.mark_failed(current_item.id);
                        }
                    } else {
                        // If no tool found, just track it as a goal for now.
                        (this.modules.goalTree as GoalTreeManagerImpl).add_goal(current_item);
                    }
                }

                // 3. Reason
                const derivedItems = this.modules.matcher.find_and_apply_schemas(current_item, contextItems, this.worldModel);
                for (const derived of derivedItems) {
                    const schemaAtom = this.worldModel.get_atom((derived as any).schema_id);
                    if (!schemaAtom) {
                        console.warn(`Could not find schema atom for derived item. Skipping.`);
                        continue;
                    }

                    const sourceTrust = schemaAtom?.meta.trust_score ?? 0.5;

                    const attention = this.modules.attention.calculate_derived(
                        [current_item], // Simplified parent tracking
                        schemaAtom.id,
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
