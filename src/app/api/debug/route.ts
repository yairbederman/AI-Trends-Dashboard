import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sources, contentItems, settings } from '@/lib/db/schema';
import { sql, desc } from 'drizzle-orm';
import { SOURCES } from '@/lib/config/sources';
import { createAdapter } from '@/lib/adapters';
import { getEffectiveConfig, getEffectiveSourceList } from '@/lib/config/resolve';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
    const diagnostics: Record<string, unknown> = {
        timestamp: new Date().toISOString(),
        environment: {},
        database: {},
        tables: {},
        config: {},
        adapters: {},
        recentContent: {},
        errors: [] as string[],
    };
    const errors = diagnostics.errors as string[];

    // 1. Environment check
    diagnostics.environment = {
        DATABASE_URL_set: !!process.env.DATABASE_URL,
        DATABASE_URL_preview: process.env.DATABASE_URL
            ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@').substring(0, 80) + '...'
            : 'NOT SET',
        YOUTUBE_API_KEY_set: !!process.env.YOUTUBE_API_KEY,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
        VERCEL_URL: process.env.VERCEL_URL,
    };

    if (!process.env.DATABASE_URL) {
        errors.push('CRITICAL: DATABASE_URL is not set');
    }

    // 2. Database connectivity
    try {
        const t0 = Date.now();
        await db.execute(sql`SELECT 1`);
        diagnostics.database = {
            connected: true,
            latencyMs: Date.now() - t0,
        };
    } catch (err) {
        diagnostics.database = {
            connected: false,
            error: err instanceof Error ? err.message : String(err),
        };
        errors.push(`DATABASE CONNECTION FAILED: ${err instanceof Error ? err.message : String(err)}`);
        // Return early — no point checking tables if DB is down
        return NextResponse.json(diagnostics, { status: 500 });
    }

    // 3. Table row counts
    try {
        const [sourceCount] = await db.select({ count: sql<number>`count(*)` }).from(sources);
        const [contentCount] = await db.select({ count: sql<number>`count(*)` }).from(contentItems);
        const [settingsCount] = await db.select({ count: sql<number>`count(*)` }).from(settings);

        diagnostics.tables = {
            sources: sourceCount?.count ?? 0,
            contentItems: contentCount?.count ?? 0,
            settings: settingsCount?.count ?? 0,
        };

        if (Number(contentCount?.count) === 0) {
            errors.push('WARNING: content_items table is EMPTY — no data to display');
        }
    } catch (err) {
        diagnostics.tables = { error: err instanceof Error ? err.message : String(err) };
        errors.push(`TABLE QUERY FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 4. Effective config resolution
    try {
        const config = await getEffectiveConfig();
        const sourceList = await getEffectiveSourceList();

        diagnostics.config = {
            theme: config.theme,
            timeRange: config.timeRange,
            enabledSourceCount: config.enabledSourceIds.length,
            enabledSourceIds: config.enabledSourceIds.slice(0, 10).concat(
                config.enabledSourceIds.length > 10 ? [`... +${config.enabledSourceIds.length - 10} more`] : []
            ),
            deletedSourceCount: config.deletedSourceIds.length,
            boostKeywords: config.boostKeywords,
            youtubeChannelCount: config.youtubeChannels.length,
            customSubredditCount: config.customSubreddits.length,
            customSourceCount: config.customSources.length,
            resolvedEnabledCount: sourceList.enabled.length,
            activeCategories: sourceList.activeCategories,
        };

        if (config.enabledSourceIds.length === 0) {
            errors.push('CRITICAL: No enabled source IDs — all sources disabled or deleted');
        }
    } catch (err) {
        diagnostics.config = { error: err instanceof Error ? err.message : String(err) };
        errors.push(`CONFIG RESOLUTION FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 5. Adapter availability
    try {
        const adapterResults: Record<string, string> = {};
        let availableCount = 0;
        let nullCount = 0;

        for (const source of SOURCES.filter(s => s.enabled)) {
            const adapter = createAdapter(source);
            if (adapter) {
                adapterResults[source.id] = 'available';
                availableCount++;
            } else {
                adapterResults[source.id] = 'null (skipped)';
                nullCount++;
            }
        }

        diagnostics.adapters = {
            totalEnabledSources: SOURCES.filter(s => s.enabled).length,
            availableAdapters: availableCount,
            skippedAdapters: nullCount,
            details: adapterResults,
        };

        if (availableCount === 0) {
            errors.push('CRITICAL: No adapters available — no data can be fetched');
        }
    } catch (err) {
        diagnostics.adapters = { error: err instanceof Error ? err.message : String(err) };
        errors.push(`ADAPTER CHECK FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 6. Recent content sample
    try {
        const recentItems = await db
            .select({
                id: contentItems.id,
                sourceId: contentItems.sourceId,
                title: contentItems.title,
                publishedAt: contentItems.publishedAt,
                fetchedAt: contentItems.fetchedAt,
            })
            .from(contentItems)
            .orderBy(desc(contentItems.publishedAt))
            .limit(5);

        // Check content distribution by source
        const sourceDistribution = await db.execute<{ source_id: string; count: number }>(sql`
            SELECT source_id, count(*)::int as count
            FROM content_items
            GROUP BY source_id
            ORDER BY count DESC
            LIMIT 15
        `);

        // Check how old the content is
        const [oldest] = await db
            .select({ oldest: sql<Date>`MIN(published_at)` })
            .from(contentItems);
        const [newest] = await db
            .select({ newest: sql<Date>`MAX(published_at)` })
            .from(contentItems);

        diagnostics.recentContent = {
            recentItems: recentItems.map(i => ({
                id: i.id.substring(0, 30) + '...',
                sourceId: i.sourceId,
                title: i.title.substring(0, 60) + (i.title.length > 60 ? '...' : ''),
                publishedAt: i.publishedAt,
                fetchedAt: i.fetchedAt,
            })),
            sourceDistribution: [...sourceDistribution].map(r => ({
                sourceId: r.source_id,
                count: r.count,
            })),
            oldestPublishedAt: oldest?.oldest,
            newestPublishedAt: newest?.newest,
            ageNote: newest?.newest
                ? `Newest content is ${Math.round((Date.now() - new Date(newest.newest as unknown as string).getTime()) / 3600000)}h old`
                : 'No content in database',
        };

        // Check if all content is outside the default 24h window
        if (newest?.newest) {
            const newestAge = Date.now() - new Date(newest.newest as unknown as string).getTime();
            if (newestAge > 24 * 60 * 60 * 1000) {
                errors.push(`WARNING: Newest content is ${Math.round(newestAge / 3600000)}h old — outside default 24h time range`);
            }
        }
    } catch (err) {
        diagnostics.recentContent = { error: err instanceof Error ? err.message : String(err) };
        errors.push(`CONTENT QUERY FAILED: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 7. Source freshness check
    try {
        const dbSources = await db
            .select({
                id: sources.id,
                enabled: sources.enabled,
                lastFetchedAt: sources.lastFetchedAt,
            })
            .from(sources)
            .limit(30);

        const sourceFreshness = dbSources.map(s => ({
            id: s.id,
            enabled: s.enabled,
            lastFetchedAt: s.lastFetchedAt,
            ageMinutes: s.lastFetchedAt
                ? Math.round((Date.now() - new Date(s.lastFetchedAt).getTime()) / 60000)
                : null,
        }));

        (diagnostics as Record<string, unknown>).sourceFreshness = sourceFreshness;
    } catch (err) {
        (diagnostics as Record<string, unknown>).sourceFreshness = {
            error: err instanceof Error ? err.message : String(err),
        };
    }

    // 8. Source health records
    try {
        const healthRaw = await db
            .select()
            .from(settings)
            .where(sql`${settings.key} = 'sourceHealth'`);

        if (healthRaw.length > 0) {
            const health = JSON.parse(healthRaw[0].value);
            const failingSources = Object.entries(health)
                .filter(([, v]) => (v as { consecutiveFailures: number }).consecutiveFailures >= 2)
                .map(([id, v]) => ({
                    id,
                    ...(v as object),
                }));

            (diagnostics as Record<string, unknown>).sourceHealth = {
                totalTracked: Object.keys(health).length,
                failingSources,
            };

            if (failingSources.length > 0) {
                errors.push(`WARNING: ${failingSources.length} sources have 2+ consecutive failures`);
            }
        }
    } catch (err) {
        (diagnostics as Record<string, unknown>).sourceHealth = {
            error: err instanceof Error ? err.message : String(err),
        };
    }

    const status = errors.some(e => e.startsWith('CRITICAL')) ? 500 : 200;
    return NextResponse.json(diagnostics, { status });
}
