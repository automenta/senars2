import { CognitiveItem, UUID, AttentionValue } from '../types/data';
import { Agenda as IAgenda } from '../types/interfaces';

export class Agenda implements IAgenda {
    private items: CognitiveItem[] = [];

    private sort(): void {
        this.items.sort((a, b) => b.attention.priority - a.attention.priority);
    }

    push(item: CognitiveItem): void {
        this.items.push(item);
        this.sort();
    }

    /**
     * Synchronously pops the highest-priority item from the agenda.
     * @returns The highest-priority item, or null if the agenda is empty.
     */
    pop(): CognitiveItem | null {
        if (this.items.length === 0) {
            return null;
        }
        return this.items.shift()!;
    }

    /**
     * Asynchronously pops an item, waiting if the agenda is empty.
     * This is for the continuous execution mode.
     */
    async pop_async(): Promise<CognitiveItem> {
        while (this.items.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Poll for an item
        }
        return this.items.shift()!;
    }

    peek(): CognitiveItem | null {
        return this.items.length > 0 ? this.items[0] : null;
    }

    size(): number {
        return this.items.length;
    }

    updateAttention(id: UUID, newVal: AttentionValue): void {
        const item = this.items.find(i => i.id === id);
        if (item) {
            item.attention = newVal;
            this.sort();
        }
    }

    remove(id: UUID): boolean {
        const index = this.items.findIndex(i => i.id === id);
        if (index > -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
}
