import * as cheerio from 'cheerio';
import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId, parseDate } from './base';

interface ParsedArticle {
    url: string;
    title: string;
    date: string;
    category: string | undefined;
}

/**
 * Anthropic News Scrape Adapter
 * Fetches and parses https://www.anthropic.com/news HTML directly
 * since Anthropic has no RSS feed.
 *
 * Uses cheerio for DOM parsing instead of regex for resilience
 * against markup changes, whitespace variations, and attribute reordering.
 */
export class AnthropicAdapter extends BaseAdapter {
    private newsUrl = 'https://www.anthropic.com/news';

    constructor(public source: SourceConfig) {
        super(source);
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            const html = await this.fetchWithRetry(async () => {
                const res = await fetch(this.newsUrl, {
                    headers: {
                        'User-Agent': 'AI-Trends-Dashboard/1.0',
                        'Accept': 'text/html',
                    },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.text();
            });

            const articles = this.parseArticles(html);

            const items: ContentItem[] = articles.map((article) => ({
                id: createContentId(this.source.id, article.url),
                sourceId: this.source.id,
                title: article.title,
                description: article.category
                    ? `Anthropic ${article.category}`
                    : 'Anthropic News',
                url: article.url,
                publishedAt: parseDate(article.date),
                fetchedAt: new Date(),
                author: 'Anthropic',
                tags: article.category
                    ? [article.category.toLowerCase()]
                    : ['anthropic'],
            }));

            return this.filterByTimeRange(items, options?.timeRange);
        } catch (error) {
            console.error('Failed to fetch Anthropic news:', error);
            return [];
        }
    }

    /**
     * Parse articles from the Anthropic /news page HTML using cheerio.
     *
     * Finds all links to /news/{slug}, then extracts title, date, and
     * category from each link's surrounding DOM context.
     */
    private parseArticles(html: string): ParsedArticle[] {
        const $ = cheerio.load(html);
        const seen = new Set<string>();
        const articles: ParsedArticle[] = [];

        // Find all links pointing to article pages
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || '';

            // Match both absolute and relative article URLs
            if (!/^(https:\/\/www\.anthropic\.com)?\/news\/[a-z0-9]/.test(href)) return;

            // Normalize to absolute URL
            const url = href.startsWith('/')
                ? `https://www.anthropic.com${href}`
                : href;

            // Deduplicate
            if (seen.has(url)) return;
            seen.add(url);

            const $el = $(el);

            // Title: first heading (h2-h6), or a span/element with "title" in class
            const $heading = $el.find('h2, h3, h4, h5, h6').first();
            let title = $heading.length ? $heading.text().trim() : '';
            if (!title) {
                const $titleSpan = $el.find('[class*="title"]').first();
                title = $titleSpan.length ? $titleSpan.text().trim() : '';
            }

            if (!title) return; // Skip nav/footer links without titles

            // Date: look for "MMM DD, YYYY" pattern in text content
            const textContent = $el.text();
            const dateMatch = textContent.match(
                /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/
            );

            if (!dateMatch) return; // Skip links without dates (nav/footer)

            // Category: element with "bold" or "subject" in class name
            const $catBold = $el.find('[class*="bold"]').first();
            const $catSubject = $el.find('[class*="subject"]').first();
            const category = ($catBold.length ? $catBold.text().trim() : null)
                || ($catSubject.length ? $catSubject.text().trim() : null)
                || undefined;

            articles.push({
                url,
                title,
                date: dateMatch[0],
                category,
            });
        });

        return articles;
    }
}
