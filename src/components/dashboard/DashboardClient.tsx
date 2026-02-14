'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import { ContentItem, SourceCategory, TimeRange, FeedMode } from '@/types';
import { ContentCard } from '@/components/dashboard/ContentCard';
import { CollapsibleSourceTabs } from '@/components/dashboard/CollapsibleSourceTabs';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { InsightCharts } from '@/components/dashboard/InsightCharts';
import { CategoryHighlights } from '@/components/dashboard/CategoryHighlights';
import { TimeRangeDropdown } from './TimeRangeDropdown';
import { FeedModeSelector } from './FeedModeSelector';
import { SourceConstellation } from '@/components/dashboard/SourceConstellation';
import { ConstellationRefreshWrapper } from '@/components/dashboard/ConstellationRefreshWrapper';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { Settings, Sparkles, TrendingUp, AlertTriangle, Activity, Crown, Hash, Rocket } from 'lucide-react';
import { SOURCES } from '@/lib/config/sources';
import { CATEGORY_LABELS } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface DashboardClientProps {
    initialItems: ContentItem[];
}

interface FeedResponse {
    success: boolean;
    count: number;
    items: ContentItem[];
    fetchedAt: string;
    cached?: boolean;
    staleRefreshing?: boolean;
    refreshingSources?: { id: string; name: string; icon: string; logoUrl?: string }[];
    failures?: { source: string; error: string }[];
}

