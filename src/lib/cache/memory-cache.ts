interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

export class MemoryCache<T = unknown> {
    private cache = new Map<string, CacheEntry<T>>();
    private ttlMs: number;

    constructor(ttlMs: number) {
        this.ttlMs = ttlMs;
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.data;
    }

    set(key: string, data: T): void {
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + this.ttlMs,
        });
    }

    invalidate(key: string): void {
        this.cache.delete(key);
    }

    invalidatePattern(pattern: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    clear(): void {
        this.cache.clear();
    }
}

// Singleton instances
export const feedCache = new MemoryCache(60 * 1000);      // 60s TTL
export const settingsCache = new MemoryCache(30 * 1000);   // 30s TTL
