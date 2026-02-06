import { SourceCategory } from '@/types';

// TTL in milliseconds per source category
const CATEGORY_TTL_MS: Record<SourceCategory, number> = {
    'community': 5 * 60 * 1000,       // 5 min  - fast-moving (Reddit, HN)
    'social': 15 * 60 * 1000,          // 15 min - moderate
    'news': 15 * 60 * 1000,            // 15 min - moderate
    'ai-labs': 15 * 60 * 1000,         // 15 min - moderate
    'creative-ai': 15 * 60 * 1000,     // 15 min - moderate
    'dev-platforms': 15 * 60 * 1000,   // 15 min - moderate
    'newsletters': 30 * 60 * 1000,     // 30 min - slow-moving
    'leaderboards': 60 * 60 * 1000,    // 60 min - rarely changes
};

export function getSourceTTL(category: SourceCategory): number {
    return CATEGORY_TTL_MS[category];
}

export function isSourceStale(lastFetchedAt: Date | null, category: SourceCategory): boolean {
    if (!lastFetchedAt) return true;
    const ttl = getSourceTTL(category);
    return Date.now() - lastFetchedAt.getTime() > ttl;
}