const CATEGORIES: SourceCategory[] = [
    'ai-labs',
    'dev-platforms',
    'social',
    'news',
    'community',
    'newsletters',
    'leaderboards',
];

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DashboardClient({ initialItems }: DashboardClientProps) {
    const [activeCategory, setActiveCategory] = useState<SourceCategory | 'all' | 'dashboard'>('dashboard');
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [feedMode, setFeedMode] = useState<FeedMode>('hot');
    const { isSourceEnabled } = useSettings();
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const [skeletonDone, setSkeletonDone] = useState(initialItems.length > 0);
    const lastScrollY = useRef(0);
    // Prevents refresh constellation from re-mounting after it completes
    // (SWR keepPreviousData keeps old staleRefreshing=true during refetch)
    const refreshDismissedRef = useRef(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show if scrolling up or at top
            if (currentScrollY < 10) {
                setIsHeaderVisible(true);
            } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
                // Scrolling down & passed threshold -> Hide
                setIsHeaderVisible(false);
            } else if (currentScrollY < lastScrollY.current) {
                // Scrolling up -> Show
                setIsHeaderVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Build API URL with time range and feed mode (category filtering is client-side)
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.set('timeRange', timeRange);
        params.set('mode', feedMode);
        return `/api/feed?${params.toString()}`;
    }, [timeRange, feedMode]);

    // Reset dismissal when feed params change (new request may trigger refresh)
    useEffect(() => {
        refreshDismissedRef.current = false;
    }, [timeRange, feedMode]);

    const { data, error, isLoading, isValidating, mutate: refreshData } = useSWR<FeedResponse>(
        apiUrl,
        fetcher,
        {
            fallbackData: {
                success: true,
                count: initialItems.length,
                items: initialItems,
                fetchedAt: new Date().toISOString(),
            },
            revalidateOnFocus: false,
            refreshInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
            dedupingInterval: 60000, // 1 minute
            keepPreviousData: true,
        }
    );

    const sourceToCategory = useMemo(() => {
        const map: Record<string, string> = {};
        SOURCES.forEach(s => { map[s.id] = s.category; });
        return map;
    }, []);

    // Filter items based on enabled sources AND active category client-side
    // This gives instant feedback on tab switch while SWR fetches the new data
    const allItems = data?.items || [];
    const items = useMemo(() => {
        let filtered = allItems.filter((item) => isSourceEnabled(item.sourceId));
        if (activeCategory !== 'all' && activeCategory !== 'dashboard') {
            filtered = filtered.filter(item => sourceToCategory[item.sourceId] === activeCategory);
        }
        return filtered;
    }, [allItems, isSourceEnabled, activeCategory, sourceToCategory]);

    const categoryCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        items.forEach(item => {
            const cat = sourceToCategory[item.sourceId];
            if (cat) counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }, [items, sourceToCategory]);

    // Source lookup map
    const sourceMap = useMemo(() => {
        const map: Record<string, { name: string; icon?: string }> = {};
        SOURCES.forEach(s => { map[s.id] = { name: s.name, icon: s.icon }; });
        return map;
    }, []);

    const kpiData = useMemo(() => {
        if (items.length === 0) return null;

        // Top Source: which source has the most high-scoring content
        // Use adaptive threshold: top 25% of score range (works across all feed modes)
        const scores = items.map(i => i.trendingScore || 0);
        const maxScore = Math.max(...scores);
        const scoreThreshold = maxScore * 0.5; // Top half of score range

        const sourceCounts: Record<string, number> = {};
        for (const item of items) {
            if ((item.trendingScore || 0) >= scoreThreshold) {
                sourceCounts[item.sourceId] = (sourceCounts[item.sourceId] || 0) + 1;
            }
        }
        let topSourceId = '';
        let topSourceCount = 0;
        for (const [id, count] of Object.entries(sourceCounts)) {
            if (count > topSourceCount) { topSourceId = id; topSourceCount = count; }
        }
        const topSourceName = topSourceId ? (sourceMap[topSourceId]?.name || topSourceId) : 'None';

        // Hottest Topic: most common tag across top 20 items (excluding generic/junk tags)
        const genericTags = new Set([
            'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
            'tech', 'technology', 'other', 'none', 'general', 'misc', 'discussion',
            'en', 'us', 'question', 'help', 'showcase', 'news',
        ]);
        const junkPatterns = [/^region:/, /^lang:/, /^license:/, /^type:/, /^v\d/, /^\d+$/, /^question\s*-/i];
        const tagCounts: Record<string, number> = {};
        const top20 = [...items].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0)).slice(0, 20);
        for (const item of top20) {
            const allTags = [...(item.tags || []), ...(item.matchedKeywords || [])];
            const seen = new Set<string>();
            for (const tag of allTags) {
                const t = tag.toLowerCase().trim();
                if (t && t.length > 2 && !genericTags.has(t) && !seen.has(t) && !junkPatterns.some(p => p.test(t))) {
                    seen.add(t);
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                }
            }
        }
        let hottestTopic = '';
        let hottestTopicCount = 0;
        for (const [tag, count] of Object.entries(tagCounts)) {
            if (count > hottestTopicCount) { hottestTopic = tag; hottestTopicCount = count; }
        }

        // Biggest Mover: item with highest velocity score, or fallback to newest high-scorer
        let biggestMover: { title: string; sourceName: string; velocity: number } | null = null;
        for (const item of items) {
            const v = item.velocityScore || 0;
            if (v > 0 && (!biggestMover || v > biggestMover.velocity)) {
                biggestMover = {
                    title: item.title.length > 50 ? item.title.slice(0, 50) + '...' : item.title,
                    sourceName: sourceMap[item.sourceId]?.name || item.sourceId,
                    velocity: v,
                };
            }
        }
        // Fallback: newest item in the top 10 by score (proxy for "rising fast")
        if (!biggestMover) {
            const topByScore = [...items].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0)).slice(0, 10);
            const newestTop = topByScore.sort((a, b) =>
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            )[0];
            if (newestTop) {
                biggestMover = {
                    title: newestTop.title.length > 50 ? newestTop.title.slice(0, 50) + '...' : newestTop.title,
                    sourceName: sourceMap[newestTop.sourceId]?.name || newestTop.sourceId,
                    velocity: 0,
                };
            }
        }

        // Driving the Feed: which category has the highest total score among top items
        const catScores: Record<string, { total: number; count: number }> = {};
        for (const item of items) {
            const cat = sourceToCategory[item.sourceId];
            if (!cat) continue;
            if (!catScores[cat]) catScores[cat] = { total: 0, count: 0 };
            catScores[cat].total += (item.trendingScore || 0);
            catScores[cat].count += 1;
        }
        let drivingCategory = '';
        let drivingCategoryScore = 0;
        let drivingCategoryCount = 0;
        for (const [cat, data] of Object.entries(catScores)) {
            if (data.total > drivingCategoryScore) {
                drivingCategory = cat;
                drivingCategoryScore = data.total;
                drivingCategoryCount = data.count;
            }
        }
        const drivingLabel = CATEGORY_LABELS[drivingCategory as keyof typeof CATEGORY_LABELS] || drivingCategory;

        return {
            topSourceName,
            topSourceCount,
            hottestTopic: hottestTopic || null,
            hottestTopicCount,
            biggestMover,
            drivingLabel,
            drivingCategoryCount,
            totalCount: items.length,
        };
    }, [items, sourceMap, sourceToCategory]);

    const HIGHLIGHTS_PER_CATEGORY = 3;

    const categoryHighlights = useMemo(() => {
        if (items.length === 0) return [];

        // Group items by category
        const byCategory: Record<string, ContentItem[]> = {};
        for (const item of items) {
            const cat = sourceToCategory[item.sourceId];
            if (!cat) continue;
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(item);
        }

        // For each category, pick top items with source diversity
        const groups: { category: SourceCategory; items: ReturnType<typeof formatHighlightItem>[] }[] = [];

        for (const [cat, catItems] of Object.entries(byCategory)) {
            const sorted = catItems.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
            const picked: typeof catItems = [];
            const sourceCounts: Record<string, number> = {};
            for (const item of sorted) {
                if (picked.length >= HIGHLIGHTS_PER_CATEGORY) break;
                const count = sourceCounts[item.sourceId] || 0;
                if (count >= 2) continue;
                sourceCounts[item.sourceId] = count + 1;
                picked.push(item);
            }

            if (picked.length > 0) {
                groups.push({
                    category: cat as SourceCategory,
                    items: picked.map(formatHighlightItem),
                });
            }
        }

        // Sort category groups by their top item's score (hottest category first)
        groups.sort((a, b) => (b.items[0]?.score || 0) - (a.items[0]?.score || 0));

        return groups;

        function formatHighlightItem(item: ContentItem) {
            const score = item.trendingScore || 0;
            const tierClass = score >= 60 ? 'score-hot' : score >= 40 ? 'score-trending' : score >= 20 ? 'score-notable' : 'score-default';
            const source = sourceMap[item.sourceId];
            const sourceName = source?.name || item.sourceId;
            const sourceIcon = source?.icon || '';

            let timeAgo: string;
            try {
                const pubDate = item.publishedAt instanceof Date ? item.publishedAt : new Date(item.publishedAt);
                timeAgo = formatDistanceToNow(pubDate, { addSuffix: true });
            } catch {
                timeAgo = '';
            }

            let primaryMetric: { label: string; value: string } | null = null;
            const eng = item.engagement;
            if (eng) {
                if (eng.views && eng.views > 0) primaryMetric = { label: 'views', value: formatNumber(eng.views) };
                else if (eng.upvotes && eng.upvotes > 0) primaryMetric = { label: 'upvotes', value: formatNumber(eng.upvotes) };
                else if (eng.stars && eng.stars > 0) primaryMetric = { label: 'stars', value: formatNumber(eng.stars) };
                else if (eng.likes && eng.likes > 0) primaryMetric = { label: 'likes', value: formatNumber(eng.likes) };
                else if (eng.downloads && eng.downloads > 0) primaryMetric = { label: 'downloads', value: formatNumber(eng.downloads) };
                else if (eng.claps && eng.claps > 0) primaryMetric = { label: 'claps', value: formatNumber(eng.claps) };
            }

            return {
                id: item.id,
                title: item.title,
                url: item.url,
                score,
                tierClass,
                sourceName,
                sourceIcon,
                timeAgo,
                primaryMetric,
                description: item.description,
                engagement: item.engagement,
                author: item.author,
                velocityScore: item.velocityScore,
            };
        }
    }, [items, sourceMap, sourceToCategory]);

    const hasFailures = data?.failures && data.failures.length > 0;
    const isStaleRefreshing = data?.staleRefreshing === true && !refreshDismissedRef.current && !isValidating;

    useEffect(() => {
        if (isStaleRefreshing && !skeletonDone) {
            setSkeletonDone(true);
        }
    }, [isStaleRefreshing, skeletonDone]);

    const handleRefreshComplete = useCallback(() => {
        refreshDismissedRef.current = true;
        refreshData();
    }, [refreshData]);

    return (
        <div className="dashboard">
            <header className={`dashboard-header-modern ${!isHeaderVisible ? 'header-hidden' : ''}`} role="banner">
                <div className="header-row">
                    {/* Logo */}
                    <div className="logo">
                        <Sparkles className="logo-icon" aria-hidden="true" />
                        <h1>AI trends / Beedo Studio</h1>
                    </div>

                    {/* Primary Controls */}
                    <div className="header-controls">
                        <FeedModeSelector activeMode={feedMode} onModeChange={setFeedMode} />
                        <div className="header-control-separator" aria-hidden="true" />
                        <TimeRangeDropdown activeRange={timeRange} onRangeChange={setTimeRange} />
                    </div>

                    {/* Settings */}
                    <Link href="/settings" className="settings-btn" aria-label="Open settings">
                        <Settings size={20} aria-hidden="true" />
                    </Link>
                </div>

                {/* Category Navigation - Compact Secondary Row */}
                <CollapsibleSourceTabs
                    categories={CATEGORIES}
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                    itemCounts={categoryCounts}
                    totalCount={items.length}
                />
            </header>

            <main id="main-content" className="dashboard-main" role="main" aria-label="AI Trends Content">
                {isStaleRefreshing && data?.refreshingSources && data.refreshingSources.length > 0 && (
                    <ConstellationRefreshWrapper
                        initialSources={data.refreshingSources}
                        onComplete={handleRefreshComplete}
                    />
                )}
                {hasFailures && (
                    <div className="warning-banner" role="alert" aria-live="polite">
                        <AlertTriangle size={16} aria-hidden="true" />
                        <span>
                            Some sources failed to load: {data?.failures?.map(f => f.source).join(', ')}
                        </span>
                    </div>
                )}
                {error ? (
                    <div className="error-message" role="alert">
                        <p>Failed to load content</p>
                        <button onClick={() => refreshData()} aria-label="Retry loading content">
                            Try Again
                        </button>
                    </div>
                ) : (items.length === 0 && isValidating && !skeletonDone) ? (
                    <SourceConstellation
                        sources={SOURCES.filter(s => s.enabled).map(s => ({
                            id: s.id,
                            name: s.name,
                            icon: s.icon || '?',
                            logoUrl: s.logoUrl,
                            category: s.category,
                            status: 'pending' as const,
                        }))}
                        percent={0}
                        isDone={false}
                        mode="skeleton"
                        onTransitionComplete={() => setSkeletonDone(true)}
                    />
                ) : (items.length > 0 && !skeletonDone && !isStaleRefreshing) ? (
                    <SourceConstellation
                        sources={SOURCES.filter(s => s.enabled).map(s => ({
                            id: s.id,
                            name: s.name,
                            icon: s.icon || '?',
                            logoUrl: s.logoUrl,
                            category: s.category,
                            status: 'pending' as const,
                        }))}
                        percent={0}
                        isDone={true}
                        mode="skeleton"
                        onTransitionComplete={() => setSkeletonDone(true)}
                    />
                ) : items.length === 0 && !isStaleRefreshing ? (
                    <div className="empty-state" role="status">
                        <div className="empty-state-icon">
                            <TrendingUp size={48} aria-hidden="true" />
                        </div>
                        <h2>No items found</h2>
                        <p>Try selecting a different category or feed mode.</p>
                    </div>
                ) : (
                    <>
                        {activeCategory === 'dashboard' ? (
                            <>
                                {kpiData && (
                                    <div className="kpi-grid">
                                        <div className="kpi-card kpi-total">
                                            <div className="kpi-icon"><Crown size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Top Source</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.topSourceName}</span>
                                            <span className="kpi-detail">{kpiData.topSourceCount} trending {kpiData.topSourceCount === 1 ? 'item' : 'items'}</span>
                                        </div>
                                        <div className="kpi-card kpi-trending">
                                            <div className="kpi-icon"><Hash size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Hottest Topic</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.hottestTopic || 'Varied'}</span>
                                            <span className="kpi-detail">{kpiData.hottestTopic ? `across ${kpiData.hottestTopicCount} top items` : 'no dominant theme'}</span>
                                        </div>
                                        <div className="kpi-card kpi-active">
                                            <div className="kpi-icon"><Rocket size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Biggest Mover</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.biggestMover?.sourceName || 'None yet'}</span>
                                            <span className="kpi-detail">{kpiData.biggestMover ? kpiData.biggestMover.title : 'no data yet'}</span>
                                        </div>
                                        <div className="kpi-card kpi-fresh">
                                            <div className="kpi-icon"><Activity size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Driving the Feed</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.drivingLabel}</span>
                                            <span className="kpi-detail">{kpiData.drivingCategoryCount} items leading the cycle</span>
                                        </div>
                                    </div>
                                )}

                                {categoryHighlights.length > 0 && (
                                    <CategoryHighlights groups={categoryHighlights} />
                                )}

                                <InsightCharts items={items} />
                                <TrendCharts items={items} />
                            </>
                        ) : (
                            <TooltipProvider delayDuration={300}>
                                <div className="content-grid" role="feed" aria-label="AI content feed">
                                    {items.map((item, index) => (
                                        <ContentCard key={item.id} item={item} isTouchDevice={isTouchDevice} style={{ '--card-delay': `${Math.min(index, 12) * 60}ms` } as any} />
                                    ))}
                                </div>
                            </TooltipProvider>
                        )}
                    </>
                )}
            </main>

            <footer className="dashboard-footer">
                <p>
                    Tracking <strong>{items.length}</strong> items from AI sources
                </p>
            </footer>
        </div>
    );
}
