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
import { Settings, Sparkles, TrendingUp, AlertTriangle, LayoutDashboard, LayoutList, Flame, Clock, Activity } from 'lucide-react';
import { SOURCES } from '@/lib/config/sources';
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

function formatSourceName(sourceId: string): string {
    return sourceId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

    const kpiData = useMemo(() => {
        if (items.length === 0) return null;
        const topItem = items.reduce((best, item) =>
            (item.trendingScore || 0) > (best.trendingScore || 0) ? item : best
        , items[0]);
        const sourceCounts: Record<string, number> = {};
        items.forEach(item => { sourceCounts[item.sourceId] = (sourceCounts[item.sourceId] || 0) + 1; });
        const topEntry = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const freshCount = items.filter(item => new Date(item.publishedAt) > oneHourAgo).length;
        return {
            total: items.length,
            topScore: topItem?.trendingScore || 0,
            topTitle: topItem?.title || '',
            topSourceId: topEntry?.[0] || '',
            topSourceCount: topEntry?.[1] || 0,
            freshCount,
        };
    }, [items]);

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
                                            <div className="kpi-icon"><LayoutList size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Total Items</span>
                                            <span className="kpi-value">{kpiData.total}</span>
                                        </div>
                                        <div className="kpi-card kpi-trending">
                                            <div className="kpi-icon"><Flame size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Top Trending</span>
                                            <span className="kpi-value">{kpiData.topScore}</span>
                                            <span className="kpi-detail">{kpiData.topTitle.length > 40 ? kpiData.topTitle.slice(0, 40) + '…' : kpiData.topTitle}</span>
                                        </div>
                                        <div className="kpi-card kpi-active">
                                            <div className="kpi-icon"><Activity size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Top Source</span>
                                            <span className="kpi-value">{kpiData.topSourceCount}</span>
                                            <span className="kpi-detail">{formatSourceName(kpiData.topSourceId)}</span>
                                        </div>
                                        <div className="kpi-card kpi-fresh">
                                            <div className="kpi-icon"><Clock size={20} aria-hidden="true" /></div>
                                            <span className="kpi-label">Last Hour</span>
                                            <span className="kpi-value">{kpiData.freshCount}</span>
                                            <span className="kpi-detail">{kpiData.freshCount === 1 ? 'new item' : 'new items'}</span>
                                        </div>
                                    </div>
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
