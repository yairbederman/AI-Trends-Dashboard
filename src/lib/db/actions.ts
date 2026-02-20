import { db } from './index';
import { settings, sources, contentItems } from './schema';
import { eq, inArray, gte, and, desc, sql } from 'drizzle-orm';
import { SOURCES, getSourceById } from '@/lib/config/sources';
import { ContentItem, CustomSourceConfig, TimeRange, SourceHealthMap } from '@/types';
import { YouTubeChannelConfig, DEFAULT_YOUTUBE_CHANNELS } from '@/lib/config/youtube-channels';
import { SubredditConfig, DEFAULT_SUBREDDITS } from '@/lib/config/subreddit-sources';
import { recordEngagementSnapshotsBatch } from './engagement-tracker';
import { isSourceStale, MAX_ITEMS_PER_SOURCE } from './cache-config';
import { settingsCache } from '@/lib/cache/memory-cache';
import { analyzeSentiment } from '@/lib/sentiment';

// === Settings Actions ===

export async function getSetting<T = string>(key: string, defaultValue: T): Promise<T> {
    try {
        // Check in-memory cache first
        const cacheKey = `setting:${key}`;
        const cached = settingsCache.get(cacheKey);
        if (cached !== undefined) return cached as T;

        const [result] = await db.select().from(settings).where(eq(settings.key, key));
        if (!result) return defaultValue;

        let value: T;
        try {
            value = JSON.parse(result.value) as T;
        } catch {
            value = result.value as unknown as T;
        }

        settingsCache.set(cacheKey, value);
        return value;
    } catch (error) {
        console.error(`Failed to get setting ${key}:`, error);
        return defaultValue;
    }
}

/**
 * Fetch ALL settings in a single query and populate cache.
 * Returns a Map of key → parsed value.
 * This avoids N individual queries when loading config (critical with high-latency DB).
 */
export async function getAllSettings(): Promise<Map<string, unknown>> {
    const cacheKey = 'allSettings:loaded';
    if (settingsCache.get(cacheKey)) {
        // Individual keys already cached from a previous bulk load
        return new Map(); // Callers should use getSetting() for cached values
    }

    try {
        const rows = await db.select().from(settings);
        const map = new Map<string, unknown>();

        for (const row of rows) {
            let value: unknown;
            try {
                value = JSON.parse(row.value);
            } catch {
                value = row.value;
            }
            map.set(row.key, value);
            // Populate individual caches so getSetting() hits cache
            settingsCache.set(`setting:${row.key}`, value);
        }

        settingsCache.set(cacheKey, true);
        return map;
    } catch (error) {
        console.error('Failed to bulk-load settings:', error);
        return new Map();
    }
}

export async function updateSetting(key: string, value: unknown): Promise<void> {
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        await db.insert(settings)
            .values({ key, value: stringValue })
            .onConflictDoUpdate({
                target: settings.key,
                set: { value: stringValue },
            });
        // Invalidate caches so subsequent reads get fresh data,
        // regardless of which code path called updateSetting().
        settingsCache.invalidate(`setting:${key}`);
        settingsCache.invalidate('allSettings:loaded');
        settingsCache.invalidatePattern('resolved:');
    } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
        throw error;
    }
}

// === Custom Source Actions ===

export async function getCustomSources(): Promise<CustomSourceConfig[]> {
    return getSetting<CustomSourceConfig[]>('customSources', []);
}

export async function setCustomSources(sources: CustomSourceConfig[]): Promise<void> {
    await updateSetting('customSources', sources);
}

export async function getDeletedSourceIds(): Promise<string[]> {
    return getSetting<string[]>('deletedSources', []);
}

export async function setDeletedSourceIds(ids: string[]): Promise<void> {
    await updateSetting('deletedSources', ids);
}

// === Source Actions ===

export async function getEnabledSourceIds(): Promise<string[]> {
    try {
        console.log('Fetching sources from database...');
        const dbSources = await db.select().from(sources);
        console.log('Successfully fetched sources:', dbSources.length);
        const dbSourceMap = new Map(dbSources.map(s => [s.id, s.enabled]));

        // Get custom sources and deleted source IDs
        const customSources = await getCustomSources();
        const deletedIds = await getDeletedSourceIds();
        const deletedSet = new Set(deletedIds);

        // Predefined sources: enabled per DB or default, minus deleted
        const predefinedIds = SOURCES.filter(s => {
            if (deletedSet.has(s.id)) return false;
            if (dbSourceMap.has(s.id)) {
                return dbSourceMap.get(s.id);
            }
            return s.enabled;
        }).map(s => s.id);

        // Custom sources: enabled per DB or default enabled
        const customIds = customSources
            .filter(cs => {
                if (dbSourceMap.has(cs.id)) {
                    return dbSourceMap.get(cs.id);
                }
                return true; // Custom sources enabled by default
            })
            .map(cs => cs.id);

        return [...predefinedIds, ...customIds];

    } catch (error) {
        console.error('Failed to get enabled sources - Full error:', error);
        console.error('Error details:', {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });
        return SOURCES.filter(s => s.enabled).map(s => s.id);
    }
}

