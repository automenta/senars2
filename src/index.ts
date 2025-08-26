import { Agenda } from './components/agenda';
import { WorldModel } from './components/world-model';
import { CognitiveWorker } from './core/worker';
import { ReflectionLoop } from './core/reflection';
import { ActionSubsystem } from './components/action';
import { PerceptionSubsystem } from './components/perception';

import { AttentionModule } from './modules/attention';
import { ResonanceModule } from './modules/resonance';
import { SchemaMatcher } from './modules/schema-matcher';
import { GoalTreeManager } from './modules/goal-tree-manager';

import { LogExecutor } from './executors/log-executor';
import { TextTransducer } from './transducers/text-transducer';

import { SemanticAtom } from './types/data';
import { createAtomId } from './lib/utils';

async function main() {
    console.log("--- System Initialization ---");

    // 1. Create Core Components
    const agenda = new Agenda();
    const worldModel = new WorldModel();

    // 2. Create Subsystems
    const actionSubsystem = new ActionSubsystem(worldModel);
    const perceptionSubsystem = new PerceptionSubsystem(worldModel, agenda);

    // 3. Create Cognitive Modules
    const attentionModule = new AttentionModule();
    const resonanceModule = new ResonanceModule();
    const schemaMatcher = new SchemaMatcher();
    const goalTreeManager = new GoalTreeManager();

    // 4. Register Concrete Implementations
    actionSubsystem.register_executor(new LogExecutor());
    perceptionSubsystem.register_transducer(new TextTransducer());

    // 5. Create the Cognitive Worker
    const worker = new CognitiveWorker(
        agenda,
        worldModel,
        resonanceModule,
        schemaMatcher,
        attentionModule,
        goalTreeManager,
        actionSubsystem
    );

    // 6. Create and start the Reflection Loop
    const reflectionLoop = new ReflectionLoop(worldModel, agenda, attentionModule, 200); // 200ms interval for test
    reflectionLoop.start();


    console.log("\n--- Scenario Setup ---");

    // 6. Define and Register a Reasoning Schema
    const schemaContent = {
        pattern: {
            a: { type: 'BELIEF', 'atom.content.text': 'initiate test' }
        },
        apply_args: ['ctx'],
        apply_logic: `
            const { a, wm, uuidv4, createAtomId } = ctx;
            const goal_content = { command: 'log', message: 'System test successful' };
            const goal_meta = {
                type: "Fact", source: "reasoning:test-schema", timestamp: new Date().toISOString(),
                author: "system", trust_score: 1.0, domain: "system.test", license: "internal"
            };
            const goal_atom = {
                id: createAtomId(goal_content, goal_meta), content: goal_content, embedding: [], meta: goal_meta
            };
            const goal_item = {
                id: uuidv4(), atom_id: goal_atom.id, type: 'GOAL',
                attention: { priority: 0.95, durability: 0.8 },
                stamp: { timestamp: Date.now(), parent_ids: [a.id], schema_id: 'test-schema-atom' },
                goal_status: 'active', label: "Goal: Log system test message"
            };
            wm.add_atom(goal_atom);
            return [goal_item];
        `
    };
    const schemaAtom: SemanticAtom = {
        id: 'test-schema-atom' as any, content: schemaContent, embedding: [],
        meta: {
            type: 'CognitiveSchema', source: 'system_definition', timestamp: new Date().toISOString(),
            author: 'system', trust_score: 1.0, domain: 'system.test', license: 'internal',
            label: 'Test Trigger Schema'
        }
    };
    worldModel.add_atom(schemaAtom);
    schemaMatcher.register_schema(schemaAtom, worldModel);

    console.log("Schema registered. System is ready for controlled execution.");

    // 7. Start the cognitive process by injecting a perception
    console.log("\n--- Running Scenario (Tick-based) ---");
    perceptionSubsystem.process("initiate test", "user_input");

    // 8. Run the worker until the agenda is empty
    let max_ticks = 10;
    while (agenda.size() > 0 && max_ticks > 0) {
        console.log(`\n[Tick ${11 - max_ticks}] - Agenda size: ${agenda.size()}`);
        await worker.tick();
        max_ticks--;
    }
    if (max_ticks === 0) {
        console.warn("Run finished due to reaching max_ticks.");
    }

    reflectionLoop.stop();
    console.log("\n--- Scenario Complete ---");
    console.log("Final state of Agenda size:", agenda.size());

    // 9. Verify the outcome
    console.log("\n--- Verification ---");
    const goals = worldModel.getItemsByFilter(item => item.type === 'GOAL');
    if (goals.length > 0) {
        const testGoal = goals.find(g => g.label === "Goal: Log system test message");
        if (testGoal) {
            console.log(`✅ Goal was created: ${testGoal.label}`);
            console.log(`Goal status: ${testGoal.goal_status}`);
            if (testGoal.goal_status === 'achieved') {
                console.log("✅ Goal was successfully achieved.");
            } else {
                console.error("❌ Goal was not achieved. Final status:", testGoal.goal_status);
            }
        } else {
            console.error("❌ Test goal was not found in the World Model.");
        }
    } else {
        console.error("❌ No goals found in the World Model.");
    }
}

main().catch(console.error);
