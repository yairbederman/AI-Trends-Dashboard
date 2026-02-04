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

interface YouTubeVideoStatistics {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
}

interface YouTubeVideoItem {
    id: string;
    statistics?: YouTubeVideoStatistics;
}

interface YouTubeVideosResponse {
    items: YouTubeVideoItem[];
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

            // Extract video IDs for statistics fetch
            const videoIds = data.items
                .filter((item) => item.id.videoId)
                .map((item) => item.id.videoId as string);

            // Fetch engagement statistics for all videos (batched)
            const statsMap = await this.fetchVideoStatistics(videoIds);

            const items = data.items
                .filter((item) => item.id.videoId)
                .map((item) => {
                    const videoId = item.id.videoId as string;
                    const stats = statsMap.get(videoId);

                    return {
                        id: createContentId(this.source.id, `https://youtube.com/watch?v=${videoId}`),
                        sourceId: this.source.id,
                        title: this.decodeHtmlEntities(item.snippet.title),
                        description: this.truncate(item.snippet.description, 200),
                        url: `https://www.youtube.com/watch?v=${videoId}`,
                        imageUrl: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.high?.url,
                        publishedAt: new Date(item.snippet.publishedAt),
                        fetchedAt: new Date(),
                        author: item.snippet.channelTitle,
                        tags: ['youtube', 'video'],
                        engagement: stats ? {
                            views: stats.views,
                            likes: stats.likes,
                            comments: stats.comments,
                        } : undefined,
                    };
                });

            // Double check filtering (API should handle it but good to be safe for consistency)
            return this.filterByTimeRange(items, options?.timeRange);
        } catch (error) {
            console.error('Failed to fetch YouTube:', error);
            return [];
        }
    }

    /**
     * Fetch video statistics (views, likes, comments) for a batch of video IDs
     * YouTube API allows up to 50 video IDs per request
     */
    private async fetchVideoStatistics(
        videoIds: string[]
    ): Promise<Map<string, { views: number; likes: number; comments: number }>> {
        const statsMap = new Map<string, { views: number; likes: number; comments: number }>();

        if (videoIds.length === 0) {
            return statsMap;
        }

        try {
            // Batch video IDs (max 50 per request)
            const batchSize = 50;
            for (let i = 0; i < videoIds.length; i += batchSize) {
                const batch = videoIds.slice(i, i + batchSize);
                const idsParam = batch.join(',');

                const url = `${this.baseUrl}/videos?part=statistics&id=${idsParam}&key=${this.apiKey}`;
                const response = await fetch(url);
                const data: YouTubeVideosResponse = await response.json();

                if (data.error) {
                    console.error('YouTube statistics API error:', data.error.message);
                    continue;
                }

                for (const video of data.items) {
                    if (video.statistics) {
                        statsMap.set(video.id, {
                            views: parseInt(video.statistics.viewCount || '0', 10),
                            likes: parseInt(video.statistics.likeCount || '0', 10),
                            comments: parseInt(video.statistics.commentCount || '0', 10),
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch YouTube statistics:', error);
            // Return empty map on error - videos will still be returned without stats
        }

        return statsMap;
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
