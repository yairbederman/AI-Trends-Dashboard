import { NextResponse } from 'next/server';
import {
    getSourceQualityBaseline,
    getSourceEngagementType,
    SOURCE_QUALITY_TIERS,
} from '@/lib/scoring/engagement-config';
import { getSourceHealth } from '@/lib/db/actions';
import { getEffectiveSourceList } from '@/lib/config/resolve';

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
    const sourceList = await getEffectiveSourceList();
    const healthMap = await getSourceHealth();

    const categorizedSources = sourceList.activeCategories.map((category) => ({
        category,
        sources: sourceList.all.filter((s) => s.category === category).map((s) => {
            const qualityBaseline = getSourceQualityBaseline(s.id);
            const engagementType = getSourceEngagementType(s.id);
            const qualityTier = s.isCustom ? 3 : getQualityTierNumber(qualityBaseline);

            const health = healthMap[s.id];

            return {
                id: s.id,
                name: s.name,
                icon: s.icon,
                enabled: s.isEnabled,
                requiresKey: s.requiresKey,
                method: s.method,
                brokenReason: s.brokenReason,
                isCustom: s.isCustom,
                // Quality tier info
                qualityTier,
                qualityTierLabel: s.isCustom ? 'Custom' : getQualityTierLabel(qualityTier),
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
        totalSources: sourceList.all.length,
        enabledSources: sourceList.enabled.length,
    });
}
