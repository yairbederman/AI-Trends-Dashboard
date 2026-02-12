import { NextResponse } from 'next/server';
import { getEnabledSourcesFiltered } from '@/lib/config/sources';
import { TimeRange, FeedMode } from '@/types';
import {
    getEnabledSourceIds,
    getSetting,
    updateSetting,
    cleanOldContent,
    getCachedContentBySourceIds,
    getCustomSources,
} from '@/lib/db/actions';
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
        // Get user's time range setting from DB, with query param override
        const dbTimeRange = await getSetting<TimeRange>('timeRange', '24h');
        const timeRange = queryTimeRange || dbTimeRange;

        // 1. Determine target source IDs (including custom sources)
        const enabledSourceIds = await getEnabledSourceIds();
        const customSources = await getCustomSources();
        let targetSources = getEnabledSourcesFiltered(enabledSourceIds, customSources);

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

        // 2. Ensure data freshness (fetch stale sources, cache results, update health)
        const { staleCount, failures } = await ensureSourcesFresh(targetSources, targetSourceIds, timeRange);

        // 3. Query ALL items from DB (fresh cached + newly cached)
        const allItems = await getCachedContentBySourceIds(targetSourceIds, timeRange);

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
            cached: staleCount === 0,
            mode: feedMode,
            failures: failures.length > 0 ? failures : undefined,
        };

        // Store in memory cache
        feedCache.set(memoryCacheKey, response);

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
