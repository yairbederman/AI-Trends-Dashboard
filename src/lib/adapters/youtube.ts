import Parser from 'rss-parser';
import { ContentItem, SourceConfig } from '@/types';
import { BaseAdapter, AdapterOptions, createContentId } from './base';
import { getYouTubeChannels } from '@/lib/db/actions';

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

/** Intermediate video data before conversion to ContentItem */
interface YouTubeVideoInfo {
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    channelTitle: string;
    thumbnailUrl?: string;
}

const rssParser = new Parser({
    timeout: 10000,
    headers: {
        'User-Agent': 'AI-Trends-Dashboard/1.0',
    },
});

/**
 * YouTube Adapter
 * Fetches videos from user-configured YouTube channels via RSS feeds (free, no quota).
 * Optionally enriches with view/like stats via YouTube Data API if key is available.
 */
export class YouTubeAdapter extends BaseAdapter {
    private apiKey: string | null;
    private baseUrl = 'https://www.googleapis.com/youtube/v3';

    constructor(public source: SourceConfig) {
        super(source);
        this.apiKey = process.env.YOUTUBE_API_KEY || null;
    }

    async fetch(options?: AdapterOptions): Promise<ContentItem[]> {
        try {
            // Calculate publishedAfter date
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

            const rssVideos = await this.fetchChannelRSS(cutoff);

            console.log(`YouTube: ${rssVideos.size} videos from RSS`);

            // Enrich with stats if API key is available
            const uniqueVideoIds = Array.from(rssVideos.keys());
            const statsMap = this.apiKey
                ? await this.fetchVideoStatistics(uniqueVideoIds)
                : new Map<string, { views: number; likes: number; comments: number }>();

            // Convert to ContentItem[]
            const items: ContentItem[] = [];
            for (const [videoId, info] of rssVideos) {
                const stats = statsMap.get(videoId);
                items.push({
                    id: createContentId(this.source.id, `https://youtube.com/watch?v=${videoId}`),
                    sourceId: this.source.id,
                    title: this.decodeHtmlEntities(info.title),
                    description: this.truncate(info.description, 200),
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    imageUrl: info.thumbnailUrl,
                    publishedAt: new Date(info.publishedAt),
                    fetchedAt: new Date(),
                    author: info.channelTitle,
                    tags: ['youtube', 'video'],
                    engagement: stats ? {
                        views: stats.views,
                        likes: stats.likes,
                        comments: stats.comments,
                    } : undefined,
                });
            }

            return items;
        } catch (error) {
            console.error('Failed to fetch YouTube:', error);
            return [];
        }
    }

    /**
     * Fetch videos from user-configured YouTube channel RSS feeds (FREE - no API quota).
     * Individual channel failures are logged and skipped.
     */
    private async fetchChannelRSS(cutoff: Date): Promise<Map<string, YouTubeVideoInfo>> {
        const videoMap = new Map<string, YouTubeVideoInfo>();

        let channels;
        try {
            channels = await getYouTubeChannels();
        } catch (error) {
            console.warn('Failed to load YouTube channels from settings:', error);
            return videoMap;
        }

        if (channels.length === 0) return videoMap;

        const feedPromises = channels.map(async (channel) => {
            try {
                const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
                const feed = await rssParser.parseURL(feedUrl);

                for (const item of feed.items) {
                    // Extract video ID from RSS entry
                    const videoId = item.id?.replace('yt:video:', '')
                        || item.link?.split('v=')[1]
                        || '';
                    if (!videoId) continue;

                    const pubDate = new Date(item.pubDate || item.isoDate || '');
                    if (isNaN(pubDate.getTime()) || pubDate < cutoff) continue;

                    videoMap.set(videoId, {
                        videoId,
                        title: item.title || '',
                        description: item.contentSnippet || item.content || '',
                        publishedAt: pubDate.toISOString(),
                        channelTitle: feed.title?.replace(' - Videos', '') || channel.name,
                        thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                    });
                }
            } catch (error) {
                console.warn(`YouTube RSS failed for ${channel.name} (${channel.channelId}):`, error instanceof Error ? error.message : error);
            }
        });

        await Promise.allSettled(feedPromises);
        return videoMap;
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
