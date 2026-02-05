'use client';

import { ContentItem, EngagementMetrics } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import {
    ExternalLink, TrendingUp, Flame, MessageCircle, Star, ArrowUp, Zap,
    Eye, ThumbsUp, GitFork, Download, Hand, Reply
} from 'lucide-react';

interface ContentCardProps {
    item: ContentItem;
    style?: React.CSSProperties;
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

export function ContentCard({ item, style }: ContentCardProps) {
    const publishedDate = new Date(item.publishedAt);
    const timeAgo = formatDistanceToNow(publishedDate, { addSuffix: true });
    const scoreInfo = item.trendingScore ? getScoreInfo(item.trendingScore) : null;
    const performanceInfo = getPerformanceLevel(item.trendingScore);
    const engagementMetrics = getEngagementMetrics(item.engagement);
    const isMustRead = item.matchedKeywords && item.matchedKeywords.length > 0;
    const hasEngagement = engagementMetrics.length > 0;

    return (
        <article className={`content-card ${isMustRead ? 'must-read' : ''}`} aria-labelledby={`title-${item.id}`} style={style}>
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
                            <span className="must-read-badge" title="Matches your boost keywords">
                                <Zap size={12} />
                                Must Read
                            </span>
                        )}
                        {item.trendingScore !== undefined && (
                            <span className={`score-badge ${scoreInfo?.className || 'score-default'}`} title="Trending score">
                                {scoreInfo?.label === 'Hot' ? <Flame size={12} /> : <TrendingUp size={12} />}
                                {item.trendingScore}
                            </span>
                        )}
                    </div>
                    <time
                        className="content-time"
                        dateTime={publishedDate.toISOString()}
                        title={publishedDate.toLocaleString()}
                    >
                        {timeAgo}
                    </time>
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
                            // Add specific class for the metric type (e.g. 'metric-views')
                            return (
                                <span key={i} className={`engagement-item metric-${metric.label}`} title={metric.label}>
                                    <Icon size={12} />
                                    {formatNumber(metric.value)}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
        </article>
    );
}
