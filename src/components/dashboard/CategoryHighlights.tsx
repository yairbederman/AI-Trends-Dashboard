'use client';

import { memo, useState, useEffect } from 'react';
import { Zap, Eye, ThumbsUp, MessageSquare, Star, Download, Heart, GitFork, Info } from 'lucide-react';
import { SourceCategory, CATEGORY_LABELS, CATEGORY_COLORS, EngagementMetrics } from '@/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';

export interface HighlightItem {
    id: string;
    title: string;
    url: string;
    score: number;
    tierClass: string;
    sourceName: string;
    sourceIcon: string;
    timeAgo: string;
    primaryMetric: { label: string; value: string } | null;
    description?: string;
    engagement?: EngagementMetrics;
    author?: string;
    velocityScore?: number;
}

export interface CategoryHighlightGroup {
    category: SourceCategory;
    items: HighlightItem[];
}

interface CategoryHighlightsProps {
    groups: CategoryHighlightGroup[];
}

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
}

function HighlightTooltip({ item }: { item: HighlightItem }) {
    const eng = item.engagement;

    // Filter out generic/unhelpful descriptions
    const isGenericDescription = (desc: string | undefined): boolean => {
        if (!desc) return true;
        const lower = desc.toLowerCase().trim();
        const genericPatterns = [
            'discussion on hacker news',
            'comments on hacker news',
            'discussion on hackernews',
            'submitted by',
            'posted in',
            'discussion in',
            'thread on',
            'comments',
            'discuss this',
        ];
        return genericPatterns.some(pattern => lower.includes(pattern)) || lower.length < 20;
    };

    // Use description only if it's meaningful
    const meaningfulDescription = !isGenericDescription(item.description) ? item.description : undefined;

    // Collect all available engagement metrics
    const metrics = [];
    if (eng?.views && eng.views > 0) metrics.push({ icon: Eye, label: 'views', value: formatNumber(eng.views) });
    if (eng?.upvotes && eng.upvotes > 0) metrics.push({ icon: ThumbsUp, label: 'upvotes', value: formatNumber(eng.upvotes) });
    if (eng?.stars && eng.stars > 0) metrics.push({ icon: Star, label: 'stars', value: formatNumber(eng.stars) });
    if (eng?.likes && eng.likes > 0) metrics.push({ icon: Heart, label: 'likes', value: formatNumber(eng.likes) });
    if (eng?.comments && eng.comments > 0) metrics.push({ icon: MessageSquare, label: 'comments', value: formatNumber(eng.comments) });
    if (eng?.downloads && eng.downloads > 0) metrics.push({ icon: Download, label: 'downloads', value: formatNumber(eng.downloads) });

    const hasContent = meaningfulDescription || metrics.length > 0 || item.author;

    if (!hasContent) {
        return null;
    }

    // Case 1: Has meaningful description - show summary style
    if (meaningfulDescription) {
        const topMetric = metrics[0];
        return (
            <div>
                <div className="tooltip-description">
                    {meaningfulDescription.length > 150
                        ? meaningfulDescription.slice(0, 150) + '...'
                        : meaningfulDescription}
                </div>
                {(topMetric || item.author) && (
                    <div className="tooltip-footer">
                        {item.author && (
                            <span className="tooltip-footer-item">
                                by {item.author}
                            </span>
                        )}
                        {topMetric && (
                            <span className="tooltip-footer-item tooltip-footer-metric">
                                <topMetric.icon size={14} />
                                {topMetric.value} {topMetric.label}
                            </span>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Case 2: No description, but has metrics - show engagement data
    return (
        <div>
            {item.author && (
                <div className="tooltip-description" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '0.5rem' }}>
                    by {item.author}
                </div>
            )}
            <div className="tooltip-metrics-compact">
                {metrics.slice(0, 3).map((metric, idx) => (
                    <div key={idx} className="tooltip-metric-compact">
                        <metric.icon size={14} />
                        <span className="tooltip-metric-compact-value">{metric.value}</span>
                        <span className="tooltip-metric-compact-label">{metric.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function LaneCard({ item, isTouchDevice }: { item: HighlightItem; isTouchDevice: boolean }) {
    const [mobileOpen, setMobileOpen] = useState(false);

    // Close tooltip on outside touch
    useEffect(() => {
        if (!mobileOpen) return;
        const close = (e: TouchEvent) => {
            // Don't close if touching the tooltip itself
            if ((e.target as Element)?.closest?.('.tooltip-content')) return;
            setMobileOpen(false);
        };
        document.addEventListener('touchstart', close);
        return () => document.removeEventListener('touchstart', close);
    }, [mobileOpen]);

    return (
        <Tooltip
            open={isTouchDevice ? mobileOpen : undefined}
            onOpenChange={isTouchDevice ? setMobileOpen : undefined}
        >
            <TooltipTrigger asChild>
                <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="lane-card"
                    title={item.title}
                >
                    <div
                        className={`highlight-score ${item.tierClass}`}
                        aria-label={`Score: ${item.score}`}
                    >
                        {item.score}
                    </div>
                    <div className="lane-card-body">
                        <span className="lane-card-source">
                            {item.sourceIcon && <span className="lane-card-emoji" aria-hidden="true">{item.sourceIcon}</span>}
                            {item.sourceName}
                        </span>
                        <span className="lane-card-title">{item.title}</span>
                    </div>
                    <div className="lane-card-meta">
                        {item.timeAgo ? (
                            <span className="lane-card-time">{item.timeAgo}</span>
                        ) : null}
                        {item.primaryMetric ? (
                            <span className="lane-card-metric">
                                {item.primaryMetric.value} {item.primaryMetric.label}
                            </span>
                        ) : null}
                    </div>
                    {isTouchDevice && (
                        <span
                            className="lane-card-info"
                            role="button"
                            tabIndex={0}
                            aria-label="Show details"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMobileOpen(prev => !prev);
                            }}
                        >
                            <Info size={14} />
                        </span>
                    )}
                </a>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
                <HighlightTooltip item={item} />
            </TooltipContent>
        </Tooltip>
    );
}

export const CategoryHighlights = memo(function CategoryHighlights({ groups }: CategoryHighlightsProps) {
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);
    const [isTouchDevice, setIsTouchDevice] = useState(false);

    useEffect(() => {
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    }, []);

    return (
        <TooltipProvider delayDuration={300}>
            <section className="highlights-section" aria-label="Must-Read Highlights">
                <div className="highlights-header">
                    <h2><Zap size={20} aria-hidden="true" /> Must-Read Highlights</h2>
                    <span className="highlights-subtitle">
                        {totalItems} across {groups.length} categories
                    </span>
                </div>

                <div className="highlights-lanes">
                    {groups.map((group, groupIndex) => {
                        const laneId = `lane-${group.category}`;
                        return (
                            <div
                                key={group.category}
                                className={`highlights-lane${groupIndex === 0 ? ' lane-featured' : ''}`}
                                role="region"
                                aria-labelledby={laneId}
                                style={{ '--lane-delay': `${groupIndex * 80}ms` } as React.CSSProperties}
                            >
                                <div className="lane-header">
                                    <span
                                        className="lane-dot"
                                        style={{ backgroundColor: CATEGORY_COLORS[group.category] }}
                                        aria-hidden="true"
                                    />
                                    <h3 className="lane-category-name" id={laneId}>
                                        {CATEGORY_LABELS[group.category]}
                                    </h3>
                                </div>
                                <div className="lane-cards">
                                    {group.items.map(item => (
                                        <LaneCard key={item.id} item={item} isTouchDevice={isTouchDevice} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        </TooltipProvider>
    );
});
