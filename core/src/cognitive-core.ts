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
import { ALL_SYSTEM_SCHEMAS } from './system-schemas';

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
    const schemaMatcher = new SchemaMatcherImpl(worldModel);
    const goalTreeManager = new GoalTreeManagerImpl(worldModel, attentionModule, schemaMatcher);
    const actionSubsystem = new ActionSubsystem(worldModel); // Pass worldModel to ActionSubsystem
    const reflectionModule = new ReflectionModuleImpl(agenda, worldModel, attentionModule, 60000);
    const perceptionSubsystem = new PerceptionSubsystem(worldModel, attentionModule);

    this.modules = {
      attention: attentionModule,
      resonance: new ResonanceModuleImpl(),
      matcher: schemaMatcher,
      goalTree: goalTreeManager,
      action: actionSubsystem,
      reflection: reflectionModule,
      perception: perceptionSubsystem,
    };
  }

  public async initialize(): Promise<void> {
    console.log('Initializing CognitiveCore modules...');

    // Register all system schemas
    for (const schemaAtom of ALL_SYSTEM_SCHEMAS) {
      this.worldModel.add_atom(schemaAtom);
    }

    // Find all schema atoms from the world model and register them with the matcher
    const allAtoms = this.worldModel.get_all_atoms();
    for (const atom of allAtoms) {
      if (atom.meta.type === 'CognitiveSchema') {
        this.modules.matcher.register_schema(atom);
      }
    }

    await this.modules.action.initialize();
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

      // Defensive check: If a blocked goal somehow ends up on the agenda, skip it.
      if (item.type === 'GOAL' && item.goal_status === 'blocked') {
        console.log(`Skipping blocked goal: ${item.label ?? item.id}`);
        continue;
      }

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
          const unblockedGoals = this.modules.goalTree.mark_achieved(item.id);
          unblockedGoals.forEach(goal => this.agenda.push(goal));
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
    const subGoals = this.modules.goalTree.decompose(item);
    if (subGoals.length > 0) {
      subGoals.forEach(subGoal => this.agenda.push(subGoal));
      console.log(`Goal ${item.label ?? item.id} decomposed into ${subGoals.length} sub-goals.`);
      return true;
    }

    // If not decomposed, attempt to execute it as an action.
    const resultItem = await this.modules.action.executeGoal(item);
    if (resultItem) {
      this.agenda.push(resultItem);
      const unblockedGoals = this.modules.goalTree.mark_achieved(item.id);
      unblockedGoals.forEach(goal => this.agenda.push(goal));
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
   * Finds and applies relevant schemas to an item and its context.
   */
  private async applySchemas(itemA: CognitiveItem, contextItems: CognitiveItem[]): Promise<void> {
    const derivationResults = this.modules.matcher.find_and_apply_schemas(itemA, contextItems, this.worldModel);

    for (const result of derivationResults) {
      const { partialItem, parentItems, schema } = result;

      const schemaAtom = this.worldModel.get_atom(schema.atom_id);
      const sourceTrust = schemaAtom?.meta.trust_score ?? 0.8;

      const attention = this.modules.attention.calculate_derived(
        parentItems,
        schema.atom_id,
        sourceTrust
      );

      const stamp: DerivationStamp = {
        timestamp: Date.now(),
        parent_ids: parentItems.map(p => p.id),
        schema_id: schema.atom_id,
        module: 'SchemaMatcher',
      };

      const newItem: CognitiveItem = {
        ...partialItem,
        id: newCognitiveItemId(),
        attention,
        stamp,
      };

      this.agenda.push(newItem);
      console.log(`Pushed derived item to agenda: ${newItem.label ?? newItem.id}`);
    }
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
