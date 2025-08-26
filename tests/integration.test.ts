import { Agenda } from '../src/components/agenda';
import { WorldModel } from '../src/components/world-model';
import { EventBus } from '../src/core/event-bus';
import { CognitiveWorker } from '../src/core/worker';
import { ActionSubsystem } from '../src/components/action';
import { PerceptionSubsystem } from '../src/components/perception';

import { AttentionModule } from '../src/modules/attention';
import { ResonanceModule } from '../src/modules/resonance';
import { SchemaMatcher } from '../src/modules/schema-matcher';
import { GoalTreeManager } from '../src/modules/goal-tree-manager';

import { LogExecutor } from '../src/executors/log-executor';
import { TextTransducer } from '../src/transducers/text-transducer';

import { ovenSafetySchema, ovenSafetySchemaAtom } from '../src/schemas/oven-safety-schema';

describe("Cognitive Architecture Integration Test", () => {
    let agenda: Agenda;
    let worldModel: WorldModel;
    let actionSubsystem: ActionSubsystem;
    let perceptionSubsystem: PerceptionSubsystem;
    let schemaMatcher: SchemaMatcher;
    let worker: CognitiveWorker;
    let eventBus: EventBus;

    beforeEach(async () => {
        // --- Full system setup ---
        eventBus = new EventBus();
        agenda = new Agenda();
        worldModel = await WorldModel.create(eventBus);

        actionSubsystem = new ActionSubsystem(worldModel);
        actionSubsystem.register_executor(new LogExecutor());

        perceptionSubsystem = new PerceptionSubsystem(worldModel, agenda);
        perceptionSubsystem.register_transducer(new TextTransducer());

        schemaMatcher = new SchemaMatcher();

        worker = new CognitiveWorker(
            agenda,
            worldModel,
            new ResonanceModule(),
            schemaMatcher,
            new AttentionModule(),
            new GoalTreeManager(),
            actionSubsystem
        );
    });

    test("Should perceive data, reason to create a goal, and execute the goal", async () => {
        // 1. Define and register a reasoning schema
        await worldModel.add_atom(ovenSafetySchemaAtom);
        schemaMatcher.register_schema(ovenSafetySchema, worldModel);

        // 2. Perception
        perceptionSubsystem.process("the oven is on", "user_report");
        expect(agenda.size()).toBe(1);
        const perceivedItem = agenda.peek();
        expect(perceivedItem?.type).toBe('BELIEF');

        // 3. Tick 1: Process the perception, derive the goal
        await worker.tick();
        expect(agenda.size()).toBe(1);
        const goalItem = agenda.peek();
        expect(goalItem?.type).toBe('GOAL');
        expect(goalItem?.label).toBe('Turn off oven');

        // Verify the goal was added to the world model
        const goalInWorld = await worldModel.get_item(goalItem!.id);
        expect(goalInWorld).toBeDefined();

        // 4. Tick 2: Process the goal, execute the action
        const logSpy = jest.spyOn(console, 'log');
        await worker.tick();

        expect(logSpy).toHaveBeenCalledWith('[LogExecutor] Action: Turn off the oven.');

        // Verify the goal was marked as achieved in the database
        const finalGoal = await worldModel.get_item(goalItem!.id);
        expect(finalGoal?.goal_status).toBe('achieved');

        // 5. Tick 3: Process the belief from the action
        expect(agenda.size()).toBe(1);
        const resultBelief = agenda.peek();
        expect(resultBelief?.type).toBe('BELIEF');
        expect(resultBelief?.label).toContain('Result of logging');

        await worker.tick();

        // 6. Final state
        expect(agenda.size()).toBe(0);
        logSpy.mockRestore();
    });
});
