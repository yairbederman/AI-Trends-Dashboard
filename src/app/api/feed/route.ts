import { NextResponse } from 'next/server';
import { getEnabledSourcesFiltered } from '@/lib/config/sources';
import { createAdapter } from '@/lib/adapters';
import { deduplicateItems } from '@/lib/adapters/base';
import { ContentItem, TimeRange, FeedMode } from '@/types';
import {
    getEnabledSourceIds,
    getSetting,
    updateSetting,
    getCachedContent,
    cacheContent,
    cleanOldContent,
    getAllSourcePriorities,
    getBoostKeywords,
} from '@/lib/db/actions';
import { scoreAndSortItems, scoreItemsByFeedMode, ScoringConfig } from '@/lib/scoring';
import { getBulkVelocities, cleanupOldSnapshots } from '@/lib/db/engagement-tracker';

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
            ]).then(([contentDeleted, snapshotsDeleted]) => {
                console.log(`Cleanup: removed ${contentDeleted} old items, ${snapshotsDeleted} old snapshots`);
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

        // Get enabled sources from database
        const enabledSourceIds = await getEnabledSourceIds();
        let sources = getEnabledSourcesFiltered(enabledSourceIds);

        if (category) {
            sources = sources.filter((s) => s.category === category);
        }

        if (sourceId) {
            sources = sources.filter((s) => s.id === sourceId);
        }

        const sourceIds = sources.map(s => s.id);

        // Check cache first
        const cached = await getCachedContent(sourceIds, timeRange);
        if (cached && !cached.isStale) {
            // Get velocities for Hot/Rising modes
            const velocities = (feedMode === 'hot' || feedMode === 'rising')
                ? await getBulkVelocities(cached.items.map(i => i.id))
                : new Map<string, number>();

            // Score and sort based on feed mode
            const scoredItems = scoreItemsByFeedMode(cached.items, velocities, feedMode);

            return NextResponse.json({
                success: true,
                count: scoredItems.length,
                items: scoredItems,
                fetchedAt: cached.fetchedAt.toISOString(),
                cached: true,
                mode: feedMode,
            });
        }

        // Create adapters for each source
        const adapters = sources
            .map((source) => createAdapter(source))
            .filter((adapter) => adapter !== null);

        // Fetch content from all adapters in parallel
        const results = await Promise.allSettled(
            adapters.map((adapter) => adapter.fetch({ timeRange }))
        );

        // Combine all successful results and track failures
        const allItems: ContentItem[] = [];
        const failures: AdapterFailure[] = [];

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                allItems.push(...result.value);
            } else {
                const failure = {
                    source: adapters[index].source.name,
                    error: result.reason?.message || 'Unknown error',
                };
                failures.push(failure);
                console.error(`Adapter ${failure.source} failed:`, result.reason);
            }
        });

        // Deduplicate items
        const uniqueItems = deduplicateItems(allItems);

        // Cache the results first (before scoring, as base items)
        await cacheContent(uniqueItems, sourceIds, timeRange);

        // Get velocities for Hot/Rising modes
        const velocities = (feedMode === 'hot' || feedMode === 'rising')
            ? await getBulkVelocities(uniqueItems.map(i => i.id))
            : new Map<string, number>();

        // Score and sort based on feed mode
        const scoredItems = scoreItemsByFeedMode(uniqueItems, velocities, feedMode);

        return NextResponse.json({
            success: true,
            count: scoredItems.length,
            items: scoredItems,
            fetchedAt: new Date().toISOString(),
            cached: false,
            mode: feedMode,
            failures: failures.length > 0 ? failures : undefined,
        });
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
