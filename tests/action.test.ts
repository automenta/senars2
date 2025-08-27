import { ActionSubsystem } from '../src/components/action';
import { WorldModel, CognitiveItem, Executor, ExecutorResult } from '@cognitive-arch/types';
import { logger } from '../src/lib/logger';

// Mock the logger to prevent console output during tests
jest.mock('../src/lib/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
    },
}));

describe('ActionSubsystem', () => {
    let worldModel: jest.Mocked<WorldModel>;
    let actionSubsystem: ActionSubsystem;
    let mockExecutor: jest.Mocked<Executor>;

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Mock WorldModel
        worldModel = {
            add_atom: jest.fn(),
            add_item: jest.fn(),
            update_item: jest.fn(),
            get_atom: jest.fn(),
            get_item: jest.fn(),
            query_by_semantic: jest.fn(),
            query_by_symbolic: jest.fn(),
            query_by_structure: jest.fn(),
            revise_belief: jest.fn(),
            register_schema_atom: jest.fn(),
            size: jest.fn(),
            getItemsByFilter: jest.fn(),
        } as jest.Mocked<WorldModel>;

        // Mock Executor
        mockExecutor = {
            can_execute: jest.fn(),
            execute: jest.fn(),
        } as jest.Mocked<Executor>;

        actionSubsystem = new ActionSubsystem(worldModel);
    });

    const mockCognitiveItem = (id: string, type: 'BELIEF' | 'GOAL' | 'QUERY', label?: string): CognitiveItem => ({
        id,
        atom_id: `atom-${id}`,
        type,
        truth: { frequency: 1, confidence: 1 },
        attention: { priority: 1, durability: 1 },
        stamp: { timestamp: Date.now(), parent_ids: [], schema_id: 'schema-1' },
        label,
    });

    it('should return null if the item is not a goal', async () => {
        const nonGoalItem = mockCognitiveItem('1', 'BELIEF');
        const result = await actionSubsystem.execute_goal(nonGoalItem);
        expect(result).toBeNull();
    });

    it('should return null if no executor can be found', async () => {
        const goal = mockCognitiveItem('1', 'GOAL');
        mockExecutor.can_execute.mockResolvedValue(false);
        actionSubsystem.register_executor(mockExecutor);

        const result = await actionSubsystem.execute_goal(goal);

        expect(result).toBeNull();
        expect(mockExecutor.can_execute).toHaveBeenCalledWith(goal, worldModel);
    });

    it('should mark goal as failed if executor throws an error', async () => {
        const goal = mockCognitiveItem('1', 'GOAL');
        const error = new Error('Executor failed');
        mockExecutor.can_execute.mockResolvedValue(true);
        mockExecutor.execute.mockRejectedValue(error);
        actionSubsystem.register_executor(mockExecutor);

        const result = await actionSubsystem.execute_goal(goal);

        expect(result).toBeNull();
        expect(worldModel.update_item).toHaveBeenCalledWith('1', { goal_status: 'failed' });
        expect(logger.error).toHaveBeenCalledWith(
            `Executor ${mockExecutor.constructor.name} failed for goal ${goal.id}`,
            error
        );
    });

    it('should handle goals with a label', async () => {
        const goal = mockCognitiveItem('1', 'GOAL', 'labeled goal');
        const executorResult: ExecutorResult = {
            belief: mockCognitiveItem('belief-1', 'BELIEF'),
            atom: { id: 'atom-1', content: 'result', embedding: [], meta: { type: 'Fact', source: 'test', timestamp: '', author: '', trust_score: 1, domain: '', license: ''} },
        };
        mockExecutor.can_execute.mockResolvedValue(true);
        mockExecutor.execute.mockResolvedValue(executorResult);
        actionSubsystem.register_executor(mockExecutor);

        await actionSubsystem.execute_goal(goal);

        expect(logger.info).toHaveBeenCalledWith(
            `Executing goal ${goal.label} with ${mockExecutor.constructor.name}`
        );
        expect(logger.info).toHaveBeenCalledWith(`Goal ${goal.label} executed successfully.`);
    });

    it('should handle goals without a label, using the id', async () => {
        const goal = mockCognitiveItem('goal-id-123', 'GOAL');
        const executorResult: ExecutorResult = {
            belief: mockCognitiveItem('belief-1', 'BELIEF'),
            atom: { id: 'atom-1', content: 'result', embedding: [], meta: { type: 'Fact', source: 'test', timestamp: '', author: '', trust_score: 1, domain: '', license: ''} },
        };
        mockExecutor.can_execute.mockResolvedValue(true);
        mockExecutor.execute.mockResolvedValue(executorResult);
        actionSubsystem.register_executor(mockExecutor);

        await actionSubsystem.execute_goal(goal);

        expect(logger.info).toHaveBeenCalledWith(
            `Executing goal ${goal.id} with ${mockExecutor.constructor.name}`
        );
        expect(logger.info).toHaveBeenCalledWith(`Goal ${goal.id} executed successfully.`);
    });
});
