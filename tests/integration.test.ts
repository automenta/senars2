import { Agenda } from '../src/components/agenda';
import { WorldModel } from '../src/components/world-model';
import { CognitiveWorker } from '../src/core/worker';
import { ResonanceModule } from '../src/modules/resonance';
import { SchemaMatcher } from '../src/modules/schema-matcher';
import { AttentionModule } from '../src/modules/attention';
import { GoalTreeManager } from '../src/modules/goal-tree-manager';
import { ReflectionLoop } from '../src/core/reflection';
import { CognitiveItem, SemanticAtom, UUID } from '../src/types/data';
import { v4 as uuidv4 } from 'uuid';

// --- Test Setup & Helpers ---

const createTestAtom = (content: any, type: "Fact" | "CognitiveSchema" | "Observation" | "Rule" = "Fact", domain: string = "test"): SemanticAtom => {
    return {
        id: uuidv4() as UUID,
        content,
        embedding: [Math.random(), Math.random()],
        meta: {
            type,
            source: 'test',
            timestamp: new Date().toISOString(),
            author: 'tester',
            trust_score: 0.9,
            domain,
            license: 'internal'
        }
    };
};

const createTestItem = (atom: SemanticAtom, type: 'BELIEF' | 'GOAL' | 'QUERY', priority: number = 0.5): CognitiveItem => {
    return {
        id: uuidv4() as UUID,
        atom_id: atom.id,
        type,
        attention: { priority, durability: 0.5 },
        stamp: {
            timestamp: Date.now(),
            parent_ids: [],
            schema_id: 'initial' as UUID,
        },
        goal_status: type === 'GOAL' ? 'active' : undefined,
        truth: type === 'BELIEF' ? { frequency: 0.9, confidence: 0.9 } : undefined,
    };
};

describe("Cognitive Architecture Integration Tests", () => {

    let agenda: Agenda;
    let worldModel: WorldModel;
    let resonanceModule: ResonanceModule;
    let schemaMatcher: SchemaMatcher;
    let attentionModule: AttentionModule;
    let goalTreeManager: GoalTreeManager;
    let worker: CognitiveWorker;

    beforeEach(() => {
        agenda = new Agenda();
        worldModel = new WorldModel();
        resonanceModule = new ResonanceModule();
        schemaMatcher = new SchemaMatcher();
        attentionModule = new AttentionModule();
        goalTreeManager = new GoalTreeManager();
        worker = new CognitiveWorker(agenda, worldModel, resonanceModule, schemaMatcher, attentionModule, goalTreeManager);
    });

    test("Simple Reasoning: A goal should find context and a schema should derive a new belief", async () => {
        // 1. Setup
        const goalAtom = createTestAtom({ text: "diagnose patient" });
        const goalItem = createTestItem(goalAtom, 'GOAL');

        const contextAtom = createTestAtom({ text: "patient has fever" });
        const contextItem = createTestItem(contextAtom, 'BELIEF');

        const derivedAtom = createTestAtom({ text: "possible flu" });
        const derivedItem = createTestItem(derivedAtom, 'BELIEF');

        const schemaAtom = createTestAtom({
            pattern: {
                a: { type: 'GOAL' },
                b: { type: 'BELIEF' }
            }
        }, "CognitiveSchema");

        const schema = schemaMatcher.register_schema(schemaAtom, worldModel);
        schema.apply = jest.fn().mockReturnValue([derivedItem]);

        worldModel.add_atom(goalAtom);
        worldModel.add_atom(contextAtom);
        worldModel.add_atom(schemaAtom);
        worldModel.add_atom(derivedAtom);
        worldModel.add_item(goalItem);
        worldModel.add_item(contextItem);

        agenda.push(goalItem);

        // 2. Execution
        await worker.cognitive_cycle();

        // 3. Assertion
        expect(schema.apply).toHaveBeenCalledWith(goalItem, contextItem, worldModel);
        const nextItem = agenda.peek();
        expect(nextItem).toBe(derivedItem);
    });

    test("Goal Hierarchy: A parent goal should be marked 'achieved' when its sub-goal is achieved", async () => {
        // 1. Setup
        const parentGoalAtom = createTestAtom({ text: "diagnose patient" });
        const parentGoalItem = createTestItem(parentGoalAtom, 'GOAL');
        parentGoalItem.id = 'parent-goal' as UUID;

        const subGoalAtom = createTestAtom({ text: "get symptoms" });
        // Manually create to set parent ID
        const subGoalItem: CognitiveItem = {
            id: 'sub-goal' as UUID,
            atom_id: subGoalAtom.id,
            type: 'GOAL',
            attention: { priority: 0.8, durability: 0.5 },
            stamp: { timestamp: Date.now(), parent_ids: [parentGoalItem.id], schema_id: 'decomp-schema' as UUID },
            goal_status: 'active',
            goal_parent_id: parentGoalItem.id
        };

        worldModel.add_atom(parentGoalAtom);
        worldModel.add_atom(subGoalAtom);
        worldModel.add_item(parentGoalItem);
        worldModel.add_item(subGoalItem);

        // 2. Execution
        // Manually mark the sub-goal as achieved
        subGoalItem.goal_status = 'achieved';
        await goalTreeManager.mark_achieved(subGoalItem.id, worldModel);

        // 3. Assertion
        const parentInWorld = worldModel.get_item(parentGoalItem.id);
        expect(parentInWorld?.goal_status).toBe('achieved');
    });

    test("Belief Revision: A new belief should merge with an existing conflicting belief", async () => {
        // 1. Setup
        const atom = createTestAtom({ text: "sky color" });
        const originalBelief = createTestItem(atom, 'BELIEF');
        originalBelief.truth = { frequency: 1.0, confidence: 0.9 }; // Sky is blue

        const newBelief = createTestItem(atom, 'BELIEF');
        newBelief.truth = { frequency: 0.0, confidence: 0.7 }; // Sky is not blue (e.g., at night)

        worldModel.add_atom(atom);
        worldModel.add_item(originalBelief);

        // 2. Execution
        worldModel.revise_belief(newBelief);

        // 3. Assertion
        const revisedBelief = worldModel.get_item(originalBelief.id);
        expect(revisedBelief?.truth?.confidence).toBeCloseTo(0.9); // (0.9 + 0.7)/2 + 0.1
        expect(revisedBelief?.truth?.frequency).toBeCloseTo(0.5625); // (0.9*1 + 0.7*0) / 1.6
    });

    test("Reflection Loop: The loop should generate a system goal for memory pressure", async () => {
        // 1. Setup
        const small_threshold = 5;
        const reflectionLoop = new ReflectionLoop(worldModel, agenda, 100, { memory: small_threshold, contradiction: 0.05 });

        for (let i = 0; i < small_threshold + 1; i++) {
            const atom = createTestAtom({ index: i });
            worldModel.add_atom(atom);
        }

        // 2. Execution
        // We call the private run_cycle method for a deterministic test run
        await (reflectionLoop as any).run_cycle();

        // 3. Assertion
        const goal = agenda.peek();
        expect(goal).not.toBeNull();
        expect(goal?.type).toBe('GOAL');
        const goalAtom = worldModel.get_atom(goal!.atom_id);
        expect(goalAtom?.content).toEqual(['compact', 'memory']);
    });
});
