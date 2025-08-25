import { AgendaImpl } from './agenda.js';
import { CognitiveItem, newCognitiveItemId, UUID } from './types.js';

// Helper to create a dummy CognitiveItem
const createItem = (priority: number, id: UUID = newCognitiveItemId()): CognitiveItem => ({
  id,
  atom_id: newCognitiveItemId(),
  type: 'GOAL',
  attention: { priority, durability: 0.5 },
  stamp: {
    timestamp: Date.now(),
    parent_ids: [],
    schema_id: newCognitiveItemId(),
  },
  label: `p${priority}`,
});

describe('AgendaImpl', () => {
  let agenda: AgendaImpl;

  beforeEach(() => {
    agenda = new AgendaImpl();
  });

  it('should push and pop items in priority order', async () => {
    const item1 = createItem(0.5);
    const item2 = createItem(0.9);
    const item3 = createItem(0.2);

    agenda.push(item1);
    agenda.push(item2);
    agenda.push(item3);

    expect(agenda.size()).toBe(3);
    const popped1 = await agenda.pop();
    expect(popped1.label).toBe(item2.label);
    const popped2 = await agenda.pop();
    expect(popped2.label).toBe(item1.label);
    const popped3 = await agenda.pop();
    expect(popped3.label).toBe(item3.label);
    expect(agenda.size()).toBe(0);
  });

  it('should handle asynchronous pop when queue is empty', async () => {
    const item = createItem(0.8);
    const popPromise = agenda.pop(); // Should wait

    setTimeout(() => agenda.push(item), 10);

    const poppedItem = await popPromise;
    expect(poppedItem.label).toBe(item.label);
  });

  it('should remove an item from the queue', async () => {
    const item1 = createItem(0.5);
    const item2 = createItem(0.9, 'removable' as UUID);
    const item3 = createItem(0.2);

    agenda.push(item1);
    agenda.push(item2);
    agenda.push(item3);

    const result = agenda.remove('removable' as UUID);
    expect(result).toBe(true);
    expect(agenda.size()).toBe(2);

    const topItem = await agenda.pop();
    expect(topItem.label).toBe(item1.label); // Corrected: item1 has the next highest priority
  });

  it('should return false when removing an item that does not exist', () => {
    const item1 = createItem(0.5);
    agenda.push(item1);
    const result = agenda.remove('non-existent' as UUID);
    expect(result).toBe(false);
    expect(agenda.size()).toBe(1);
  });

  it('should update the attention of an item and re-prioritize', async () => {
    const item1 = createItem(0.2, 'updatable' as UUID);
    const item2 = createItem(0.9);
    const item3 = createItem(0.7);

    agenda.push(item1);
    agenda.push(item2);
    agenda.push(item3);

    // 'updatable' is lowest priority. Let's make it the highest.
    agenda.updateAttention('updatable' as UUID, { priority: 0.95, durability: 0.5 });

    expect(agenda.size()).toBe(3);
    const popped = await agenda.pop();
    expect(popped.label).toBe(item1.label); // The label is p0.2
    expect(popped.attention.priority).toBe(0.95);
  });

  it('should correctly handle updating an item to a lower priority', async () => {
    const item1 = createItem(0.2);
    const item2 = createItem(0.9, 'updatable' as UUID);
    const item3 = createItem(0.7);

    agenda.push(item1);
    agenda.push(item2);
    agenda.push(item3);

    // 'updatable' is highest priority. Let's make it the lowest.
    agenda.updateAttention('updatable' as UUID, { priority: 0.1, durability: 0.5 });

    const popped1 = await agenda.pop();
    expect(popped1.label).toBe(item3.label);
    const popped2 = await agenda.pop();
    expect(popped2.label).toBe(item1.label);
    const popped3 = await agenda.pop();
    expect(popped3.label).toBe(item2.label);
  });
});
