import Parser from 'rss-parser';
import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId, parseDate } from './base';

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'AI-Trends-Dashboard/1.0',
    },
});

/**
 * RSS Feed Adapter
 * Fetches content from RSS/Atom feeds
 */
export class RSSAdapter extends BaseAdapter {
    constructor(public source: SourceConfig) {
        super(source);
        if (!source.feedUrl) {
            throw new Error(`RSS adapter requires feedUrl for source: ${source.id}`);
        }
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // Use retry mechanism for network requests
            const feed = await this.fetchWithRetry(() =>
                parser.parseURL(this.source.feedUrl!)
            );

            const items = feed.items.map((item) => ({
                id: createContentId(this.source.id, item.link || item.guid || ''),
                sourceId: this.source.id,
                title: item.title || 'Untitled',
                description: this.cleanDescription(item.contentSnippet || item.content || ''),
                url: item.link || '',
                imageUrl: this.extractImage(item),
                publishedAt: parseDate(item.pubDate || item.isoDate),
                fetchedAt: new Date(),
                author: this.extractAuthor(item.creator || item.author),
                tags: this.extractTags(item.categories),
            }));

            return this.filterByTimeRange(items, options?.timeRange);
        } catch (error) {
            console.error(`Failed to fetch RSS for ${this.source.name}:`, error);
            return [];
        }
    }

    private extractAuthor(author: unknown): string | undefined {
        if (!author) return undefined;
        if (typeof author === 'string') return author;
        if (typeof author === 'object') {
            const obj = author as Record<string, unknown>;
            // Handle common author object shapes
            if (obj.name) return String(obj.name);
            if (obj._) return String(obj._);
            return JSON.stringify(author);
        }
        return String(author);
    }

    private extractTags(categories: unknown): string[] | undefined {
        if (!categories) return undefined;
        if (!Array.isArray(categories)) return undefined;
        return categories.map((cat) => {
            if (typeof cat === 'string') return cat;
            if (typeof cat === 'object' && cat !== null) {
                const obj = cat as Record<string, unknown>;
                if (obj._) return String(obj._);
                if (obj.term) return String(obj.term);
                if (obj.name) return String(obj.name);
            }
            return String(cat);
        }).filter(Boolean);
    }

    // cleanDescription inherited from BaseAdapter

    private extractImage(item: Parser.Item): string | undefined {
        // Try to extract image from various RSS fields
        const mediaContent = (item as Record<string, unknown>)['media:content'];
        if (mediaContent && typeof mediaContent === 'object') {
            const media = mediaContent as { $?: { url?: string } };
            if (media.$?.url) return media.$.url;
        }

        const enclosure = item.enclosure;
        if (enclosure?.url && enclosure.type?.startsWith('image/')) {
            return enclosure.url;
        }

        return undefined;
    }
}
