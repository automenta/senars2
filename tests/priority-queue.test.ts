import { PriorityQueue } from '../src/lib/priority-queue';

type TestItem = {
    id: string;
    name: string;
};

describe('PriorityQueue', () => {
    let maxQueue: PriorityQueue<TestItem>;
    let minQueue: PriorityQueue<TestItem>;

    const item1: TestItem = { id: '1', name: 'item1' };
    const item2: TestItem = { id: '2', name: 'item2' };
    const item3: TestItem = { id: '3', name: 'item3' };
    const item4: TestItem = { id: '4', name: 'item4' };

    beforeEach(() => {
        maxQueue = new PriorityQueue<TestItem>('Max');
        minQueue = new PriorityQueue<TestItem>('Min');
    });

    test('should be empty initially', () => {
        expect(maxQueue.isEmpty()).toBe(true);
        expect(maxQueue.size()).toBe(0);
    });

    test('should push items and maintain max-heap property', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        maxQueue.push(item3, 5);

        expect(maxQueue.size()).toBe(3);
        expect(maxQueue.peek()?.value).toBe(item2);
    });

    test('should push items and maintain min-heap property', () => {
        minQueue.push(item1, 10);
        minQueue.push(item2, 20);
        minQueue.push(item3, 5);

        expect(minQueue.size()).toBe(3);
        expect(minQueue.peek()?.value).toBe(item3);
    });

    test('should pop items in max-priority order', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        maxQueue.push(item3, 5);

        expect(maxQueue.pop()?.value).toBe(item2);
        expect(maxQueue.pop()?.value).toBe(item1);
        expect(maxQueue.pop()?.value).toBe(item3);
        expect(maxQueue.isEmpty()).toBe(true);
    });

    test('should pop items in min-priority order', () => {
        minQueue.push(item1, 10);
        minQueue.push(item2, 20);
        minQueue.push(item3, 5);

        expect(minQueue.pop()?.value).toBe(item3);
        expect(minQueue.pop()?.value).toBe(item1);
        expect(minQueue.pop()?.value).toBe(item2);
        expect(minQueue.isEmpty()).toBe(true);
    });

    test('should handle peeking an empty queue', () => {
        expect(maxQueue.peek()).toBeNull();
    });

    test('should handle popping an empty queue', () => {
        expect(maxQueue.pop()).toBeNull();
    });

    test('should remove an item from the queue', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        maxQueue.push(item3, 5);
        maxQueue.push(item4, 15);

        const wasRemoved = maxQueue.remove(item1);
        expect(wasRemoved).toBe(true);
        expect(maxQueue.size()).toBe(3);
        expect(maxQueue.peek()?.value).toBe(item2);
        expect(maxQueue.toArray()).not.toContain(item1);
    });

    test('should handle removing a non-existent item', () => {
        maxQueue.push(item1, 10);
        const wasRemoved = maxQueue.remove(item2);
        expect(wasRemoved).toBe(false);
        expect(maxQueue.size()).toBe(1);
    });

    test('should update an items priority', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 5);
        expect(maxQueue.peek()?.value).toBe(item1);

        maxQueue.update(item2, 15);
        expect(maxQueue.peek()?.value).toBe(item2);

        maxQueue.update(item2, 2);
        expect(maxQueue.peek()?.value).toBe(item1);
    });

    test('should clear the queue', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        maxQueue.clear();
        expect(maxQueue.isEmpty()).toBe(true);
        expect(maxQueue.size()).toBe(0);
    });

    test('should get an item by id', () => {
        maxQueue.push(item1, 10);
        const foundItem = maxQueue.get('1');
        expect(foundItem).toBe(item1);
        const notFoundItem = maxQueue.get('99');
        expect(notFoundItem).toBeNull();
    });

    test('should remove the last item correctly', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        const wasRemoved = maxQueue.remove(item1);
        expect(wasRemoved).toBe(true);
        expect(maxQueue.size()).toBe(1);
        expect(maxQueue.peek()?.value).toBe(item2);
    });

    test('should update an item to a lower priority in a max-heap', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        maxQueue.update(item2, 5);
        expect(maxQueue.peek()?.value).toBe(item1);
    });

    test('should update an item to a higher priority in a min-heap', () => {
        minQueue.push(item1, 10);
        minQueue.push(item2, 5);
        minQueue.update(item2, 15);
        expect(minQueue.peek()?.value).toBe(item1);
    });

    test('should add a new item if update is called for a non-existent item', () => {
        maxQueue.push(item1, 10);
        maxQueue.update(item2, 20);
        expect(maxQueue.size()).toBe(2);
        expect(maxQueue.peek()?.value).toBe(item2);
    });

    test('should remove the item when it is the last one', () => {
        maxQueue.push(item1, 10);
        maxQueue.remove(item1);
        expect(maxQueue.isEmpty()).toBe(true);
    });

    test('should update an item to a lower priority in a min-heap', () => {
        minQueue.push(item1, 10);
        minQueue.push(item2, 20);
        minQueue.update(item2, 5);
        expect(minQueue.peek()?.value).toBe(item2);
    });

    test('should update an item to a higher priority in a max-heap', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 5);
        maxQueue.update(item2, 15);
        expect(maxQueue.peek()?.value).toBe(item2);
    });

    test('should correctly sift down after removing the root', () => {
        maxQueue.push(item1, 10);
        maxQueue.push(item2, 20);
        maxQueue.push(item3, 5);
        maxQueue.push(item4, 15);

        // item2 is the root
        expect(maxQueue.peek()?.value).toBe(item2);

        maxQueue.remove(item2);

        // item4 should be the new root
        expect(maxQueue.peek()?.value).toBe(item4);
        expect(maxQueue.size()).toBe(3);
    });
});
