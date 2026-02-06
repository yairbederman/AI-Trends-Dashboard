import { db } from './index';
import { settings, sources, contentItems } from './schema';
import { eq, inArray, gte, and, desc, sql } from 'drizzle-orm';
import { SOURCES, getSourceById } from '@/lib/config/sources';
import { ContentItem, TimeRange } from '@/types';
import { YouTubeChannelConfig, DEFAULT_YOUTUBE_CHANNELS } from '@/lib/config/youtube-channels';
import { recordEngagementSnapshot } from './engagement-tracker';
import { isSourceStale } from './cache-config';
import { settingsCache } from '@/lib/cache/memory-cache';

// === Settings Actions ===

export async function getSetting<T = string>(key: string, defaultValue: T): Promise<T> {
    try {
        // Check in-memory cache first
        const cacheKey = `setting:${key}`;
        const cached = settingsCache.get(cacheKey);
        if (cached !== undefined) return cached as T;

        const result = await db.select().from(settings).where(eq(settings.key, key)).get();
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

export async function updateSetting(key: string, value: unknown): Promise<void> {
    try {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        const existing = await db.select().from(settings).where(eq(settings.key, key)).get();

        if (existing) {
            await db.update(settings).set({ value: stringValue }).where(eq(settings.key, key)).run();
        } else {
            await db.insert(settings).values({ key, value: stringValue }).run();
        }
    } catch (error) {
        console.error(`Failed to update setting ${key}:`, error);
        throw error;
    }
}

// === Source Actions ===

export async function getEnabledSourceIds(): Promise<string[]> {
    try {
        const dbSources = await db.select().from(sources).all();
        const dbSourceMap = new Map(dbSources.map(s => [s.id, s.enabled]));

        return SOURCES.filter(s => {
            if (dbSourceMap.has(s.id)) {
                return dbSourceMap.get(s.id);
            }
            return s.enabled;
        }).map(s => s.id);

    } catch (error) {
        console.error('Failed to get enabled sources:', error);
        return SOURCES.filter(s => s.enabled).map(s => s.id);
    }
}

export async function toggleSourceEnabled(sourceId: string, enabled: boolean): Promise<void> {
    try {
        const existing = await db.select().from(sources).where(eq(sources.id, sourceId)).get();

        if (existing) {
            await db.update(sources).set({ enabled }).where(eq(sources.id, sourceId)).run();
        } else {
            await db.insert(sources).values({
                id: sourceId,
                enabled: enabled,
                lastFetchedAt: new Date()
            }).run();
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
            .where(inArray(sources.id, sourceIds))
            .all();

        const existingIdSet = new Set(existingIds.map(s => s.id));
        const toUpdate = sourceIds.filter(id => existingIdSet.has(id));
        const toInsert = sourceIds.filter(id => !existingIdSet.has(id));

        // Batch update existing
        if (toUpdate.length > 0) {
            await db
                .update(sources)
                .set({ enabled })
                .where(inArray(sources.id, toUpdate))
                .run();
        }

        // Batch insert new
        if (toInsert.length > 0) {
            await db
                .insert(sources)
                .values(toInsert.map(id => ({
                    id,
                    enabled,
                    lastFetchedAt: new Date()
                })))
                .run();
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
    try {
        const dbSources = await db
            .select({ id: sources.id, lastFetchedAt: sources.lastFetchedAt })
            .from(sources)
            .where(inArray(sources.id, sourceIds))
            .all();

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
            .where(inArray(sources.id, sourceIds))
            .all();

        const existingIdSet = new Set(existingIds.map(s => s.id));
        const toUpdate = sourceIds.filter(id => existingIdSet.has(id));
        const toInsert = sourceIds.filter(id => !existingIdSet.has(id));

        if (toUpdate.length > 0) {
            await db
                .update(sources)
                .set({ lastFetchedAt: now })
                .where(inArray(sources.id, toUpdate))
                .run();
        }

        if (toInsert.length > 0) {
            await db
                .insert(sources)
                .values(toInsert.map(id => ({
                    id,
                    enabled: true,
                    lastFetchedAt: now,
                })))
                .run();
        }
    } catch (error) {
        console.error('Failed to update source lastFetchedAt:', error);
    }
}

export async function getCachedContentBySourceIds(
    sourceIds: string[],
    timeRange: TimeRange = '24h'
): Promise<ContentItem[]> {
    try {
        if (sourceIds.length === 0) return [];

        const cutoff = getTimeRangeCutoff(timeRange);

        const items = await db
            .select()
            .from(contentItems)
            .where(
                and(
                    inArray(contentItems.sourceId, sourceIds),
                    gte(contentItems.publishedAt, cutoff)
                )
            )
            .orderBy(desc(contentItems.publishedAt))
            .all();

        return items.map(item => ({
            id: item.id,
            sourceId: item.sourceId,
            title: item.title,
            description: item.description ?? undefined,
            url: item.url,
            imageUrl: item.imageUrl ?? undefined,
            publishedAt: item.publishedAt!,
            fetchedAt: item.fetchedAt!,
            author: item.author ?? undefined,
            tags: item.tags ? JSON.parse(item.tags) : undefined,
            sentiment: item.sentiment as ContentItem['sentiment'],
            sentimentScore: item.sentimentScore ?? undefined,
            engagement: item.engagement ? JSON.parse(item.engagement) : undefined,
        }));
    } catch (error) {
        console.error('Failed to get cached content by source IDs:', error);
        return [];
    }
}

export async function cacheContent(items: ContentItem[]): Promise<void> {
    try {
        if (items.length === 0) return;

        // Batch upsert content items in chunks of 100
        const CHUNK_SIZE = 100;
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
            const chunk = items.slice(i, i + CHUNK_SIZE);
            const dbItems = chunk.map(item => ({
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
                sentiment: item.sentiment ?? null,
                sentimentScore: item.sentimentScore ?? null,
                engagement: item.engagement ? JSON.stringify(item.engagement) : null,
            }));

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
                })
                .run();
        }

        // Record engagement snapshots for velocity tracking (inherently sequential)
        for (const item of items) {
            if (item.engagement) {
                await recordEngagementSnapshot(item.id, item.engagement);
            }
        }
    } catch (error) {
        console.error('Failed to cache content:', error);
    }
}

export async function cleanOldContent(daysToKeep: number = 30): Promise<number> {
    try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysToKeep);

        const result = await db
            .delete(contentItems)
            .where(sql`${contentItems.fetchedAt} < ${cutoff.getTime()}`)
            .run();

        return result.changes;
    } catch (error) {
        console.error('Failed to clean old content:', error);
        return 0;
    }
}

// === Source Priority Actions ===

export async function getSourcePriority(sourceId: string): Promise<number> {
    try {
        const result = await db
            .select({ priority: sources.priority })
            .from(sources)
            .where(eq(sources.id, sourceId))
            .get();

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
        const existing = await db
            .select({ id: sources.id })
            .from(sources)
            .where(eq(sources.id, sourceId))
            .get();

        if (existing) {
            await db
                .update(sources)
                .set({ priority: clampedPriority })
                .where(eq(sources.id, sourceId))
                .run();
        } else {
            await db
                .insert(sources)
                .values({
                    id: sourceId,
                    enabled: true,
                    priority: clampedPriority,
                    lastFetchedAt: new Date(),
                })
                .run();
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
            .from(sources)
            .all();

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
