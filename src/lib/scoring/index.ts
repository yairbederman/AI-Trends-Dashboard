import { ContentItem, EngagementMetrics } from '@/types';
import {
    getEngagementConfig,
    getSourceQualityBaseline,
    QualityRatioConfig,
} from './engagement-config';

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
    priority: 0.15,      // 15% - source importance
    engagement: 0.50,    // 50% - community validation (primary signal)
    recency: 0.25,       // 25% - freshness
    keywordBoost: 0.10,  // 10% - personal relevance
};

/**
 * Calculate quality ratio bonus (0-1) based on engagement ratio
 * Higher ratio compared to ideal = better quality indicator
 */
function calculateQualityRatio(
    engagement: EngagementMetrics,
    config: QualityRatioConfig
): number {
    const numeratorValue = (engagement as Record<string, number | undefined>)[config.numerator] || 0;
    const denominatorValue = (engagement as Record<string, number | undefined>)[config.denominator] || 1;

    if (denominatorValue === 0) return 0;

    const actualRatio = numeratorValue / denominatorValue;

    // Score how close to ideal ratio (0-1 scale)
    // If actual >= ideal, return 1; otherwise return actual/ideal
    return Math.min(actualRatio / config.idealRatio, 1);
}

/**
 * Calculate a normalized engagement score (0-1) using source-specific configuration
 *
 * @param sourceId - The source identifier (e.g., 'youtube', 'github-trending', 'reddit-ml')
 * @param engagement - The engagement metrics from the content item
 * @returns A normalized score between 0 and 1
 */
