import { createAdapter } from '@/lib/adapters';
import { deduplicateItems } from '@/lib/adapters/base';
import { ContentItem, SourceConfig, TimeRange, SourceHealthRecord } from '@/types';
import {
    cacheContent,
    getSourceFreshness,
    updateSourceLastFetched,
    getSourceHealth,
    updateSourceHealth,
} from '@/lib/db/actions';
import {
    markSourceFetching,
    markSourceDone,
    markSourceFailed,
    endRefreshSession,
} from './refresh-progress';

export interface FreshnessResult {
    staleCount: number;
    freshCount: number;
    failures: { source: string; error: string }[];
}

/**
 * Ensure sources are fresh: check staleness, fetch stale sources,
 * cache results, and update health records.
 *
 * Shared by /api/feed and /api/discovery/items.
 */
export async function ensureSourcesFresh(
    targetSources: SourceConfig[],
    targetSourceIds: string[],
    timeRange: TimeRange
): Promise<FreshnessResult> {
    const { stale, fresh } = await getSourceFreshness(targetSourceIds);
    const failures: { source: string; error: string }[] = [];

    if (stale.length === 0) {
        return { staleCount: 0, freshCount: fresh.length, failures };
    }

    console.log(`Selective fetch: ${stale.length} stale, ${fresh.length} fresh of ${targetSourceIds.length} total`);

    const staleSources = targetSources.filter(s => stale.includes(s.id));
    const adapterPairs = staleSources
        .map(source => ({ source, adapter: createAdapter(source) }))
        .filter(
            (pair): pair is { source: typeof pair.source; adapter: NonNullable<typeof pair.adapter> } =>
                pair.adapter !== null
        );

    // Fetch stale sources in parallel with 10s timeout per adapter
    const results = await Promise.allSettled(
        adapterPairs.map(({ source, adapter }) => {
            markSourceFetching(source.id);
            return Promise.race([
                adapter.fetch({ timeRange }),
                new Promise<ContentItem[]>((_, reject) =>
                    setTimeout(() => reject(new Error('Adapter timeout')), 10000)
                ),
            ]).then(items => {
                markSourceDone(source.id);
                return items;
            }, err => {
                markSourceFailed(source.id);
                throw err;
            });
        })
    );

    const newItems: ContentItem[] = [];
    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            newItems.push(...result.value);
        } else {
            failures.push({
                source: adapterPairs[index].source.name,
                error: result.reason?.message || 'Unknown error',
            });
            console.error(`Adapter ${adapterPairs[index].source.name} failed:`, result.reason);
        }
    });

    // Cache new items + update lastFetchedAt
    const uniqueNewItems = deduplicateItems(newItems);
    await cacheContent(uniqueNewItems);

    const successfulSourceIds = adapterPairs
        .filter((_, i) => results[i].status === 'fulfilled')
        .map(p => p.source.id);
    if (successfulSourceIds.length > 0) {
        await updateSourceLastFetched(successfulSourceIds);
    }

    // End progress tracking — all fetches complete
    endRefreshSession();

    // Record source health (fire-and-forget)
    getSourceHealth()
        .then(currentHealth => {
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
        })
        .catch(err => console.error('Failed to update source health:', err));

    return { staleCount: stale.length, freshCount: fresh.length, failures };
}
