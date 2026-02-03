import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId } from './base';

interface YouTubeSearchResult {
    id: { videoId?: string; channelId?: string };
    snippet: {
        title: string;
        description: string;
        publishedAt: string;
        channelTitle: string;
        thumbnails: {
            medium?: { url: string };
            high?: { url: string };
        };
    };
}

interface YouTubeResponse {
    items: YouTubeSearchResult[];
    error?: { message: string };
}



/**
 * YouTube Data API Adapter
 * Fetches AI-related videos from YouTube
 */
export class YouTubeAdapter extends BaseAdapter {
    private apiKey: string;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';

    constructor(public source: SourceConfig) {
        super(source);
        const key = process.env.YOUTUBE_API_KEY;
        if (!key) {
            throw new Error('YouTube API key not configured');
        }
        this.apiKey = key;
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // Calculate publishedAfter date to optimize API usage
            const cutoff = new Date();
            const timeRange = options?.timeRange || '7d';

            switch (timeRange) {
                case '1h':
                    cutoff.setHours(cutoff.getHours() - 1);
                    break;
                case '12h':
                    cutoff.setHours(cutoff.getHours() - 12);
                    break;
                case '24h':
                    cutoff.setHours(cutoff.getHours() - 24);
                    break;
                case '48h':
                    cutoff.setHours(cutoff.getHours() - 48);
                    break;
                case '7d':
                default:
                    cutoff.setDate(cutoff.getDate() - 7);
                    break;
            }

            // Search for recent AI-related videos
            const searchQuery = encodeURIComponent('artificial intelligence OR LLM OR GPT OR machine learning');
            // Allow fetching up to 50 videos (max allowed by API) to ensure we get enough content
            const publishedAfter = cutoff.toISOString();
            const url = `${this.baseUrl}/search?part=snippet&q=${searchQuery}&type=video&order=date&publishedAfter=${publishedAfter}&maxResults=50&key=${this.apiKey}`;

            const response = await fetch(url);
            const data: YouTubeResponse = await response.json();

            if (data.error) {
                console.error('YouTube API error:', data.error.message);
                return [];
            }

            const items = data.items
                .filter((item) => item.id.videoId)
                .map((item) => ({
                    id: createContentId(this.source.id, `https://youtube.com/watch?v=${item.id.videoId}`),
                    sourceId: this.source.id,
                    title: this.decodeHtmlEntities(item.snippet.title),
                    description: this.truncate(item.snippet.description, 200),
                    url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
                    imageUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high?.url,
                    publishedAt: new Date(item.snippet.publishedAt),
                    fetchedAt: new Date(),
                    author: item.snippet.channelTitle,
                    tags: ['youtube', 'video'],
                }));

            // Double check filtering (API should handle it but good to be safe for consistency)
            return this.filterByTimeRange(items, options?.timeRange);
        } catch (error) {
            console.error('Failed to fetch YouTube:', error);
            return [];
        }
    }

    private truncate(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength) + '...';
    }

    private decodeHtmlEntities(text: string): string {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
}
