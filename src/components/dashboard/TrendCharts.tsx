'use client';

import { useMemo } from 'react';
import {
    AreaChart,
    Area,
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
import { ContentItem, CATEGORY_LABELS, SourceCategory } from '@/types';
import { SOURCES } from '@/lib/config/sources';

interface TrendChartsProps {
    items: ContentItem[];
}

const COLORS = [
    '#6366f1',
    '#22c55e',
    '#eab308',
    '#ef4444',
    '#a855f7',
    '#06b6d4',
    '#ec4899',
    '#f97316',
];

export function TrendCharts({ items }: TrendChartsProps) {
    // Build sourceId → category map
    const sourceToCategory = useMemo(() => {
        const map: Record<string, SourceCategory> = {};
        SOURCES.forEach(s => { map[s.id] = s.category; });
        return map;
    }, []);

    // Category Activity data (horizontal bar chart)
    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        items.forEach(item => {
            const cat = sourceToCategory[item.sourceId];
            if (cat) {
                counts[cat] = (counts[cat] || 0) + 1;
            }
        });
        return Object.entries(counts)
            .map(([key, count]) => ({
                category: key,
                label: CATEGORY_LABELS[key as SourceCategory] || key,
                count,
            }))
            .sort((a, b) => b.count - a.count);
    }, [items, sourceToCategory]);

    // Hourly Activity data (24h area chart)
    const hourlyData = useMemo(() => {
        const now = new Date();
        const buckets: { hour: Date; label: string; count: number }[] = [];

        // Create 24 hourly buckets
        for (let i = 23; i >= 0; i--) {
            const hour = new Date(now);
            hour.setMinutes(0, 0, 0);
            hour.setHours(hour.getHours() - i);
            const label = hour.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            buckets.push({ hour, label, count: 0 });
        }

        // Place items into buckets
        items.forEach(item => {
            const itemDate = item.publishedAt instanceof Date
                ? item.publishedAt
                : new Date(item.publishedAt);
            if (isNaN(itemDate.getTime())) return;

            // Truncate to hour
            const itemHour = new Date(itemDate);
            itemHour.setMinutes(0, 0, 0);
            const itemTime = itemHour.getTime();

            for (const bucket of buckets) {
                if (bucket.hour.getTime() === itemTime) {
                    bucket.count++;
                    break;
                }
            }
        });

        return buckets.map(b => ({ label: b.label, count: b.count }));
    }, [items]);

    if (items.length === 0) {
        return null;
    }

    return (
        <section className="charts-section">
            <div className="charts-header">
                <h2><BarChart2 size={18} aria-hidden="true" /> Trends & Activity</h2>
            </div>

            <div className="chart-grid">
                {/* Hourly Activity */}
                <div className="chart-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Hourly Activity (Last 24h)
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={hourlyData}>
                            <defs>
                                <linearGradient id="colorHourly" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border-color)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                stroke="var(--text-muted)"
                                fontSize={11}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                stroke="var(--text-muted)"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="url(#colorHourly)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Category Activity */}
                <div className="chart-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Category Activity
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <BarChart layout="vertical" data={categoryData} margin={{ left: 80 }}>
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
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                {categoryData.map((_, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
}
