import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId, isAIRelevant } from './base';

interface HNItem {
    id: number;
    title: string;
    url?: string;
    by: string;
    time: number;
    score: number;
    descendants?: number;
    type: string;
}

/**
 * Hacker News API Adapter
 * Fetches top AI-related stories from Hacker News
 */
export class HackerNewsAdapter extends BaseAdapter {
    private baseUrl = 'https://hacker-news.firebaseio.com/v0';
    constructor(public source: SourceConfig) {
        super(source);
    }

    private fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
    }

    /**
     * Fetch og:description from a URL's <head>. 3s timeout, 16KB read limit.
     * Returns null on any failure.
     */
    private async fetchOgDescription(url: string): Promise<string | null> {
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3000);
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'AI-Trends-Dashboard/1.0' },
            }).finally(() => clearTimeout(timer));

            if (!response.ok || !response.body) return null;

            // Read only first 16KB (meta tags are in <head>)
            const reader = response.body.getReader();
            const chunks: Uint8Array[] = [];
            let totalBytes = 0;
            const MAX_BYTES = 16384;

            while (totalBytes < MAX_BYTES) {
                const { done, value } = await reader.read();
                if (done || !value) break;
                chunks.push(value);
                totalBytes += value.length;
            }
            reader.cancel();

            const html = new TextDecoder().decode(
                chunks.length === 1 ? chunks[0] : Buffer.concat(chunks)
            );

            // Extract og:description content
            const match = html.match(
                /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
            ) ?? html.match(
                /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i
            );

            if (match?.[1]) {
                const desc = match[1].trim();
                return desc.length > 300 ? desc.slice(0, 297) + '...' : desc;
            }
            return null;
        } catch {
            return null;
        }
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // Get top stories (with timeout)
            const topStoriesRes = await this.fetchWithTimeout(`${this.baseUrl}/topstories.json`);
            const topStories: number[] = await topStoriesRes.json();

            // Fetch first 100 stories in chunks of 10 with allSettled
            const storyIds = topStories.slice(0, 100);
            const CHUNK_SIZE = 10;
            const stories: HNItem[] = [];

            for (let i = 0; i < storyIds.length; i += CHUNK_SIZE) {
                const chunk = storyIds.slice(i, i + CHUNK_SIZE);
                const results = await Promise.allSettled(
                    chunk.map((id) =>
                        this.fetchWithTimeout(`${this.baseUrl}/item/${id}.json`).then((r) => r.json())
                    )
                );
                for (const result of results) {
                    if (result.status === 'fulfilled' && result.value) {
                        stories.push(result.value);
                    }
                }
            }

            // Filter for AI-related content
            const aiStories = stories.filter((story) => {
                if (!story || story.type !== 'story') return false;
                return isAIRelevant(story.title || '');
            });

            // Fetch og:description for stories with external URLs (parallel, best-effort)
            const ogDescriptions = new Map<number, string>();
            const storiesWithUrls = aiStories.filter(s => s.url);
            if (storiesWithUrls.length > 0) {
                const ogResults = await Promise.allSettled(
                    storiesWithUrls.map(async (story) => {
                        const desc = await this.fetchOgDescription(story.url!);
                        return { id: story.id, desc };
                    })
                );
                for (const result of ogResults) {
                    if (result.status === 'fulfilled' && result.value.desc) {
                        ogDescriptions.set(result.value.id, result.value.desc);
                    }
                }
            }

            const items = aiStories.map((story) => ({
                id: createContentId(this.source.id, `https://news.ycombinator.com/item?id=${story.id}`),
                sourceId: this.source.id,
                title: story.title,
                description: ogDescriptions.get(story.id)
                    ?? (story.url ? 'Discussion on Hacker News' : 'Ask HN / Show HN post'),
                url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
                publishedAt: new Date(story.time * 1000),
                fetchedAt: new Date(),
                author: story.by,
                tags: ['hacker-news'],
                engagement: {
                    upvotes: story.score,
                    comments: story.descendants || 0,
                },
            }));

            return items;
        } catch (error) {
            console.error('Failed to fetch Hacker News:', error);
            return [];
        }
    }
}