/**
 * Pure computation of enabled source IDs from already-fetched data.
 * Avoids redundant DB queries when callers already have these values.
 */
export function computeEnabledSourceIds(
    dbSources: { id: string; enabled: boolean | null }[],
    customSrcs: CustomSourceConfig[],
    deletedIds: string[],
): string[] {
    const dbSourceMap = new Map(dbSources.map(s => [s.id, s.enabled]));
    const deletedSet = new Set(deletedIds);

    const predefinedIds = SOURCES.filter(s => {
        if (deletedSet.has(s.id)) return false;
        if (dbSourceMap.has(s.id)) return dbSourceMap.get(s.id);
        return s.enabled;
    }).map(s => s.id);

    const customIds = customSrcs
        .filter(cs => {
            if (dbSourceMap.has(cs.id)) return dbSourceMap.get(cs.id);
            return true;
        })
        .map(cs => cs.id);

    return [...predefinedIds, ...customIds];
}

export async function toggleSourceEnabled(sourceId: string, enabled: boolean): Promise<void> {
    try {
        const [existing] = await db.select().from(sources).where(eq(sources.id, sourceId));

        if (existing) {
            await db.update(sources).set({ enabled }).where(eq(sources.id, sourceId));
        } else {
            await db.insert(sources).values({
                id: sourceId,
                enabled: enabled,
                lastFetchedAt: new Date()
            });
        }
    } catch (error) {
        console.error(`Failed to toggle source ${sourceId}:`, error);
        throw error;
    }
}

export async function setCategoryEnabled(sourceIds: string[], enabled: boolean): Promise<void> {
    try {
        // Batch operation using SQL for better performance
        if (sourceIds.length === 0) return;

        const existingIds = await db
            .select({ id: sources.id })
            .from(sources)
            .where(inArray(sources.id, sourceIds));

        const existingIdSet = new Set(existingIds.map(s => s.id));
        const toUpdate = sourceIds.filter(id => existingIdSet.has(id));
        const toInsert = sourceIds.filter(id => !existingIdSet.has(id));

        // Batch update existing
        if (toUpdate.length > 0) {
            await db
                .update(sources)
                .set({ enabled })
                .where(inArray(sources.id, toUpdate));
        }

        // Batch insert new
        if (toInsert.length > 0) {
            await db
                .insert(sources)
                .values(toInsert.map(id => ({
                    id,
                    enabled,
                    lastFetchedAt: new Date()
                })));
        }
    } catch (error) {
        console.error('Failed to toggle category:', error);
        throw error;
    }
}

// === Content Caching Actions ===

function getTimeRangeCutoff(timeRange: TimeRange): Date {
    const now = new Date();
    const cutoff = new Date();

    switch (timeRange) {
        case '1h':
            cutoff.setHours(now.getHours() - 1);
            break;
        case '12h':
            cutoff.setHours(now.getHours() - 12);
            break;
        case '24h':
            cutoff.setHours(now.getHours() - 24);
            break;
        case '48h':
            cutoff.setHours(now.getHours() - 48);
            break;
        case '7d':
            cutoff.setDate(now.getDate() - 7);
            break;
        default:
            cutoff.setDate(now.getDate() - 7); // Default to 7 days
    }

    return cutoff;
}

// === Per-Source Freshness Tracking ===

export async function getSourceFreshness(
    sourceIds: string[]
): Promise<{ stale: string[]; fresh: string[] }> {
    if (sourceIds.length === 0) return { stale: [], fresh: [] };
    try {
        const dbSources = await db
            .select({ id: sources.id, lastFetchedAt: sources.lastFetchedAt })
            .from(sources)
            .where(inArray(sources.id, sourceIds));

        const dbMap = new Map(dbSources.map(s => [s.id, s.lastFetchedAt]));

        const stale: string[] = [];
        const fresh: string[] = [];

        for (const id of sourceIds) {
            const sourceConfig = getSourceById(id);
            if (!sourceConfig) {
                stale.push(id);
                continue;
            }

            const lastFetchedAt = dbMap.get(id) ?? null;
            if (isSourceStale(lastFetchedAt, sourceConfig.category)) {
                stale.push(id);
            } else {
                fresh.push(id);
            }
        }

        return { stale, fresh };
    } catch (error) {
        console.error('Failed to get source freshness:', error);
        return { stale: sourceIds, fresh: [] };
    }
}

