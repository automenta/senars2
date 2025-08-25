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
      const item = await this.agenda.pop();
      console.log(`Processing item: ${item.label ?? item.id}`);

      try {
        // Step 1: Handle Goals
        if (item.type === 'GOAL') {
          const goalHandled = await this.handleGoalProcessing(item);
          if (goalHandled) continue; // Skip to next item if goal was decomposed or executed
        }

        // Step 2: Contextualize and Reason
        const contextItems = await this.modules.resonance.find_context(item, this.worldModel, 10);
        await this.applySchemas(item, contextItems);

        // Step 3: Memorize Beliefs
        if (item.type === 'BELIEF') {
          await this.memorizeBelief(item);
        }

        // Step 4: Update Attention and Goal Status
        this.modules.attention.update_on_access([item, ...contextItems], this.worldModel);
        if (item.type === 'GOAL' && await this.is_achieved(item)) {
          this.modules.goalTree.mark_achieved(item.id);
        }

      } catch (e) {
        console.error(`Worker failed while processing item ${item.id}`, e);
      }
    }
  }

  /**
   * Handles the processing of a GOAL item, attempting to decompose or execute it.
   * @returns True if the goal was handled (decomposed or executed), false otherwise.
   */
  private async handleGoalProcessing(item: CognitiveItem): Promise<boolean> {
    // Attempt to decompose the goal into sub-goals.
    const subGoals = this.modules.goalTree.decompose(item, this.worldModel, this.modules.attention);
    if (subGoals.length > 0) {
      subGoals.forEach(subGoal => this.agenda.push(subGoal));
      console.log(`Goal ${item.label ?? item.id} decomposed into ${subGoals.length} sub-goals.`);
      return true;
    }

    // If not decomposed, attempt to execute it as an action.
    const resultItem = await this.modules.action.executeGoal(item);
    if (resultItem) {
      this.agenda.push(resultItem);
      this.modules.goalTree.mark_achieved(item.id);
      console.log(`Goal ${item.label ?? item.id} executed by ActionSubsystem.`);
      this.modules.attention.update_on_access([item], this.worldModel);
      return true;
    }

    // If it can't be decomposed or executed, track it as a primary goal.
    console.warn(`Goal ${item.label ?? item.id} could not be decomposed or executed. Tracking as a primary goal.`);
    this.modules.goalTree.add_goal(item);
    return false;
  }

  /**
   * Finds and applies relevant schemas to a pair of cognitive items.
   */
  private async applySchemas(itemA: CognitiveItem, contextItems: CognitiveItem[]): Promise<void> {
    for (const itemB of contextItems) {
      const schemas = this.modules.matcher.find_applicable(itemA, itemB, this.worldModel);
      for (const schema of schemas) {
        try {
          const derivedItems = await this.createDerivedItems(schema, itemA, itemB);
          for (const newItem of derivedItems) {
            this.agenda.push(newItem);
            console.log(`Pushed derived item to agenda: ${newItem.label ?? newItem.id}`);
            if (newItem.type === 'BELIEF' && newItem.goal_parent_id) {
              this.modules.goalTree.mark_achieved(newItem.goal_parent_id);
            }
          }
        } catch (error) {
          console.warn(`Schema ${schema.atom_id} failed to apply`, error);
        }
      }
    }
  }

  /**
   * Creates new cognitive items based on a schema and parent items.
   */
  private async createDerivedItems(schema: any, itemA: CognitiveItem, itemB: CognitiveItem): Promise<CognitiveItem[]> {
    const schemaAtom = this.worldModel.get_atom(schema.atom_id);
    const sourceTrust = schemaAtom?.meta.trust_score ?? 0.5;

    const thenClause = schema.content.then;
    let label = thenClause.label_template || 'New Derived Item';
    label = label.replace('{{a.label}}', itemA.label || 'itemA').replace('{{b.label}}', itemB.label || 'itemB');

    let atom_id: UUID;
    if (thenClause.atom_id_from === 'a') {
      atom_id = itemA.atom_id;
    } else if (thenClause.atom_id_from === 'b') {
      atom_id = itemB.atom_id;
    } else {
      const content = thenClause.content_template || { derived_from: [itemA.atom_id, itemB.atom_id].filter(Boolean) };
      const newAtom = this.worldModel.find_or_create_atom(content, {
        type: 'Fact',
        source: 'system_schema_derivation',
        schema_id: schema.atom_id,
      });
      atom_id = newAtom.id;
    }

    const attention = this.modules.attention.calculate_derived([itemA, itemB], schema.atom_id, sourceTrust);
    const stamp: DerivationStamp = {
      timestamp: Date.now(),
      parent_ids: [itemA.id, itemB.id],
      schema_id: schema.atom_id,
      module: 'SchemaMatcher',
    };

    const newItem: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id,
      attention,
      stamp,
      type: thenClause.type,
      truth: thenClause.truth || { frequency: 1.0, confidence: 0.7 },
      goal_parent_id: itemA.type === 'GOAL' ? itemA.id : itemB.type === 'GOAL' ? itemB.id : undefined,
      label,
    };

    return [newItem];
  }

  /**
   * Revises a belief in the world model.
   */
  private async memorizeBelief(item: CognitiveItem): Promise<void> {
    const revisedItem = this.worldModel.revise_belief(item);
    if (revisedItem) {
      revisedItem.attention = this.modules.attention.calculate_initial(revisedItem);
      this.agenda.push(revisedItem);
    }
  }

  /**
   * Checks if a goal is achieved.
   * A goal is achieved if its status is 'achieved' or if all its sub-goals are achieved.
   */
  private async is_achieved(item: CognitiveItem): Promise<boolean> {
    if (item.goal_status === 'achieved') {
      return true;
    }
    // A goal is also considered achieved if it has subgoals and all of them are achieved.
    const subGoalIds = this.modules.goalTree.get_sub_goals(item.id);
    if (subGoalIds.length > 0) {
      const subGoals = subGoalIds.map(id => this.worldModel.get_item(id)).filter(Boolean) as CognitiveItem[];
      return subGoals.every(sg => sg.goal_status === 'achieved');
    }
    return false;
  }
}
