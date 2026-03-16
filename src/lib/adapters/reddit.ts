import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId } from './base';
import { getCustomSubreddits } from '@/lib/db/actions';

interface RedditPost {
    data: {
        id: string;
        title: string;
        selftext?: string;
        url: string;
        permalink: string;
        author: string;
        created_utc: number;
        score: number;
        num_comments: number;
        thumbnail?: string;
        link_flair_text?: string;
        subreddit: string;
    };
}

interface RedditResponse {
    data: {
        children: RedditPost[];
    };
}

/**
 * Reddit JSON API Adapter
 * Fetches posts from specified subreddits.
 * For the 'reddit-custom' source, fetches from user-configured subreddits.
 * For individual reddit-* sources, fetches from the URL-specified subreddit.
 */
export class RedditAdapter extends BaseAdapter {
    constructor(public source: SourceConfig) {
        super(source);
    }

    private getSubreddit(): string {
        // Extract subreddit from URL
        const match = this.source.url.match(/\/r\/([^/]+)/);
        return match ? match[1] : 'MachineLearning';
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        // For the custom source, fetch from all user-configured subreddits
        if (this.source.id === 'reddit-custom') {
            return this.fetchCustomSubreddits();
        }

        // For individual reddit sources, fetch single subreddit
        return this.fetchSubreddit(this.getSubreddit());
    }

    private async fetchCustomSubreddits(): Promise<ContentItem[]> {
        let subreddits;
        try {
            subreddits = await getCustomSubreddits();
        } catch (error) {
            console.warn('Failed to load custom subreddits from settings:', error);
            return [];
        }

        if (subreddits.length === 0) return [];

        // Fetch in batches of 4 to avoid Reddit rate-limiting
        const BATCH_SIZE = 4;
        const allItems: ContentItem[] = [];

        for (let i = 0; i < subreddits.length; i += BATCH_SIZE) {
            const batch = subreddits.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(async (sub) => {
                    try {
                        return await this.fetchSubreddit(sub.name);
                    } catch (error) {
                        console.warn(`Reddit fetch failed for r/${sub.name}:`, error instanceof Error ? error.message : error);
                        return [];
                    }
                })
            );
            for (const result of results) {
                if (result.status === 'fulfilled') {
                    allItems.push(...result.value);
                }
            }
        }

        console.log(`[Reddit] Total: ${allItems.length} posts from ${subreddits.length} subreddits`);
        return allItems;
    }

    private async fetchSubreddit(subreddit: string): Promise<ContentItem[]> {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50&raw_json=1`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'AI-Trends-Dashboard/1.0 (dashboard; content aggregator)',
                    'Accept': 'application/json',
                },
                signal: controller.signal,
            }).finally(() => clearTimeout(timer));

            if (!response.ok) {
                console.warn(`[Reddit] r/${subreddit}: HTTP ${response.status}`);
                throw new Error(`Reddit API error: ${response.status}`);
            }

            const data: RedditResponse = await response.json();

            const items = data.data.children.map((post) => ({
                id: createContentId(this.source.id, post.data.permalink),
                sourceId: this.source.id,
                title: post.data.title,
                description: this.truncate(post.data.selftext || '', 300),
                url: `https://reddit.com${post.data.permalink}`,
                imageUrl: this.getValidThumbnail(post.data.thumbnail),
                publishedAt: new Date(post.data.created_utc * 1000),
                fetchedAt: new Date(),
                author: post.data.author,
                tags: [
                    ...(post.data.link_flair_text ? [post.data.link_flair_text] : []),
                    `r/${post.data.subreddit || subreddit}`,
                ],
                engagement: {
                    upvotes: post.data.score,
                    comments: post.data.num_comments,
                },
            }));

            // Don't filter by time range — cache everything, DB query filters by user's time range.
            console.log(`[Reddit] r/${subreddit}: ${items.length} posts`);
            return items;
        } catch (error) {
            console.error(`[Reddit] r/${subreddit} FAILED:`, error instanceof Error ? error.message : error);
            return [];
        }
    }

    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    }

    private getValidThumbnail(thumbnail?: string): string | undefined {
        if (!thumbnail) return undefined;
        if (thumbnail === 'self' || thumbnail === 'default' || thumbnail === 'nsfw') {
            return undefined;
        }
        return thumbnail;
    }
}
