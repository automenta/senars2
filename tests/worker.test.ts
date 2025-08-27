import { CognitiveWorker } from '../src/core/worker';
import { Agenda, WorldModel, ResonanceModule, SchemaMatcher, AttentionModule, GoalTreeManager, CognitiveItem, CognitiveSchema, Executor, ExecutorResult } from '@cognitive-arch/types';
import { ActionSubsystem } from '../src/components/action';

// Mock dependencies
const mockAgenda: jest.Mocked<Agenda> = {
  pop_async: jest.fn(),
  pop: jest.fn(),
  push: jest.fn(),
  updateAttention: jest.fn(),
  remove: jest.fn(),
  get: jest.fn(),
  size: jest.fn(),
  getAllItems: jest.fn(),
  peek: jest.fn(),
};

const mockWorldModel: jest.Mocked<WorldModel> = {
  add_atom: jest.fn(),
  get_atom: jest.fn(),
  add_item: jest.fn(),
  get_item: jest.fn(),
  revise_belief: jest.fn(),
  update_item: jest.fn(),
  query_by_semantic: jest.fn(),
  query_by_symbolic: jest.fn(),
  query_by_structure: jest.fn(),
  register_schema_atom: jest.fn(),
  size: jest.fn(),
  getItemsByFilter: jest.fn(),
};

const mockResonanceModule: jest.Mocked<ResonanceModule> = {
  find_context: jest.fn(),
};

const mockSchemaMatcher: jest.Mocked<SchemaMatcher> = {
  find_applicable: jest.fn(),
  register_schema: jest.fn(),
};

const mockAttentionModule: jest.Mocked<AttentionModule> = {
  calculate_initial: jest.fn(),
  calculate_derived: jest.fn(),
  update_on_access: jest.fn(),
  run_decay_cycle: jest.fn(),
};

const mockGoalTreeManager: jest.Mocked<GoalTreeManager> = {
  get_ancestors: jest.fn(),
  mark_achieved: jest.fn(),
  mark_failed: jest.fn(),
  decompose: jest.fn(),
};

const mockActionSubsystem = new ActionSubsystem(mockWorldModel);

