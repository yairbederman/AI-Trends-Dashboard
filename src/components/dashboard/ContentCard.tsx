'use client';

import { useState, useEffect } from 'react';
import { ContentItem, EngagementMetrics } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import {
    ExternalLink, TrendingUp, Flame, MessageCircle, Star, ArrowUp, Zap,
    Eye, ThumbsUp, GitFork, Download, Hand, Reply, Info
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';

interface ContentCardProps {
    item: ContentItem;
    style?: React.CSSProperties;
    isTouchDevice: boolean;
}

function formatSourceName(sourceId: string): string {
    return sourceId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function getScoreInfo(score: number): { label: string; className: string } {
    if (score >= 80) return { label: 'Hot', className: 'score-hot' };
    if (score >= 60) return { label: 'Trending', className: 'score-trending' };
    if (score >= 40) return { label: 'Notable', className: 'score-notable' };
    return { label: '', className: '' };
}

function getPerformanceLevel(score: number | undefined): { level: string; className: string } {
    if (!score) return { level: '', className: '' };
    if (score >= 80) return { level: 'exceptional', className: 'perf-exceptional' };
    if (score >= 60) return { level: 'high', className: 'perf-high' };
    if (score >= 40) return { level: 'good', className: 'perf-good' };
    if (score >= 20) return { level: 'moderate', className: 'perf-moderate' };
    return { level: 'low', className: 'perf-low' };
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

interface MetricDisplay {
    icon: typeof Eye;
    value: number;
    label: string;
    priority: number; // For sorting - lower = more important
}

function getEngagementMetrics(engagement: EngagementMetrics | undefined): MetricDisplay[] {
    if (!engagement) return [];

    const metrics: MetricDisplay[] = [];

    // Primary metrics (higher priority)
    if (engagement.views !== undefined && engagement.views > 0) {
        metrics.push({ icon: Eye, value: engagement.views, label: 'views', priority: 1 });
    }
    if (engagement.upvotes !== undefined && engagement.upvotes > 0) {
        metrics.push({ icon: ArrowUp, value: engagement.upvotes, label: 'points', priority: 2 });
    }
    if (engagement.stars !== undefined && engagement.stars > 0) {
        metrics.push({ icon: Star, value: engagement.stars, label: 'stars', priority: 2 });
    }
    if (engagement.likes !== undefined && engagement.likes > 0) {
        metrics.push({ icon: ThumbsUp, value: engagement.likes, label: 'likes', priority: 3 });
    }
    if (engagement.claps !== undefined && engagement.claps > 0) {
        metrics.push({ icon: Hand, value: engagement.claps, label: 'claps', priority: 3 });
    }
    if (engagement.downloads !== undefined && engagement.downloads > 0) {
        metrics.push({ icon: Download, value: engagement.downloads, label: 'downloads', priority: 3 });
    }

    // Secondary metrics
    if (engagement.forks !== undefined && engagement.forks > 0) {
        metrics.push({ icon: GitFork, value: engagement.forks, label: 'forks', priority: 4 });
    }
    if (engagement.comments !== undefined && engagement.comments > 0) {
        metrics.push({ icon: MessageCircle, value: engagement.comments, label: 'comments', priority: 5 });
    }
    if (engagement.responses !== undefined && engagement.responses > 0) {
        metrics.push({ icon: Reply, value: engagement.responses, label: 'responses', priority: 5 });
    }

    // Sort by priority and limit display
    return metrics.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

function isGenericDescription(desc: string | undefined): boolean {
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
}

function CardTooltip({ item }: { item: ContentItem }) {
    const eng = item.engagement;
    const meaningfulDescription = !isGenericDescription(item.description) ? item.description : undefined;

    // Top engagement metric
    const metrics: { icon: typeof Eye; label: string; value: string }[] = [];
    if (eng?.views && eng.views > 0) metrics.push({ icon: Eye, label: 'views', value: formatNumber(eng.views) });
    if (eng?.upvotes && eng.upvotes > 0) metrics.push({ icon: ArrowUp, label: 'upvotes', value: formatNumber(eng.upvotes) });
    if (eng?.stars && eng.stars > 0) metrics.push({ icon: Star, label: 'stars', value: formatNumber(eng.stars) });
    if (eng?.likes && eng.likes > 0) metrics.push({ icon: ThumbsUp, label: 'likes', value: formatNumber(eng.likes) });
    if (eng?.downloads && eng.downloads > 0) metrics.push({ icon: Download, label: 'downloads', value: formatNumber(eng.downloads) });
    if (eng?.comments && eng.comments > 0) metrics.push({ icon: MessageCircle, label: 'comments', value: formatNumber(eng.comments) });

    const hasContent = meaningfulDescription || metrics.length > 0 || item.author;
    if (!hasContent) return null;

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

export function ContentCard({ item, style, isTouchDevice }: ContentCardProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [selected, setSelected] = useState(false);

    const publishedDate = new Date(item.publishedAt);
    const timeAgo = formatDistanceToNow(publishedDate, { addSuffix: true });
    const scoreInfo = item.trendingScore ? getScoreInfo(item.trendingScore) : null;
    const performanceInfo = getPerformanceLevel(item.trendingScore);
    const engagementMetrics = getEngagementMetrics(item.engagement);
    const isMustRead = item.matchedKeywords && item.matchedKeywords.length > 0;
    const hasEngagement = engagementMetrics.length > 0;

    // Close tooltip on outside touch
    useEffect(() => {
        if (!mobileOpen) return;
        const close = (e: TouchEvent) => {
            if ((e.target as Element)?.closest?.('.tooltip-content')) return;
            setMobileOpen(false);
            setSelected(false);
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
                <article
                    className={`content-card ${isMustRead ? 'must-read' : ''}${selected ? ' selected' : ''}`}
                    aria-labelledby={`title-${item.id}`}
                    style={style}
                >
                    {/* Performance indicator bar at top */}
                    {item.trendingScore !== undefined && item.trendingScore > 0 && (
                        <div className={`performance-bar ${performanceInfo.className}`}>
                            <div
                                className="performance-fill"
                                style={{ width: `${Math.min(item.trendingScore, 100)}%` }}
                            />
                        </div>
                    )}

                    {/* Main Content Area */}
                    <div className="content-main">
                        <div className="content-card-header">
                            <div className="content-card-meta">
                                <span className="content-source">{formatSourceName(item.sourceId)}</span>
                                {isMustRead && (
                                    <span className="must-read-badge">
                                        <Zap size={12} />
                                        Must Read
                                    </span>
                                )}
                                {item.trendingScore !== undefined && (
                                    <span className={`score-badge ${scoreInfo?.className || 'score-default'}`}>
                                        {scoreInfo?.label === 'Hot' ? <Flame size={12} /> : <TrendingUp size={12} />}
                                        {item.trendingScore}
                                    </span>
                                )}
                            </div>
                            <div className="content-card-header-right">
                                <time
                                    className="content-time"
                                    dateTime={publishedDate.toISOString()}
                                >
                                    {timeAgo}
                                </time>
                                {isTouchDevice && (
                                    <span
                                        className="content-card-info"
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Show details"
                                        onTouchEnd={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setMobileOpen(prev => !prev);
                                            setSelected(true);
                                        }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setMobileOpen(prev => !prev);
                                            setSelected(true);
                                        }}
                                    >
                                        <Info size={16} />
                                    </span>
                                )}
                            </div>
                        </div>

                        <h3 id={`title-${item.id}`} className="content-title">
                            <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${item.title} (opens in new tab)`}
                            >
                                {item.title}
                                <ExternalLink size={14} className="external-icon" aria-hidden="true" />
                            </a>
                        </h3>

                        {item.description && (
                            <p className="content-description">{item.description}</p>
                        )}
                    </div>

                    {/* Footer / Data Terminal */}
                    <div className="content-footer">
                        <div className="footer-left">
                            {item.author && (
                                <span className="content-author">by {item.author}</span>
                            )}

                            <div className="content-tags-row">
                                {item.matchedKeywords && item.matchedKeywords.length > 0 && (
                                    <div className="matched-keywords" aria-label="Matched keywords">
                                        {item.matchedKeywords.map((kw, i) => (
                                            <span key={i} className="keyword-tag">{kw}</span>
                                        ))}
                                    </div>
                                )}

                                {item.tags && item.tags.length > 0 && (
                                    <div className="content-tags" aria-label="Tags">
                                        {item.tags.slice(0, 2).map((tag, i) => (
                                            <span key={i} className="tag">{tag}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {hasEngagement && (
                            <div className="content-engagement">
                                {engagementMetrics.map((metric, i) => {
                                    const Icon = metric.icon;
                                    return (
                                        <span key={i} className={`engagement-item metric-${metric.label}`}>
                                            <Icon size={12} />
                                            {formatNumber(metric.value)}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </article>
            </TooltipTrigger>
            <TooltipContent side="top" align="center">
                <CardTooltip item={item} />
            </TooltipContent>
        </Tooltip>
    );
}
