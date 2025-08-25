import { Agenda } from './agenda';
import { WorldModel } from './world-model';
import { AttentionModule, AttentionModuleImpl } from './modules/attention';
import { ResonanceModule, ResonanceModuleImpl } from './modules/resonance';
import { SchemaMatcher, SchemaMatcherImpl } from './modules/schema';
import { GoalTreeManager, GoalTreeManagerImpl } from './modules/goal-tree';
import { ActionSubsystem } from './modules/action';
import { ReflectionModule, ReflectionModuleImpl } from './modules/reflection';
import { PerceptionSubsystem } from './modules/perception';
import { CognitiveItem, DerivationStamp, newCognitiveItemId, UUID } from './types';
import { GOAL_DECOMPOSITION_SCHEMA_ATOM } from './utils';

type CognitiveCoreModules = {
  attention: AttentionModule;
  resonance: ResonanceModule;
  matcher: SchemaMatcher;
  goalTree: GoalTreeManager;
  action: ActionSubsystem;
  reflection: ReflectionModule;
  perception: PerceptionSubsystem;
};

export class CognitiveCore {
  private agenda: Agenda;
  private worldModel: WorldModel;
  private modules: CognitiveCoreModules;
  public getModules(): CognitiveCoreModules {
    return this.modules;
  }
  private running: boolean = false;

  constructor(agenda: Agenda, worldModel: WorldModel) {
    this.agenda = agenda;
    this.worldModel = worldModel;

    // Instantiate modules
    const attentionModule = new AttentionModuleImpl();
    const goalTreeManager = new GoalTreeManagerImpl(worldModel, attentionModule);
    const actionSubsystem = new ActionSubsystem(worldModel); // Pass worldModel to ActionSubsystem
    const reflectionModule = new ReflectionModuleImpl(agenda, worldModel, attentionModule, 60000);
    const perceptionSubsystem = new PerceptionSubsystem(worldModel, attentionModule);

    this.modules = {
      attention: attentionModule,
      resonance: new ResonanceModuleImpl(),
      matcher: new SchemaMatcherImpl(worldModel),
      goalTree: goalTreeManager,
      action: actionSubsystem,
      reflection: reflectionModule,
      perception: perceptionSubsystem,
    };
  }

  public async initialize(): Promise<void> {
    console.log('Initializing CognitiveCore modules...');
    // Register system schemas
    this.worldModel.add_atom(GOAL_DECOMPOSITION_SCHEMA_ATOM);
    this.worldModel.register_schema_atom(GOAL_DECOMPOSITION_SCHEMA_ATOM);

    await this.modules.action.initialize();
    // Initialize reflection module
    this.modules.reflection.start();
    console.log('CognitiveCore modules initialized.');
  }

  public start(): void {
    if (this.running) {
      console.log('CognitiveCore is already running.');
      return;
    }
    this.running = true;
    console.log('CognitiveCore started.');
    this.worker_loop().catch(err => {
      console.error('CognitiveCore worker loop crashed:', err);
      this.running = false;
    });
  }