export async function updateSourceLastFetched(sourceIds: string[]): Promise<void> {
    try {
        const now = new Date();

        const existingIds = await db
            .select({ id: sources.id })
            .from(sources)
            .where(inArray(sources.id, sourceIds));

        const existingIdSet = new Set(existingIds.map(s => s.id));
        const toUpdate = sourceIds.filter(id => existingIdSet.has(id));
        const toInsert = sourceIds.filter(id => !existingIdSet.has(id));

        if (toUpdate.length > 0) {
            await db
                .update(sources)
                .set({ lastFetchedAt: now })
                .where(inArray(sources.id, toUpdate));
        }

        if (toInsert.length > 0) {
            await db
                .insert(sources)
                .values(toInsert.map(id => ({
                    id,
                    enabled: true,
                    lastFetchedAt: now,
                })));
        }
    } catch (error) {
        console.error('Failed to update source lastFetchedAt:', error);
    }
}

export async function getCachedContentBySourceIds(
    sourceIds: string[],
    timeRange: TimeRange = '24h',
    limit: number = 2000
): Promise<ContentItem[]> {
    try {
        if (sourceIds.length === 0) return [];

        const cutoff = getTimeRangeCutoff(timeRange);
        const cutoffISO = cutoff.toISOString();

        // Per-source cap: prevent high-frequency sources (reddit, huggingface) from
        // crowding out low-frequency sources (AI Labs blogs) in the LIMIT window.
        const maxPerSource = Math.max(MAX_ITEMS_PER_SOURCE, Math.ceil(limit / sourceIds.length * 2));
        const sourceIdList = sql.join(sourceIds.map(id => sql`${id}`), sql`, `);

        const items = await db.execute<{
            id: string;
            source_id: string;
            title: string;
            description: string | null;
            url: string;
            image_url: string | null;
            published_at: Date;
            fetched_at: Date;
            author: string | null;
            tags: string | null;
            sentiment: string | null;
            sentiment_score: number | null;
            engagement: string | null;
        }>(sql`
            WITH ranked AS (
                SELECT *, ROW_NUMBER() OVER (PARTITION BY source_id ORDER BY published_at DESC) AS rn
                FROM content_items
                WHERE source_id IN (${sourceIdList})
                  AND published_at >= ${cutoffISO}::timestamptz
            )
            SELECT id, source_id, title, description, url, image_url,
                   published_at, fetched_at, author, tags, sentiment,
                   sentiment_score, engagement
            FROM ranked
            WHERE rn <= ${maxPerSource}
            ORDER BY published_at DESC
            LIMIT ${limit}
        `);

        return [...items].map(item => ({
            id: item.id,
            sourceId: item.source_id,
            title: item.title,
            description: item.description ?? undefined,
            url: item.url,
            imageUrl: item.image_url ?? undefined,
            publishedAt: item.published_at,
            fetchedAt: item.fetched_at,
            author: item.author ?? undefined,
            tags: item.tags ? JSON.parse(item.tags) : undefined,
            sentiment: item.sentiment as ContentItem['sentiment'],
            sentimentScore: item.sentiment_score ?? undefined,
            engagement: item.engagement ? JSON.parse(item.engagement) : undefined,
        }));
    } catch (error) {
        console.error('Failed to get cached content by source IDs:', error);
        return [];
    }
}

export async function cacheContent(items: ContentItem[]): Promise<void> {
    if (items.length === 0) return;

    // Batch upsert content items in chunks of 100.
    // Each chunk has its own try-catch so a single FK violation (e.g. a source
    // missing from the `sources` table) doesn't silently drop all remaining chunks.
    const CHUNK_SIZE = 100;
    let cachedCount = 0;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunk = items.slice(i, i + CHUNK_SIZE);
        try {
            const dbItems = chunk.map(item => {
                // Run sentiment analysis if not already set
                const sentimentResult = (!item.sentiment)
                    ? analyzeSentiment(item.title, item.description)
                    : null;

                return {
                    id: item.id,
                    sourceId: item.sourceId,
                    title: item.title,
                    description: item.description ?? null,
                    url: item.url,
                    imageUrl: item.imageUrl ?? null,
                    publishedAt: item.publishedAt,
                    fetchedAt: item.fetchedAt,
                    author: item.author ?? null,
                    tags: item.tags ? JSON.stringify(item.tags) : null,
                    sentiment: item.sentiment ?? sentimentResult?.sentiment ?? null,
                    sentimentScore: item.sentimentScore ?? sentimentResult?.score ?? null,
                    engagement: item.engagement ? JSON.stringify(item.engagement) : null,
                };
            });

            await db.insert(contentItems)
                .values(dbItems)
                .onConflictDoUpdate({
                    target: contentItems.id,
                    set: {
                        sourceId: sql`excluded.source_id`,
                        title: sql`excluded.title`,
                        description: sql`excluded.description`,
                        url: sql`excluded.url`,
                        imageUrl: sql`excluded.image_url`,
                        publishedAt: sql`excluded.published_at`,
                        fetchedAt: sql`excluded.fetched_at`,
                        author: sql`excluded.author`,
                        tags: sql`excluded.tags`,
                        sentiment: sql`excluded.sentiment`,
                        sentimentScore: sql`excluded.sentiment_score`,
                        engagement: sql`excluded.engagement`,
                    },
                });
            cachedCount += chunk.length;
        } catch (error) {
            const sourceIds = [...new Set(chunk.map(c => c.sourceId))];
            console.error(`Failed to cache chunk ${i / CHUNK_SIZE} (${chunk.length} items, sources: ${sourceIds.join(',')}):`, error);
        }
    }

    if (cachedCount < items.length) {
        console.warn(`[cacheContent] Cached ${cachedCount}/${items.length} items (${items.length - cachedCount} lost to chunk errors)`);
    }

    // Record engagement snapshots in background (non-blocking).
    // Uses batch query instead of per-item N+1 to handle remote DB latency.
    const engagementItems = items
        .filter(item => item.engagement)
        .map(item => ({ contentId: item.id, engagement: item.engagement! }));
    if (engagementItems.length > 0) {
        recordEngagementSnapshotsBatch(engagementItems).catch(err =>
            console.error('Background engagement snapshot failed:', err)
        );
    }
}

