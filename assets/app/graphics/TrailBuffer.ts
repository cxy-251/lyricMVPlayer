export interface Point2 {
    readonly x: number;
    readonly y: number;
}

export class TrailBuffer {
    private storage: Array<Point2 | undefined>;
    private orderedValues: Point2[] = [];
    private capacity: number;
    private start = 0;
    private count = 0;
    private dirty = false;

    constructor(capacity: number) {
        this.capacity = this.normalizeCapacity(capacity);
        this.storage = new Array<Point2 | undefined>(this.capacity);
    }

    get length(): number {
        return this.count;
    }

    get values(): readonly Point2[] {
        if (!this.dirty) {
            return this.orderedValues;
        }

        this.orderedValues.length = 0;

        for (let index = 0; index < this.count; index += 1) {
            const point = this.storage[(this.start + index) % this.capacity];

            if (point) {
                this.orderedValues.push(point);
            }
        }

        this.dirty = false;
        return this.orderedValues;
    }

    setCapacity(capacity: number): void {
        const nextCapacity = this.normalizeCapacity(capacity);

        if (nextCapacity === this.capacity) {
            return;
        }

        const retained = this.values.slice(-nextCapacity);
        this.capacity = nextCapacity;
        this.storage = new Array<Point2 | undefined>(nextCapacity);
        this.orderedValues = [];
        this.start = 0;
        this.count = 0;
        this.dirty = false;

        for (const point of retained) {
            this.push(point);
        }
    }

    push(point: Point2): void {
        if (this.count < this.capacity) {
            const writeIndex = (this.start + this.count) % this.capacity;
            this.storage[writeIndex] = point;
            this.count += 1;
        } else {
            this.storage[this.start] = point;
            this.start = (this.start + 1) % this.capacity;
        }

        this.dirty = true;
    }

    clear(): void {
        this.storage = new Array<Point2 | undefined>(this.capacity);
        this.orderedValues.length = 0;
        this.start = 0;
        this.count = 0;
        this.dirty = false;
    }

    private normalizeCapacity(value: number): number {
        if (!Number.isFinite(value)) {
            throw new Error('TrailBuffer capacity must be finite');
        }

        return Math.max(2, Math.round(value));
    }
}
