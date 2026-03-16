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

    // Per-adapter timeout: reddit-custom gets 20s (fetches 12+ subreddits),
    // hackernews gets 15s (og:description fetches), others get 10s.
    function getAdapterTimeout(sourceId: string): number {
        if (sourceId === 'reddit-custom') return 20000;
        if (sourceId === 'hackernews') return 15000;
        return 10000;
    }

    // Fetch stale sources in parallel with per-adapter timeout
    const results = await Promise.allSettled(
        adapterPairs.map(({ source, adapter }) => {
            markSourceFetching(source.id);
            return Promise.race([
                adapter.fetch({ timeRange }),
                new Promise<ContentItem[]>((_, reject) =>
                    setTimeout(() => reject(new Error('Adapter timeout')), getAdapterTimeout(source.id))
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

    // Ensure source rows exist BEFORE caching content items.
    // content_items.source_id has a FK reference to sources(id). If a source was
    // added to config but never inserted into the sources table (e.g. migration
    // not applied), the entire insert chunk fails. Creating the rows first avoids this.
    //
    // Only mark sources as "fetched" if they returned items. Sources that resolve
    // with 0 items are left stale so they get retried on the next request — this
    // prevents silent failure loops where a blocked API returns [] indefinitely.
    const successfulSourceIds = adapterPairs
        .filter((_, i) => results[i].status === 'fulfilled' && results[i].value.length > 0)
        .map(p => p.source.id);
    const emptySourceIds = adapterPairs
        .filter((_, i) => results[i].status === 'fulfilled' && results[i].value.length === 0)
        .map(p => p.source.id);
    if (emptySourceIds.length > 0) {
        console.warn(`Sources returned 0 items (not marking fresh): ${emptySourceIds.join(', ')}`);
    }
    if (successfulSourceIds.length > 0) {
        await updateSourceLastFetched(successfulSourceIds);
    }

    // Cache new items (source rows now guaranteed to exist)
    const uniqueNewItems = deduplicateItems(newItems);
    await cacheContent(uniqueNewItems);

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
                    // 0 items returned — fetch succeeded but no data came back.
                    // Treat as a soft failure: increment consecutiveFailures so
                    // the health indicator surfaces the problem to the user.
                    currentHealth[sourceId] = {
                        lastFetchAt: now,
                        lastSuccessAt: prev.lastSuccessAt,
                        lastItemCount: 0,
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
