'use client';

import { useState, useCallback, useMemo } from 'react';
import useSWR from 'swr';
import { ContentItem, SourceCategory } from '@/types';
import { ContentCard } from '@/components/dashboard/ContentCard';
import { SourceTabs } from '@/components/dashboard/SourceTabs';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { RefreshCw, Settings, Sparkles, TrendingUp, AlertTriangle, Flame, Clock } from 'lucide-react';
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SortMode = 'trending' | 'newest';

export function DashboardClient({ initialItems }: DashboardClientProps) {
    const [activeCategory, setActiveCategory] = useState<SourceCategory | 'all'>('all');
    const [manualRefresh, setManualRefresh] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('trending');
    const { enabledSources, isSourceEnabled, timeRange } = useSettings();

    // Build API URL with timeRange and category
    const apiUrl = useMemo(() => {
        const params = new URLSearchParams();
        if (activeCategory !== 'all') {
            params.set('category', activeCategory);
        }
        params.set('timeRange', timeRange);
        if (manualRefresh) {
            params.set('refresh', 'true');
        }
        return `/api/feed?${params.toString()}`;
    }, [activeCategory, timeRange, manualRefresh]);

    const { data, error, isValidating, mutate: refreshData } = useSWR<FeedResponse>(
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
            revalidateOnMount: false, // Don't immediately refetch - use server data
            dedupingInterval: 60000, // 1 minute
        }
    );

    // Filter items based on enabled sources and apply sorting
    const allItems = data?.items || [];
    const items = useMemo(() => {
        const filtered = allItems.filter((item) => isSourceEnabled(item.sourceId));

        if (sortMode === 'newest') {
            // Sort by publish date (newest first)
            return [...filtered].sort((a, b) =>
                new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
        }

        // Default: sort by trending score (already sorted from API, but ensure consistency)
        return [...filtered].sort((a, b) =>
            (b.trendingScore || 0) - (a.trendingScore || 0)
        );
    }, [allItems, isSourceEnabled, sortMode]);

    const lastUpdated = data?.fetchedAt ? new Date(data.fetchedAt) : null;
    const hasFailures = data?.failures && data.failures.length > 0;

    const handleRefresh = useCallback(() => {
        setManualRefresh(true);
        refreshData().finally(() => setManualRefresh(false));
    }, [refreshData]);

    return (
        <div className="dashboard">
            <header className="dashboard-header" role="banner">
                <div className="header-content">
                    <div className="logo">
                        <Sparkles className="logo-icon" aria-hidden="true" />
                        <h1>AI Trends</h1>
                    </div>
                    <div className="header-actions">
                        <div className="sort-toggle" role="group" aria-label="Sort order">
                            <button
                                className={`sort-btn ${sortMode === 'trending' ? 'active' : ''}`}
                                onClick={() => setSortMode('trending')}
                                aria-pressed={sortMode === 'trending'}
                            >
                                <Flame size={14} aria-hidden="true" />
                                Trending
                            </button>
                            <button
                                className={`sort-btn ${sortMode === 'newest' ? 'active' : ''}`}
                                onClick={() => setSortMode('newest')}
                                aria-pressed={sortMode === 'newest'}
                            >
                                <Clock size={14} aria-hidden="true" />
                                Newest
                            </button>
                        </div>
                        {lastUpdated && (
                            <span className="last-updated" aria-live="polite">
                                Updated {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            className="refresh-btn"
                            onClick={handleRefresh}
                            disabled={isValidating}
                            aria-label={isValidating ? 'Refreshing feed...' : 'Refresh feed'}
                            aria-busy={isValidating}
                        >
                            <RefreshCw className={isValidating ? 'spinning' : ''} size={20} aria-hidden="true" />
                        </button>
                        <Link href="/settings" className="settings-btn" aria-label="Open settings">
                            <Settings size={20} aria-hidden="true" />
                        </Link>
                    </div>
                </div>

                <SourceTabs
                    categories={CATEGORIES}
                    activeCategory={activeCategory}
                    onCategoryChange={setActiveCategory}
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
                        <button onClick={handleRefresh} aria-label="Retry loading content">
                            Try Again
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty-state" role="status">
                        <TrendingUp size={48} aria-hidden="true" />
                        <h2>No items found</h2>
                        <p>Try selecting a different category or refresh the feed.</p>
                    </div>
                ) : (
                    <>
                        {activeCategory === 'all' && <TrendCharts items={items} />}
                        <div className="content-grid" role="feed" aria-label="AI content feed">
                            {items.map((item) => (
                                <ContentCard key={item.id} item={item} />
                            ))}
                        </div>
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
