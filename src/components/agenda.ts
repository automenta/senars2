import { CognitiveItem, UUID, AttentionValue } from '../types/data';
import { Agenda as IAgenda } from '../types/interfaces';
import { PriorityQueue } from 'priority-queue-typescript';

type PromiseResolver = (item: CognitiveItem) => void;

export class Agenda implements IAgenda {
    private queue: PriorityQueue<CognitiveItem>;
    private waitingConsumers: PromiseResolver[] = [];

    constructor() {
        // The library's comparator requires a number.
        // It's a min-heap by default, so we reverse the logic for a max-heap.
        this.queue = new PriorityQueue<CognitiveItem>(
            100, // initial capacity
            (a: CognitiveItem, b: CognitiveItem) => b.attention.priority - a.attention.priority
        );
    }

    push(item: CognitiveItem): void {
        if (this.waitingConsumers.length > 0) {
            const resolver = this.waitingConsumers.shift();
            if (resolver) {
                resolver(item);
                return;
            }
        }
        this.queue.add(item);
    }

    pop(): CognitiveItem | null {
        if (this.queue.empty()) {
            return null;
        }
        return this.queue.poll();
    }

    async pop_async(): Promise<CognitiveItem> {
        if (!this.queue.empty()) {
            return this.queue.poll()!;
        }

        return new Promise<CognitiveItem>((resolve) => {
            this.waitingConsumers.push(resolve);
        });
    }

    peek(): CognitiveItem | null {
        if (this.queue.empty()) {
            return null;
        }
        return this.queue.peek();
    }

    size(): number {
        return this.queue.size();
    }

    updateAttention(id: UUID, newVal: AttentionValue): void {
        const items = this.queue.toArray();
        this.queue.clear();

        const itemToUpdate = items.find(i => i.id === id);
        if (itemToUpdate) {
            itemToUpdate.attention = newVal;
        }

        items.forEach(item => this.queue.add(item));
    }

    remove(id: UUID): boolean {
        const items = this.queue.toArray();
        let found = false;

        const filteredItems = items.filter(item => {
            if (item.id === id) {
                found = true;
                return false;
            }
            return true;
        });

        this.queue.clear();
        filteredItems.forEach(item => this.queue.add(item));
        return found;
    }
}
