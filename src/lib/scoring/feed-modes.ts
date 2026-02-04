import { ContentItem } from '@/types';

export type FeedMode = 'hot' | 'rising' | 'top';

/**
 * Calculate recency score (0-1) with exponential decay
 */
function calculateRecencyScore(publishedAt: Date | string): number {
  const published = new Date(publishedAt);
  const ageHours = (Date.now() - published.getTime()) / (1000 * 60 * 60);
  const halfLifeHours = 24;
  return Math.exp(-ageHours / halfLifeHours);
}

/**
 * Normalize velocity to 0-1 scale using log scale
 */
function normalizeVelocity(velocity: number): number {
  if (velocity <= 0) return 0;
  // velocity of 10/hr = ~0.25, 100/hr = ~0.5, 1000/hr = ~0.75
  return Math.min(1, Math.log10(velocity + 1) / 4);
}

/**
 * Calculate engagement score (0-1) from metrics
 */
function calculateEngagementScore(engagement?: ContentItem['engagement']): number {
  if (!engagement) return 0.25; // baseline for items without metrics

  const primary = engagement.views || engagement.upvotes || engagement.stars ||
                  engagement.likes || engagement.downloads || engagement.claps || 0;

  // Log scale normalization
  if (primary <= 0) return 0.25;
  return Math.min(1, Math.log10(primary + 1) / 6); // 1M = ~1.0
}

/**
 * HOT: What's peaking now
 * 50% engagement + 30% recency + 20% velocity
 */
export function calculateHotScore(
  item: ContentItem,
  velocity: number
): number {
  const engagementScore = calculateEngagementScore(item.engagement);
  const recencyScore = calculateRecencyScore(item.publishedAt);
  const velocityScore = normalizeVelocity(velocity);

  return (
    engagementScore * 0.50 +
    recencyScore * 0.30 +
    velocityScore * 0.20
  ) * 100;
}

/**
 * RISING: Gaining momentum, not yet hot
 * 70% velocity + 20% recency + 10% engagement
 * Penalize items that are already very popular
 */
export function calculateRisingScore(
  item: ContentItem,
  velocity: number,
  engagementPercentile: number
): number {
  const velocityScore = normalizeVelocity(velocity);
  const recencyScore = calculateRecencyScore(item.publishedAt);
  const engagementScore = calculateEngagementScore(item.engagement);

  // Penalty for items already in top 20% engagement
  const newnessPenalty = engagementPercentile > 0.8 ? 0.6 : 1.0;

  return (
    velocityScore * 0.70 +
    recencyScore * 0.20 +
    engagementScore * 0.10
  ) * newnessPenalty * 100;
}

/**
 * TOP: Highest engagement in time range
 * Pure engagement score
 */
export function calculateTopScore(item: ContentItem): number {
  return calculateEngagementScore(item.engagement) * 100;
}

/**
 * Score and sort items by feed mode
 */
export function scoreItemsByFeedMode(
  items: ContentItem[],
  velocities: Map<string, number>,
  mode: FeedMode
): ContentItem[] {
  // Calculate engagement percentiles for Rising mode
  const engagementScores = items.map(item => ({
    id: item.id,
    score: calculateEngagementScore(item.engagement)
  }));
  engagementScores.sort((a, b) => a.score - b.score);

  const percentileMap = new Map<string, number>();
  engagementScores.forEach((item, idx) => {
    const percentile = engagementScores.length > 1
      ? idx / (engagementScores.length - 1)
      : 0.5;
    percentileMap.set(item.id, percentile);
  });

  // Score items based on mode
  const scoredItems = items.map(item => {
    const velocity = velocities.get(item.id) || 0;
    let score: number;

    switch (mode) {
      case 'hot':
        score = calculateHotScore(item, velocity);
        break;
      case 'rising':
        score = calculateRisingScore(item, velocity, percentileMap.get(item.id) || 0);
        break;
      case 'top':
        score = calculateTopScore(item);
        break;
    }

    return {
      ...item,
      trendingScore: Math.round(score * 10) / 10,
      velocityScore: velocity,
    };
  });

  // Sort by score descending
  return scoredItems.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
}
