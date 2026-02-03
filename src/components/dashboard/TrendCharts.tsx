'use client';

import { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

interface TrendData {
    date: string;
    count: number;
}

interface CategoryDistribution {
    category: string;
    count: number;
}

interface TrendChartsProps {
    items: { sourceId: string; publishedAt: Date | string }[];
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
    // Memoize activity data processing
    const activityData = useMemo<TrendData[]>(() => {
        const dateCounts: Record<string, number> = {};

        // Get last 7 days
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const key = date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
            dateCounts[key] = 0;
        }

        // Count items per day
        items.forEach((item) => {
            const itemDate = item.publishedAt instanceof Date
                ? item.publishedAt
                : new Date(item.publishedAt);

            if (isNaN(itemDate.getTime())) return;

            const key = itemDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
            });
            if (dateCounts[key] !== undefined) {
                dateCounts[key]++;
            }
        });

        return Object.entries(dateCounts).map(([date, count]) => ({
            date,
            count,
        }));
    }, [items]);

    // Memoize category data processing
    const categoryData = useMemo<CategoryDistribution[]>(() => {
        const sourceCounts: Record<string, number> = {};

        items.forEach((item) => {
            const source = item.sourceId.split('-')[0];
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });

        return Object.entries(sourceCounts)
            .map(([category, count]) => ({
                category: category.charAt(0).toUpperCase() + category.slice(1),
                count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);
    }, [items]);

    if (items.length === 0) {
        return null;
    }

    return (
        <section className="charts-section">
            <div className="charts-header">
                <h2>📊 Trends & Activity</h2>
            </div>

            <div className="chart-grid">
                {/* Activity over time */}
                <div className="chart-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Content Activity (Last 7 Days)
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={activityData}>
                            <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
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
                                dataKey="date"
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
                                fill="url(#colorCount)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Category distribution */}
                <div className="chart-container">
                    <h3 style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Content by Source
                    </h3>
                    <ResponsiveContainer width="100%" height="85%">
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={2}
                                dataKey="count"
                                nameKey="category"
                            >
                                {categoryData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                    {/* Legend */}
                    <div
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.5rem',
                            justifyContent: 'center',
                            marginTop: '-1rem',
                        }}
                    >
                        {categoryData.slice(0, 5).map((item, index) => (
                            <span
                                key={item.category}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.7rem',
                                    color: 'var(--text-muted)',
                                }}
                            >
                                <span
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: COLORS[index],
                                    }}
                                />
                                {item.category}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