describe('CognitiveWorker', () => {
  let worker: CognitiveWorker;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    worker = new CognitiveWorker(
      mockAgenda,
      mockWorldModel,
      mockResonanceModule,
      mockSchemaMatcher,
      mockAttentionModule,
      mockGoalTreeManager,
      mockActionSubsystem
    );
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  it('should stop the worker', () => {
    worker.stop();
    expect((worker as any).running).toBe(false);
  });

  describe('tick', () => {
    it('should return false if no item is on the agenda', async () => {
      mockAgenda.pop.mockReturnValue(null);
      const result = await worker.tick();
      expect(result).toBe(false);
    });

    it('should process an item and return true', async () => {
      const item = { id: '1', type: 'BELIEF' } as CognitiveItem;
      mockAgenda.pop.mockReturnValue(item);
      mockResonanceModule.find_context.mockResolvedValue([]);
      mockSchemaMatcher.find_applicable.mockResolvedValue([]);
      const result = await worker.tick();
      expect(result).toBe(true);
      expect(mockAgenda.pop).toHaveBeenCalledTimes(1);
    });
  });

  describe('process_item', () => {
    it('should catch and log errors during item processing', async () => {
      const item = { id: '1', type: 'BELIEF' } as CognitiveItem;
      const error = new Error('Test Error');
      mockResonanceModule.find_context.mockRejectedValue(error);

      // Mock logger to spy on it
      const logger = require('../src/lib/logger');
      const errorSpy = jest.spyOn(logger.logger, 'error').mockImplementation(() => {});

      await (worker as any).process_item(item);

      expect(errorSpy).toHaveBeenCalledWith(`Worker failed processing item ${item.id}`, error);
      errorSpy.mockRestore();
    });

    it('should handle schema application errors gracefully', async () => {
      const itemA = { id: 'a', type: 'BELIEF' } as CognitiveItem;
      const itemB = { id: 'b', type: 'BELIEF' } as CognitiveItem;
      const schema = { atom_id: 's1', apply: jest.fn().mockRejectedValue(new Error('Schema error')) } as unknown as CognitiveSchema;

      mockResonanceModule.find_context.mockResolvedValue([itemB]);
      mockSchemaMatcher.find_applicable.mockResolvedValue([schema]);

      const logger = require('../src/lib/logger');
      const warnSpy = jest.spyOn(logger.logger, 'warn').mockImplementation(() => {});

      await (worker as any).process_item(itemA);

      expect(warnSpy).toHaveBeenCalledWith(`Schema ${schema.atom_id} failed to apply`, expect.any(Error));
      warnSpy.mockRestore();
    });

    it('should process derived goals correctly', async () => {
        const itemA = { id: 'a', type: 'GOAL' } as CognitiveItem;
        const itemB = { id: 'b', type: 'BELIEF' } as CognitiveItem;
        const newGoal = { id: 'newGoal', type: 'GOAL' } as CognitiveItem;
        const schema = {
          atom_id: 's1',
          apply: jest.fn().mockResolvedValue({ atoms: [], items: [newGoal] }),
        } as unknown as CognitiveSchema;

        mockResonanceModule.find_context.mockResolvedValue([itemB]);
        mockSchemaMatcher.find_applicable.mockResolvedValue([schema]);
        mockWorldModel.get_atom.mockResolvedValue({ meta: { trust_score: 0.8 } } as any);
        mockAttentionModule.calculate_derived.mockReturnValue({ priority: 0.9, durability: 0.8 });

        await (worker as any).process_item(itemA);

        expect(newGoal.goal_parent_id).toBe(itemA.id);
        expect(newGoal.goal_status).toBe('active');
        expect(mockWorldModel.add_item).toHaveBeenCalledWith(newGoal);
        expect(mockAgenda.push).toHaveBeenCalledWith(newGoal);
      });

      it('should act on active goals', async () => {
        const goal = { id: 'g1', type: 'GOAL', goal_status: 'active' } as CognitiveItem;
        const actionResult = {
          atom: { id: 'atom1' },
          belief: { id: 'belief1', type: 'BELIEF' },
        } as any;

        mockResonanceModule.find_context.mockResolvedValue([]);
        mockSchemaMatcher.find_applicable.mockResolvedValue([]);
        const executeGoalSpy = jest.spyOn(mockActionSubsystem, 'execute_goal').mockResolvedValue(actionResult);

        await (worker as any).process_item(goal);

        expect(executeGoalSpy).toHaveBeenCalledWith(goal);
        expect(mockWorldModel.add_atom).toHaveBeenCalledWith(actionResult.atom);
        expect(mockAgenda.push).toHaveBeenCalledWith(actionResult.belief);
      });

      it('should memorize beliefs and re-process if revised', async () => {
        const belief = { id: 'b1', type: 'BELIEF' } as CognitiveItem;
        const revisedBelief = { id: 'b2', type: 'BELIEF' } as CognitiveItem;

        mockResonanceModule.find_context.mockResolvedValue([]);
        mockSchemaMatcher.find_applicable.mockResolvedValue([]);
        mockWorldModel.revise_belief.mockResolvedValue(revisedBelief);

        await (worker as any).process_item(belief);

        expect(mockWorldModel.revise_belief).toHaveBeenCalledWith(belief);
        expect(mockAgenda.push).toHaveBeenCalledWith(revisedBelief);
      });

      it('should update the goal tree for an achieved goal', async () => {
        const goal = { id: 'g1', type: 'GOAL' } as CognitiveItem;
        mockWorldModel.get_item.mockResolvedValue({ ...goal, goal_status: 'achieved' });
        mockResonanceModule.find_context.mockResolvedValue([]);
        mockSchemaMatcher.find_applicable.mockResolvedValue([]);

        await (worker as any).process_item(goal);

        expect(mockGoalTreeManager.mark_achieved).toHaveBeenCalledWith(goal.id, mockWorldModel);
      });

      it('should update the goal tree for a failed goal', async () => {
        const goal = { id: 'g1', type: 'GOAL' } as CognitiveItem;
        mockWorldModel.get_item.mockResolvedValue({ ...goal, goal_status: 'failed' });
        mockResonanceModule.find_context.mockResolvedValue([]);
        mockSchemaMatcher.find_applicable.mockResolvedValue([]);

        await (worker as any).process_item(goal);

        expect(mockGoalTreeManager.mark_failed).toHaveBeenCalledWith(goal.id, mockWorldModel);
      });
  });
});