export async function cleanOldContent(daysToKeep: number = 30): Promise<number> {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);

        const deleted = await db
            .delete(contentItems)
            .where(sql`${contentItems.fetchedAt} < ${cutoff}`)
            .returning({ id: contentItems.id });

        return deleted.length;
    } catch (error) {
        console.error('Failed to clean old content:', error);
        return 0;
    }
}

// === Source Priority Actions ===

export async function getSourcePriority(sourceId: string): Promise<number> {
    try {
        const [result] = await db
            .select({ priority: sources.priority })
            .from(sources)
            .where(eq(sources.id, sourceId));

        return result?.priority ?? 3; // Default priority is 3
    } catch (error) {
        console.error(`Failed to get priority for ${sourceId}:`, error);
        return 3;
    }
}

export async function setSourcePriority(sourceId: string, priority: number): Promise<void> {
    // Clamp priority between 1 and 5
    const clampedPriority = Math.max(1, Math.min(5, priority));

    try {
        const [existing] = await db
            .select({ id: sources.id })
            .from(sources)
            .where(eq(sources.id, sourceId));

        if (existing) {
            await db
                .update(sources)
                .set({ priority: clampedPriority })
                .where(eq(sources.id, sourceId));
        } else {
            await db
                .insert(sources)
                .values({
                    id: sourceId,
                    enabled: true,
                    priority: clampedPriority,
                    lastFetchedAt: new Date(),
                });
        }
    } catch (error) {
        console.error(`Failed to set priority for ${sourceId}:`, error);
        throw error;
    }
}

export async function getAllSourcePriorities(): Promise<Map<string, number>> {
    try {
        const results = await db
            .select({ id: sources.id, priority: sources.priority })
            .from(sources);

        const priorities = new Map<string, number>();
        for (const row of results) {
            priorities.set(row.id, row.priority ?? 3);
        }
        return priorities;
    } catch (error) {
        console.error('Failed to get source priorities:', error);
        return new Map();
    }
}

// === Keyword Boost Actions ===

export async function getBoostKeywords(): Promise<string[]> {
    return getSetting<string[]>('boostKeywords', []);
}

export async function setBoostKeywords(keywords: string[]): Promise<void> {
    await updateSetting('boostKeywords', keywords);
}

// === YouTube Channel Actions ===

export async function getYouTubeChannels(): Promise<YouTubeChannelConfig[]> {
    return getSetting<YouTubeChannelConfig[]>('youtubeChannels', DEFAULT_YOUTUBE_CHANNELS);
}

export async function setYouTubeChannels(channels: YouTubeChannelConfig[]): Promise<void> {
    await updateSetting('youtubeChannels', channels);
}

// === Custom Subreddit Actions ===

export async function getCustomSubreddits(): Promise<SubredditConfig[]> {
    return getSetting<SubredditConfig[]>('customSubreddits', DEFAULT_SUBREDDITS);
}

export async function setCustomSubreddits(subreddits: SubredditConfig[]): Promise<void> {
    await updateSetting('customSubreddits', subreddits);
}

// === Source Health Actions ===

export async function getSourceHealth(): Promise<SourceHealthMap> {
    return getSetting<SourceHealthMap>('sourceHealth', {});
}

export async function updateSourceHealth(health: SourceHealthMap): Promise<void> {
    await updateSetting('sourceHealth', health);
    // Invalidate cache after write so next read gets fresh data
    settingsCache.invalidate('setting:sourceHealth');
}
