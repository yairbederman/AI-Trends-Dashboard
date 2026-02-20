import { NextResponse, after } from 'next/server';
import { TimeRange, FeedMode } from '@/types';
import {
    getSetting,
    updateSetting,
    cleanOldContent,
    getCachedContentBySourceIds,
    getSourceFreshness,
} from '@/lib/db/actions';
import { getEffectiveConfig, getEffectiveSourceList } from '@/lib/config/resolve';
import { scoreItemsByFeedMode, normalizeCrossCategory } from '@/lib/scoring';
import { getBulkVelocities, cleanupOldSnapshots } from '@/lib/db/engagement-tracker';
import { SOURCES } from '@/lib/config/sources';
import { feedCache } from '@/lib/cache/memory-cache';
import { ensureSourcesFresh } from '@/lib/fetching/ensure-fresh';
import { startRefreshSession } from '@/lib/fetching/refresh-progress';
import { db } from '@/lib/db';
import { settings, contentItems } from '@/lib/db/schema';
import { sql, inArray } from 'drizzle-orm';

// Run cleanup once per day max
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Module-level lock: prevent duplicate background refreshes for the same source set
const activeRefreshKeys = new Set<string>();

async function maybeRunCleanup() {
    try {
        const lastCleanup = await getSetting<string>('lastCleanupTime', '');
        const lastTime = lastCleanup ? new Date(lastCleanup).getTime() : 0;

        if (Date.now() - lastTime > CLEANUP_INTERVAL_MS) {
            const [contentDeleted, snapshotsDeleted] = await Promise.all([
                cleanOldContent(7),        // Keep 7 days of content
                cleanupOldSnapshots(7),    // Keep 7 days of snapshots
                // Clean up stale feed_cache_* entries from settings table
                db.delete(settings).where(sql`${settings.key} LIKE 'feed_cache_%'`),
            ]);
            console.log(`Cleanup: removed ${contentDeleted} old items, ${snapshotsDeleted} old snapshots, cleaned feed_cache_* settings`);
            await updateSetting('lastCleanupTime', new Date().toISOString());
        }
    } catch (error) {
        console.error('Cleanup failed:', error);
    }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(request: Request) {
    // Trigger cleanup if needed (runs after response via after())
    after(() => maybeRunCleanup());

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
        const t0 = Date.now();
        console.log(`[FEED] Request: timeRange=${queryTimeRange} mode=${rawMode} category=${category} source=${sourceId}`);
        console.log(`[FEED] DATABASE_URL set: ${!!process.env.DATABASE_URL}`);

        // Fetch config and source list in parallel
        const [config, sourceList] = await Promise.all([
            getEffectiveConfig(),
            getEffectiveSourceList(),
        ]);
        const timeRange = queryTimeRange || config.timeRange;
        console.log(`[FEED TIMING] config+sourceList: ${Date.now() - t0}ms | enabledSources=${sourceList.enabled.length} configuredTimeRange=${config.timeRange} effectiveTimeRange=${timeRange}`);

        // 1. Determine target source IDs (including custom sources)
        let targetSources = sourceList.enabled;

        if (category) {
            targetSources = targetSources.filter((s) => s.category === category);
        }

        if (sourceId) {
            targetSources = targetSources.filter((s) => s.id === sourceId);
        }

        const targetSourceIds = targetSources.map(s => s.id);
        console.log(`[FEED] Target sources: ${targetSourceIds.length} (after filters: category=${category}, source=${sourceId})`);

        // Guard: no matching sources → return empty result (avoids SQL crash with empty inArray)
        if (targetSourceIds.length === 0) {
            console.warn(`[FEED] No matching sources — returning empty. Total enabled: ${sourceList.enabled.length}, categories: ${sourceList.activeCategories.join(',')}`);
            return NextResponse.json({
                success: true,
                count: 0,
                items: [],
                fetchedAt: new Date().toISOString(),
                cached: true,
                mode: feedMode,
                _debug: {
                    reason: 'no_matching_sources',
                    totalEnabled: sourceList.enabled.length,
                    activeCategories: sourceList.activeCategories,
                },
            });
        }

        // Check in-memory cache first
        const memoryCacheKey = `feed:${targetSourceIds.sort().join(',')}:${timeRange}:${feedMode}`;
        const memoryCached = feedCache.get(memoryCacheKey);
        if (memoryCached) {
            return NextResponse.json(memoryCached);
        }

        // 2. Query existing DB content, check freshness, and check if ANY content exists
        //    (even outside time range) to distinguish returning users from first-ever visits
        const t1 = Date.now();
        const [existingItems, freshness, hasAnyContent] = await Promise.all([
            getCachedContentBySourceIds(targetSourceIds, timeRange, 300),
            getSourceFreshness(targetSourceIds),
            db.select({ id: contentItems.id })
                .from(contentItems)
                .where(inArray(contentItems.sourceId, targetSourceIds))
                .limit(1)
                .then(rows => rows.length > 0)
                .catch(err => {
                    console.error('hasAnyContent query failed:', err);
                    return false;
                }),
        ]);

        console.log(`[FEED TIMING] DB queries (items=${existingItems.length}, hasAny=${hasAnyContent}, stale=${freshness.stale.length}, fresh=${freshness.fresh.length}): ${Date.now() - t1}ms`);
        if (existingItems.length === 0) {
            console.warn(`[FEED] No items found in DB for timeRange=${timeRange}. hasAnyContent=${hasAnyContent}. stale=${freshness.stale.length}/${targetSourceIds.length} sources stale.`);
        }

        let staleRefreshing = false;
        let failures: { source: string; error: string }[] = [];

        // Build stale source name list for the client
        const refreshingSources = freshness.stale.length > 0
            ? targetSources
                .filter(s => freshness.stale.includes(s.id))
                .map(s => ({ id: s.id, name: s.name, icon: s.icon || '', logoUrl: s.logoUrl }))
            : [];

        if (freshness.stale.length > 0) {
            // Always non-blocking: return whatever we have now, refresh in background.
            // Uses after() so Vercel keeps the function alive until refresh completes.
            staleRefreshing = true;
            const refreshKey = targetSourceIds.sort().join(',');
            if (!activeRefreshKeys.has(refreshKey)) {
                activeRefreshKeys.add(refreshKey);
                startRefreshSession(refreshingSources);
                after(async () => {
                    try {
                        await ensureSourcesFresh(targetSources, targetSourceIds, timeRange);
                        feedCache.clear();
                    } catch (err) {
                        console.error('Background source refresh failed:', err);
                    } finally {
                        activeRefreshKeys.delete(refreshKey);
                    }
                });
            }
        }

        // 3. Use existing items (background refresh will populate new ones)
        const allItems = existingItems;

        // Get velocities for Hot/Rising modes (with 3s timeout to avoid serverless 504)
        const t3 = Date.now();
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
                console.warn('Velocity query timed out, falling back to engagement scoring');
            }
        }
        console.log(`[FEED TIMING] velocities: ${Date.now() - t3}ms`);

        // Score and sort based on feed mode
        const rawScoredItems = scoreItemsByFeedMode(allItems, velocities, feedMode);

        // Normalize scores across categories to reduce dev-platforms dominance
        const sourceToCategoryMap: Record<string, string> = {};
        for (const s of SOURCES) { sourceToCategoryMap[s.id] = s.category; }
        const scoredItems = normalizeCrossCategory(rawScoredItems, sourceToCategoryMap);

        const response: Record<string, unknown> = {
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

        // Include debug info when no items are returned to help diagnose issues
        if (scoredItems.length === 0) {
            response._debug = {
                reason: 'no_items_after_scoring',
                targetSourceCount: targetSourceIds.length,
                dbItemCount: existingItems.length,
                hasAnyContentInDb: hasAnyContent,
                staleSourceCount: freshness.stale.length,
                freshSourceCount: freshness.fresh.length,
                timeRange,
                backgroundRefreshTriggered: staleRefreshing,
            };
        }

        // Only cache non-empty results. When items is empty AND a background refresh
        // was triggered, caching would lock out fresh data for the entire TTL.
        if (scoredItems.length > 0) {
            feedCache.set(memoryCacheKey, response);
        } else {
            console.warn(`[FEED] Skipping cache — empty result with staleRefreshing=${staleRefreshing}`);
        }
        console.log(`[FEED TIMING] total: ${Date.now() - t0}ms | items=${scoredItems.length} stale=${freshness.stale.length} swr=${staleRefreshing}`);

        // Don't let CDN cache empty responses — the background refresh will populate data soon.
        const cacheHeader = scoredItems.length > 0
            ? 'public, s-maxage=120, stale-while-revalidate=60'
            : 'no-store';

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': cacheHeader,
            },
        });
    } catch (error) {
        console.error('Feed API error:', error);
        console.error('Feed API error stack:', error instanceof Error ? error.stack : 'no stack');
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to fetch feed',
                details: error instanceof Error ? error.message : 'Unknown error',
                _debug: {
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    stack: process.env.NODE_ENV !== 'production'
                        ? (error instanceof Error ? error.stack : undefined)
                        : undefined,
                    databaseUrlSet: !!process.env.DATABASE_URL,
                },
            },
            { status: 500 }
        );
    }
}
