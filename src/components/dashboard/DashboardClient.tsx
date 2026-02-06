'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { ContentItem, SourceCategory, TimeRange, FeedMode } from '@/types';
import { ContentCard } from '@/components/dashboard/ContentCard';
import { CollapsibleSourceTabs } from '@/components/dashboard/CollapsibleSourceTabs';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { TimeRangeDropdown } from './TimeRangeDropdown';
import { FeedModeSelector } from './FeedModeSelector';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { Settings, Sparkles, TrendingUp, AlertTriangle, Flame, Activity, Zap, Gauge } from 'lucide-react';
import { SOURCES } from '@/lib/config/sources';
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
    failures?: { source: string; error: string }[];
}

const CATEGORIES: SourceCategory[] = [
    'ai-labs',
    'creative-ai',
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
    const lastScrollY = useRef(0);

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

    // Build API URL with time range, category, and feed mode
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams();
        params.set('timeRange', timeRange);
        params.set('mode', feedMode);
        if (activeCategory !== 'all' && activeCategory !== 'dashboard') {
            params.set('category', activeCategory);
        }
        return `/api/feed?${params.toString()}`;
    }, [timeRange, feedMode, activeCategory]);

    const { data, error, mutate: refreshData } = useSWR<FeedResponse>(
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
        }
    );

    // Filter items based on enabled sources (sorting is done by API based on feedMode)
    const allItems = data?.items || [];
    const items = useMemo(() => {
        return allItems.filter((item) => isSourceEnabled(item.sourceId));
    }, [allItems, isSourceEnabled]);

    const sourceToCategory = useMemo(() => {
        const map: Record<string, string> = {};
        SOURCES.forEach(s => { map[s.id] = s.category; });
        return map;
    }, []);

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
        const map: Record<string, { name: string }> = {};
        SOURCES.forEach(s => { map[s.id] = { name: s.name }; });
        return map;
    }, []);

    const kpiData = useMemo(() => {
        if (items.length === 0) return null;

        const hotCount = items.filter(item => (item.trendingScore || 0) >= 60).length;
        const totalScore = items.reduce((sum, item) => sum + (item.trendingScore || 0), 0);
        const avgScore = Math.round((totalScore / items.length) * 10) / 10;
        const scoreClass = avgScore >= 60 ? 'On Fire' : avgScore >= 40 ? 'Active' : avgScore >= 20 ? 'Moderate' : 'Quiet';
        const risingCount = items.filter(item => (item.velocityScore || 0) > 0).length;
        const activeSourceIds = new Set(items.map(item => item.sourceId));
        const activeSourceCount = activeSourceIds.size;
        const totalSourceCount = SOURCES.length;

        return {
            hotCount,
            avgScore,
            scoreClass,
            risingCount,
            activeSourceCount,
            totalSourceCount,
        };
    }, [items]);

    const highlights = useMemo(() => {
        if (items.length === 0) return [];

        const sorted = [...items].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
        const top5 = sorted.slice(0, 5);

        return top5.map(item => {
            const score = item.trendingScore || 0;
            const tierClass = score >= 60 ? 'score-hot' : score >= 40 ? 'score-trending' : score >= 20 ? 'score-notable' : 'score-default';
            const sourceName = sourceMap[item.sourceId]?.name || item.sourceId;

            let timeAgo: string;
            try {
                const pubDate = item.publishedAt instanceof Date ? item.publishedAt : new Date(item.publishedAt);
                timeAgo = formatDistanceToNow(pubDate, { addSuffix: true });
            } catch {
                timeAgo = '';
            }

            // Extract primary engagement metric
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
                timeAgo,
                primaryMetric,
            };
        });
    }, [items, sourceMap]);

    const hasFailures = data?.failures && data.failures.length > 0;

    return (
        <div className="dashboard">
            <header className={`dashboard-header ${!isHeaderVisible ? 'header-hidden' : ''}`} role="banner">
                <div className="header-content">
                    <div className="logo">
                        <Sparkles className="logo-icon" aria-hidden="true" />
                        <h1>AI Trends</h1>
                    </div>

                    <div className="header-actions">
                        <FeedModeSelector activeMode={feedMode} onModeChange={setFeedMode} />
                        <TimeRangeDropdown activeRange={timeRange} onRangeChange={setTimeRange} />
                        <Link href="/settings" className="settings-btn" aria-label="Open settings">
                            <Settings size={20} aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                <CollapsibleSourceTabs
                    categories={CATEGORIES}
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
                    itemCounts={categoryCounts}
                    totalCount={items.length}
                />
            </header>

            <main id="main-content" className="dashboard-main" role="main" aria-label="AI Trends Content">
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
                ) : items.length === 0 ? (
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
                                            <div className="kpi-icon"><Flame size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Hot Right Now</span>
                                            <span className="kpi-value">{kpiData.hotCount}</span>
                                            <span className="kpi-detail">score &ge; 60</span>
                                        </div>
                                        <div className="kpi-card kpi-trending">
                                            <div className="kpi-icon"><Gauge size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Avg Score</span>
                                            <span className="kpi-value">{kpiData.avgScore}</span>
                                            <span className="kpi-detail">{kpiData.scoreClass}</span>
                                        </div>
                                        <div className="kpi-card kpi-active">
                                            <div className="kpi-icon"><TrendingUp size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Rising Fast</span>
                                            <span className="kpi-value">{kpiData.risingCount}</span>
                                            <span className="kpi-detail">velocity &gt; 0</span>
                                        </div>
                                        <div className="kpi-card kpi-fresh">
                                            <div className="kpi-icon"><Activity size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Sources Active</span>
                                            <span className="kpi-value">{kpiData.activeSourceCount}/{kpiData.totalSourceCount}</span>
                                            <span className="kpi-detail">sources with content</span>
                                        </div>
                                    </div>
                                )}

                                {highlights.length > 0 && (
                                    <section className="highlights-section">
                                        <div className="highlights-header">
                                            <h2><Zap size={20} aria-hidden="true" /> Must-Read Highlights</h2>
                                        </div>
                                        <div className="highlights-list">
                                            {highlights.map(item => (
                                                <a
                                                    key={item.id}
                                                    href={item.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="highlight-item"
                                                >
                                                    <div className={`highlight-score ${item.tierClass}`}>
                                                        {item.score}
                                                    </div>
                                                    <div className="highlight-content">
                                                        <span className="highlight-source">{item.sourceName}</span>
                                                        <span className="highlight-title">{item.title}</span>
                                                        <span className="highlight-time">{item.timeAgo}</span>
                                                    </div>
                                                    {item.primaryMetric && (
                                                        <span className="highlight-metric">
                                                            {item.primaryMetric.value} {item.primaryMetric.label}
                                                        </span>
                                                    )}
                                                </a>
                                            ))}
                                        </div>
                                    </section>
                                )}

                                <TrendCharts items={items} />
                            </>
                        ) : (
                            <div className="content-grid" role="feed" aria-label="AI content feed">
                                {items.map((item, index) => (
                                    <ContentCard key={item.id} item={item} style={{ '--card-delay': `${Math.min(index, 12) * 60}ms` } as any} />
                                ))}
                            </div>
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
