import { Agenda } from './components/agenda';
import { WorldModel } from './components/world-model';
import { WorkerPool } from './core/worker-pool';
import { ReflectionLoop } from './core/reflection';
import { ActionSubsystem } from './components/action';
import { PerceptionSubsystem } from './components/perception';

import { AttentionModule } from './modules/attention';
import { ResonanceModule } from './modules/resonance';
import { SchemaMatcher } from './modules/schema-matcher';
import { GoalTreeManager } from './modules/goal-tree-manager';

import { LogExecutor } from './executors/log-executor';
import { TextTransducer } from './transducers/text-transducer';

import { testTriggerSchema, testTriggerSchemaAtom } from './schemas/test-trigger-schema';
import { SemanticAtom } from './types/data';

const NUM_WORKERS = 4;
const TEST_DURATION_MS = 3000; // Run for 3 seconds

async function main() {
    console.log("--- System Initialization ---");

    const agenda = new Agenda();
    const worldModel = await WorldModel.create();
    const actionSubsystem = new ActionSubsystem(worldModel);
    const perceptionSubsystem = new PerceptionSubsystem(worldModel, agenda);
    const attentionModule = new AttentionModule();
    const resonanceModule = new ResonanceModule();
    const schemaMatcher = new SchemaMatcher();
    const goalTreeManager = new GoalTreeManager();

    actionSubsystem.register_executor(new LogExecutor());
    perceptionSubsystem.register_transducer(new TextTransducer());

    const workerPool = new WorkerPool(
        NUM_WORKERS,
        agenda,
        worldModel,
        resonanceModule,
        schemaMatcher,
        attentionModule,
        goalTreeManager,
        actionSubsystem
    );

    const reflectionLoop = new ReflectionLoop(worldModel, agenda, attentionModule, 1000);

    console.log("\n--- Scenario Setup ---");
    await worldModel.add_atom(testTriggerSchemaAtom);
    schemaMatcher.register_schema(testTriggerSchema, worldModel);
    console.log("Schema registered. System is ready for controlled execution.");

    console.log("\n--- Running Scenario (Continuous) ---");
    workerPool.start();
    reflectionLoop.start();

    perceptionSubsystem.process("initiate test", "user_input");

    // Let the system run for a while
    await new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS));

    console.log("\n--- Stopping System ---");
    workerPool.stop();
    reflectionLoop.stop();

    console.log("\n--- Verification ---");
    const goals = await worldModel.getItemsByFilter(item => item.type === 'GOAL');
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

    // Semantic search test from previous step
    console.log("\n--- Semantic Search Test ---");
    const atom1: SemanticAtom = { id: 'atom1', content: { text: 'cat' }, embedding: [1, 0, 0], meta: { type: 'Fact', source: 'test', timestamp: '', author: '', trust_score: 1, domain: '', license: '' } };
    const item1: import('./types/data').CognitiveItem = { id: 'item1', atom_id: 'atom1', type: 'BELIEF', attention: { priority: 0.5, durability: 0.5 }, stamp: { timestamp: 0, parent_ids: [], schema_id: '' }, truth: { frequency: 1, confidence: 1 }, label: 'Belief: cat' };
    const atom2: SemanticAtom = { id: 'atom2', content: { text: 'dog' }, embedding: [0, 1, 0], meta: { type: 'Fact', source: 'test', timestamp: '', author: '', trust_score: 1, domain: '', license: '' } };
    const item2: import('./types/data').CognitiveItem = { id: 'item2', atom_id: 'atom2', type: 'BELIEF', attention: { priority: 0.5, durability: 0.5 }, stamp: { timestamp: 0, parent_ids: [], schema_id: '' }, truth: { frequency: 1, confidence: 1 }, label: 'Belief: dog' };
    await worldModel.add_atom(atom1);
    await worldModel.add_item(item1);
    await worldModel.add_atom(atom2);
    await worldModel.add_item(item2);
    const queryEmbedding = [0.9, 0.1, 0];
    const searchResults = await worldModel.query_by_semantic(queryEmbedding, 1);
    if (searchResults.length > 0 && searchResults[0].id === 'item1') {
        console.log(`✅ Semantic search returned the correct item: ${searchResults[0].label}`);
    } else {
        console.error("❌ Semantic search failed. Expected 'item1', got:", searchResults);
    }
}

main().catch(console.error);
