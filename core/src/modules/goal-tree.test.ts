import { GoalTreeManagerImpl } from './goal-tree.js';
import { WorldModel } from '../world-model.js';
import { jest } from '@jest/globals';
import { AttentionModule } from './attention.js';
import { CognitiveItem, UUID, newCognitiveItemId } from '../types.js';
import { SchemaMatcher } from './schema.js';
import { PredictiveModelingModule } from './predictive-modeling.js';

// Mock dependencies
const mockWorldModel = {
  find_or_create_atom: jest.fn((content) => ({
    id: newCognitiveItemId(),
    content,
    embedding: [],
    meta: { type: 'Fact' },
  })),
  get_atom: jest.fn(),
  add_atom: jest.fn(),
  // Add other methods if needed by the code under test
} as unknown as WorldModel;

const mockAttentionModule = {
  calculate_derived: jest.fn(() => ({ priority: 0.5, durability: 0.5 })),
  // Add other methods if needed by the code under test
} as unknown as AttentionModule;

const mockSchemaMatcher = {
  find_and_apply_decomposition_schemas: jest.fn(() => []),
} as unknown as SchemaMatcher;

const mockPredictionModule = {
    estimate_goal_completion: jest.fn(() => ({ time: 1000, confidence: 0.9 })),
} as unknown as PredictiveModelingModule;

const createGoal = (label: string, dependencies: UUID[] = []): CognitiveItem => ({
  id: newCognitiveItemId(),
  atom_id: newCognitiveItemId(),
  type: 'GOAL',
  label,
  attention: { priority: 0.5, durability: 0.5 },
  stamp: {
    timestamp: Date.now(),
    parent_ids: [],
    schema_id: 'test-schema' as UUID,
  },
  goal_status: 'active',
  goal_dependencies: dependencies,
});

