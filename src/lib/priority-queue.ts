export type PriorityQueueType = "Min" | "Max";

export interface PriorityQueueValue<T> {
    value: T;
    priority: number;
}

const top = 0;
const parent = (i: number) => ((i + 1) >>> 1) - 1;
const left = (i: number) => (i << 1) + 1;
const right = (i: number) => (i + 1) << 1;

export class PriorityQueue<T extends { id: string }> {
    private _heap: PriorityQueueValue<T>[];
    private _indexs: Map<string, number>;
    private _comparator: (a: PriorityQueueValue<T>, b: PriorityQueueValue<T>) => boolean;

    constructor(type: PriorityQueueType) {
        this._heap = [];
        this._indexs = new Map<string, number>();
        if (type === 'Max') {
            this._comparator = (a, b) => a.priority > b.priority;
        } else {
            this._comparator = (a, b) => a.priority < b.priority;
        }
    }

    size() {
        return this._heap.length;
    }

    isEmpty() {
        return this.size() === 0;
    }

    peek() {
        return this._heap.length > 0 ? this._heap[top] : null;
    }

    push(value: T, priority: number) {
        const item = { value, priority };
        this._heap.push(item);
        this._indexs.set(value.id, this.size() - 1);
        this._siftUp();
        return this.size();
    }

    pop() {
        if (this.isEmpty()) {
            return null;
        }
        const poppedValue = this.peek();
        const bottom = this.size() - 1;
        if (bottom > top) {
            this._swap(top, bottom);
        }
        this._heap.pop();
        if (poppedValue) {
            this._indexs.delete(poppedValue.value.id);
        }
        this._siftDown();
        return poppedValue;
    }

    remove(value: T): boolean {
        const index = this._indexs.get(value.id);
        if (index === undefined) {
            return false;
        }

        const bottom = this.size() - 1;
        if (index !== bottom) {
            this._swap(index, bottom);
        }
        this._heap.pop();
        this._indexs.delete(value.id);

        // Re-heapify the element that was swapped into the removed element's place
        if (index < this.size()) {
            const movedItem = this._heap[index];
            this._siftUpFrom(index);
            this._siftDownFrom(index);
        }

        return true;
    }

    update(value: T, priority: number): void {
        const index = this._indexs.get(value.id);
        if (index === undefined) {
            this.push(value, priority);
            return;
        }

        const oldPriority = this._heap[index].priority;
        this._heap[index].priority = priority;

        if (this._comparator({ value, priority }, { value, priority: oldPriority })) {
            this._siftUpFrom(index);
        } else {
            this._siftDownFrom(index);
        }
    }

    private _greater(i: number, j: number) {
        return this._comparator(this._heap[i], this._heap[j]);
    }

    private _swap(i: number, j: number) {
        const itemI = this._heap[i];
        const itemJ = this._heap[j];
        this._indexs.set(itemI.value.id, j);
        this._indexs.set(itemJ.value.id, i);
        [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }

    private _siftUp() {
        this._siftUpFrom(this.size() - 1);
    }

    private _siftUpFrom(startNode: number) {
        let node = startNode;
        while (node > top && this._greater(node, parent(node))) {
            this._swap(node, parent(node));
            node = parent(node);
        }
    }

    private _siftDown() {
        this._siftDownFrom(top);
    }

    private _siftDownFrom(startNode: number) {
        let node = startNode;
        while (
            (left(node) < this.size() && this._greater(left(node), node)) ||
            (right(node) < this.size() && this._greater(right(node), node))
        ) {
            const maxChild = (right(node) < this.size() && this._greater(right(node), left(node))) ? right(node) : left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }

    toArray(): T[] {
        return this._heap.map(item => item.value);
    }

    clear() {
        this._heap = [];
        this._indexs.clear();
    }

    get(id: string): T | null {
        const index = this._indexs.get(id);
        if (index !== undefined) {
            return this._heap[index].value;
        }
        return null;
    }
}
