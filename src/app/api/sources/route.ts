import { NextResponse } from 'next/server';
import { SOURCES, getAllCategories } from '@/lib/config/sources';
import {
    getSourceQualityBaseline,
    getSourceEngagementType,
    SOURCE_QUALITY_TIERS,
} from '@/lib/scoring/engagement-config';

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
    const categories = getAllCategories();

    const categorizedSources = categories.map((category) => ({
        category,
        sources: SOURCES.filter((s) => s.category === category).map((s) => {
            const qualityBaseline = getSourceQualityBaseline(s.id);
            const engagementType = getSourceEngagementType(s.id);
            const qualityTier = getQualityTierNumber(qualityBaseline);

            return {
                id: s.id,
                name: s.name,
                icon: s.icon,
                enabled: s.enabled,
                requiresKey: s.requiresKey,
                method: s.method,
                // Quality tier info
                qualityTier,
                qualityTierLabel: getQualityTierLabel(qualityTier),
                qualityBaseline,
                engagementType,
                hasEngagementMetrics: engagementType !== 'rss',
            };
        }),
    }));

    return NextResponse.json({
        categories: categorizedSources,
        totalSources: SOURCES.length,
        enabledSources: SOURCES.filter((s) => s.enabled).length,
    });
}
