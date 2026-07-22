export interface Point2 {
    readonly x: number;
    readonly y: number;
}

export class TrailBuffer {
    private points: Point2[] = [];
    private capacity: number;

    constructor(capacity: number) {
        this.capacity = this.normalizeCapacity(capacity);
    }

    get values(): readonly Point2[] {
        return this.points;
    }

    setCapacity(capacity: number): void {
        this.capacity = this.normalizeCapacity(capacity);

        if (this.points.length > this.capacity) {
            this.points = this.points.slice(this.points.length - this.capacity);
        }
    }

    push(point: Point2): void {
        this.points.push(point);

        if (this.points.length > this.capacity) {
            this.points.splice(0, this.points.length - this.capacity);
        }
    }

    clear(): void {
        this.points = [];
    }

    private normalizeCapacity(value: number): number {
        return Math.max(2, Math.round(value));
    }
}
