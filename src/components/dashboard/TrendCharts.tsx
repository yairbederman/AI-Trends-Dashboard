'use client';

import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { ContentItem, CATEGORY_LABELS, CATEGORY_COLORS, SourceCategory } from '@/types';
import { SOURCES } from '@/lib/config/sources';

interface TrendChartsProps {
    items: ContentItem[];
}

const SCORE_TIERS = [
    { label: 'Hot', min: 60, max: 101, color: '#ef4444' },
    { label: 'Trending', min: 40, max: 60, color: '#f97316' },
    { label: 'Notable', min: 20, max: 40, color: '#eab308' },
    { label: 'Normal', min: 5, max: 20, color: '#6366f1' },
    { label: 'Low', min: 0, max: 5, color: '#64748b' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScoreDistributionTooltip({ active, payload }: any) {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload as { label: string; count: number; pct: number };
    return (
        <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
        }}>
            <strong>{data.label}</strong>: {data.count} items ({data.pct}%)
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CategoryQualityTooltip({ active, payload }: any) {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload as { label: string; avgScore: number; count: number };
    return (
        <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
        }}>
            <strong>{data.label}</strong><br />
            Avg score: {data.avgScore} ({data.count} items)
        </div>
    );
}

export function TrendCharts({ items }: TrendChartsProps) {
    const sourceToCategory = useMemo(() => {
        const map: Record<string, SourceCategory> = {};
        SOURCES.forEach(s => { map[s.id] = s.category; });
        return map;
    }, []);

    // Score Distribution: how many items fall into each score tier
    const scoreData = useMemo(() => {
        const total = items.length;
        if (total === 0) return [];

        return SCORE_TIERS.map(tier => {
            const count = items.filter(item => {
                const s = item.trendingScore || 0;
                return s >= tier.min && s < tier.max;
            }).length;
            return {
                label: tier.label,
                count,
                pct: Math.round((count / total) * 100),
                color: tier.color,
            };
        });
    }, [items]);

    // Category Quality: average trending score per category
    const categoryQualityData = useMemo(() => {
        const catStats: Record<string, { total: number; count: number }> = {};
        items.forEach(item => {
            const cat = sourceToCategory[item.sourceId];
            if (!cat) return;
            if (!catStats[cat]) catStats[cat] = { total: 0, count: 0 };
            catStats[cat].total += (item.trendingScore || 0);
            catStats[cat].count += 1;
        });

        return Object.entries(catStats)
            .map(([key, stats]) => ({
                category: key,
                label: CATEGORY_LABELS[key as SourceCategory] || key,
                avgScore: Math.round((stats.total / stats.count) * 10) / 10,
                count: stats.count,
                color: CATEGORY_COLORS[key] || '#6366f1',
            }))
            .sort((a, b) => b.avgScore - a.avgScore);
    }, [items, sourceToCategory]);

    if (items.length === 0) {
        return null;
    }

    return (
        <section className="charts-section">
            <div className="charts-header">
                <h2><BarChart2 size={18} aria-hidden="true" /> Trends & Activity</h2>
            </div>

            <div className="chart-grid">
                {/* Score Distribution */}
                <div className="chart-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Score Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart data={scoreData}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border-color)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                            />
                            <YAxis
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip content={<ScoreDistributionTooltip />} cursor={{ fill: 'var(--border-color)', opacity: 0.3 }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {scoreData.map((entry, index) => (
                                    <Cell key={`score-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Quality */}
                <div className="chart-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Category Quality (Avg Score)
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart layout="vertical" data={categoryQualityData} margin={{ left: 80 }}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border-color)"
                                horizontal={false}
                            />
                            <XAxis
                                type="number"
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                domain={[0, 100]}
                            />
                            <YAxis
                                type="category"
                                dataKey="label"
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={80}
                            />
                            <Tooltip content={<CategoryQualityTooltip />} cursor={{ fill: 'var(--border-color)', opacity: 0.3 }} />
                            <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                                {categoryQualityData.map((entry, index) => (
                                    <Cell key={`cat-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
}
