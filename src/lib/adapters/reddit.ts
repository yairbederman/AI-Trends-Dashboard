import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId } from './base';

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
    };
}

interface RedditResponse {
    data: {
        children: RedditPost[];
    };
}

/**
 * Reddit JSON API Adapter
 * Fetches posts from specified subreddits
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
        const subreddit = this.getSubreddit();
        // We could use t=hour/day/week param if we switched to /top/.json
        // But /hot/.json is usually better for "trends", so we'll fetch hot and filter by date
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=50`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'AI-Trends-Dashboard/1.0',
                },
            });

            if (!response.ok) {
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
                tags: post.data.link_flair_text ? [post.data.link_flair_text] : [],
                engagement: {
                    upvotes: post.data.score,
                    comments: post.data.num_comments,
                },
            }));

            // Filter items by time range
            return this.filterByTimeRange(items, options?.timeRange);
        } catch (error) {
            console.error(`Failed to fetch Reddit r/${subreddit}:`, error);
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
