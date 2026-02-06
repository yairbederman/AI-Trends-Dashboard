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

/**
 * AI-relevance filtering for general-topic feeds.
 *
 * Two-tier matching:
 * 1. BOUNDARY keywords — short words that appear as substrings of common English
 *    words (e.g., "ai" in "said"). Matched with regex \b word boundaries.
 * 2. SUBSTRING keywords — longer words/phrases specific enough for simple includes().
 *
 * Removed: "safety", "alignment", "benchmark" — too generic even with word
 * boundaries. Any AI article about these topics will also contain specific terms.
 */

// Short keywords matched with \b to avoid "said"→"ai", "storage"→"rag", etc.
// Uses regex literal to avoid string escaping issues with \b
const BOUNDARY_REGEX = /\b(ai|rag|gpu|tpu|llm|gpt)/i;

// Longer keywords safe for substring matching
const SUBSTRING_KEYWORDS = [
    // Core concepts
    'artificial intelligence', 'machine learning', 'deep learning',
    'neural network', 'neural net', 'natural language', 'computer vision',
    'reinforcement learning', 'language model',
    // Model types & techniques
    'transformer', 'diffusion', 'generative', 'fine-tuning', 'fine tuning',
    'rlhf', 'embedding', 'retrieval augmented', 'prompt engineering',
    'chain of thought', 'few-shot', 'zero-shot', 'multimodal',
    'foundation model', 'frontier model', 'agentic', 'chatbot', 'neural',
    // Companies & products
    'openai', 'anthropic', 'claude', 'chatgpt', 'gpt-4', 'gpt-5', 'gpt4', 'gpt5',
    'gemini', 'mistral', 'llama', 'copilot', 'midjourney', 'stable diffusion',
    'dall-e', 'sora', 'deepmind', 'hugging face', 'huggingface',
    // Infrastructure
    'nvidia', 'cuda', 'inference', 'training data',
    'vector database', 'model weights', 'open source model', 'open-source model',
];

/**
 * Check if text is AI-relevant using two-tier keyword matching.
 * Used by adapters for content filtering.
 */
export function isAIRelevant(text: string): boolean {
    const lower = text.toLowerCase();
    if (BOUNDARY_REGEX.test(lower)) return true;
    return SUBSTRING_KEYWORDS.some(kw => lower.includes(kw));
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

    /**
     * Filter items for AI relevance using two-tier keyword matching.
     * Only applied when source.relevanceFilter is true.
     */
    protected filterByRelevance(items: ContentItem[]): ContentItem[] {
        if (!this.source.relevanceFilter) return items;

        return items.filter(item => {
            const text = `${item.title} ${item.description || ''} ${item.tags?.join(' ') || ''}`;
            return isAIRelevant(text);
        });
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
