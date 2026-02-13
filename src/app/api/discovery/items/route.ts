import { NextResponse } from 'next/server';
import { checkRateLimit } from '@vercel/firewall';
import { getSourceById } from '@/lib/config/sources';
import { ContentItem, TimeRange, SourceCategory, SourceConfig } from '@/types';
import { getCachedContentBySourceIds } from '@/lib/db/actions';
import { getEffectiveConfig, getEffectiveSourceList } from '@/lib/config/resolve';
import { scoreAndSortItems } from '@/lib/scoring';
import { feedCache } from '@/lib/cache/memory-cache';
import { ensureSourcesFresh } from '@/lib/fetching/ensure-fresh';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export function OPTIONS() {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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
    // Rate limit check (requires 'discovery-items' rule in Vercel Firewall dashboard)
    try {
        const { rateLimited } = await checkRateLimit('discovery-items', { request });
        if (rateLimited) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': '60' } }
            );
        }
    } catch {
        // Firewall rule not configured yet or running locally — skip silently
    }

    const { searchParams } = new URL(request.url);
    const categoriesParam = searchParams.get('categories');
    const timeRangeParam = searchParams.get('timeRange');
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const searchQuery = searchParams.get('search')?.trim().toLowerCase() || null;

    // 1. Validate required params
    if (!categoriesParam) {
        return NextResponse.json(
            {
                error: 'Missing required parameter: categories',
                validValues: [...VALID_API_CATEGORIES],
            },
            { status: 400, headers: CORS_HEADERS }
        );
    }

    if (!timeRangeParam) {
        return NextResponse.json(
            {
                error: 'Missing required parameter: timeRange',
                validValues: [...VALID_TIME_RANGES],
            },
            { status: 400, headers: CORS_HEADERS }
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
            { status: 400, headers: CORS_HEADERS }
        );
    }

    // Validate timeRange
    if (!(VALID_TIME_RANGES as readonly string[]).includes(timeRangeParam)) {
        return NextResponse.json(
            {
                error: `Invalid timeRange: ${timeRangeParam}`,
                validValues: [...VALID_TIME_RANGES],
            },
            { status: 400, headers: CORS_HEADERS }
        );
    }

    const timeRange = timeRangeParam as TimeRange;
    const limit = Math.min(Math.max(1, parseInt(limitParam || '100', 10) || 100), 500);
    const offset = Math.max(0, parseInt(offsetParam || '0', 10) || 0);

    // Convert API categories to internal categories
    const internalCategories = new Set(
        requestedCategories.map(c => apiCategoryToInternal(c as ApiCategory))
    );

    try {
        // 2. Resolve sources per category
        const sourceList = await getEffectiveSourceList();

        const targetSources = sourceList.enabled.filter(s =>
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
            const filtered = searchQuery ? filterBySearch(cached.scoredItems, searchQuery) : cached.scoredItems;
            return buildResponse(filtered, cached.sourceMap, requestedCategories, offset, limit, timeRange);
        }

        // 3. Ensure data freshness (fetch stale sources, cache results, update health)
        await ensureSourcesFresh(targetSources, targetSourceIds, timeRange);

        // 4. Query & score items
        const allItems = await getCachedContentBySourceIds(targetSourceIds, timeRange);

        const config = await getEffectiveConfig();
        const priorities = config.priorities;
        const boostKeywords = config.boostKeywords;

        const scoredItems = scoreAndSortItems(allItems, {
            priorities,
            boostKeywords,
        });

        // Build source lookup map for response mapping
        const sourceMap: Record<string, SourceConfig> = {};
        for (const s of targetSources) {
            sourceMap[s.id] = s;
        }
        for (const item of scoredItems) {
            if (!sourceMap[item.sourceId]) {
                const cfg = getSourceById(item.sourceId);
                if (cfg) sourceMap[item.sourceId] = cfg;
            }
        }

        // Cache full scored items (search filtering applied on read)
        feedCache.set(memoryCacheKey, { scoredItems, sourceMap });

        const filtered = searchQuery ? filterBySearch(scoredItems, searchQuery) : scoredItems;
        return buildResponse(filtered, sourceMap, requestedCategories, offset, limit, timeRange);
    } catch (error) {
        console.error('Discovery API error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500, headers: CORS_HEADERS }
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

    const paginated = scoredItems.slice(offset, offset + limit);

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

    return NextResponse.json(
        {
            meta: {
                totalItems: scoredItems.length,
                returnedItems: items.length,
                offset,
                limit,
                timeRange,
                categories: categoryCounts,
            },
            items,
        },
        {
            headers: {
                ...CORS_HEADERS,
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
            },
        }
    );
}

function filterBySearch(items: ContentItem[], query: string): ContentItem[] {
    return items.filter(item => {
        const text = `${item.title} ${item.description || ''} ${item.tags?.join(' ') || ''}`.toLowerCase();
        return text.includes(query);
    });
}
