import { Agenda } from '../src/components/agenda';
import { WorldModel } from '../src/components/world-model';
import { CognitiveWorker } from '../src/core/worker';
import { ActionSubsystem } from '../src/components/action';
import { PerceptionSubsystem } from '../src/components/perception';

import { AttentionModule } from '../src/modules/attention';
import { ResonanceModule } from '../src/modules/resonance';
import { SchemaMatcher } from '../src/modules/schema-matcher';
import { GoalTreeManager } from '../src/modules/goal-tree-manager';

import { LogExecutor } from '../src/executors/log-executor';
import { TextTransducer } from '../src/transducers/text-transducer';

import { SemanticAtom, CognitiveItem, UUID } from '../src/types/data';
import { createAtomId } from '../src/lib/utils';
import { v4 as uuidv4 } from 'uuid';


describe("Cognitive Architecture Integration Test", () => {

    let agenda: Agenda;
    let worldModel: WorldModel;
    let actionSubsystem: ActionSubsystem;
    let perceptionSubsystem: PerceptionSubsystem;
    let schemaMatcher: SchemaMatcher;
    let worker: CognitiveWorker;

    beforeEach(() => {
        // --- Full system setup ---
        agenda = new Agenda();
        worldModel = new WorldModel();

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
        const schemaContent = {
            pattern: {
                a: { type: 'BELIEF', 'atom.content.text': 'the oven is on' }
            },
            apply_args: ['ctx'],
            apply_logic: `
                const { a, wm, uuidv4, createAtomId } = ctx;
                const goal_content = { command: 'log', message: 'Action: Turn off the oven.' };
                const goal_meta = {
                    type: "Fact", source: "reasoning:safety-schema", timestamp: new Date().toISOString(),
                    author: "system", trust_score: 1.0, domain: "safety", license: "internal"
                };
                const goal_atom = {
                    id: createAtomId(goal_content, goal_meta), content: goal_content, embedding: [], meta: goal_meta
                };
                const goal_item = {
                    id: uuidv4(), atom_id: goal_atom.id, type: 'GOAL',
                    attention: { priority: 1.0, durability: 0.9 },
                    stamp: { timestamp: Date.now(), parent_ids: [a.id], schema_id: 'safety-schema-atom' },
                    goal_status: 'active', label: "Turn off oven"
                };
                wm.add_atom(goal_atom);
                return [goal_item];
            `
        };
        const schemaAtom: SemanticAtom = {
            id: 'safety-schema-atom' as any, content: schemaContent, embedding: [],
            meta: {
                type: 'CognitiveSchema', source: 'system_definition', timestamp: new Date().toISOString(),
                author: 'system', trust_score: 1.0, domain: 'safety',
                label: 'Oven Safety Schema', license: 'internal'
            }
        };
        worldModel.add_atom(schemaAtom);
        schemaMatcher.register_schema(schemaAtom, worldModel);

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
        const goalInWorld = worldModel.get_item(goalItem!.id);
        expect(goalInWorld).toBeDefined();

        // 4. Tick 2: Process the goal, execute the action
        const logSpy = jest.spyOn(console, 'log');
        await worker.tick();

        expect(logSpy).toHaveBeenCalledWith('[LogExecutor] Action: Turn off the oven.');
        expect(goalItem?.goal_status).toBe('achieved');

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
