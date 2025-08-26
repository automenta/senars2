import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { CognitiveCore } from './cognitive-core.js';
import { AgendaImpl } from './agenda.js';
import { WorldModelImpl } from './world-model.js';
import { CognitiveItem, newCognitiveItemId, UUID } from './types.js';
import { TextTransducer } from './modules/perception.js';

// Mock the tool-providing environment
const mockReadFile = jest.fn<() => Promise<string>>();
const mockReplace = jest.fn<() => Promise<string>>();
(global as any).read_file = mockReadFile;
(global as any).replace_with_git_merge_diff = mockReplace;

describe('E2E Self-Development Task', () => {
  let core: CognitiveCore;
  let agenda: AgendaImpl;
  let worldModel: WorldModelImpl;

  beforeEach(async () => {
    agenda = new AgendaImpl();
    worldModel = new WorldModelImpl();
    core = new CognitiveCore(agenda, worldModel);
    await core.initialize(); // This registers system schemas

    mockReadFile.mockClear();
    mockReplace.mockClear();
  });

  it('should read and modify a file to complete a self-improvement goal', async () => {
    // 1. Define the high-level goal
    const goalLabel = `Improve Cognitive Health calculation in file gui/src/components/ReflectionView.tsx by making change const healthScore = 100 - (kpis.memoryUtilization / 2) - (kpis.contradictionRate * 50);===const healthScore = 100 - (kpis.memoryUtilization / 2) - (kpis.contradictionRate * 50) - (kpis.agendaSize / 10);`;

    // 2. Manually create the initial goal item to avoid label truncation
    const goalAtom = worldModel.find_or_create_atom(goalLabel, { type: 'Goal' });
    const partialGoal: Partial<CognitiveItem> = {
        atom_id: goalAtom.id,
        type: 'GOAL',
        label: goalLabel,
        stamp: {
            timestamp: Date.now(),
            parent_ids: [],
            schema_id: 'manual-test-input' as UUID,
            module: 'user_input'
        },
    };
    const initialGoal: CognitiveItem = {
        id: newCognitiveItemId(),
        ...partialGoal,
        attention: core.getModules().attention.calculate_initial(partialGoal),
        goal_status: 'active',
    } as CognitiveItem;
    agenda.push(initialGoal);

    // 3. Run the cognitive core and wait for the decomposition to happen
    const decompositionPromise = new Promise<void>(resolve => {
        core.getModules().goalTree.once('decomposed', () => {
            resolve();
        });
    });

    core.start();
    await decompositionPromise;

    // 4. Verify the decomposition
    const agendaItems = agenda.getItems();
    // The MODIFY_CODE_SCHEMA should have created two sub-goals
    // Note: The exact number might vary based on other schemas. We look for the specific ones.
    const readFileQuery = agendaItems.find(item => item.label?.startsWith('content of file'));
    const replaceFileGoal = agendaItems.find(item => item.label?.startsWith('action: replace_in_file'));

    expect(readFileQuery).toBeDefined();
    expect(readFileQuery?.type).toBe('QUERY');
    expect(readFileQuery?.label).toBe('content of file gui/src/components/ReflectionView.tsx');

    expect(replaceFileGoal).toBeDefined();
    expect(replaceFileGoal?.type).toBe('GOAL');

    // 5. Simulate the next cycle: processing the read_file query
    // Manually pop the query and run another cycle
    agenda.remove(readFileQuery!.id);

    // The query for the file content should have produced a goal to run the read_file action.
    // In a real run, this would be on the agenda. For this test, we'll create it manually.
    const readActionGoal = {
        id: newCognitiveItemId(),
        type: 'GOAL',
        label: `action: read_file gui/src/components/ReflectionView.tsx`,
        atom_id: readFileQuery!.atom_id,
        attention: { priority: 0.9, durability: 0.9 },
        stamp: { timestamp: Date.now(), parent_ids: [readFileQuery!.id], schema_id: 'read-file-schema' as UUID }
    } as CognitiveItem;
    agenda.push(readActionGoal);

    // 6. Verify that the read_file action was called
    const originalFileContent = 'const healthScore = 100 - (kpis.memoryUtilization / 2) - (kpis.contradictionRate * 50);';
    mockReadFile.mockResolvedValue(originalFileContent);

    // We need to manually trigger the action execution part for the test
    const actionSubsystem = core.getModules().action;
    await actionSubsystem.executeGoal(readActionGoal);
    expect(mockReadFile).toHaveBeenCalledWith('gui/src/components/ReflectionView.tsx');

    // 7. Now, assume the replace_in_file goal is on the agenda and execute it
    agenda.remove(replaceFileGoal!.id); // Remove the original placeholder
    const replaceActionGoal = (await textTransducer.process(replaceFileGoal!.label!))[0];

    await actionSubsystem.executeGoal(replaceActionGoal);

    // 8. Verify the replace action was called with the correct parameters
    const expectedSearch = 'const healthScore = 100 - (kpis.memoryUtilization / 2) - (kpis.contradictionRate * 50);';
    const expectedReplace = 'const healthScore = 100 - (kpis.memoryUtilization / 2) - (kpis.contradictionRate * 50) - (kpis.agendaSize / 10);';
    expect(mockReplace).toHaveBeenCalledWith('gui/src/components/ReflectionView.tsx', expectedSearch, expectedReplace);

    await core.stop();
  }, 10000); // Increase timeout for this complex test
});
