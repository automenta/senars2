import { AttentionValue, CognitiveItem, UUID } from './types';

type Comparator<T> = (a: T, b: T) => number;

class PriorityQueue<T extends { id: UUID }> {
  private heap: T[] = [];
  private itemIndex: Map<UUID, number> = new Map();
  private comparator: Comparator<T>;

  constructor(comparator: Comparator<T>) {
    this.comparator = (a, b) => Math.sign(comparator(a, b));
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
    if (index === undefined) {
      return false;
    }
    const oldItem = this.heap[index];
    const newItem = updateFn(oldItem);
    this.heap[index] = newItem;

    const comparison = this.comparator(newItem, oldItem);
    if (comparison > 0) {
      this.siftUp(index);
    } else if (comparison < 0) {
      this.siftDown(index);
    }
    return true;
  }

  public remove(id: UUID): T | undefined {
    const index = this.itemIndex.get(id);
    if (index === undefined) {
      return undefined;
    }
    if (index === this.heap.length - 1) {
      const item = this.heap.pop();
      if (item) this.itemIndex.delete(item.id);
      return item;
    }
    this.swap(index, this.heap.length - 1);
    const item = this.heap.pop();
    if (item) {
      this.itemIndex.delete(item.id);
    }
    this.siftUp(index);
    this.siftDown(index);
    return item;
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

export interface Agenda {
    push(item: CognitiveItem): void;
    pop(): Promise<CognitiveItem>;        // Blocking
    peek(): CognitiveItem | null;
    size(): number;
    updateAttention(id: UUID, newVal: AttentionValue): void;
    remove(id: UUID): boolean;
    getItems(): CognitiveItem[];
}

export class AgendaImpl implements Agenda {
  private queue: PriorityQueue<CognitiveItem>;
  private waitingResolvers: ((item: CognitiveItem) => void)[] = [];

  constructor() {
    // Order by attention.priority (descending), so higher priority items are popped first.
    this.queue = new PriorityQueue<CognitiveItem>((a, b) => b.attention.priority - a.attention.priority);
  }

  push(item: CognitiveItem): void {
    this.queue.push(item);
    // If there are waiting consumers, resolve the promise with the highest priority item.
    // The item just pushed might be the new highest priority.
    if (this.waitingResolvers.length > 0) {
      const resolver = this.waitingResolvers.shift();
      if (resolver) {
        // Pop the highest priority item from the queue and resolve the waiting promise.
        const highestPriorityItem = this.queue.pop();
        if (highestPriorityItem) {
          resolver(highestPriorityItem);
        } else {
          // This case should ideally not happen if an item was just pushed and resolvers are waiting.
          // But as a fallback, push the resolver back if no item was found.
          this.waitingResolvers.unshift(resolver);
        }
      }
    }
  }

  pop(): Promise<CognitiveItem> {
    const item = this.queue.pop();
    if (item) {
      return Promise.resolve(item);
    }
    // If no item is available, add a resolver to the waiting list.
    return new Promise((resolve) => {
      this.waitingResolvers.push(resolve);
    });
  }

  peek(): CognitiveItem | null {
    return this.queue.peek();
  }

  size(): number {
    return this.queue.length;
  }

  updateAttention(id: UUID, newVal: AttentionValue): void {
    this.queue.update(id, (item) => ({
      ...item,
      attention: newVal,
    }));
  }

  remove(id: UUID): boolean {
    return this.queue.remove(id) !== undefined;
  }

  getItems(): CognitiveItem[] {
    return this.queue.getItems();
  }
}
