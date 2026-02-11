import { NextResponse } from 'next/server';
import { getEnabledSourcesFiltered } from '@/lib/config/sources';
import { createAdapter } from '@/lib/adapters';
import { deduplicateItems } from '@/lib/adapters/base';
import { ContentItem, TimeRange, FeedMode } from '@/types';
import {
    getEnabledSourceIds,
    getSetting,
    updateSetting,
    cacheContent,
    cleanOldContent,
    getSourceFreshness,
    updateSourceLastFetched,
    getCachedContentBySourceIds,
    getCustomSources,
    getSourceHealth,
    updateSourceHealth,
} from '@/lib/db/actions';
import { SourceHealthRecord } from '@/types';
import { scoreItemsByFeedMode } from '@/lib/scoring';
import { getBulkVelocities, cleanupOldSnapshots } from '@/lib/db/engagement-tracker';
import { feedCache } from '@/lib/cache/memory-cache';
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

interface AdapterFailure {
    source: string;
    error: string;
}

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

        // 2. Check per-source freshness
        const { stale, fresh } = await getSourceFreshness(targetSourceIds);

        let failures: AdapterFailure[] = [];

        // 3. Fetch only stale sources
        if (stale.length > 0) {
            console.log(`Selective fetch: ${stale.length} stale, ${fresh.length} fresh of ${targetSourceIds.length} total`);

            const staleSources = targetSources.filter(s => stale.includes(s.id));
            const adapterPairs = staleSources
                .map((source) => ({ source, adapter: createAdapter(source) }))
                .filter((pair): pair is { source: typeof pair.source; adapter: NonNullable<typeof pair.adapter> } => pair.adapter !== null);

            // 4. Fetch stale sources in parallel with 10s timeout per adapter
            const results = await Promise.allSettled(
                adapterPairs.map(({ adapter }) =>
                    Promise.race([
                        adapter.fetch({ timeRange }),
                        new Promise<ContentItem[]>((_, reject) =>
                            setTimeout(() => reject(new Error('Adapter timeout')), 10000)
                        )
                    ])
                )
            );

            const newItems: ContentItem[] = [];

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    newItems.push(...result.value);
                } else {
                    const failure = {
                        source: adapterPairs[index].source.name,
                        error: result.reason?.message || 'Unknown error',
                    };
                    failures.push(failure);
                    console.error(`Adapter ${failure.source} failed:`, result.reason);
                }
            });

            // 5. Cache new items + update lastFetchedAt
            const uniqueNewItems = deduplicateItems(newItems);
            await cacheContent(uniqueNewItems);

            // Update lastFetchedAt for successfully fetched sources
            const successfulSourceIds = adapterPairs
                .filter((_, i) => results[i].status === 'fulfilled')
                .map(p => p.source.id);
            if (successfulSourceIds.length > 0) {
                await updateSourceLastFetched(successfulSourceIds);
            }

            // Record source health (fire-and-forget)
            getSourceHealth().then(currentHealth => {
                const now = new Date().toISOString();

                results.forEach((result, index) => {
                    const sourceId = adapterPairs[index].source.id;
                    const prev = currentHealth[sourceId] || {
                        lastFetchAt: now,
                        lastSuccessAt: null,
                        lastItemCount: 0,
                        consecutiveFailures: 0,
                        lastError: null,
                    } satisfies SourceHealthRecord;

                    if (result.status === 'fulfilled' && result.value.length > 0) {
                        currentHealth[sourceId] = {
                            lastFetchAt: now,
                            lastSuccessAt: now,
                            lastItemCount: result.value.length,
                            consecutiveFailures: 0,
                            lastError: null,
                        };
                    } else if (result.status === 'fulfilled') {
                        currentHealth[sourceId] = {
                            lastFetchAt: now,
                            lastSuccessAt: prev.lastSuccessAt,
                            lastItemCount: prev.lastItemCount,
                            consecutiveFailures: prev.consecutiveFailures + 1,
                            lastError: 'Returned 0 items',
                        };
                    } else {
                        currentHealth[sourceId] = {
                            lastFetchAt: now,
                            lastSuccessAt: prev.lastSuccessAt,
                            lastItemCount: prev.lastItemCount,
                            consecutiveFailures: prev.consecutiveFailures + 1,
                            lastError: result.reason?.message || 'Unknown error',
                        };
                    }
                });

                // Warn about persistently failing sources
                for (const [id, health] of Object.entries(currentHealth)) {
                    if (health.consecutiveFailures >= 3) {
                        console.warn(`Source ${id} has ${health.consecutiveFailures} consecutive failures: ${health.lastError}`);
                    }
                }

                return updateSourceHealth(currentHealth);
            }).catch(err => console.error('Failed to update source health:', err));
        }

        // 6. Query ALL items from DB (fresh cached + newly cached)
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
            cached: stale.length === 0,
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
