'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { ContentItem, SourceCategory, TimeRange, FeedMode } from '@/types';
import { ContentCard } from '@/components/dashboard/ContentCard';
import { SourceTabs } from '@/components/dashboard/SourceTabs';
import { TrendCharts } from '@/components/dashboard/TrendCharts';
import { TimeRangeSelector } from './TimeRangeSelector';
import { FeedModeSelector } from './FeedModeSelector';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSettings } from '@/lib/contexts/SettingsContext';
import { Settings, Sparkles, TrendingUp, AlertTriangle, LayoutDashboard, LayoutList } from 'lucide-react';
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

export function DashboardClient({ initialItems }: DashboardClientProps) {
    const [activeCategory, setActiveCategory] = useState<SourceCategory | 'all' | 'dashboard'>('dashboard');
    const [timeRange, setTimeRange] = useState<TimeRange>('24h');
    const [feedMode, setFeedMode] = useState<FeedMode>('hot');
    const { isSourceEnabled } = useSettings();

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

    const hasFailures = data?.failures && data.failures.length > 0;

    return (
        <div className="dashboard">
            <header className="dashboard-header" role="banner">
                <div className="header-content">
                    <div className="logo">
                        <Sparkles className="logo-icon" aria-hidden="true" />
                        <h1>AI Trends</h1>
                    </div>

                    <div className="header-actions">
                        <FeedModeSelector activeMode={feedMode} onModeChange={setFeedMode} />
                        <TimeRangeSelector activeRange={timeRange} onRangeChange={setTimeRange} />
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
                        <button onClick={() => refreshData()} aria-label="Retry loading content">
                            Try Again
                        </button>
                    </div>
                ) : items.length === 0 ? (
                    <div className="empty-state" role="status">
                        <TrendingUp size={48} aria-hidden="true" />
                        <h2>No items found</h2>
                        <p>Try selecting a different category or feed mode.</p>
                    </div>
                ) : (
                    <>
                        {activeCategory === 'dashboard' ? (
                            <TrendCharts items={items} />
                        ) : (
                            <div className="content-grid" role="feed" aria-label="AI content feed">
                                {items.map((item) => (
                                    <ContentCard key={item.id} item={item} />
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
