import { AttentionModule } from '../src/modules/attention';
import { WorldModel, Agenda, CognitiveSchema, CognitiveItem, AttentionValue } from '@cognitive-arch/types';
import { v4 as uuidv4 } from 'uuid';

const createMockItem = (attention: AttentionValue): CognitiveItem => ({
    id: uuidv4(),
    atom_id: uuidv4(),
    type: 'BELIEF',
    attention,
    stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: uuidv4(),
    },
});

describe('AttentionModule', () => {
    let attentionModule: AttentionModule;
    let mockWorldModel: jest.Mocked<WorldModel>;
    let mockAgenda: jest.Mocked<Agenda>;
    let mockSchema: jest.Mocked<CognitiveSchema>;

    beforeEach(() => {
        attentionModule = new AttentionModule();
        mockWorldModel = {
            update_item: jest.fn(),
            getItemsByFilter: jest.fn(),
        } as any;
        mockAgenda = {
            get: jest.fn(),
            updateAttention: jest.fn(),
            getAllItems: jest.fn(),
        } as any;
        mockSchema = {
            atom_id: uuidv4(),
            apply: jest.fn(),
        } as any;
    });

    describe('calculate_initial', () => {
        it('should return high priority and medium durability', () => {
            const item = createMockItem({ priority: 0, durability: 0 });
            const attention = attentionModule.calculate_initial(item);
            expect(attention).toEqual({ priority: 0.9, durability: 0.5 });
        });
    });

    describe('calculate_derived', () => {
        it('should return default attention if no parents', () => {
            const attention = attentionModule.calculate_derived([], mockSchema, 0.5);
            expect(attention).toEqual({ priority: 0.5, durability: 0.5 });
        });

        it('should calculate attention based on parents and schema trust', () => {
            const parent1 = createMockItem({ priority: 0.8, durability: 0.6 });
            const parent2 = createMockItem({ priority: 0.6, durability: 0.4 });
            const sourceTrust = 0.8;
            const attention = attentionModule.calculate_derived([parent1, parent2], mockSchema, sourceTrust);
            expect(attention.priority).toBeCloseTo(0.63);
            expect(attention.durability).toBeCloseTo(0.5);
        });
    });

    describe('update_on_access', () => {
        it('should boost attention for an item in the agenda', async () => {
            const item = createMockItem({ priority: 0.5, durability: 0.5 });
            mockAgenda.get.mockReturnValue(item);

            await attentionModule.update_on_access([item], mockWorldModel, mockAgenda);

            expect(mockAgenda.updateAttention).toHaveBeenCalledWith(item.id, {
                priority: 0.6,
                durability: 0.55,
            });
            expect(mockWorldModel.update_item).not.toHaveBeenCalled();
        });

        it('should boost attention for an item in the world model', async () => {
            const item = createMockItem({ priority: 0.5, durability: 0.5 });
            mockAgenda.get.mockReturnValue(null);

            await attentionModule.update_on_access([item], mockWorldModel, mockAgenda);

            expect(mockWorldModel.update_item).toHaveBeenCalledWith(item.id, {
                attention: {
                    priority: 0.6,
                    durability: 0.55,
                },
            });
            expect(mockAgenda.updateAttention).not.toHaveBeenCalled();
        });
    });

    describe('run_decay_cycle', () => {
        it('should decay attention for items in world model and agenda', async () => {
            const wmItem = createMockItem({ priority: 0.5, durability: 0.5 });
            const agendaItem = createMockItem({ priority: 0.8, durability: 0.8 });

            mockWorldModel.getItemsByFilter.mockResolvedValue([wmItem]);
            mockAgenda.getAllItems.mockReturnValue([agendaItem]);

            await attentionModule.run_decay_cycle(mockWorldModel, mockAgenda);

            expect(mockWorldModel.update_item).toHaveBeenCalledWith(wmItem.id, {
                attention: {
                    priority: 0.5 * 0.98,
                    durability: 0.5,
                },
            });
            expect(mockAgenda.updateAttention).toHaveBeenCalledWith(agendaItem.id, {
                priority: 0.8 * 0.98,
                durability: 0.8,
            });
        });
    });
});
