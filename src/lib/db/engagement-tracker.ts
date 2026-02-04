import { db } from './index';
import { engagementSnapshots } from './schema';
import { EngagementMetrics } from '@/types';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

/**
 * Record an engagement snapshot for a content item
 */
export async function recordEngagementSnapshot(
  contentId: string,
  engagement: EngagementMetrics
): Promise<void> {
  try {
    const now = new Date();

    // Calculate velocity from previous snapshot
    const velocity = await calculateVelocityForItem(contentId, engagement, 6);

    await db.insert(engagementSnapshots).values({
      contentId,
      snapshotAt: now,
      upvotes: engagement.upvotes,
      comments: engagement.comments,
      views: engagement.views,
      likes: engagement.likes,
      stars: engagement.stars,
      forks: engagement.forks,
      downloads: engagement.downloads,
      claps: engagement.claps,
      velocityScore: velocity,
    });
  } catch (error) {
    console.error('Failed to record engagement snapshot:', error);
  }
}

/**
 * Calculate velocity for a single item based on recent snapshots
 */
async function calculateVelocityForItem(
  contentId: string,
  currentEngagement: EngagementMetrics,
  windowHours: number
): Promise<number> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const recentSnapshots = await db
    .select()
    .from(engagementSnapshots)
    .where(
      and(
        eq(engagementSnapshots.contentId, contentId),
        gte(engagementSnapshots.snapshotAt, windowStart)
      )
    )
    .orderBy(desc(engagementSnapshots.snapshotAt))
    .limit(1);

  if (recentSnapshots.length === 0) {
    return 0; // No previous snapshot, can't calculate velocity
  }

  const oldSnapshot = recentSnapshots[0];
  const oldEngagement = getPrimaryMetric(oldSnapshot);
  const newEngagement = getPrimaryMetricFromEngagement(currentEngagement);

  const hoursElapsed = (Date.now() - oldSnapshot.snapshotAt.getTime()) / (1000 * 60 * 60);
  if (hoursElapsed < 0.5) return oldSnapshot.velocityScore || 0; // Not enough time elapsed

  return (newEngagement - oldEngagement) / hoursElapsed;
}

/**
 * Get primary engagement metric from snapshot
 */
function getPrimaryMetric(snapshot: typeof engagementSnapshots.$inferSelect): number {
  return snapshot.views || snapshot.upvotes || snapshot.stars ||
         snapshot.likes || snapshot.downloads || snapshot.claps || 0;
}

/**
 * Get primary engagement metric from EngagementMetrics
 */
function getPrimaryMetricFromEngagement(engagement: EngagementMetrics): number {
  return engagement.views || engagement.upvotes || engagement.stars ||
         engagement.likes || engagement.downloads || engagement.claps || 0;
}

/**
 * Get velocities for multiple content items (bulk operation)
 */
export async function getBulkVelocities(
  contentIds: string[]
): Promise<Map<string, number>> {
  if (contentIds.length === 0) return new Map();

  try {
    // Get most recent velocity for each content item
    const results = await db
      .select({
        contentId: engagementSnapshots.contentId,
        velocityScore: engagementSnapshots.velocityScore,
      })
      .from(engagementSnapshots)
      .where(sql`${engagementSnapshots.contentId} IN (${sql.join(contentIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(engagementSnapshots.snapshotAt));

    // Keep only the most recent velocity per contentId
    const velocityMap = new Map<string, number>();
    for (const row of results) {
      if (!velocityMap.has(row.contentId)) {
        velocityMap.set(row.contentId, row.velocityScore || 0);
      }
    }

    return velocityMap;
  } catch (error) {
    console.error('Failed to get bulk velocities:', error);
    return new Map();
  }
}

/**
 * Clean up old snapshots to prevent database bloat
 */
export async function cleanupOldSnapshots(daysToKeep: number = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

  try {
    const result = await db
      .delete(engagementSnapshots)
      .where(sql`${engagementSnapshots.snapshotAt} < ${cutoff}`);

    return result.changes || 0;
  } catch (error) {
    console.error('Failed to cleanup old snapshots:', error);
    return 0;
  }
}
