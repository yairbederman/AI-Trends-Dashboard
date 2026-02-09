'use client';

import { memo } from 'react';
import { Zap, Eye, ThumbsUp, MessageSquare, Star, Download, Heart, GitFork } from 'lucide-react';
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
    // Find the most relevant engagement metric to show
    const getTopMetric = () => {
        const eng = item.engagement;
        if (!eng) return null;

        if (eng.views && eng.views > 0) return { icon: Eye, label: 'views', value: formatNumber(eng.views) };
        if (eng.upvotes && eng.upvotes > 0) return { icon: ThumbsUp, label: 'upvotes', value: formatNumber(eng.upvotes) };
        if (eng.stars && eng.stars > 0) return { icon: Star, label: 'stars', value: formatNumber(eng.stars) };
        if (eng.likes && eng.likes > 0) return { icon: Heart, label: 'likes', value: formatNumber(eng.likes) };
        if (eng.downloads && eng.downloads > 0) return { icon: Download, label: 'downloads', value: formatNumber(eng.downloads) };
        if (eng.comments && eng.comments > 0) return { icon: MessageSquare, label: 'comments', value: formatNumber(eng.comments) };
        return null;
    };

    const topMetric = getTopMetric();
    const hasContent = item.description || topMetric || item.author;

    if (!hasContent) {
        return null;
    }

    return (
        <div>
            {/* Summary/Description - Main content */}
            {item.description && (
                <div className="tooltip-description">
                    {item.description.length > 150
                        ? item.description.slice(0, 150) + '...'
                        : item.description}
                </div>
            )}

            {/* Compact metadata at bottom */}
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

export const CategoryHighlights = memo(function CategoryHighlights({ groups }: CategoryHighlightsProps) {
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

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
                                        <Tooltip key={item.id}>
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
                                                </a>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" align="center">
                                                <HighlightTooltip item={item} />
                                            </TooltipContent>
                                        </Tooltip>
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
