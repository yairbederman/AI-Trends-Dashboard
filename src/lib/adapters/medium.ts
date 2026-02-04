import Parser from 'rss-parser';
import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId, parseDate } from './base';

const parser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'AI-Trends-Dashboard/1.0',
    },
});

interface MediumEngagement {
    claps: number;
    responses: number;
}

/**
 * Medium Adapter
 * Extends RSS feed fetching with web scraping to extract engagement metrics (claps, responses)
 */
export class MediumAdapter extends BaseAdapter {
    // Rate limiting: minimum delay between scrape requests (ms)
    private scrapeDelayMs = 500;
    // Maximum articles to scrape per fetch (to avoid overloading)
    private maxScrapeCount = 20;

    constructor(public source: SourceConfig) {
        super(source);
        if (!source.feedUrl) {
            throw new Error(`Medium adapter requires feedUrl for source: ${source.id}`);
        }
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // First, fetch RSS feed for article discovery
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

            // Filter by time range first to reduce scraping
            const filteredItems = this.filterByTimeRange(items, options?.timeRange);

            // Scrape engagement metrics for filtered items (with rate limiting)
            const itemsWithEngagement = await this.scrapeEngagementForItems(filteredItems);

            return itemsWithEngagement;
        } catch (error) {
            console.error(`Failed to fetch Medium for ${this.source.name}:`, error);
            return [];
        }
    }

    /**
     * Scrape engagement metrics for a batch of items with rate limiting
     */
    private async scrapeEngagementForItems(items: ContentItem[]): Promise<ContentItem[]> {
        const results: ContentItem[] = [];
        const toScrape = items.slice(0, this.maxScrapeCount);

        for (let i = 0; i < toScrape.length; i++) {
            const item = toScrape[i];

            try {
                const engagement = await this.scrapeArticleEngagement(item.url);
                results.push({
                    ...item,
                    engagement: engagement ? {
                        claps: engagement.claps,
                        responses: engagement.responses,
                    } : undefined,
                });
            } catch (error) {
                // On scrape failure, add item without engagement (will use baseline score)
                console.warn(`Failed to scrape Medium engagement for: ${item.url}`);
                results.push(item);
            }

            // Rate limiting delay between requests (skip for last item)
            if (i < toScrape.length - 1) {
                await new Promise(resolve => setTimeout(resolve, this.scrapeDelayMs));
            }
        }

        // Add remaining items without scraping
        for (let i = this.maxScrapeCount; i < items.length; i++) {
            results.push(items[i]);
        }

        return results;
    }

    /**
     * Scrape engagement metrics from a Medium article page
     * Looks for claps and responses in the page HTML/JSON
     */
    private async scrapeArticleEngagement(url: string): Promise<MediumEngagement | null> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
            });

            if (!response.ok) {
                return null;
            }

            const html = await response.text();

            // Try multiple extraction methods
            let claps = this.extractClapsFromHtml(html);
            let responses = this.extractResponsesFromHtml(html);

            // If extraction failed, try JSON-LD structured data
            if (claps === 0) {
                const jsonLdData = this.extractJsonLdData(html);
                if (jsonLdData) {
                    claps = jsonLdData.claps || 0;
                    responses = jsonLdData.responses || responses;
                }
            }

            return { claps, responses };
        } catch (error) {
            console.warn(`Error scraping Medium article: ${error}`);
            return null;
        }
    }

    /**
     * Extract clap count from Medium HTML
     * Medium uses various patterns for displaying claps
     */
    private extractClapsFromHtml(html: string): number {
        // Pattern 1: Look for clap count in button text (e.g., "1.2K")
        const clapPatterns = [
            // Button with clap count like "1.2K" or "500"
            /aria-label="[^"]*?(\d+(?:\.\d+)?[KkMm]?)\s*claps?/i,
            // Clap count in span/text near clap button
            /data-testid="[^"]*clap[^"]*"[^>]*>.*?(\d+(?:\.\d+)?[KkMm]?)/i,
            // Generic clap number pattern
            /"clapCount":\s*(\d+)/,
            // Apollo state pattern
            /"claps":\s*(\d+)/,
        ];

        for (const pattern of clapPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return this.parseMetricValue(match[1]);
            }
        }

        return 0;
    }

    /**
     * Extract response/comment count from Medium HTML
     */
    private extractResponsesFromHtml(html: string): number {
        const responsePatterns = [
            // Response count patterns
            /aria-label="[^"]*?(\d+(?:\.\d+)?[KkMm]?)\s*responses?/i,
            /"responseCount":\s*(\d+)/,
            /"responses?":\s*(\d+)/,
            // Comment count patterns
            /(\d+(?:\.\d+)?[KkMm]?)\s*(?:responses?|comments?)/i,
        ];

        for (const pattern of responsePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return this.parseMetricValue(match[1]);
            }
        }

        return 0;
    }

    /**
     * Extract structured data from JSON-LD script tags
     */
    private extractJsonLdData(html: string): { claps?: number; responses?: number } | null {
        try {
            // Find JSON-LD script tags
            const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
            if (jsonLdMatch && jsonLdMatch[1]) {
                const data = JSON.parse(jsonLdMatch[1]);

                // Look for interaction statistics
                if (data.interactionStatistic) {
                    const stats = Array.isArray(data.interactionStatistic)
                        ? data.interactionStatistic
                        : [data.interactionStatistic];

                    let claps = 0;
                    let responses = 0;

                    for (const stat of stats) {
                        if (stat['@type'] === 'InteractionCounter') {
                            const type = stat.interactionType?.['@type'] || stat.interactionType;
                            const count = parseInt(stat.userInteractionCount, 10) || 0;

                            if (type === 'LikeAction' || type === 'http://schema.org/LikeAction') {
                                claps = count;
                            } else if (type === 'CommentAction' || type === 'http://schema.org/CommentAction') {
                                responses = count;
                            }
                        }
                    }

                    if (claps > 0 || responses > 0) {
                        return { claps, responses };
                    }
                }
            }
        } catch {
            // JSON parsing failed, return null
        }
        return null;
    }

    /**
     * Parse metric values with K/M suffixes
     */
    private parseMetricValue(value: string): number {
        const normalized = value.trim().toUpperCase();
        const numMatch = normalized.match(/^(\d+(?:\.\d+)?)/);

        if (!numMatch) return 0;

        let num = parseFloat(numMatch[1]);

        if (normalized.endsWith('K')) {
            num *= 1000;
        } else if (normalized.endsWith('M')) {
            num *= 1000000;
        }

        return Math.round(num);
    }

    private extractAuthor(author: unknown): string | undefined {
        if (!author) return undefined;
        if (typeof author === 'string') return author;
        if (typeof author === 'object') {
            const obj = author as Record<string, unknown>;
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

    private extractImage(item: Parser.Item): string | undefined {
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
