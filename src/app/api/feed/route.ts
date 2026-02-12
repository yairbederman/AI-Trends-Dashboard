import { NextResponse } from 'next/server';
import { TimeRange, FeedMode } from '@/types';
import {
    getSetting,
    updateSetting,
    cleanOldContent,
    getCachedContentBySourceIds,
    getSourceFreshness,
} from '@/lib/db/actions';
import { getEffectiveConfig, getEffectiveSourceList } from '@/lib/config/resolve';
import { scoreItemsByFeedMode } from '@/lib/scoring';
import { getBulkVelocities, cleanupOldSnapshots } from '@/lib/db/engagement-tracker';
import { feedCache } from '@/lib/cache/memory-cache';
import { ensureSourcesFresh } from '@/lib/fetching/ensure-fresh';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// Run cleanup once per day max
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function maybeRunCleanup() {
    try {
        const lastCleanup = await getSetting<string>('lastCleanupTime', '');
        const lastTime = lastCleanup ? new Date(lastCleanup).getTime() : 0;

        if (Date.now() - lastTime > CLEANUP_INTERVAL_MS) {
            // Run cleanup in background (don't await)
            Promise.all([
                cleanOldContent(7),        // Keep 7 days of content
                cleanupOldSnapshots(7),    // Keep 7 days of snapshots
                // Phase 4: Clean up stale feed_cache_* entries from settings table
                db.delete(settings).where(sql`${settings.key} LIKE 'feed_cache_%'`),
            ]).then(([contentDeleted, snapshotsDeleted]) => {
                console.log(`Cleanup: removed ${contentDeleted} old items, ${snapshotsDeleted} old snapshots, cleaned feed_cache_* settings`);
            });
            await updateSetting('lastCleanupTime', new Date().toISOString());
        }
    } catch (error) {
        console.error('Cleanup check failed:', error);
    }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    // Trigger cleanup if needed (runs in background, once per day)
    maybeRunCleanup();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sourceId = searchParams.get('source');
    const queryTimeRange = searchParams.get('timeRange') as TimeRange | null;
    const feedMode = (searchParams.get('mode') as FeedMode) || 'hot';

    try {
        // Fetch config and source list in parallel
        const [config, sourceList] = await Promise.all([
            getEffectiveConfig(),
            getEffectiveSourceList(),
        ]);
        const timeRange = queryTimeRange || config.timeRange;

        // 1. Determine target source IDs (including custom sources)
        let targetSources = sourceList.enabled;

        if (category) {
            targetSources = targetSources.filter((s) => s.category === category);
        }

        if (sourceId) {
            targetSources = targetSources.filter((s) => s.id === sourceId);
        }

        const targetSourceIds = targetSources.map(s => s.id);

        // Check in-memory cache first
        const memoryCacheKey = `feed:${targetSourceIds.sort().join(',')}:${timeRange}:${feedMode}`;
        const memoryCached = feedCache.get(memoryCacheKey);
        if (memoryCached) {
            return NextResponse.json(memoryCached);
        }

        // 2. Query existing DB content and check freshness in parallel
        const [existingItems, freshness] = await Promise.all([
            getCachedContentBySourceIds(targetSourceIds, timeRange),
            getSourceFreshness(targetSourceIds),
        ]);

        let staleRefreshing = false;
        let failures: { source: string; error: string }[] = [];

        if (freshness.stale.length > 0 && existingItems.length > 0) {
            // Stale-while-revalidate: return existing data now, refresh in background
            staleRefreshing = true;
            ensureSourcesFresh(targetSources, targetSourceIds, timeRange)
                .then(() => {
                    // Invalidate memory cache so next request gets fresh data
                    feedCache.clear();
                })
                .catch(err => console.error('Background source refresh failed:', err));
        } else if (freshness.stale.length > 0) {
            // No existing content (first-ever visit) — must block on fetch
            const result = await ensureSourcesFresh(targetSources, targetSourceIds, timeRange);
            failures = result.failures;
        }

        // 3. Use existing items or re-query if we did a blocking fetch
        const allItems = (freshness.stale.length > 0 && existingItems.length === 0)
            ? await getCachedContentBySourceIds(targetSourceIds, timeRange)
            : existingItems;

        // Get velocities for Hot/Rising modes
        const velocities = (feedMode === 'hot' || feedMode === 'rising')
            ? await getBulkVelocities(allItems.map(i => i.id))
            : new Map<string, number>();

        // Score and sort based on feed mode
        const scoredItems = scoreItemsByFeedMode(allItems, velocities, feedMode);

        const response = {
            success: true,
            count: scoredItems.length,
            items: scoredItems,
            fetchedAt: new Date().toISOString(),
            cached: freshness.stale.length === 0,
            staleRefreshing,
            mode: feedMode,
            failures: failures.length > 0 ? failures : undefined,
        };

        // Store in memory cache (skip if background refresh is in progress)
        if (!staleRefreshing) {
            feedCache.set(memoryCacheKey, response);
        }

        return NextResponse.json(response);
    } catch (error) {
        console.error('Feed API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch feed',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
