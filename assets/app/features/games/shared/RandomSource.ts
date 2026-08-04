export interface RandomSource {
    next(): number;
    nextInt(maxExclusive: number): number;
    reset(seed: number): void;
    snapshot(): number;
}

abstract class RandomSource32 implements RandomSource {
    protected state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
    }

    abstract next(): number;

    nextInt(maxExclusive: number): number {
        const maximum = Math.max(1, Math.floor(maxExclusive));
        return Math.floor(this.next() * maximum);
    }

    reset(seed: number): void {
        this.state = seed >>> 0;
    }

    snapshot(): number {
        return this.state >>> 0;
    }
}

export class XorShift32Random extends RandomSource32 {
    next(): number {
        this.state = XorShift32Random.mix(this.state);
        return this.state / 0x1_0000_0000;
    }

    static mix(seed: number): number {
        let state = seed >>> 0;
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return state >>> 0;
    }
}

export class LinearCongruentialRandom extends RandomSource32 {
    next(): number {
        this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
        return this.state / 0x1_0000_0000;
    }
}
