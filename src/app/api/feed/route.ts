import { NextResponse } from 'next/server';
import { getEnabledSourcesFiltered } from '@/lib/config/sources';
import { createAdapter } from '@/lib/adapters';
import { deduplicateItems } from '@/lib/adapters/base';
import { ContentItem, TimeRange } from '@/types';
import {
    getEnabledSourceIds,
    getSetting,
    getCachedContent,
    cacheContent,
    getAllSourcePriorities,
    getBoostKeywords,
} from '@/lib/db/actions';
import { scoreAndSortItems, ScoringConfig } from '@/lib/scoring';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AdapterFailure {
    source: string;
    error: string;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const sourceId = searchParams.get('source');
    const queryTimeRange = searchParams.get('timeRange') as TimeRange | null;
    const forceRefresh = searchParams.get('refresh') === 'true';

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

        // Check cache first (unless force refresh)
        if (!forceRefresh) {
            const cached = await getCachedContent(sourceIds, timeRange);
            if (cached && !cached.isStale) {
                return NextResponse.json({
                    success: true,
                    count: cached.items.length,
                    items: cached.items,
                    fetchedAt: cached.fetchedAt.toISOString(),
                    cached: true,
                });
            }
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

        // Get scoring configuration
        const priorities = await getAllSourcePriorities();
        const boostKeywords = await getBoostKeywords();

        const scoringConfig: ScoringConfig = {
            priorities,
            boostKeywords,
        };

        // Score and sort items by trending score
        const scoredItems = scoreAndSortItems(uniqueItems, scoringConfig);

        // Cache the results
        await cacheContent(scoredItems, sourceIds, timeRange);

        return NextResponse.json({
            success: true,
            count: scoredItems.length,
            items: scoredItems,
            fetchedAt: new Date().toISOString(),
            cached: false,
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