  public async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.modules.action.cleanup();
    this.modules.reflection.stop();
    console.log('CognitiveCore stopped and cleaned up.');
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
          const resultItem = await this.modules.action.executeGoal(current_item);
          if (resultItem) {
            this.agenda.push(resultItem);
            this.modules.goalTree.mark_achieved(current_item.id);
            console.log(`Goal ${current_item.label ?? current_item.id} executed by ActionSubsystem.`);
            
            // Reinforce after action execution
            this.modules.attention.update_on_access([current_item], this.worldModel);
            continue; // Move to the next item after executing a goal
          } else {
            console.warn(`ActionSubsystem could not execute goal: ${current_item.label ?? current_item.id}. Attempting decomposition.`);
            // If no tool found or execution failed, attempt to decompose the goal.
            const subGoals = this.modules.goalTree.decompose(current_item, this.worldModel, this.modules.attention);
            if (subGoals.length > 0) {
              subGoals.forEach(subGoal => this.agenda.push(subGoal));
              console.log(`Goal ${current_item.label ?? current_item.id} decomposed into ${subGoals.length} sub-goals.`);
            } else {
              console.warn(`Goal ${current_item.label ?? current_item.id} could not be decomposed. Tracking as a primary goal.`);
              this.modules.goalTree.add_goal(current_item);
            }
          }
        }

        // 3. Reason - Apply schemas to pairs of items
        for (const itemB of contextItems) {
          const schemas = this.modules.matcher.find_applicable(current_item, itemB, this.worldModel);
          for (const schema of schemas) {
            try {
              // Get the schema atom to access trust score
              const schemaAtom = this.worldModel.get_atom(schema.atom_id);
              const sourceTrust = schemaAtom?.meta.trust_score ?? 0.5;
              
              // Apply the schema
              const derivedItems = [schema.content].map(thenClause => {
                let label = thenClause.then.label_template || 'New Derived Item';
                if (current_item.label) {
                  label = label.replace('{{a.label}}', current_item.label);
                }
                if (itemB.label) {
                  label = label.replace('{{b.label}}', itemB.label);
                }

                let atom_id: UUID;
                let content: any = {};

                if (thenClause.then.atom_id_from === 'a') {
                  atom_id = current_item.atom_id;
                  content = this.worldModel.get_atom(current_item.atom_id)?.content || {};
                } else if (thenClause.then.atom_id_from === 'b') {
                  atom_id = itemB.atom_id;
                  content = this.worldModel.get_atom(itemB.atom_id)?.content || {};
                } else {
                  // Create a new atom based on content_template or a generic one
                  content = thenClause.then.content_template || { 
                    derived_from: [current_item.atom_id, itemB.atom_id].filter(Boolean) 
                  };
                  const newAtom = this.worldModel.find_or_create_atom(content, {
                    type: 'Fact',
                    source: 'system_schema_derivation',
                    schema_id: schema.atom_id,
                  });
                  atom_id = newAtom.id;
                }

                return {
                  atom_id: atom_id,
                  type: thenClause.then.type,
                  truth: thenClause.then.truth || { frequency: 1.0, confidence: 0.7 },
                  goal_parent_id: current_item.type === 'GOAL' ? current_item.id : 
                                  itemB.type === 'GOAL' ? itemB.id : undefined,
                  label,
                  stamp: {
                    timestamp: Date.now(),
                    parent_ids: [current_item.id, itemB.id],
                    schema_id: schema.atom_id,
                    module: 'SchemaMatcher',
                  },
                } as Omit<CognitiveItem, 'id' | 'attention'>;
              });

              // Process derived items
              for (const derived of derivedItems) {
                const attention = this.modules.attention.calculate_derived(
                  [current_item, itemB],
                  schema.atom_id,
                  sourceTrust,
                );

                const stamp: DerivationStamp = {
                  timestamp: Date.now(),
                  parent_ids: derived.stamp.parent_ids,
                  schema_id: derived.stamp.schema_id,
                  module: 'SchemaMatcher',
                };

                const newItem: CognitiveItem = {
                  ...derived,
                  id: newCognitiveItemId(),
                  attention,
                  stamp,
                };

                this.agenda.push(newItem);
                console.log(`Pushed derived item to agenda: ${newItem.label ?? newItem.id}`);

                // Update goal tree if this is a belief that achieves a goal
                if (newItem.type === 'BELIEF' && newItem.goal_parent_id) {
                  this.modules.goalTree.mark_achieved(newItem.goal_parent_id);
                }
              }
            } catch (error) {
              console.warn(`Schema ${schema.atom_id} failed to apply`, error);
            }
          }
        }

        // 4. Memorize
        if (current_item.type === 'BELIEF') {
          const revisedItem = this.worldModel.revise_belief(current_item);
          if (revisedItem) {
            revisedItem.attention = this.modules.attention.calculate_initial(revisedItem);
            this.agenda.push(revisedItem);
          }
        }

        // 5. Reinforce
        this.modules.attention.update_on_access([current_item, ...contextItems], this.worldModel);

        // 6. Update goal tree for achieved goals
        if (current_item.type === 'GOAL' && this.is_achieved(current_item)) {
          this.modules.goalTree.mark_achieved(current_item.id);
        }

      } catch (e) {
        console.error(`Worker failed while processing item ${current_item.id}`, e);
      }
    }
  }

  private is_achieved(item: CognitiveItem): boolean {
    // Simple implementation - in a real system, this would check if the goal's conditions are met
    // For now, we'll just check if it has a result or if it's marked as achieved
    return item.goal_status === 'achieved';
  }
}
