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
import { Settings, Sparkles, TrendingUp, AlertTriangle, Activity, Zap, Flame, Gem, Clock } from 'lucide-react';
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

const fetcher = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.error || `HTTP ${res.status}`);
        (err as Error & { info: unknown }).info = body;
        throw err;
    }
    return res.json();
};

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
            // Refresh sooner (30s) when we have no items yet (background fetch likely in progress),
            // otherwise every 5 minutes
            refreshInterval: (latestData) =>
                (latestData?.count === 0 && latestData?.staleRefreshing) ? 30_000 : 5 * 60 * 1000,
            // Shorter dedup when empty — allows faster retry after background refresh completes
            dedupingInterval: 15000,
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

        const genericTags = new Set([
            'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
            'tech', 'technology', 'other', 'none', 'general', 'misc', 'discussion',
            'en', 'us', 'question', 'help', 'showcase', 'news',
        ]);
        const junkPatterns = [/^region:/, /^lang:/, /^license:/, /^type:/, /^v\d/, /^\d+$/, /^question\s*-/i];
        const isUsefulTag = (t: string) =>
            t.length > 2 && !genericTags.has(t) && !junkPatterns.some(p => p.test(t));

        const titleStopWords = new Set([
            'about', 'also', 'been', 'best', 'code', 'could', 'data', 'does',
            'even', 'first', 'from', 'full', 'have', 'here', 'high', 'into',
            'just', 'last', 'like', 'made', 'make', 'more', 'most', 'much',
            'next', 'only', 'open', 'over', 'some', 'than', 'that', 'them',
            'then', 'they', 'this', 'tool', 'tools', 'very', 'want', 'were',
            'what', 'when', 'will', 'with', 'your',
        ]);

        const sorted = [...items].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
        const usedUrls = new Set<string>();

        // Helper: get engagement string for an item
        function getEngagementProof(item: ContentItem): string | null {
            const eng = item.engagement;
            if (!eng) return null;
            if (eng.views && eng.views > 0) return `${formatNumber(eng.views)} views`;
            if (eng.stars && eng.stars > 0) return `${formatNumber(eng.stars)} stars`;
            if (eng.upvotes && eng.upvotes > 0) return `${formatNumber(eng.upvotes)} upvotes`;
            if (eng.likes && eng.likes > 0) return `${formatNumber(eng.likes)} likes`;
            if (eng.downloads && eng.downloads > 0) return `${formatNumber(eng.downloads)} downloads`;
            if (eng.claps && eng.claps > 0) return `${formatNumber(eng.claps)} claps`;
            return null;
        }

        // --- 1. Cross-Source Signal: topic appearing in most distinct categories ---
        // Extract signals from titles AND tags
        const signalData: Record<string, { cats: Set<string>; count: number; totalScore: number }> = {};
        for (const item of items) {
            const cat = sourceToCategory[item.sourceId] || 'other';
            const seen = new Set<string>();

            // Title words
            const titleWords = item.title.toLowerCase().split(/[^a-z]+/).filter(
                w => w.length >= 4 && !titleStopWords.has(w) && !genericTags.has(w)
            );
            for (const w of titleWords) {
                if (!seen.has(w)) {
                    seen.add(w);
                    if (!signalData[w]) signalData[w] = { cats: new Set(), count: 0, totalScore: 0 };
                    signalData[w].cats.add(cat);
                    signalData[w].count += 1;
                    signalData[w].totalScore += (item.trendingScore || 0);
                }
            }

            // Tags + matchedKeywords
            const allTags = [...(item.tags || []), ...(item.matchedKeywords || [])];
            for (const tag of allTags) {
                const t = tag.toLowerCase().trim();
                if (t && isUsefulTag(t) && !seen.has(t)) {
                    seen.add(t);
                    if (!signalData[t]) signalData[t] = { cats: new Set(), count: 0, totalScore: 0 };
                    signalData[t].cats.add(cat);
                    signalData[t].count += 1;
                    signalData[t].totalScore += (item.trendingScore || 0);
                }
            }
        }

        let crossSourceTopic = '';
        let crossSourceCatCount = 0;
        let crossSourceItemCount = 0;
        let crossSourceAvgScore = 0;
        for (const [signal, data] of Object.entries(signalData)) {
            if (data.cats.size < 2) continue;
            const avg = data.totalScore / data.count;
            if (
                data.cats.size > crossSourceCatCount ||
                (data.cats.size === crossSourceCatCount && data.count > crossSourceItemCount) ||
                (data.cats.size === crossSourceCatCount && data.count === crossSourceItemCount && avg > crossSourceAvgScore)
            ) {
                crossSourceTopic = signal;
                crossSourceCatCount = data.cats.size;
                crossSourceItemCount = data.count;
                crossSourceAvgScore = avg;
            }
        }

        let crossSource: { topic: string; catCount: number; article: { title: string; url: string } } | null = null;
        if (crossSourceTopic) {
            // Find highest-scored item containing the winning signal
            for (const item of sorted) {
                const titleWords = new Set(item.title.toLowerCase().split(/[^a-z]+/));
                const allTags = [...(item.tags || []), ...(item.matchedKeywords || [])].map(t => t.toLowerCase().trim());
                if (titleWords.has(crossSourceTopic) || allTags.includes(crossSourceTopic)) {
                    crossSource = {
                        topic: crossSourceTopic,
                        catCount: crossSourceCatCount,
                        article: {
                            title: item.title.length > 50 ? item.title.slice(0, 50) + '...' : item.title,
                            url: item.url,
                        },
                    };
                    usedUrls.add(item.url);
                    break;
                }
            }
        }

        // --- 2. Top Read: highest-scored article with engagement proof ---
        let topRead: { title: string; url: string; sourceName: string; engagementProof: string } | null = null;
        for (const item of sorted) {
            if (usedUrls.has(item.url)) continue;
            const proof = getEngagementProof(item) || `score ${Math.round(item.trendingScore || 0)}`;
            topRead = {
                title: item.title.length > 50 ? item.title.slice(0, 50) + '...' : item.title,
                url: item.url,
                sourceName: sourceMap[item.sourceId]?.name || item.sourceId,
                engagementProof: proof,
            };
            usedUrls.add(item.url);
            break;
        }

        // --- 3. Hidden Gem: highest-scoring item from underrepresented category ---
        let hiddenGem: { title: string; url: string; sourceName: string; categoryLabel: string; score: number } | null = null;
        const catAvgScores: Record<string, { total: number; count: number }> = {};
        for (const item of items) {
            const cat = sourceToCategory[item.sourceId];
            if (!cat) continue;
            if (!catAvgScores[cat]) catAvgScores[cat] = { total: 0, count: 0 };
            catAvgScores[cat].total += (item.trendingScore || 0);
            catAvgScores[cat].count += 1;
        }
        const catRanked = Object.entries(catAvgScores)
            .map(([cat, d]) => ({ cat, avg: d.total / d.count }))
            .sort((a, b) => b.avg - a.avg);

        if (catRanked.length >= 3) {
            const bottomHalf = new Set(catRanked.slice(Math.ceil(catRanked.length / 2)).map(c => c.cat));
            for (const item of sorted) {
                if (usedUrls.has(item.url)) continue;
                const cat = sourceToCategory[item.sourceId];
                if (cat && bottomHalf.has(cat)) {
                    hiddenGem = {
                        title: item.title.length > 45 ? item.title.slice(0, 45) + '...' : item.title,
                        url: item.url,
                        sourceName: sourceMap[item.sourceId]?.name || item.sourceId,
                        categoryLabel: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat,
                        score: Math.round(item.trendingScore || 0),
                    };
                    usedUrls.add(item.url);
                    break;
                }
            }
        }
        if (!hiddenGem) {
            for (const item of sorted) {
                if (usedUrls.has(item.url)) continue;
                const cat = sourceToCategory[item.sourceId] || '';
                hiddenGem = {
                    title: item.title.length > 45 ? item.title.slice(0, 45) + '...' : item.title,
                    url: item.url,
                    sourceName: sourceMap[item.sourceId]?.name || item.sourceId,
                    categoryLabel: CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat,
                    score: Math.round(item.trendingScore || 0),
                };
                usedUrls.add(item.url);
                break;
            }
        }

        // --- 4. Just In: freshest article above quality floor ---
        let justIn: { title: string; url: string; sourceName: string; timeAgo: string } | null = null;
        const byFreshness = [...items].sort((a, b) => {
            const da = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const db = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return db - da;
        });

        // Try threshold 40, then 20, then any
        for (const threshold of [40, 20, 0]) {
            for (const item of byFreshness) {
                if (usedUrls.has(item.url)) continue;
                if ((item.trendingScore || 0) < threshold) continue;
                let timeAgo = '';
                try {
                    const pubDate = item.publishedAt instanceof Date ? item.publishedAt : new Date(item.publishedAt);
                    timeAgo = formatDistanceToNow(pubDate, { addSuffix: true });
                } catch {
                    timeAgo = 'recently';
                }
                justIn = {
                    title: item.title.length > 50 ? item.title.slice(0, 50) + '...' : item.title,
                    url: item.url,
                    sourceName: sourceMap[item.sourceId]?.name || item.sourceId,
                    timeAgo,
                };
                usedUrls.add(item.url);
                break;
            }
            if (justIn) break;
        }

        return { crossSource, topRead, hiddenGem, justIn };
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

        // Sort by average score of top 3 picked items (fairer than raw top-item score),
        // then apply a daily rotation offset so a different category leads each day
        groups.sort((a, b) => {
            const avgA = a.items.reduce((s, i) => s + i.score, 0) / a.items.length;
            const avgB = b.items.reduce((s, i) => s + i.score, 0) / b.items.length;
            return avgB - avgA;
        });
        // Daily rotation: shift the sorted array by (dayOfYear % groupCount)
        if (groups.length > 1) {
            const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
            const offset = dayOfYear % groups.length;
            const rotated = [...groups.slice(offset), ...groups.slice(0, offset)];
            groups.length = 0;
            groups.push(...rotated);
        }

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

    // Interleave items across categories for multi-category views (Fix D)
    // Uses weighted round-robin: pick top unpicked item from each category per round
    const interleavedItems = useMemo(() => {
        // Only interleave for multi-category views
        if (activeCategory !== 'all' && activeCategory !== 'dashboard') return items;
        if (items.length === 0) return items;

        // Group by category, each group pre-sorted by score (items already sorted)
        const queues = new Map<string, ContentItem[]>();
        for (const item of items) {
            const cat = sourceToCategory[item.sourceId] || 'unknown';
            if (!queues.has(cat)) queues.set(cat, []);
            queues.get(cat)!.push(item);
        }

        // Weighted round-robin: take top item from each category per round
        const result: ContentItem[] = [];
        const cursors = new Map<string, number>();
        for (const cat of queues.keys()) cursors.set(cat, 0);

        while (result.length < items.length) {
            const roundItems: ContentItem[] = [];
            for (const [cat, queue] of queues) {
                const idx = cursors.get(cat)!;
                if (idx < queue.length) {
                    roundItems.push(queue[idx]);
                    cursors.set(cat, idx + 1);
                }
            }
            if (roundItems.length === 0) break;
            // Sort items within each round by score (best first)
            roundItems.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
            result.push(...roundItems);
        }

        return result;
    }, [items, activeCategory, sourceToCategory]);

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
                                        <a href={kpiData.crossSource?.article.url || undefined} target="_blank" rel="noopener noreferrer" className={`kpi-card kpi-trending${kpiData.crossSource ? ' kpi-link' : ''}`}>
                                            <div className="kpi-icon"><Zap size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Cross-Source Signal</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.crossSource?.topic || 'No cross-source signal'}</span>
                                            <span className="kpi-detail">{kpiData.crossSource ? `${kpiData.crossSource.article.title} · ${kpiData.crossSource.catCount} categories` : 'No topic spans 2+ categories'}</span>
                                        </a>
                                        <a href={kpiData.topRead?.url || undefined} target="_blank" rel="noopener noreferrer" className={`kpi-card kpi-total${kpiData.topRead ? ' kpi-link' : ''}`}>
                                            <div className="kpi-icon"><Flame size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Top Read</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.topRead?.title || 'None found'}</span>
                                            <span className="kpi-detail">{kpiData.topRead ? `${kpiData.topRead.sourceName} · ${kpiData.topRead.engagementProof}` : 'Not enough data'}</span>
                                        </a>
                                        <a href={kpiData.hiddenGem?.url || undefined} target="_blank" rel="noopener noreferrer" className={`kpi-card kpi-fresh${kpiData.hiddenGem ? ' kpi-link' : ''}`}>
                                            <div className="kpi-icon"><Gem size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Hidden Gem</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.hiddenGem?.title || 'None found'}</span>
                                            <span className="kpi-detail">{kpiData.hiddenGem ? `${kpiData.hiddenGem.sourceName} · ${kpiData.hiddenGem.categoryLabel} · score ${kpiData.hiddenGem.score}` : 'Not enough data'}</span>
                                        </a>
                                        <a href={kpiData.justIn?.url || undefined} target="_blank" rel="noopener noreferrer" className={`kpi-card kpi-active${kpiData.justIn ? ' kpi-link' : ''}`}>
                                            <div className="kpi-icon"><Clock size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Just In</span>
                                            <span className="kpi-value kpi-value-text">{kpiData.justIn?.title || 'Nothing recent'}</span>
                                            <span className="kpi-detail">{kpiData.justIn ? `${kpiData.justIn.sourceName} · published ${kpiData.justIn.timeAgo}` : 'No recent items'}</span>
                                        </a>
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
                                    {interleavedItems.map((item, index) => (
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
