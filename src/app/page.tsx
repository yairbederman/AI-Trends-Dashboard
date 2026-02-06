import { Suspense } from 'react';
import { getEnabledSourcesFiltered } from '@/lib/config/sources';
import { createAdapter } from '@/lib/adapters';
import { deduplicateItems } from '@/lib/adapters/base';
import { ContentItem, TimeRange } from '@/types';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  getEnabledSourceIds,
  getSetting,
  cacheContent,
  getAllSourcePriorities,
  getBoostKeywords,
  getSourceFreshness,
  updateSourceLastFetched,
  getCachedContentBySourceIds,
} from '@/lib/db/actions';
import { scoreAndSortItems, ScoringConfig } from '@/lib/scoring';

// Server-side data fetching with caching
async function fetchAllContent(): Promise<ContentItem[]> {
  // Get user settings from database
  const enabledSourceIds = await getEnabledSourceIds();
  const timeRange = await getSetting<TimeRange>('timeRange', '24h');

  const sources = getEnabledSourcesFiltered(enabledSourceIds);
  const sourceIds = sources.map(s => s.id);

  // Check per-source freshness
  const { stale } = await getSourceFreshness(sourceIds);

  if (stale.length > 0) {
    // Fetch only stale sources
    const staleSources = sources.filter(s => stale.includes(s.id));
    const adapterPairs = staleSources
      .map((source) => ({ source, adapter: createAdapter(source) }))
      .filter((pair): pair is { source: typeof pair.source; adapter: NonNullable<typeof pair.adapter> } => pair.adapter !== null);

    const results = await Promise.allSettled(
      adapterPairs.map(({ adapter }) => adapter.fetch({ timeRange }))
    );

    const items: ContentItem[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        items.push(...result.value);
      }
    });

    const uniqueItems = deduplicateItems(items);
    await cacheContent(uniqueItems);

    // Update lastFetchedAt for successfully fetched sources
    const successfulSourceIds = adapterPairs
      .filter((_, i) => results[i].status === 'fulfilled')
      .map(p => p.source.id);
    if (successfulSourceIds.length > 0) {
      await updateSourceLastFetched(successfulSourceIds);
    }
  }

  // Get all items from DB (fresh + newly cached)
  const allItems = await getCachedContentBySourceIds(sourceIds, timeRange);

  // Get scoring configuration
  const priorities = await getAllSourcePriorities();
  const boostKeywords = await getBoostKeywords();

  const scoringConfig: ScoringConfig = {
    priorities,
    boostKeywords,
  };

  // Score and sort items
  return scoreAndSortItems(allItems, scoringConfig);
}

// Async Server Component wrapper
async function DashboardContent() {
  const items = await fetchAllContent();
  return <DashboardClient initialItems={items} />;
}

// Root page - Server Component with Suspense
export default function Dashboard() {
  return (
    <Suspense fallback={<LoadingSpinner message="Fetching AI trends..." />}>
      <DashboardContent />
    </Suspense>
  );
}
