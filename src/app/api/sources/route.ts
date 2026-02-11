import { NextResponse } from 'next/server';
import { SOURCES, getActiveCategoriesFiltered, getEffectiveSources } from '@/lib/config/sources';
import {
    getSourceQualityBaseline,
    getSourceEngagementType,
    SOURCE_QUALITY_TIERS,
} from '@/lib/scoring/engagement-config';
import { getEnabledSourceIds, getCustomSources, getDeletedSourceIds, getSourceHealth } from '@/lib/db/actions';

/**
 * Get quality tier number (1-4) from baseline value
 */
function getQualityTierNumber(baseline: number): number {
    if (baseline >= SOURCE_QUALITY_TIERS.TIER_1_OFFICIAL) return 1;
    if (baseline >= SOURCE_QUALITY_TIERS.TIER_2_NEWS) return 2;
    if (baseline >= SOURCE_QUALITY_TIERS.TIER_3_QUALITY) return 3;
    return 4;
}

/**
 * Get tier label for display
 */
function getQualityTierLabel(tier: number): string {
    switch (tier) {
        case 1: return 'Official';
        case 2: return 'Major';
        case 3: return 'Quality';
        case 4: return 'Other';
        default: return 'Other';
    }
}

export async function GET() {
    // Get enabled source IDs from database
    const enabledSourceIds = await getEnabledSourceIds();
    const customSources = await getCustomSources();
    const deletedIds = await getDeletedSourceIds();

    // Build the effective source list
    const effectiveSources = getEffectiveSources(customSources, deletedIds);
    const customSourceIds = new Set(customSources.map(cs => cs.id));
    const healthMap = await getSourceHealth();

    // Only show categories that have at least one enabled source
    const categories = getActiveCategoriesFiltered(enabledSourceIds, customSources);

    const categorizedSources = categories.map((category) => ({
        category,
        sources: effectiveSources.filter((s) => s.category === category).map((s) => {
            const qualityBaseline = getSourceQualityBaseline(s.id);
            const engagementType = getSourceEngagementType(s.id);
            const qualityTier = customSourceIds.has(s.id) ? 3 : getQualityTierNumber(qualityBaseline);
            const isCustom = customSourceIds.has(s.id);

            const health = healthMap[s.id];

            return {
                id: s.id,
                name: s.name,
                icon: s.icon,
                enabled: s.enabled,
                requiresKey: s.requiresKey,
                method: s.method,
                brokenReason: s.brokenReason,
                isCustom,
                // Quality tier info
                qualityTier,
                qualityTierLabel: isCustom ? 'Custom' : getQualityTierLabel(qualityTier),
                qualityBaseline,
                engagementType,
                hasEngagementMetrics: engagementType !== 'rss',
                // Health info
                health: health ? {
                    lastSuccessAt: health.lastSuccessAt,
                    consecutiveFailures: health.consecutiveFailures,
                    lastError: health.lastError,
                    lastItemCount: health.lastItemCount,
                } : undefined,
            };
        }),
    }));

    return NextResponse.json({
        categories: categorizedSources,
        totalSources: effectiveSources.length,
        enabledSources: effectiveSources.filter((s) => s.enabled).length,
    });
}
