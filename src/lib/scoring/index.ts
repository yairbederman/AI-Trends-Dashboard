import { ContentItem, EngagementMetrics } from '@/types';

export interface ScoringConfig {
    // Source priorities (sourceId -> priority 1-5)
    priorities: Map<string, number>;
    // Keywords that boost content score
    boostKeywords: string[];
    // Weights for each scoring component (should sum to ~1.0)
    weights?: {
        priority: number;
        engagement: number;
        recency: number;
        keywordBoost: number;
    };
}

const DEFAULT_WEIGHTS = {
    priority: 0.25,      // 25% - source importance
    engagement: 0.35,    // 35% - community validation
    recency: 0.25,       // 25% - freshness
    keywordBoost: 0.15,  // 15% - personal relevance
};

/**
 * Calculate a normalized engagement score (0-1) from various metrics
 */
function calculateEngagementScore(engagement?: EngagementMetrics): number {
    if (!engagement) return 0;

    // Different sources have different scales, so we use log normalization
    // This compresses large values while still differentiating them
    const scores: number[] = [];

    if (engagement.upvotes !== undefined) {
        // Reddit/HN: 1 upvote = baseline, 100 = good, 1000+ = viral
        scores.push(Math.min(1, Math.log10(Math.max(1, engagement.upvotes)) / 4));
    }

    if (engagement.comments !== undefined) {
        // Comments indicate discussion/interest
        scores.push(Math.min(1, Math.log10(Math.max(1, engagement.comments)) / 3));
    }

    if (engagement.stars !== undefined) {
        // GitHub stars: 10 = notable, 100 = popular, 1000+ = viral
        scores.push(Math.min(1, Math.log10(Math.max(1, engagement.stars)) / 4));
    }

    if (engagement.forks !== undefined) {
        // Forks indicate actual usage
        scores.push(Math.min(1, Math.log10(Math.max(1, engagement.forks)) / 3));
    }

    if (engagement.views !== undefined) {
        // Views: 1000 = baseline, 100k = popular, 1M+ = viral
        scores.push(Math.min(1, Math.log10(Math.max(1, engagement.views)) / 6));
    }

    if (scores.length === 0) return 0;

    // Average all available engagement signals
    return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * Calculate a recency score (0-1) based on age
 * Uses exponential decay - newer content scores higher
 */
function calculateRecencyScore(publishedAt: Date | string): number {
    const published = new Date(publishedAt);
    const now = new Date();
    const ageHours = (now.getTime() - published.getTime()) / (1000 * 60 * 60);

    // Decay function: score = e^(-age/halfLife)
    // Half-life of 24 hours means content loses half its recency score per day
    const halfLifeHours = 24;
    const score = Math.exp(-ageHours / halfLifeHours);

    return Math.max(0, Math.min(1, score));
}

/**
 * Calculate keyword boost score (0-1) based on matching keywords
 * Returns 1 if any keyword matches, 0 otherwise (can be enhanced for partial matching)
 */
function calculateKeywordBoost(
    item: ContentItem,
    keywords: string[]
): { score: number; matchedKeywords: string[] } {
    if (!keywords || keywords.length === 0) {
        return { score: 0, matchedKeywords: [] };
    }

    const text = `${item.title} ${item.description || ''} ${item.tags?.join(' ') || ''}`.toLowerCase();
    const matchedKeywords: string[] = [];

    for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
            matchedKeywords.push(keyword);
        }
    }

    // Score based on number of keywords matched (capped at 1)
    const score = Math.min(1, matchedKeywords.length / Math.max(1, keywords.length) * 2);

    return { score, matchedKeywords };
}

/**
 * Calculate the trending score for a content item
 * Returns a score from 0-100 where higher = more important/trending
 */
export function calculateTrendingScore(
    item: ContentItem,
    config: ScoringConfig
): { score: number; matchedKeywords: string[] } {
    const weights = config.weights || DEFAULT_WEIGHTS;

    // 1. Priority score (1-5 normalized to 0-1)
    const priority = config.priorities.get(item.sourceId) ?? 3;
    const priorityScore = (priority - 1) / 4; // Convert 1-5 to 0-1

    // 2. Engagement score
    const engagementScore = calculateEngagementScore(item.engagement);

    // 3. Recency score
    const recencyScore = calculateRecencyScore(item.publishedAt);

    // 4. Keyword boost
    const { score: keywordScore, matchedKeywords } = calculateKeywordBoost(
        item,
        config.boostKeywords
    );

    // Combine scores with weights
    const combinedScore =
        priorityScore * weights.priority +
        engagementScore * weights.engagement +
        recencyScore * weights.recency +
        keywordScore * weights.keywordBoost;

    // Scale to 0-100
    const finalScore = Math.round(combinedScore * 100);

    return {
        score: Math.max(0, Math.min(100, finalScore)),
        matchedKeywords,
    };
}

/**
 * Score and sort an array of content items
 */
export function scoreAndSortItems(
    items: ContentItem[],
    config: ScoringConfig
): ContentItem[] {
    // Calculate scores for all items
    const scoredItems = items.map(item => {
        const { score, matchedKeywords } = calculateTrendingScore(item, config);
        return {
            ...item,
            trendingScore: score,
            matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
        };
    });

    // Sort by trending score (descending)
    return scoredItems.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
}

/**
 * Get a human-readable label for a trending score
 */
export function getScoreLabel(score: number): string {
    if (score >= 80) return 'Hot';
    if (score >= 60) return 'Trending';
    if (score >= 40) return 'Notable';
    if (score >= 20) return 'Normal';
    return 'Low';
}

/**
 * Get a color class for a trending score
 */
export function getScoreColor(score: number): string {
    if (score >= 80) return 'score-hot';
    if (score >= 60) return 'score-trending';
    if (score >= 40) return 'score-notable';
    return 'score-normal';
}
