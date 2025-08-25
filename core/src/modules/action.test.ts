import { ActionSubsystem } from './action';
import { CognitiveCore } from '../cognitive-core';
import { AgendaImpl } from '../agenda';
import { WorldModelImpl } from '../world-model';
import { AttentionModuleImpl } from './attention';
import { ResonanceModuleImpl } from './resonance';
import { SchemaMatcherImpl } from './schema';
import { GoalTreeManagerImpl } from './goal-tree';
import { CognitiveItem, newCognitiveItemId } from '../types';
import { ReflectionModuleImpl } from './reflection'; // Added import

// Increase timeout for this test suite as it involves starting a subprocess
jest.setTimeout(30000);

describe('ActionSubsystem and CognitiveCore Integration', () => {
  let agenda: AgendaImpl;
  let worldModel: WorldModelImpl;
  let attentionModule: AttentionModuleImpl; // Declared as let
  let resonanceModule: ResonanceModuleImpl; // Declared as let
  let schemaMatcher: SchemaMatcherImpl;     // Declared as let
  let goalTreeManager: GoalTreeManagerImpl; // Declared as let
  let actionSubsystem: ActionSubsystem;
  let cognitiveCore: CognitiveCore; // Declared as let

  beforeEach(async () => {
    // Setup all the modules
    agenda = new AgendaImpl();
    worldModel = new WorldModelImpl(1); // embedding dim doesn't matter here
    attentionModule = new AttentionModuleImpl(); // Assigned
    resonanceModule = new ResonanceModuleImpl(); // Assigned
    schemaMatcher = new SchemaMatcherImpl(worldModel); // Assigned
    goalTreeManager = new GoalTreeManagerImpl(worldModel, attentionModule); // Assigned
    actionSubsystem = new ActionSubsystem(worldModel);

    cognitiveCore = new CognitiveCore(agenda, worldModel);

    // Initialize the core, which starts the MCP server
    await cognitiveCore.initialize(); // Use cognitiveCore
  });

  afterEach(async () => {
    // Ensure the core and its subprocesses are cleaned up
    await cognitiveCore.stop(); // Use cognitiveCore
  });

  it('should execute a tool via a GOAL item and produce a BELIEF item', async () => {
    // 1. Create a goal to use the echo tool
    const toolInput = { message: 'Hello MCP!' };
    const goalAtom = worldModel.find_or_create_atom(toolInput, { type: 'Fact' });

    const goalItem: CognitiveItem = {
      id: newCognitiveItemId(),
      atom_id: goalAtom.id,
      type: 'GOAL',
      label: 'local-stdio_echo', // This must match the tool name from the MCP server
      attention: { priority: 1.0, durability: 1.0 },
      stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: 'user-input' as any,
      },
    };

    // 2. Add the goal to the agenda
    agenda.push(goalItem);
    cognitiveCore.start(); // Use cognitiveCore

    // 3. Wait for the result to appear in the agenda
    // The core will pop the GOAL, execute the tool, and push a BELIEF.
    const resultItem = await agenda.pop();

    // 4. Assertions
    expect(resultItem.type).toBe('BELIEF');
    expect(resultItem.label).toBe('Result from local-stdio_echo');
    expect(resultItem.goal_parent_id).toBe(goalItem.id);

    const resultAtom = worldModel.get_atom(resultItem.atom_id);
    expect(resultAtom).not.toBeNull();
    expect(resultAtom?.content.result).toBe(toolInput.message);
  });
});