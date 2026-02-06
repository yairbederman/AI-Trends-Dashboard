import { SourceAdapter } from './base';
import { RSSAdapter } from './rss';
import { HackerNewsAdapter } from './hackernews';
import { RedditAdapter } from './reddit';
import { YouTubeAdapter } from './youtube';
import { GitHubAdapter } from './github';
import { HuggingFaceAdapter } from './huggingface';
import { SourceConfig } from '@/types';

/**
 * Factory function to create the appropriate adapter for a source
 */
export function createAdapter(source: SourceConfig): SourceAdapter | null {
    // Skip disabled sources
    if (!source.enabled) {
        return null;
    }

    // Check for required API keys
    if (source.requiresKey && source.apiKeyEnvVar) {
        const hasKey = process.env[source.apiKeyEnvVar];
        if (!hasKey) {
            console.log(`Skipping ${source.name}: API key not configured (${source.apiKeyEnvVar})`);
            return null;
        }
    }

    switch (source.method) {
        case 'rss':
            if (!source.feedUrl) {
                console.warn(`No feed URL for RSS source: ${source.name}`);
                return null;
            }
            return new RSSAdapter(source);

        case 'api':
            // Route to specific API adapters
            if (source.id === 'hackernews') {
                return new HackerNewsAdapter(source);
            }
            if (source.id.startsWith('reddit-')) {
                return new RedditAdapter(source);
            }
            if (source.id === 'youtube') {
                try {
                    return new YouTubeAdapter(source);
                } catch (e) {
                    console.log(`YouTube adapter not available: ${e}`);
                    return null;
                }
            }
            if (source.id === 'github-trending') {
                return new GitHubAdapter(source);
            }
            if (source.id === 'huggingface') {
                return new HuggingFaceAdapter(source);
            }
            // For other API sources, log and skip for now
            console.log(`API adapter not yet implemented for: ${source.name}`);
            return null;

        case 'scrape':
            // Scraping adapters to be implemented
            console.log(`Scrape adapter not yet implemented for: ${source.name}`);
            return null;

        default:
            console.warn(`Unknown method for source: ${source.name}`);
            return null;
    }
}

export { RSSAdapter } from './rss';
export { HackerNewsAdapter } from './hackernews';
export { RedditAdapter } from './reddit';
export { YouTubeAdapter } from './youtube';
export { GitHubAdapter } from './github';
export { HuggingFaceAdapter } from './huggingface';
export type { SourceAdapter } from './base';
