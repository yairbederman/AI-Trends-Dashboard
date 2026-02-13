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
import { startRefreshSession } from '@/lib/fetching/refresh-progress';
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
            }).catch(err => console.error('Cleanup failed:', err));
            await updateSetting('lastCleanupTime', new Date().toISOString());
        }
    } catch (error) {
        console.error('Cleanup check failed:', error);
    }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: Request) {
    // Trigger cleanup if needed (runs in background, once per day)
    maybeRunCleanup();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sourceId = searchParams.get('source');
    const queryTimeRange = searchParams.get('timeRange') as TimeRange | null;
    const rawMode = searchParams.get('mode');

    // Validate timeRange parameter
    const VALID_TIME_RANGES: TimeRange[] = ['1h', '12h', '24h', '48h', '7d'];
    if (queryTimeRange && !VALID_TIME_RANGES.includes(queryTimeRange)) {
        return NextResponse.json(
            { success: false, error: `Invalid timeRange: ${queryTimeRange}`, validValues: VALID_TIME_RANGES },
            { status: 400 }
        );
    }

    // Validate mode parameter
    const VALID_FEED_MODES: FeedMode[] = ['hot', 'rising', 'top'];
    if (rawMode && !VALID_FEED_MODES.includes(rawMode as FeedMode)) {
        return NextResponse.json(
            { success: false, error: `Invalid mode: ${rawMode}`, validValues: VALID_FEED_MODES },
            { status: 400 }
        );
    }
    const feedMode: FeedMode = (rawMode as FeedMode) || 'hot';

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

        // Guard: no matching sources → return empty result (avoids SQL crash with empty inArray)
        if (targetSourceIds.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                items: [],
                fetchedAt: new Date().toISOString(),
                cached: true,
                mode: feedMode,
            });
        }

        // Check in-memory cache first
        const memoryCacheKey = `feed:${targetSourceIds.sort().join(',')}:${timeRange}:${feedMode}`;
        const memoryCached = feedCache.get(memoryCacheKey);
        if (memoryCached) {
            return NextResponse.json(memoryCached);
        }

        // 2. Query existing DB content and check freshness
        //    Limit to 300 items (plenty for dashboard display) to keep queries fast on serverless
        const [existingItems, freshness] = await Promise.all([
            getCachedContentBySourceIds(targetSourceIds, timeRange, 300),
            getSourceFreshness(targetSourceIds),
        ]);
        const hasAnyContent = existingItems.length > 0;

        let staleRefreshing = false;
        let failures: { source: string; error: string }[] = [];

        // Build stale source name list for the client
        const refreshingSources = freshness.stale.length > 0
            ? targetSources
                .filter(s => freshness.stale.includes(s.id))
                .map(s => ({ id: s.id, name: s.name, icon: s.icon || '' }))
            : [];

        if (freshness.stale.length > 0 && hasAnyContent) {
            // Stale-while-revalidate: return existing data now, refresh in background
            staleRefreshing = true;
            // Start session SYNCHRONOUSLY so it exists before client polls
            startRefreshSession(refreshingSources);
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

        // 3. Use existing items, or re-query after a blocking fetch (not SWR)
        const allItems = (!staleRefreshing && freshness.stale.length > 0 && existingItems.length === 0)
            ? await getCachedContentBySourceIds(targetSourceIds, timeRange, 300)
            : existingItems;

        // Get velocities for Hot/Rising modes (with 3s timeout to avoid serverless 504)
        let velocities = new Map<string, number>();
        if (feedMode === 'hot' || feedMode === 'rising') {
            try {
                velocities = await Promise.race([
                    getBulkVelocities(allItems.map(i => i.id)),
                    new Promise<Map<string, number>>((_, reject) =>
                        setTimeout(() => reject(new Error('Velocity query timeout')), 3000)
                    ),
                ]);
            } catch {
                // Timeout or error — fall back to engagement-only scoring
                console.warn('Velocity query timed out, falling back to engagement scoring');
            }
        }

        // Score and sort based on feed mode
        const scoredItems = scoreItemsByFeedMode(allItems, velocities, feedMode);

        const response = {
            success: true,
            count: scoredItems.length,
            items: scoredItems,
            fetchedAt: new Date().toISOString(),
            cached: freshness.stale.length === 0,
            staleRefreshing,
            refreshingSources: staleRefreshing ? refreshingSources : undefined,
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
