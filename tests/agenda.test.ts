import { Agenda } from '../src/components/agenda';
import { CognitiveItem, UUID } from '../src/types/data';
import { v4 as uuidv4 } from 'uuid';

// Helper to create a dummy CognitiveItem
const createMockItem = (priority: number): CognitiveItem => ({
    id: uuidv4() as UUID,
    atom_id: uuidv4() as UUID,
    type: 'BELIEF',
    attention: { priority, durability: 0.5 },
    stamp: {
        timestamp: Date.now(),
        parent_ids: [],
        schema_id: uuidv4() as UUID,
    },
});

describe('Agenda', () => {
    let agenda: Agenda;

    beforeEach(() => {
        agenda = new Agenda();
    });

    it('should be empty initially', () => {
        expect(agenda.size()).toBe(0);
        expect(agenda.peek()).toBeNull();
    });

    it('should add an item and increase size', () => {
        const item = createMockItem(0.5);
        agenda.push(item);
        expect(agenda.size()).toBe(1);
        expect(agenda.peek()).toEqual(item);
    });

    it('should maintain priority order with synchronous pop', () => {
        const lowPriorityItem = createMockItem(0.2);
        const highPriorityItem = createMockItem(0.8);
        const midPriorityItem = createMockItem(0.5);

        agenda.push(lowPriorityItem);
        agenda.push(highPriorityItem);
        agenda.push(midPriorityItem);

        expect(agenda.size()).toBe(3);
        expect(agenda.peek()).toEqual(highPriorityItem);

        const poppedItem1 = agenda.pop();
        expect(poppedItem1).toEqual(highPriorityItem);
        expect(agenda.size()).toBe(2);

        const poppedItem2 = agenda.pop();
        expect(poppedItem2).toEqual(midPriorityItem);
        expect(agenda.size()).toBe(1);

        const poppedItem3 = agenda.pop();
        expect(poppedItem3).toEqual(lowPriorityItem);
        expect(agenda.size()).toBe(0);

        const poppedItem4 = agenda.pop();
        expect(poppedItem4).toBeNull();
    });

    it('should update attention and re-prioritize', () => {
        const item1 = createMockItem(0.4);
        const item2 = createMockItem(0.6);
        agenda.push(item1);
        agenda.push(item2);

        expect(agenda.peek()).toEqual(item2);

        agenda.updateAttention(item1.id, { priority: 0.9, durability: 0.5 });
        expect(agenda.peek()).toEqual(item1);
    });

    it('should remove an item', () => {
        const item1 = createMockItem(0.5);
        const item2 = createMockItem(0.7);
        agenda.push(item1);
        agenda.push(item2);

        expect(agenda.size()).toBe(2);
        const result = agenda.remove(item1.id);
        expect(result).toBe(true);
        expect(agenda.size()).toBe(1);
        expect(agenda.peek()).toEqual(item2);
    });

    it('should handle removing a non-existent item', () => {
        const item = createMockItem(0.5);
        agenda.push(item);
        const result = agenda.remove(uuidv4() as UUID);
        expect(result).toBe(false);
        expect(agenda.size()).toBe(1);
    });

    it('pop_async should block until an item is available', async () => {
        const popPromise = agenda.pop_async();

        // Give the pop() a moment to enter its waiting loop
        await new Promise(resolve => setTimeout(resolve, 50));

        const item = createMockItem(0.5);
        agenda.push(item);

        const poppedItem = await popPromise;
        expect(poppedItem).toEqual(item);
        expect(agenda.size()).toBe(0);
    });
});
