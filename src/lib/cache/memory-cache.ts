interface CacheEntry<T> {
    data: T;
    expiresAt: number;
    lastAccessedAt: number;
}

export class MemoryCache<T = unknown> {
    private cache = new Map<string, CacheEntry<T>>();
    private ttlMs: number;
    private maxSize: number;
    private sweepTimer: ReturnType<typeof setInterval> | null = null;

    constructor(ttlMs: number, maxSize = 50) {
        this.ttlMs = ttlMs;
        this.maxSize = maxSize;

        // Periodic sweep: remove expired entries every 60s
        this.sweepTimer = setInterval(() => this.sweep(), 60_000);
        // Allow the process to exit even if the timer is still running
        if (this.sweepTimer && typeof this.sweepTimer === 'object' && 'unref' in this.sweepTimer) {
            this.sweepTimer.unref();
        }
    }

    get(key: string): T | undefined {
        const entry = this.cache.get(key);
        if (!entry) return undefined;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return undefined;
        }

        // Update access time for LRU tracking
        entry.lastAccessedAt = Date.now();
        return entry.data;
    }

    set(key: string, data: T): void {
        // If at capacity and this is a new key, evict least-recently-used
        if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
            this.evictLRU();
        }

        this.cache.set(key, {
            data,
            expiresAt: Date.now() + this.ttlMs,
            lastAccessedAt: Date.now(),
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

    get size(): number {
        return this.cache.size;
    }

    /** Remove all expired entries. */
    private sweep(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    /** Evict the least-recently-used entry. */
    private evictLRU(): void {
        let oldestKey: string | null = null;
        let oldestTime = Infinity;

        for (const [key, entry] of this.cache) {
            if (entry.lastAccessedAt < oldestTime) {
                oldestTime = entry.lastAccessedAt;
                oldestKey = key;
            }
        }

        if (oldestKey) {
            this.cache.delete(oldestKey);
        }
    }
}

// Singleton instances
// Feed cache: 5min TTL, max 30 entries (sourceIds x timeRange x feedMode combos)
export const feedCache = new MemoryCache(5 * 60 * 1000, 30);
// Settings cache: 30s TTL, max 20 entries (small payloads, low permutation count)
export const settingsCache = new MemoryCache(30 * 1000, 20);
