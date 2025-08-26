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

    async pop(): Promise<CognitiveItem> {
        while (this.items.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 10)); // Poll for an item
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
