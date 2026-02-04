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
  getCachedContent,
  cacheContent,
  getAllSourcePriorities,
  getBoostKeywords,
} from '@/lib/db/actions';
import { scoreAndSortItems, ScoringConfig } from '@/lib/scoring';

// Server-side data fetching with caching
async function fetchAllContent(): Promise<ContentItem[]> {
  // Get user settings from database
  const enabledSourceIds = await getEnabledSourceIds();
  const timeRange = await getSetting<TimeRange>('timeRange', '24h');

  const sources = getEnabledSourcesFiltered(enabledSourceIds);
  const sourceIds = sources.map(s => s.id);

  // Check cache first
  const cached = await getCachedContent(sourceIds, timeRange);
  if (cached && !cached.isStale) {
    // Re-score cached items (scores depend on recency which changes over time)
    const priorities = await getAllSourcePriorities();
    const boostKeywords = await getBoostKeywords();
    const scoringConfig: ScoringConfig = { priorities, boostKeywords };
    return scoreAndSortItems(cached.items, scoringConfig);
  }

  // Fetch fresh content
  const adapters = sources
    .map((source) => createAdapter(source))
    .filter((adapter) => adapter !== null);

  const results = await Promise.allSettled(
    adapters.map((adapter) => adapter.fetch({ timeRange }))
  );

  const items: ContentItem[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) {
      items.push(...result.value);
    }
  });

  // Deduplicate items
  const uniqueItems = deduplicateItems(items);

  // Get scoring configuration
  const priorities = await getAllSourcePriorities();
  const boostKeywords = await getBoostKeywords();

  const scoringConfig: ScoringConfig = {
    priorities,
    boostKeywords,
  };

  // Score and sort items
  const scoredItems = scoreAndSortItems(uniqueItems, scoringConfig);

  // Cache results
  await cacheContent(scoredItems, sourceIds, timeRange);

  return scoredItems;
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
