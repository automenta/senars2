import { GoalTreeManager } from '../src/modules/goal-tree-manager';
import { WorldModel } from '../src/types/interfaces';
import { CognitiveItem, UUID } from '../src/types/data';
import { v4 as uuidv4 } from 'uuid';

import { GoalStatus } from '../src/types/data';

const createMockGoal = (parent_id: UUID | null = null, status: GoalStatus = 'active'): CognitiveItem => ({
    id: uuidv4() as UUID,
    atom_id: uuidv4() as UUID,
    type: 'GOAL',
    truth: { frequency: 1, confidence: 1 },
    attention: { priority: 0.5, durability: 0.5 },
    stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: uuidv4() as UUID,
    },
    goal_parent_id: parent_id || undefined,
    goal_status: status,
});

describe('GoalTreeManager', () => {
    let goalTreeManager: GoalTreeManager;
    let mockWorldModel: jest.Mocked<WorldModel>;

    beforeEach(() => {
        goalTreeManager = new GoalTreeManager();
        mockWorldModel = {
            get_item: jest.fn(),
            update_item: jest.fn(),
            query_by_symbolic: jest.fn(),
        } as any;
    });

    describe('get_ancestors', () => {
        it('should return an empty array for a goal with no parent', async () => {
            const goal = createMockGoal();
            mockWorldModel.get_item.mockResolvedValue(goal);

            const ancestors = await goalTreeManager.get_ancestors(goal.id, mockWorldModel);
            expect(ancestors).toEqual([]);
        });

        it('should return the chain of parent IDs', async () => {
            const grandParent = createMockGoal();
            const parent = createMockGoal(grandParent.id);
            const child = createMockGoal(parent.id);

            mockWorldModel.get_item.mockImplementation(async (id: UUID) => {
                if (id === child.id) return child;
                if (id === parent.id) return parent;
                if (id === grandParent.id) return grandParent;
                return null;
            });

            const ancestors = await goalTreeManager.get_ancestors(child.id, mockWorldModel);
            expect(ancestors).toEqual([parent.id, grandParent.id]);
        });
    });

    describe('mark_achieved', () => {
        it('should mark a goal as achieved', async () => {
            const goal = createMockGoal();
            mockWorldModel.get_item.mockResolvedValue(goal);
            mockWorldModel.query_by_symbolic.mockResolvedValue([]);

            await goalTreeManager.mark_achieved(goal.id, mockWorldModel);

            expect(mockWorldModel.update_item).toHaveBeenCalledWith(goal.id, { goal_status: 'achieved' });
        });

        it('should recursively mark parent as achieved if all siblings are achieved', async () => {
            const parent = createMockGoal();
            const child1 = createMockGoal(parent.id);
            const child2 = createMockGoal(parent.id, 'achieved');

            mockWorldModel.get_item.mockImplementation(async (id: UUID) => {
                if (id === child1.id) return child1;
                if (id === parent.id) return parent;
                return null;
            });
            mockWorldModel.query_by_symbolic.mockResolvedValue([
                { ...child1, goal_status: 'achieved' },
                child2,
            ]);

            await goalTreeManager.mark_achieved(child1.id, mockWorldModel);

            expect(mockWorldModel.update_item).toHaveBeenCalledWith(child1.id, { goal_status: 'achieved' });
            expect(mockWorldModel.update_item).toHaveBeenCalledWith(parent.id, { goal_status: 'achieved' });
        });
    });

    describe('mark_failed', () => {
        it('should mark a goal as failed and its parent as blocked', async () => {
            const parent = createMockGoal();
            const child = createMockGoal(parent.id);

            mockWorldModel.get_item.mockImplementation(async (id: UUID) => {
                if (id === child.id) return child;
                if (id === parent.id) return parent;
                return null;
            });

            await goalTreeManager.mark_failed(child.id, mockWorldModel);

            expect(mockWorldModel.update_item).toHaveBeenCalledWith(child.id, { goal_status: 'failed' });
            expect(mockWorldModel.update_item).toHaveBeenCalledWith(parent.id, { goal_status: 'blocked' });
        });
    });
});
