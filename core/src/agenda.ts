import { EventEmitter } from 'events';
import { AttentionValue, CognitiveItem, UUID } from './types.js';

type Comparator<T> = (a: T, b: T) => number;

class PriorityQueue<T extends { id: UUID }> {
  private heap: T[] = [];
  private itemIndex: Map<UUID, number> = new Map();
  private comparator: Comparator<T>;

  constructor(comparator: Comparator<T>) {
    this.comparator = comparator;
  }

  public get length(): number {
    return this.heap.length;
  }

  public getItems(): T[] {
    return [...this.heap];
  }

  public push(item: T): void {
    this.heap.push(item);
    const index = this.heap.length - 1;
    this.itemIndex.set(item.id, index);
    this.siftUp(index);
  }

  public pop(): T | undefined {
    if (this.heap.length === 0) {
      return undefined;
    }
    this.swap(0, this.heap.length - 1);
    const item = this.heap.pop();
    if (item) {
      this.itemIndex.delete(item.id);
    }
    if (this.heap.length > 0) {
      this.siftDown(0);
    }
    return item;
  }

  public peek(): T | null {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  public update(id: UUID, updateFn: (item: T) => T): boolean {
    const index = this.itemIndex.get(id);
    if (index === undefined || index >= this.heap.length) {
      return false;
    }
    const oldItem = this.heap[index];
    const newItem = updateFn(oldItem);
    this.heap[index] = newItem;

    const comparison = this.comparator(newItem, oldItem);
    if (comparison > 0) {
      this.siftUp(index);
    } else {
      this.siftDown(index);
    }
    return true;
  }

  public remove(id: UUID): T | undefined {
    const index = this.itemIndex.get(id);
    if (index === undefined || index >= this.heap.length) {
      return undefined;
    }

    const itemToRemove = this.heap[index];
    this.swap(index, this.heap.length - 1);
    this.heap.pop();
    this.itemIndex.delete(id);

    // If the item was the last one, no need to heapify
    if (index < this.heap.length) {
        const item = this.heap[index];
        const parentIndex = this.parent(index);
        // If it's the root or its priority is less than its parent, sift down
        if (index === 0 || this.comparator(this.heap[parentIndex], item) > 0) {
            this.siftDown(index);
        } else { // Otherwise, sift up
            this.siftUp(index);
        }
    }

    return itemToRemove;
  }

  private parent(i: number): number {
    return Math.floor((i - 1) / 2);
  }

  private leftChild(i: number): number {
    return 2 * i + 1;
  }

  private rightChild(i: number): number {
    return 2 * i + 2;
  }

  private swap(i: number, j: number): void {
    const itemI = this.heap[i];
    const itemJ = this.heap[j];
    this.heap[i] = itemJ;
    this.heap[j] = itemI;
    this.itemIndex.set(itemI.id, j);
    this.itemIndex.set(itemJ.id, i);
  }

  private siftUp(i: number): void {
    let current = i;
    while (current > 0 && this.comparator(this.heap[current], this.heap[this.parent(current)]) > 0) {
      this.swap(current, this.parent(current));
      current = this.parent(current);
    }
  }

  private siftDown(i: number): void {
    let maxIndex = i;
    const left = this.leftChild(i);
    if (left < this.heap.length && this.comparator(this.heap[left], this.heap[maxIndex]) > 0) {
      maxIndex = left;
    }
    const right = this.rightChild(i);
    if (right < this.heap.length && this.comparator(this.heap[right], this.heap[maxIndex]) > 0) {
      maxIndex = right;
    }
    if (i !== maxIndex) {
      this.swap(i, maxIndex);
      this.siftDown(maxIndex);
    }
  }
}

export interface Agenda extends EventEmitter {
    push(item: CognitiveItem): void;
    pop(): Promise<CognitiveItem>;        // Blocking
    peek(): CognitiveItem | null;
    size(): number;
    updateAttention(id: UUID, newVal: AttentionValue): void;
    remove(id: UUID): boolean;
    getItems(): CognitiveItem[];
    clone(): Agenda;
}

export class AgendaImpl extends EventEmitter implements Agenda {
  private queue: PriorityQueue<CognitiveItem>;
  private waitingResolvers: ((item: CognitiveItem) => void)[] = [];

  constructor() {
    super();
    // Order by attention.priority (descending), so higher priority items are popped first.
    this.queue = new PriorityQueue<CognitiveItem>((a, b) => a.attention.priority - b.attention.priority);
  }

  push(item: CognitiveItem): void {
    // If there's a waiting pop, resolve it directly without adding to the queue
    if (this.waitingResolvers.length > 0) {
      const resolver = this.waitingResolvers.shift();
      if (resolver) {
        // This item is immediately consumed, so it's not 'added' to the agenda from an observer's perspective.
        // The 'item_removed' event will be handled by the pop() that initiated this.
        resolver(item);
        return;
      }
    }
    // Otherwise, add the item to the queue and notify listeners.
    this.queue.push(item);
    this.emit('item_added', item);
  }

  async pop(): Promise<CognitiveItem> {
    const item = this.queue.pop();

    if (item) {
      this.emit('item_removed', item); // Emit the full item
      return Promise.resolve(item);
    }

    // If no item is available, wait for one to be pushed.
    return new Promise((resolve) => {
      this.waitingResolvers.push((newItem) => {
        this.emit('item_removed', newItem); // The newly pushed item is immediately removed
        resolve(newItem);
      });
    });
  }

  peek(): CognitiveItem | null {
    return this.queue.peek();
  }

  size(): number {
    return this.queue.length;
  }

  updateAttention(id: UUID, newVal: AttentionValue): void {
    let updated = false;
    this.queue.update(id, (item) => {
      const updatedItem = { ...item, attention: newVal };
      this.emit('item_updated', updatedItem);
      updated = true;
      return updatedItem;
    });
  }

  remove(id: UUID): boolean {
    const removedItem = this.queue.remove(id);
    if (removedItem) {
        this.emit('item_removed', removedItem); // Emit the full removed item
        return true;
    }
    return false;
  }

  getItems(): CognitiveItem[] {
    return this.queue.getItems();
  }

  clone(): Agenda {
    const newAgenda = new AgendaImpl();
    for (const item of this.getItems()) {
      newAgenda.push(JSON.parse(JSON.stringify(item)));
    }
    return newAgenda;
  }
}
