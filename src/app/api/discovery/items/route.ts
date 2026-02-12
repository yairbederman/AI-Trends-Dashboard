import { NextResponse } from 'next/server';
import { getEnabledSourcesFiltered, getSourceById, SOURCES } from '@/lib/config/sources';
import { createAdapter } from '@/lib/adapters';
import { deduplicateItems } from '@/lib/adapters/base';
import { ContentItem, TimeRange, SourceCategory, SourceConfig } from '@/types';
import {
    getEnabledSourceIds,
    cacheContent,
    getSourceFreshness,
    updateSourceLastFetched,
    getCachedContentBySourceIds,
    getCustomSources,
    getSourceHealth,
    updateSourceHealth,
    getAllSourcePriorities,
    getBoostKeywords,
} from '@/lib/db/actions';
import { SourceHealthRecord } from '@/types';
import { scoreAndSortItems } from '@/lib/scoring';
import { feedCache } from '@/lib/cache/memory-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Valid API category names (superset of internal SourceCategory)
const VALID_API_CATEGORIES = [
    'news',
    'newsletters',
    'social-blogs',
    'ai-labs',
    'dev-platforms',
    'community',
    'leaderboards',
] as const;
type ApiCategory = (typeof VALID_API_CATEGORIES)[number];

const VALID_TIME_RANGES = ['1h', '12h', '24h', '48h', '7d'] as const;

// Map API category name → internal SourceCategory
function apiCategoryToInternal(apiCat: ApiCategory): SourceCategory {
    if (apiCat === 'social-blogs') return 'social';
    return apiCat as SourceCategory;
}

