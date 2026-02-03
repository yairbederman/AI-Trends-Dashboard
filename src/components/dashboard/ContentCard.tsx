'use client';

import { ContentItem } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink, TrendingUp, Flame, MessageCircle, Star, ArrowUp, Zap } from 'lucide-react';

interface ContentCardProps {
    item: ContentItem;
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

function formatEngagement(engagement: ContentItem['engagement']): string[] {
    if (!engagement) return [];
    const parts: string[] = [];

    if (engagement.upvotes !== undefined) {
        parts.push(`${formatNumber(engagement.upvotes)} pts`);
    }
    if (engagement.stars !== undefined) {
        parts.push(`${formatNumber(engagement.stars)} stars`);
    }
    if (engagement.comments !== undefined) {
        parts.push(`${engagement.comments} comments`);
    }

    return parts;
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}

export function ContentCard({ item }: ContentCardProps) {
    const publishedDate = new Date(item.publishedAt);
    const timeAgo = formatDistanceToNow(publishedDate, { addSuffix: true });
    const scoreInfo = item.trendingScore ? getScoreInfo(item.trendingScore) : null;
    const engagementParts = formatEngagement(item.engagement);
    const isMustRead = item.matchedKeywords && item.matchedKeywords.length > 0;

    return (
        <article className={`content-card ${isMustRead ? 'must-read' : ''}`} aria-labelledby={`title-${item.id}`}>
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

            <div className="content-footer">
                {item.author && (
                    <span className="content-author">by {item.author}</span>
                )}

                {engagementParts.length > 0 && (
                    <div className="content-engagement">
                        {item.engagement?.upvotes !== undefined && (
                            <span className="engagement-item" title="Upvotes">
                                <ArrowUp size={12} />
                                {formatNumber(item.engagement.upvotes)}
                            </span>
                        )}
                        {item.engagement?.stars !== undefined && (
                            <span className="engagement-item" title="Stars">
                                <Star size={12} />
                                {formatNumber(item.engagement.stars)}
                            </span>
                        )}
                        {item.engagement?.comments !== undefined && (
                            <span className="engagement-item" title="Comments">
                                <MessageCircle size={12} />
                                {item.engagement.comments}
                            </span>
                        )}
                    </div>
                )}
            </div>

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
                        {item.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="tag">{tag}</span>
                        ))}
                    </div>
                )}
            </div>
        </article>
    );
}
