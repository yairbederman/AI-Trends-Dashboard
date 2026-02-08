import { db } from './index';
import { engagementSnapshots } from './schema';
import { EngagementMetrics } from '@/types';
import { desc, sql } from 'drizzle-orm';

/**
 * Record engagement snapshots for multiple content items in batch.
 * Replaces the old per-item sequential approach which caused N+1 queries
 * (catastrophic with remote Postgres/Supabase latency).
 *
 * Strategy:
 * 1. Single query to fetch the most recent snapshot per content ID
 * 2. Calculate velocities in-memory
 * 3. Single batch INSERT for all new snapshots
 */
export async function recordEngagementSnapshotsBatch(
  items: { contentId: string; engagement: EngagementMetrics }[]
): Promise<void> {
  if (items.length === 0) return;

  try {
    const now = new Date();
    const windowStart = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const contentIds = items.map(i => i.contentId);

    // 1. Batch fetch most recent snapshot per content ID (single query)
    const previousSnapshots = await db
      .select()
      .from(engagementSnapshots)
      .where(sql`${engagementSnapshots.contentId} IN (${sql.join(contentIds.map(id => sql`${id}`), sql`, `)})
        AND ${engagementSnapshots.snapshotAt} >= ${windowStart}`)
      .orderBy(desc(engagementSnapshots.snapshotAt));

    // Keep only the most recent snapshot per contentId
    const latestByContentId = new Map<string, typeof previousSnapshots[number]>();
    for (const snap of previousSnapshots) {
      if (!latestByContentId.has(snap.contentId)) {
        latestByContentId.set(snap.contentId, snap);
      }
    }

    // 2. Build all snapshot rows with velocity calculated in-memory
    const rows = items.map(({ contentId, engagement }) => {
      let velocity = 0;
      const oldSnapshot = latestByContentId.get(contentId);
      if (oldSnapshot) {
        const oldEngagement = getPrimaryMetric(oldSnapshot);
        const newEngagement = getPrimaryMetricFromEngagement(engagement);
        const hoursElapsed = (now.getTime() - oldSnapshot.snapshotAt.getTime()) / (1000 * 60 * 60);
        if (hoursElapsed >= 0.5) {
          velocity = (newEngagement - oldEngagement) / hoursElapsed;
        } else {
          velocity = oldSnapshot.velocityScore || 0;
        }
      }

      return {
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
      };
    });

    // 3. Batch insert all snapshots (chunks of 100 to stay within parameter limits)
    const CHUNK_SIZE = 100;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      await db.insert(engagementSnapshots).values(rows.slice(i, i + CHUNK_SIZE));
    }
  } catch (error) {
    console.error('Failed to record engagement snapshots batch:', error);
  }
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
 * Get velocities for multiple content items (bulk operation).
 * Uses Postgres DISTINCT ON to efficiently get only the latest snapshot per content ID
 * within a 24h window, avoiding unbounded result sets.
 */
export async function getBulkVelocities(
  contentIds: string[]
): Promise<Map<string, number>> {
  if (contentIds.length === 0) return new Map();

  try {
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Postgres DISTINCT ON: get the most recent snapshot per contentId in one query
    const results = await db.execute<{ content_id: string; velocity_score: number | null }>(
      sql`SELECT DISTINCT ON (content_id) content_id, velocity_score
          FROM engagement_snapshots
          WHERE content_id IN (${sql.join(contentIds.map(id => sql`${id}`), sql`, `)})
            AND snapshot_at >= ${windowStart}
          ORDER BY content_id, snapshot_at DESC`
    );

    const velocityMap = new Map<string, number>();
    for (const row of results) {
      velocityMap.set(row.content_id, row.velocity_score || 0);
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
    const deleted = await db
      .delete(engagementSnapshots)
      .where(sql`${engagementSnapshots.snapshotAt} < ${cutoff}`)
      .returning({ id: engagementSnapshots.id });

    return deleted.length;
  } catch (error) {
    console.error('Failed to cleanup old snapshots:', error);
    return 0;
  }
}