// Map internal SourceCategory → API category name
function internalCategoryToApi(cat: SourceCategory): ApiCategory {
    if (cat === 'social') return 'social-blogs';
    return cat as ApiCategory;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const categoriesParam = searchParams.get('categories');
    const timeRangeParam = searchParams.get('timeRange');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    // 1. Validate required params
    if (!categoriesParam) {
        return NextResponse.json(
            {
                error: 'Missing required parameter: categories',
                validValues: [...VALID_API_CATEGORIES],
            },
            { status: 400 }
        );
    }

    if (!timeRangeParam) {
        return NextResponse.json(
            {
                error: 'Missing required parameter: timeRange',
                validValues: [...VALID_TIME_RANGES],
            },
            { status: 400 }
        );
    }

    // Validate categories
    const requestedCategories = categoriesParam.split(',').map(c => c.trim());
    const invalidCategories = requestedCategories.filter(
        c => !(VALID_API_CATEGORIES as readonly string[]).includes(c)
    );
    if (invalidCategories.length > 0) {
        return NextResponse.json(
            {
                error: `Invalid categories: ${invalidCategories.join(', ')}`,
                validValues: [...VALID_API_CATEGORIES],
            },
            { status: 400 }
        );
    }

    // Validate timeRange
    if (!(VALID_TIME_RANGES as readonly string[]).includes(timeRangeParam)) {
        return NextResponse.json(
            {
                error: `Invalid timeRange: ${timeRangeParam}`,
                validValues: [...VALID_TIME_RANGES],
            },
            { status: 400 }
        );
    }

    const timeRange = timeRangeParam as TimeRange;
    const limit = Math.max(1, parseInt(limitParam || '100', 10) || 100);
    const offset = Math.max(0, parseInt(offsetParam || '0', 10) || 0);

    // Convert API categories to internal categories
    const internalCategories = new Set(
        requestedCategories.map(c => apiCategoryToInternal(c as ApiCategory))
    );

    try {
        // 2. Resolve sources per category
        const enabledSourceIds = await getEnabledSourceIds();
        const customSources = await getCustomSources();
        const allEnabledSources = getEnabledSourcesFiltered(enabledSourceIds, customSources);

        const targetSources = allEnabledSources.filter(s =>
            internalCategories.has(s.category)
        );
        const targetSourceIds = targetSources.map(s => s.id);

        if (targetSourceIds.length === 0) {
            return NextResponse.json({
                meta: {
                    totalItems: 0,
                    returnedItems: 0,
                    offset,
                    limit,
                    timeRange,
                    categories: Object.fromEntries(
                        requestedCategories.map(c => [c, 0])
                    ),
                },
                items: [],
            });
        }

        // Check in-memory cache
        const memoryCacheKey = `discovery:${targetSourceIds.sort().join(',')}:${timeRange}`;
        const memoryCached = feedCache.get(memoryCacheKey);
        if (memoryCached) {
            const cached = memoryCached as { scoredItems: ContentItem[]; sourceMap: Record<string, SourceConfig> };
            return buildResponse(
                cached.scoredItems,
                cached.sourceMap,
                requestedCategories,
                offset,
                limit,
                timeRange
            );
        }

        // 3. Ensure data freshness
        const { stale } = await getSourceFreshness(targetSourceIds);

        if (stale.length > 0) {
            const staleSources = targetSources.filter(s => stale.includes(s.id));
            const adapterPairs = staleSources
                .map(source => ({ source, adapter: createAdapter(source) }))
                .filter(
                    (pair): pair is { source: typeof pair.source; adapter: NonNullable<typeof pair.adapter> } =>
                        pair.adapter !== null
                );

            const results = await Promise.allSettled(
                adapterPairs.map(({ adapter }) =>
                    Promise.race([
                        adapter.fetch({ timeRange }),
                        new Promise<ContentItem[]>((_, reject) =>
                            setTimeout(() => reject(new Error('Adapter timeout')), 10000)
                        ),
                    ])
                )
            );

            const newItems: ContentItem[] = [];
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    newItems.push(...result.value);
                } else {
                    console.error(
                        `Discovery: adapter ${adapterPairs[index].source.name} failed:`,
                        result.reason
                    );
                }
            });

            const uniqueNewItems = deduplicateItems(newItems);
            await cacheContent(uniqueNewItems);

            const successfulSourceIds = adapterPairs
                .filter((_, i) => results[i].status === 'fulfilled')
                .map(p => p.source.id);
            if (successfulSourceIds.length > 0) {
                await updateSourceLastFetched(successfulSourceIds);
            }

            // Record source health (fire-and-forget)
            getSourceHealth()
                .then(currentHealth => {
                    const now = new Date().toISOString();
                    results.forEach((result, index) => {
                        const sid = adapterPairs[index].source.id;
                        const prev = currentHealth[sid] || {
                            lastFetchAt: now,
                            lastSuccessAt: null,
                            lastItemCount: 0,
                            consecutiveFailures: 0,
                            lastError: null,
                        } satisfies SourceHealthRecord;

                        if (result.status === 'fulfilled' && result.value.length > 0) {
                            currentHealth[sid] = {
                                lastFetchAt: now,
                                lastSuccessAt: now,
                                lastItemCount: result.value.length,
                                consecutiveFailures: 0,
                                lastError: null,
                            };
                        } else if (result.status === 'fulfilled') {
                            currentHealth[sid] = {
                                lastFetchAt: now,
                                lastSuccessAt: prev.lastSuccessAt,
                                lastItemCount: prev.lastItemCount,
                                consecutiveFailures: prev.consecutiveFailures + 1,
                                lastError: 'Returned 0 items',
                            };
                        } else {
                            currentHealth[sid] = {
                                lastFetchAt: now,
                                lastSuccessAt: prev.lastSuccessAt,
                                lastItemCount: prev.lastItemCount,
                                consecutiveFailures: prev.consecutiveFailures + 1,
                                lastError: result.reason?.message || 'Unknown error',
                            };
                        }
                    });
                    return updateSourceHealth(currentHealth);
                })
                .catch(err => console.error('Failed to update source health:', err));
        }

        // 4. Query & score items
        const allItems = await getCachedContentBySourceIds(targetSourceIds, timeRange);

        const [priorities, boostKeywords] = await Promise.all([
            getAllSourcePriorities(),
            getBoostKeywords(),
        ]);

        const scoredItems = scoreAndSortItems(allItems, {
            priorities,
            boostKeywords,
        });

        // Build source lookup map for response mapping
        const sourceMap: Record<string, SourceConfig> = {};
        for (const s of targetSources) {
            sourceMap[s.id] = s;
        }
        // Also include sources from SOURCES that might appear in cached items
        for (const item of scoredItems) {
            if (!sourceMap[item.sourceId]) {
                const cfg = getSourceById(item.sourceId);
                if (cfg) sourceMap[item.sourceId] = cfg;
            }
        }

        // Cache scored items for subsequent paginated requests
        feedCache.set(memoryCacheKey, { scoredItems, sourceMap });

        return buildResponse(scoredItems, sourceMap, requestedCategories, offset, limit, timeRange);
    } catch (error) {
        console.error('Discovery API error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

function buildResponse(
    scoredItems: ContentItem[],
    sourceMap: Record<string, SourceConfig>,
    requestedCategories: string[],
    offset: number,
    limit: number,
    timeRange: string
) {
    // Count items per API category (before pagination)
    const categoryCounts: Record<string, number> = {};
    for (const cat of requestedCategories) {
        categoryCounts[cat] = 0;
    }
    for (const item of scoredItems) {
        const cfg = sourceMap[item.sourceId];
        if (cfg) {
            const apiCat = internalCategoryToApi(cfg.category);
            if (categoryCounts[apiCat] !== undefined) {
                categoryCounts[apiCat]++;
            }
        }
    }

    // Paginate
    const paginated = scoredItems.slice(offset, offset + limit);

    // Map to discovery item shape
    const items = paginated.map(item => {
        const cfg = sourceMap[item.sourceId];
        return {
            id: item.id,
            title: item.title,
            source: cfg?.name ?? item.sourceId,
            summary: item.description ?? null,
            url: item.url,
            category: cfg ? internalCategoryToApi(cfg.category) : 'news',
            tags: item.tags ?? [],
            trendingScore: item.trendingScore ?? null,
            publishedAt: new Date(item.publishedAt).toISOString(),
            addedAt: new Date(item.fetchedAt).toISOString(),
        };
    });

    return NextResponse.json({
        meta: {
            totalItems: scoredItems.length,
            returnedItems: items.length,
            offset,
            limit,
            timeRange,
            categories: categoryCounts,
        },
        items,
    });
}
