import { sys } from 'cc';

export class StorageService {
    constructor(private readonly namespace = 'cocoslab') {}

    get<T>(key: string, fallback: T): T {
        const raw = sys.localStorage.getItem(this.toKey(key));

        if (raw === null) {
            return fallback;
        }

        try {
            return JSON.parse(raw) as T;
        } catch (error) {
            console.warn(`[cocoslab] invalid stored value for ${key}`, error);
            return fallback;
        }
    }

    set<T>(key: string, value: T): void {
        try {
            sys.localStorage.setItem(this.toKey(key), JSON.stringify(value));
        } catch (error) {
            console.warn(`[cocoslab] failed to store ${key}`, error);
        }
    }

    remove(key: string): void {
        sys.localStorage.removeItem(this.toKey(key));
    }

    private toKey(key: string): string {
        return `${this.namespace}:${key}`;
    }
}
