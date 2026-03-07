/**
 * Cross-platform signal linking and score amplification.
 *
 * Groups items by platform family, links same-story items across platforms
 * via hybrid similarity, then amplifies trendingScore for multi-platform stories.
 */

import { ContentItem } from '@/types';
import { hybridSimilarity } from './similarity';

export interface CrossPlatformConfig {
    /** Minimum hybrid similarity to consider two items the same story (default 0.40) */
    similarityThreshold?: number;
    /** Score multiplier per additional platform (default 0.12) */
    amplificationFactor?: number;
    /** Maximum amplification multiplier (default 1.5) */
    maxAmplification?: number;
}

const DEFAULT_CONFIG: Required<CrossPlatformConfig> = {
    similarityThreshold: 0.40,
    amplificationFactor: 0.12,
    maxAmplification: 1.5,
};

/**
 * Map a sourceId to its platform family.
 * Sources from the same platform family are never linked to each other.
 */
function getPlatformFamily(sourceId: string): string {
    if (sourceId.startsWith('reddit-')) return 'reddit';
    if (sourceId.startsWith('hn') || sourceId === 'hacker-news') return 'hackernews';
    if (sourceId.startsWith('arxiv-')) return 'arxiv';
    return sourceId;
}

/**
 * Link same-story items across platforms and amplify their trending scores.
 *
 * 1. Groups items by platform family
 * 2. For each cross-platform pair, computes hybridSimilarity on titles
 * 3. If >= threshold, bidirectionally links via crossRefs
 * 4. Assigns crossPlatformCount and crossPlatformSources
 * 5. Amplifies trendingScore: score *= min(maxAmp, 1 + factor * platformCount)
 * 6. Clamps to 100
 */
export function linkAndAmplify(
    items: ContentItem[],
    config?: CrossPlatformConfig
): ContentItem[] {
    if (items.length === 0) return items;

    const {
        similarityThreshold,
        amplificationFactor,
        maxAmplification,
    } = { ...DEFAULT_CONFIG, ...config };

    // Build platform family lookup
    const familyOf = new Map<string, string>();
    for (const item of items) {
        if (!familyOf.has(item.sourceId)) {
            familyOf.set(item.sourceId, getPlatformFamily(item.sourceId));
        }
    }

    // Adjacency: item index -> set of linked item indices
    const links = new Map<number, Set<number>>();
    for (let i = 0; i < items.length; i++) {
        links.set(i, new Set());
    }

    // Compare cross-platform pairs
    for (let i = 0; i < items.length; i++) {
        const familyA = familyOf.get(items[i].sourceId)!;
        for (let j = i + 1; j < items.length; j++) {
            const familyB = familyOf.get(items[j].sourceId)!;
            // Only compare items from different platform families
            if (familyA === familyB) continue;

            const sim = hybridSimilarity(items[i].title, items[j].title);
            if (sim >= similarityThreshold) {
                links.get(i)!.add(j);
                links.get(j)!.add(i);
            }
        }
    }

    // Build clusters via BFS to find connected components
    const visited = new Set<number>();
    const clusters: number[][] = [];

    for (let i = 0; i < items.length; i++) {
        if (visited.has(i)) continue;
        const neighbors = links.get(i)!;
        if (neighbors.size === 0) continue;

        // BFS to find full cluster
        const cluster: number[] = [];
        const queue = [i];
        visited.add(i);
        while (queue.length > 0) {
            const current = queue.shift()!;
            cluster.push(current);
            for (const neighbor of links.get(current)!) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        clusters.push(cluster);
    }

    // Apply cross-platform metadata and amplification
    const result = [...items];

    for (const cluster of clusters) {
        // Collect unique platform families in this cluster
        const platformFamilies = new Set<string>();
        const sourceIds = new Set<string>();
        const itemIds: string[] = [];

        for (const idx of cluster) {
            platformFamilies.add(familyOf.get(items[idx].sourceId)!);
            sourceIds.add(items[idx].sourceId);
            itemIds.push(items[idx].id);
        }

        const platformCount = platformFamilies.size;
        if (platformCount < 2) continue; // Single platform cluster, skip

        const amplifier = Math.min(
            maxAmplification,
            1 + amplificationFactor * platformCount
        );

        for (const idx of cluster) {
            const item = items[idx];
            const otherIds = itemIds.filter(id => id !== item.id);
            const otherSources = [...sourceIds].filter(s => s !== item.sourceId);

            const amplifiedScore = item.trendingScore
                ? Math.min(100, Math.round(item.trendingScore * amplifier * 10) / 10)
                : undefined;

            result[idx] = {
                ...item,
                crossRefs: otherIds,
                crossPlatformCount: platformCount,
                crossPlatformSources: otherSources,
                trendingScore: amplifiedScore ?? item.trendingScore,
            };
        }
    }

    return result;
}
