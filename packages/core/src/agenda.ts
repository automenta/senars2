import { CognitiveItem, UUID, AttentionValue } from './types';
import TinyQueue from 'tiny-queue';

export interface Agenda {
    push(item: CognitiveItem): void;
    pop(): Promise<CognitiveItem>;
    peek(): CognitiveItem | null;
    size(): number;
    updateAttention(id: UUID, newVal: AttentionValue): void;
    remove(id: UUID): boolean;
}

export class AgendaImpl implements Agenda {
    private queue: TinyQueue<CognitiveItem>;
    private waitingResolvers: ((item: CognitiveItem) => void)[] = [];

    constructor() {
        // The comparator should sort by priority descending.
        this.queue = new TinyQueue<CognitiveItem>([], (a, b) => b.attention.priority - a.attention.priority);
    }

    push(item: CognitiveItem): void {
        if (this.waitingResolvers.length > 0) {
            const resolver = this.waitingResolvers.shift();
            if (resolver) {
                resolver(item);
                return;
            }
        }
        this.queue.push(item);
    }

    pop(): Promise<CognitiveItem> {
        if (this.queue.length > 0) {
            return Promise.resolve(this.queue.pop() as CognitiveItem);
        }
        return new Promise((resolve) => {
            this.waitingResolvers.push(resolve);
        });
    }

    peek(): CognitiveItem | null {
        return this.queue.peek() ?? null;
    }

    size(): number {
        return this.queue.length;
    }

    updateAttention(id: UUID, newVal: AttentionValue): void {
        const items = [];
        let found = false;
        while(this.queue.length > 0) {
            const item = this.queue.pop() as CognitiveItem;
            if (item.id === id) {
                item.attention = newVal;
                found = true;
            }
            items.push(item);
        }
        // Re-add all items to the queue
        for (const item of items) {
            this.queue.push(item);
        }
        if (!found) {
            // This is a no-op if the item is not in the queue.
        }
    }

    remove(id: UUID): boolean {
        const items = [];
        let found = false;
        while(this.queue.length > 0) {
            const item = this.queue.pop() as CognitiveItem;
            if (item.id === id) {
                found = true;
                // Don't add it back to the items array
            } else {
                items.push(item);
            }
        }
        // Re-add remaining items to the queue
        for (const item of items) {
            this.queue.push(item);
        }
        return found;
    }
}
