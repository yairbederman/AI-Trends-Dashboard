'use client';

import { Zap } from 'lucide-react';
import { SourceCategory, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types';

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
}

export interface CategoryHighlightGroup {
    category: SourceCategory;
    items: HighlightItem[];
}

interface CategoryHighlightsProps {
    groups: CategoryHighlightGroup[];
}

export function CategoryHighlights({ groups }: CategoryHighlightsProps) {
    const totalItems = groups.reduce((sum, g) => sum + g.items.length, 0);

    return (
        <section className="highlights-section">
            <div className="highlights-header">
                <h2><Zap size={20} aria-hidden="true" /> Must-Read Highlights</h2>
                <span className="highlights-subtitle">
                    {totalItems} across {groups.length} categories
                </span>
            </div>

            <div className="highlights-lanes">
                {groups.map((group, groupIndex) => (
                    <div
                        key={group.category}
                        className={`highlights-lane${groupIndex === 0 ? ' lane-featured' : ''}`}
                    >
                        <div className="lane-header">
                            <span
                                className="lane-dot"
                                style={{ backgroundColor: CATEGORY_COLORS[group.category] }}
                            />
                            <h3 className="lane-category-name">
                                {CATEGORY_LABELS[group.category]}
                            </h3>
                        </div>
                        <div className="lane-cards">
                            {group.items.map(item => (
                                <a
                                    key={item.id}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="lane-card"
                                    title={item.title}
                                >
                                    <div className={`highlight-score ${item.tierClass}`}>
                                        {item.score}
                                    </div>
                                    <div className="lane-card-body">
                                        <span className="lane-card-source">
                                            {item.sourceIcon && <span className="lane-card-emoji">{item.sourceIcon}</span>}
                                            {item.sourceName}
                                        </span>
                                        <span className="lane-card-title">{item.title}</span>
                                    </div>
                                    <div className="lane-card-meta">
                                        {item.timeAgo && (
                                            <span className="lane-card-time">{item.timeAgo}</span>
                                        )}
                                        {item.primaryMetric && (
                                            <span className="lane-card-metric">
                                                {item.primaryMetric.value} {item.primaryMetric.label}
                                            </span>
                                        )}
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