function calculateEngagementScore(sourceId: string, engagement?: EngagementMetrics): number {
    const config = getEngagementConfig(sourceId);

    // Get source-specific quality baseline (used when no metrics available)
    // This differentiates official AI labs (0.55) from newsletters (0.35) from unimplemented (0.25)
    const qualityBaseline = getSourceQualityBaseline(sourceId);

    // If source has no configured metrics (e.g., RSS), return quality-based baseline
    if (config.metrics.length === 0) {
        return qualityBaseline;
    }

    // If no engagement data, return quality baseline or type-specific fallback
    if (!engagement) {
        return config.noEngagementBaseline || qualityBaseline;
    }

    // Calculate weighted metric score
    let metricScore = 0;
    let hasAnyMetric = false;

    for (const metric of config.metrics) {
        const value = (engagement as Record<string, number | undefined>)[metric.name];
        if (value !== undefined && value > 0) {
            hasAnyMetric = true;
            // Two-tier scaling: linear up to baseline, sqrt scaling above
            // This spreads out values more evenly across the range
            let normalized: number;
            if (value <= metric.baseline) {
                // Linear scale from 0 to 0.4 for values up to baseline
                normalized = (value / metric.baseline) * 0.4;
            } else if (value <= metric.viral) {
                // Linear scale from 0.4 to 0.8 for baseline to viral
                const range = metric.viral - metric.baseline;
                const progress = (value - metric.baseline) / range;
                normalized = 0.4 + progress * 0.4;
            } else {
                // Sqrt scale from 0.8 to 1.0 for values above viral
                // This still differentiates mega-viral content
                const overViral = value / metric.viral;
                normalized = 0.8 + Math.min(0.2, Math.sqrt(overViral - 1) * 0.1);
            }
            metricScore += normalized * metric.weight;
        }
    }

    // If no metrics were available, return quality baseline or type-specific fallback
    if (!hasAnyMetric) {
        return config.noEngagementBaseline || qualityBaseline;
    }

    // Apply quality ratio bonus if configured
    if (config.qualityRatio) {
        const ratioScore = calculateQualityRatio(engagement, config.qualityRatio);
        // Ratio acts as a multiplier: score * (1 + ratioScore * weight)
        // e.g., with weight 0.2 and perfect ratio: score * 1.2
        metricScore *= (1 + ratioScore * config.qualityRatio.weight);
    }

    // Cap at 1.0
    return Math.min(metricScore, 1);
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
 * @param percentileRank - Optional percentile rank (0-1) within source type for better spread
 * @param preCalculatedEngagement - Optional pre-calculated engagement score (avoids recalculation)
 */
export function calculateTrendingScore(
    item: ContentItem,
    config: ScoringConfig,
    percentileRank?: number,
    preCalculatedEngagement?: number
): { score: number; matchedKeywords: string[] } {
    const weights = config.weights || DEFAULT_WEIGHTS;

    // 1. Priority score (1-5 normalized to 0-1)
    const priority = config.priorities.get(item.sourceId) ?? 3;
    const priorityScore = (priority - 1) / 4; // Convert 1-5 to 0-1

    // 2. Engagement score - blend absolute and percentile
    // Absolute score includes quality ratios (likes/views, forks/stars, etc.)
    const absoluteEngagement = preCalculatedEngagement ?? calculateEngagementScore(item.sourceId, item.engagement);
    // Use percentile rank if available, blended with absolute score
    // This ensures items compete within their source type
    const engagementScore = percentileRank !== undefined
        ? absoluteEngagement * 0.3 + percentileRank * 0.7  // 70% relative, 30% absolute
        : absoluteEngagement;

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

    // Scale to 0-100 with 1 decimal place for better differentiation
    const finalScore = Math.round(combinedScore * 1000) / 10;

    return {
        score: Math.max(0, Math.min(100, finalScore)),
        matchedKeywords,
    };
}

/**
 * Get primary engagement value for tiebreaking
 */
function getPrimaryEngagement(item: ContentItem): number {
    const e = item.engagement;
    if (!e) return 0;
    // Return the most significant metric available
    return e.views || e.stars || e.upvotes || e.downloads || e.claps || e.likes || e.comments || 0;
}

/**
 * Score and sort an array of content items
 * Uses percentile-based engagement scoring within each source type for better spread
 */
export function scoreAndSortItems(
    items: ContentItem[],
    config: ScoringConfig
): ContentItem[] {
    // First pass: calculate raw engagement scores for each item
    // This includes quality ratios (like/view, fork/star, etc.)
    const engagementScores = new Map<string, number>();
    for (const item of items) {
        const score = calculateEngagementScore(item.sourceId, item.engagement);
        engagementScores.set(item.id, score);
    }

    // Group items by source type for percentile calculation
    const bySource = new Map<string, ContentItem[]>();
    for (const item of items) {
        const sourceType = getSourceTypeForScoring(item.sourceId);
        if (!bySource.has(sourceType)) bySource.set(sourceType, []);
        bySource.get(sourceType)!.push(item);
    }

    // Calculate percentile ranks within each source type
    // Rank by CALCULATED engagement score (includes quality ratios like likes/views)
    const percentileRanks = new Map<string, number>();
    for (const [, sourceItems] of bySource) {
        // Sort by calculated engagement score (not raw metric)
        const sorted = [...sourceItems].sort((a, b) =>
            (engagementScores.get(b.id) || 0) - (engagementScores.get(a.id) || 0)
        );
        // Assign percentile (0 = worst, 1 = best)
        sorted.forEach((item, idx) => {
            const percentile = sorted.length > 1
                ? 1 - (idx / (sorted.length - 1))
                : 0.5;
            percentileRanks.set(item.id, percentile);
        });
    }

    // Calculate final scores using percentile-adjusted engagement
    const scoredItems = items.map(item => {
        const absoluteScore = engagementScores.get(item.id) || 0;
        let percentile = percentileRanks.get(item.id);

        // Dampen percentile rank for items with very low absolute engagement.
        // Below the floor (0.15), scale the percentile proportionally so that
        // near-zero engagement can't ride a high relative rank to an inflated score.
        const ENGAGEMENT_FLOOR = 0.15;
        if (percentile !== undefined && absoluteScore < ENGAGEMENT_FLOOR) {
            percentile = percentile * (absoluteScore / ENGAGEMENT_FLOOR);
        }

        const { score, matchedKeywords } = calculateTrendingScore(
            item,
            config,
            percentile,
            absoluteScore
        );
        return {
            ...item,
            trendingScore: score,
            matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
        };
    });

    // Sort by trending score (descending), with engagement as tiebreaker
    return scoredItems.sort((a, b) => {
        const scoreDiff = (b.trendingScore || 0) - (a.trendingScore || 0);
        if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
        return (engagementScores.get(b.id) || 0) - (engagementScores.get(a.id) || 0);
    });
}

function getSourceTypeForScoring(sourceId: string): string {
    if (sourceId.startsWith('reddit-')) return 'reddit';
    if (sourceId.startsWith('arxiv-')) return 'arxiv';
    return sourceId;
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

/**
 * Normalize scores across categories to reduce dominance of high-metric categories.
 * Re-maps scores within each category to a common 15-85 range using min-max normalization,
 * then blends 80% normalized + 20% original to preserve some absolute signal.
 *
 * @param items - Scored items with trendingScore set
 * @param sourceToCategoryMap - Maps sourceId -> category string
 * @returns Items with adjusted trendingScore values
 */
export function normalizeCrossCategory(
    items: ContentItem[],
    sourceToCategoryMap: Record<string, string>
): ContentItem[] {
    if (items.length === 0) return items;

    // Group items by category
    const byCategory = new Map<string, ContentItem[]>();
    for (const item of items) {
        const cat = sourceToCategoryMap[item.sourceId] || 'unknown';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(item);
    }

    // Build a set of item IDs that should be normalized
    const normalizedScores = new Map<string, number>();

    for (const [, catItems] of byCategory) {
        // Skip categories with <3 items — not enough data to normalize meaningfully
        if (catItems.length < 3) continue;

        const scores = catItems.map(i => i.trendingScore || 0);
        const min = Math.min(...scores);
        const max = Math.max(...scores);

        // Skip if all items have the same score (avoid division by zero)
        if (max - min < 0.01) continue;

        const TARGET_MIN = 15;
        const TARGET_MAX = 85;

        for (const item of catItems) {
            const original = item.trendingScore || 0;
            // Min-max normalization to TARGET_MIN..TARGET_MAX range
            const mapped = TARGET_MIN + ((original - min) / (max - min)) * (TARGET_MAX - TARGET_MIN);
            // Blend: 80% normalized + 20% original
            const blended = mapped * 0.8 + original * 0.2;
            normalizedScores.set(item.id, Math.round(blended * 10) / 10);
        }
    }

    // Apply normalized scores (items in small categories keep original scores)
    return items.map(item => {
        const newScore = normalizedScores.get(item.id);
        if (newScore !== undefined) {
            return { ...item, trendingScore: newScore };
        }
        return item;
    });
}

export { scoreItemsByFeedMode, calculateHotScore, calculateRisingScore, calculateTopScore } from './feed-modes';
export type { FeedMode } from './feed-modes';
