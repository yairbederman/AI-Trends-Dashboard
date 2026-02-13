/**
 * Consolidated config resolver — single read-path for "what is the resolved config right now?"
 *
 * Writes stay in `@/lib/db/actions`. Code defaults stay in their files.
 * This module only reads and merges.
 */

import {
    getSetting,
    getAllSettings,
    getAllSourcePriorities,
    getBoostKeywords,
    getYouTubeChannels,
    getCustomSubreddits,
    getCustomSources,
    getDeletedSourceIds,
    computeEnabledSourceIds,
} from '@/lib/db/actions';
import { db } from '@/lib/db';
import { sources } from '@/lib/db/schema';
import { SOURCES, customToSourceConfig } from '@/lib/config/sources';
import { settingsCache } from '@/lib/cache/memory-cache';
import type { SourceConfig, SourceCategory, CustomSourceConfig, TimeRange } from '@/types';
import type { YouTubeChannelConfig } from '@/lib/config/youtube-channels';
import type { SubredditConfig } from '@/lib/config/subreddit-sources';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EffectiveConfig {
    theme: string;
    timeRange: TimeRange;
    enabledSourceIds: string[];
    priorities: Map<string, number>;
    boostKeywords: string[];
    youtubeChannels: YouTubeChannelConfig[];
    customSubreddits: SubredditConfig[];
    customSources: CustomSourceConfig[];
    deletedSourceIds: string[];
}

export interface ResolvedSource extends SourceConfig {
    isEnabled: boolean;
    isCustom: boolean;
    effectivePriority: number;
}

export interface EffectiveSourceList {
    /** All sources (predefined + custom − deleted) with resolved flags */
    all: ResolvedSource[];
    /** Only the enabled sources */
    enabled: ResolvedSource[];
    /** Flat array of enabled source IDs (convenience) */
    enabledIds: string[];
    /** Categories that have at least one enabled source */
    activeCategories: SourceCategory[];
}

// ---------------------------------------------------------------------------
// Cache keys — cleared automatically by settingsCache.clear() in POST /api/settings
// ---------------------------------------------------------------------------

const CONFIG_CACHE_KEY = 'resolved:effectiveConfig';
const SOURCE_LIST_CACHE_KEY = 'resolved:sourceList';

// ---------------------------------------------------------------------------
// getEffectiveConfig
// ---------------------------------------------------------------------------

export async function getEffectiveConfig(): Promise<EffectiveConfig> {
    const cached = settingsCache.get(CONFIG_CACHE_KEY) as EffectiveConfig | undefined;
    if (cached) return cached;

    // Only 2 parallel queries instead of 9 — critical with 2s+ latency to Seoul DB.
    // getAllSettings() bulk-loads all settings rows and populates the per-key cache,
    // so subsequent getSetting() calls hit the in-memory cache.
    const [, dbSources] = await Promise.all([
        getAllSettings(),
        db.select({ id: sources.id, enabled: sources.enabled, priority: sources.priority }).from(sources),
    ]);

    // These now all hit the in-memory cache (populated by getAllSettings above)
    const [
        theme,
        timeRange,
        boostKeywords,
        youtubeChannels,
        customSubreddits,
        customSources,
        deletedSourceIds,
    ] = await Promise.all([
        getSetting('theme', 'dark'),
        getSetting<TimeRange>('timeRange', '24h'),
        getBoostKeywords(),
        getYouTubeChannels(),
        getCustomSubreddits(),
        getCustomSources(),
        getDeletedSourceIds(),
    ]);

    // Build priorities from dbSources (already fetched) — no extra query
    const priorities = new Map<string, number>();
    for (const row of dbSources) {
        priorities.set(row.id, row.priority ?? 3);
    }

    // Compute enabled IDs in-memory from already-fetched data (no extra queries)
    const enabledSourceIds = computeEnabledSourceIds(dbSources, customSources, deletedSourceIds);

    const config: EffectiveConfig = {
        theme,
        timeRange,
        enabledSourceIds,
        priorities,
        boostKeywords,
        youtubeChannels,
        customSubreddits,
        customSources,
        deletedSourceIds,
    };

    settingsCache.set(CONFIG_CACHE_KEY, config);
    return config;
}

// ---------------------------------------------------------------------------
// getEffectiveSourceList
// ---------------------------------------------------------------------------

export async function getEffectiveSourceList(): Promise<EffectiveSourceList> {
    const cached = settingsCache.get(SOURCE_LIST_CACHE_KEY) as EffectiveSourceList | undefined;
    if (cached) return cached;

    const config = await getEffectiveConfig();

    const enabledSet = new Set(config.enabledSourceIds);
    const deletedSet = new Set(config.deletedSourceIds);
    const customIds = new Set(config.customSources.map(cs => cs.id));

    // Build resolved list: predefined (minus deleted) + custom
    const all: ResolvedSource[] = [];

    for (const s of SOURCES) {
        if (deletedSet.has(s.id)) continue;
        all.push({
            ...s,
            isEnabled: enabledSet.has(s.id),
            isCustom: false,
            effectivePriority: config.priorities.get(s.id) ?? s.defaultPriority ?? 3,
        });
    }

    for (const cs of config.customSources) {
        const sc = customToSourceConfig(cs);
        all.push({
            ...sc,
            isEnabled: enabledSet.has(cs.id),
            isCustom: true,
            effectivePriority: config.priorities.get(cs.id) ?? sc.defaultPriority ?? 3,
        });
    }

    const enabled = all.filter(s => s.isEnabled);
    const enabledIds = enabled.map(s => s.id);

    const activeCategorySet = new Set<SourceCategory>();
    for (const s of enabled) {
        activeCategorySet.add(s.category);
    }
    const activeCategories = [...activeCategorySet];

    const result: EffectiveSourceList = { all, enabled, enabledIds, activeCategories };
    settingsCache.set(SOURCE_LIST_CACHE_KEY, result);
    return result;
}
