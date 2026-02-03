import { SourceConfig, ContentItem } from '@/types';
import { createHash } from 'crypto';

export interface AdapterOptions {
    timeRange?: string;
    maxRetries?: number;
    retryDelayMs?: number;
}

export interface SourceAdapter {
    source: SourceConfig;
    fetch(options?: AdapterOptions): Promise<ContentItem[]>;
}

// Retry utility with exponential backoff
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Don't retry on certain errors
            if (lastError.message.includes('404') ||
                lastError.message.includes('401') ||
                lastError.message.includes('403')) {
                throw lastError;
            }

            if (attempt < maxRetries - 1) {
                // Exponential backoff: 1s, 2s, 4s...
                const delay = baseDelayMs * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('Max retries exceeded');
}

export abstract class BaseAdapter implements SourceAdapter {
    protected maxRetries: number = 3;
    protected retryDelayMs: number = 1000;

    constructor(public source: SourceConfig) { }

    abstract fetch(options?: AdapterOptions): Promise<ContentItem[]>;

    protected async fetchWithRetry<T>(fn: () => Promise<T>): Promise<T> {
        return withRetry(fn, this.maxRetries, this.retryDelayMs);
    }

    protected cleanDescription(html: string): string {
        if (!html) return '';
        const cleaned = html
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        return cleaned.length > 300 ? cleaned.substring(0, 300) + '...' : cleaned;
    }

    protected filterByTimeRange(items: ContentItem[], timeRange?: string): ContentItem[] {
        if (!timeRange) return items;

        const now = new Date();
        const cutoff = new Date();

        switch (timeRange) {
            case '1h':
                cutoff.setHours(now.getHours() - 1);
                break;
            case '12h':
                cutoff.setHours(now.getHours() - 12);
                break;
            case '24h':
                cutoff.setHours(now.getHours() - 24);
                break;
            case '48h':
                cutoff.setHours(now.getHours() - 48);
                break;
            case '7d':
                cutoff.setDate(now.getDate() - 7);
                break;
            default:
                return items;
        }

        return items.filter(item => new Date(item.publishedAt) >= cutoff);
    }
}

/**
 * Create a unique ID for content items using crypto hash
 * This ensures no collisions even with similar URLs
 */
export function createContentId(sourceId: string, uniqueIdentifier: string): string {
    // Use SHA-256 hash for proper uniqueness
    const hash = createHash('sha256')
        .update(`${sourceId}:${uniqueIdentifier}`)
        .digest('hex')
        .slice(0, 16); // 16 hex chars = 64 bits = effectively unique
    return `${sourceId}-${hash}`;
}

/**
 * Parse date from various formats
 */
export function parseDate(dateString: string | undefined): Date {
    if (!dateString) return new Date();
    const parsed = new Date(dateString);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Deduplicate content items by ID
 */
export function deduplicateItems(items: ContentItem[]): ContentItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}
