import { CognitiveItem, UUID, AttentionValue } from '../types/data';
import { Agenda as IAgenda } from '../types/interfaces';
import { PriorityQueue } from '../lib/priority-queue';

type PromiseResolver = (item: CognitiveItem) => void;

export class Agenda implements IAgenda {
    private queue: PriorityQueue<CognitiveItem>;
    private waitingConsumers: PromiseResolver[] = [];

    constructor() {
        // We want a max-heap based on priority.
        this.queue = new PriorityQueue<CognitiveItem>('Max');
    }

    push(item: CognitiveItem): void {
        if (this.waitingConsumers.length > 0) {
            const resolver = this.waitingConsumers.shift();
            if (resolver) {
                resolver(item);
                return;
            }
        }
        this.queue.push(item, item.attention.priority);
    }

    pop(): CognitiveItem | null {
        if (this.queue.isEmpty()) {
            return null;
        }
        const item = this.queue.pop();
        return item ? item.value : null;
    }

    async pop_async(): Promise<CognitiveItem> {
        const item = this.pop();
        if (item) {
            return item;
        }

        return new Promise<CognitiveItem>((resolve) => {
            this.waitingConsumers.push(resolve);
        });
    }

    peek(): CognitiveItem | null {
        const item = this.queue.peek();
        return item ? item.value : null;
    }

    size(): number {
        return this.queue.size();
    }

    updateAttention(id: UUID, newVal: AttentionValue): void {
        const itemToUpdate = this.queue.get(id);
        if (itemToUpdate) {
            itemToUpdate.attention = newVal;
            this.queue.update(itemToUpdate, newVal.priority);
        }
    }

    remove(id: UUID): boolean {
        const itemToRemove = this.queue.get(id);
        if (itemToRemove) {
            return this.queue.remove(itemToRemove);
        }
        return false;
    }

    // Method to get all items for decay cycle, etc.
    getAllItems(): CognitiveItem[] {
        return this.queue.toArray();
    }

    get(id: UUID): CognitiveItem | null {
        return this.queue.get(id);
    }
}