describe('GoalTreeManagerImpl', () => {
  let goalTreeManager: GoalTreeManagerImpl;

  beforeEach(() => {
    // Reset mocks and create a new manager for each test
    jest.clearAllMocks();
    goalTreeManager = new GoalTreeManagerImpl(mockWorldModel, mockAttentionModule, mockSchemaMatcher, mockPredictionModule);
  });

  it('should block a goal if its dependency is not achieved', () => {
    const goalA = createGoal('Goal A');
    const goalB = createGoal('Goal B', [goalA.id]);

    goalTreeManager.add_goal(goalA);
    goalTreeManager.add_goal(goalB);

    const tree = goalTreeManager.get_goal_tree();
    const nodeB = tree.get(goalB.id);

    expect(nodeB?.item.goal_status).toBe('blocked');
  });

  it('should unblock a goal when its dependency is achieved', () => {
    const goalA = createGoal('Goal A');
    const goalB = createGoal('Goal B', [goalA.id]);

    goalTreeManager.add_goal(goalA);
    goalTreeManager.add_goal(goalB);

    // Verify Goal B is initially blocked
    expect(goalTreeManager.get_goal_tree().get(goalB.id)?.item.goal_status).toBe('blocked');

    // Mark Goal A as achieved
    const unblockedGoals = goalTreeManager.mark_achieved(goalA.id);

    // Verify Goal B is in the list of unblocked goals
    expect(unblockedGoals).toHaveLength(1);
    expect(unblockedGoals[0].id).toBe(goalB.id);

    // Verify Goal B's status is now active
    expect(goalTreeManager.get_goal_tree().get(goalB.id)?.item.goal_status).toBe('active');
  });

  describe('decompose', () => {
    it('should create sub-goals based on a decomposition schema', () => {
      const highLevelGoal = createGoal('Diagnose pet illness');

      const decompositionResult = [
        {
          partialItem: {
            temp_id: 'step1',
            label: 'Gather symptoms',
            type: 'GOAL',
          },
          schema: { atom_id: 'schema1' as UUID, content: {} as any },
        },
        {
          partialItem: {
            temp_id: 'step2',
            label: 'Analyze symptoms',
            type: 'GOAL',
            dependencies: ['step1'],
          },
          schema: { atom_id: 'schema1' as UUID, content: {} as any },
        },
      ];

      // Configure the mock to return our decomposition plan
      (mockSchemaMatcher.find_and_apply_decomposition_schemas as jest.Mock).mockReturnValue(decompositionResult);

      const subGoals = goalTreeManager.decompose(highLevelGoal);

      // Verify that the correct number of sub-goals were created
      expect(subGoals).toHaveLength(2);

      // Verify the schema matcher was called correctly
      expect(mockSchemaMatcher.find_and_apply_decomposition_schemas).toHaveBeenCalledWith(highLevelGoal, mockWorldModel);

      // Verify the sub-goals have the correct properties
      const gatherSymptomsGoal = subGoals.find(g => g.label === 'Gather symptoms');
      const analyzeSymptomsGoal = subGoals.find(g => g.label === 'Analyze symptoms');

      expect(gatherSymptomsGoal).toBeDefined();
      expect(analyzeSymptomsGoal).toBeDefined();
      expect(gatherSymptomsGoal?.goal_parent_id).toBe(highLevelGoal.id);
      expect(analyzeSymptomsGoal?.goal_parent_id).toBe(highLevelGoal.id);

      // Verify that add_goal was called for each new sub-goal, and check the tree state
      const tree = goalTreeManager.get_goal_tree();
      expect(tree.size).toBe(2); // The two new sub-goals should be in the tree

      const gatherSymptomsNode = tree.get(gatherSymptomsGoal!.id);
      const analyzeSymptomsNode = tree.get(analyzeSymptomsGoal!.id);

      expect(gatherSymptomsNode).toBeDefined();
      expect(analyzeSymptomsNode).toBeDefined();

      // Verify the dependency was correctly assigned and resulted in a 'blocked' status
      expect(analyzeSymptomsNode?.item.goal_dependencies).toEqual([gatherSymptomsGoal?.id]);
      expect(analyzeSymptomsNode?.item.goal_status).toBe('blocked');

      // The first goal should be active as it has no dependencies
      expect(gatherSymptomsNode?.item.goal_status).toBe('active');
    });
  });

  it('should not unblock a goal if only one of its two dependencies is achieved', () => {
    const goalA = createGoal('Goal A');
    const goalB = createGoal('Goal B');
    const goalC = createGoal('Goal C', [goalA.id, goalB.id]);

    goalTreeManager.add_goal(goalA);
    goalTreeManager.add_goal(goalB);
    goalTreeManager.add_goal(goalC);

    // Verify Goal C is blocked
    expect(goalTreeManager.get_goal_tree().get(goalC.id)?.item.goal_status).toBe('blocked');

    // Mark Goal A as achieved
    const unblockedGoals = goalTreeManager.mark_achieved(goalA.id);

    // Verify Goal C is NOT in the list of unblocked goals
    expect(unblockedGoals).toHaveLength(0);

    // Verify Goal C's status is still blocked
    expect(goalTreeManager.get_goal_tree().get(goalC.id)?.item.goal_status).toBe('blocked');
  });

  it('should unblock a goal only when all of its dependencies are achieved', () => {
    const goalA = createGoal('Goal A');
    const goalB = createGoal('Goal B');
    const goalC = createGoal('Goal C', [goalA.id, goalB.id]);

    goalTreeManager.add_goal(goalA);
    goalTreeManager.add_goal(goalB);
    goalTreeManager.add_goal(goalC);

    // Mark Goal A as achieved - C should still be blocked
    goalTreeManager.mark_achieved(goalA.id);
    expect(goalTreeManager.get_goal_tree().get(goalC.id)?.item.goal_status).toBe('blocked');

    // Mark Goal B as achieved - C should now be unblocked
    const unblockedGoals = goalTreeManager.mark_achieved(goalB.id);
    expect(unblockedGoals).toHaveLength(1);
    expect(unblockedGoals[0].id).toBe(goalC.id);
    expect(goalTreeManager.get_goal_tree().get(goalC.id)?.item.goal_status).toBe('active');
  });
});
