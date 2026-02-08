'use client';

import { useMemo } from 'react';
import {
    Treemap,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Layers, Activity, Trophy, Target } from 'lucide-react';
import { ContentItem, CATEGORY_LABELS, CATEGORY_COLORS, SourceCategory } from '@/types';
import { SOURCES } from '@/lib/config/sources';

interface InsightChartsProps {
    items: ContentItem[];
}

// ─── Trending Topics Treemap ────────────────────────────────────────────────

function getTopicColor(avgScore: number): string {
    if (avgScore >= 60) return '#22c55e';
    if (avgScore >= 40) return '#14b8a6';
    if (avgScore >= 20) return '#3b82f6';
    return '#6366f1';
}

interface TreemapContentProps {
    x: number;
    y: number;
    width: number;
    height: number;
    name?: string;
    avgScore?: number;
}

function TreemapContent({ x, y, width, height, name, avgScore, ...rest }: TreemapContentProps & Record<string, unknown>) {
    // Skip parent/root nodes (recharts passes depth/index on leaf nodes)
    if ('children' in rest && Array.isArray(rest.children)) return null;
    if (!name || width < 35 || height < 22) return null;
    const fill = getTopicColor(avgScore || 0);
    const fontSize = width > 120 ? 13 : width > 80 ? 11 : 9;
    const showScore = width > 60 && height > 40;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                rx={6}
                ry={6}
                fill={fill}
                fillOpacity={0.15}
                stroke={fill}
                strokeWidth={1.5}
                strokeOpacity={0.4}
            />
            <text
                x={x + width / 2}
                y={y + height / 2 - (showScore ? 6 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--text-primary)"
                fontSize={fontSize}
                fontWeight={600}
            >
                {(name || '').length > 16 ? (name || '').slice(0, 14) + '...' : name}
            </text>
            {showScore && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 14}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={fill}
                    fontSize={10}
                    fontWeight={700}
                >
                    avg {avgScore}
                </text>
            )}
        </g>
    );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TreemapTooltip({ active, payload }: any) {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload as { name: string; count: number; avgScore: number };
    const color = getTopicColor(data.avgScore);
    return (
        <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
            <div style={{ fontWeight: 600 }}>{data.name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                {data.count} mentions &middot; <span style={{ color, fontWeight: 600 }}>avg score {data.avgScore}</span>
            </div>
        </div>
    );
}

// ─── Activity Timeline Tooltip ──────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TimelineTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s: number, p: { value: number }) => s + (p.value || 0), 0);
    return (
        <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                {total} total items
            </div>
            {payload.filter((p: { value: number }) => p.value > 0).map((p: { name: string; value: number; color: string }, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{p.name}: {p.value}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Radar Tooltip ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RadarTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '0.5rem 0.75rem',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
            {payload.map((p: { name: string; value: number; color: string }, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{p.name}: {Math.round(p.value)}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Helper: format engagement ──────────────────────────────────────────────

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
    return String(n);
}

function getPrimaryEngagement(item: ContentItem): { value: number; label: string } {
    const e = item.engagement;
    if (!e) return { value: 0, label: '' };
    if (e.views && e.views > 0) return { value: e.views, label: 'views' };
    if (e.upvotes && e.upvotes > 0) return { value: e.upvotes, label: 'upvotes' };
    if (e.stars && e.stars > 0) return { value: e.stars, label: 'stars' };
    if (e.downloads && e.downloads > 0) return { value: e.downloads, label: 'downloads' };
    if (e.likes && e.likes > 0) return { value: e.likes, label: 'likes' };
    if (e.comments && e.comments > 0) return { value: e.comments, label: 'comments' };
    return { value: 0, label: '' };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function InsightCharts({ items }: InsightChartsProps) {
    const sourceToCategory = useMemo(() => {
        const map: Record<string, SourceCategory> = {};
        SOURCES.forEach(s => { map[s.id] = s.category; });
        return map;
    }, []);

    const sourceMap = useMemo(() => {
        const map: Record<string, { name: string; icon?: string }> = {};
        SOURCES.forEach(s => { map[s.id] = { name: s.name, icon: s.icon }; });
        return map;
    }, []);

    // ── Trending Topics Data ──────────────────────────────────────────────
    const topicData = useMemo(() => {
        const genericTags = new Set([
            'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
            'tech', 'technology', 'research', 'paper', 'blog', 'article', 'news',
            'update', 'new', 'launch', 'release', 'announcement', 'other',
            'question', 'help', 'discussion', 'question - help', 'question | help',
        ]);
        // Filter out location/format tags
        const junkPatterns = [/^region:/, /^lang:/, /^license:/, /^en$/, /^v\d/, /^\d+$/];

        const tagStats: Record<string, { count: number; totalScore: number }> = {};
        for (const item of items) {
            const allTags = [...(item.tags || []), ...(item.matchedKeywords || [])];
            const seen = new Set<string>();
            for (const tag of allTags) {
                const t = tag.toLowerCase().trim();
                if (t && t.length > 2 && !genericTags.has(t) && !seen.has(t) && !junkPatterns.some(p => p.test(t))) {
                    seen.add(t);
                    if (!tagStats[t]) tagStats[t] = { count: 0, totalScore: 0 };
                    tagStats[t].count += 1;
                    tagStats[t].totalScore += (item.trendingScore || 0);
                }
            }
        }

        return Object.entries(tagStats)
            .filter(([, s]) => s.count >= 2) // At least 2 mentions
            .map(([name, s]) => ({
                name,
                count: s.count,
                avgScore: Math.round(s.totalScore / s.count),
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);
    }, [items]);

    // ── Activity Timeline Data ────────────────────────────────────────────
    const timelineData = useMemo(() => {
        const now = new Date();
        const buckets: Record<string, Record<string, number>> = {};

        // Create 12 x 2-hour buckets going back 24 hours
        for (let i = 11; i >= 0; i--) {
            const bucketTime = new Date(now.getTime() - i * 2 * 60 * 60 * 1000);
            const label = bucketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            buckets[label] = {};
        }

        const bucketKeys = Object.keys(buckets);

        for (const item of items) {
            const pubDate = new Date(item.publishedAt);
            const ageHours = (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60);
            if (ageHours > 24 || ageHours < 0) continue;

            const bucketIndex = Math.max(0, 11 - Math.floor(ageHours / 2));
            const bucketKey = bucketKeys[Math.min(bucketIndex, bucketKeys.length - 1)];
            const cat = sourceToCategory[item.sourceId] || 'other';
            const catLabel = CATEGORY_LABELS[cat as SourceCategory] || cat;

            if (!buckets[bucketKey]) continue;
            buckets[bucketKey][catLabel] = (buckets[bucketKey][catLabel] || 0) + 1;
        }

        // Collect all category labels that appear
        const allCats = new Set<string>();
        for (const counts of Object.values(buckets)) {
            for (const cat of Object.keys(counts)) allCats.add(cat);
        }

        return {
            data: bucketKeys.map(time => ({
                time,
                ...buckets[time],
            })),
            categories: [...allCats],
        };
    }, [items, sourceToCategory]);

    // ── Top Engaged Items ─────────────────────────────────────────────────
    const topEngaged = useMemo(() => {
        const withEng = [...items]
            .map(item => {
                const eng = getPrimaryEngagement(item);
                return { ...item, primaryEng: eng };
            })
            .filter(item => item.primaryEng.value > 0)
            .sort((a, b) => b.primaryEng.value - a.primaryEng.value);

        // Pick top items with source diversity (max 2 per source)
        const picked: typeof withEng = [];
        const sourceCounts: Record<string, number> = {};
        for (const item of withEng) {
            if (picked.length >= 6) break;
            const count = sourceCounts[item.sourceId] || 0;
            if (count >= 2) continue;
            sourceCounts[item.sourceId] = count + 1;
            picked.push(item);
        }
        return picked;
    }, [items]);

    // ── Category Radar Data ───────────────────────────────────────────────
    const radarData = useMemo(() => {
        const catStats: Record<string, {
            count: number;
            totalScore: number;
            maxScore: number;
            totalEngagement: number;
            totalFreshness: number;
        }> = {};

        const now = new Date();
        for (const item of items) {
            const cat = sourceToCategory[item.sourceId];
            if (!cat) continue;
            if (!catStats[cat]) catStats[cat] = { count: 0, totalScore: 0, maxScore: 0, totalEngagement: 0, totalFreshness: 0 };

            const s = catStats[cat];
            s.count += 1;
            s.totalScore += (item.trendingScore || 0);
            s.maxScore = Math.max(s.maxScore, item.trendingScore || 0);

            const eng = getPrimaryEngagement(item);
            s.totalEngagement += eng.value;

            // Freshness: hours since published (lower = fresher)
            const ageHours = (now.getTime() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60);
            s.totalFreshness += Math.max(0, 100 - ageHours * 4); // 0-100 scale, full freshness = 0h
        }

        // Normalize all dimensions to 0-100 for the radar
        const maxCount = Math.max(...Object.values(catStats).map(s => s.count), 1);
        const maxEng = Math.max(...Object.values(catStats).map(s => s.totalEngagement), 1);

        // We'll create one data point per dimension, with category values as separate keys
        const dimensions = ['Volume', 'Avg Score', 'Peak Score', 'Engagement', 'Freshness'];
        const activeCats = Object.entries(catStats)
            .filter(([, s]) => s.count >= 2) // Need at least 2 items
            .sort((a, b) => b[1].totalScore - a[1].totalScore)
            .slice(0, 4); // Top 4 for readability

        return {
            data: dimensions.map(dim => {
                const point: Record<string, string | number> = { dimension: dim };
                for (const [cat, s] of activeCats) {
                    const label = CATEGORY_LABELS[cat as SourceCategory] || cat;
                    switch (dim) {
                        case 'Volume':
                            point[label] = Math.round((s.count / maxCount) * 100);
                            break;
                        case 'Avg Score':
                            point[label] = Math.round(s.totalScore / s.count);
                            break;
                        case 'Peak Score':
                            point[label] = Math.round(s.maxScore);
                            break;
                        case 'Engagement':
                            point[label] = Math.round((s.totalEngagement / maxEng) * 100);
                            break;
                        case 'Freshness':
                            point[label] = Math.round(Math.min(100, s.totalFreshness / s.count));
                            break;
                    }
                }
                return point;
            }),
            categories: activeCats.map(([cat]) => ({
                key: CATEGORY_LABELS[cat as SourceCategory] || cat,
                color: CATEGORY_COLORS[cat] || '#6366f1',
            })),
        };
    }, [items, sourceToCategory]);

    if (items.length === 0) return null;

    const hasTopics = topicData.length > 0;
    const hasTimeline = timelineData.data.length > 0 && timelineData.categories.length > 0;
    const hasEngaged = topEngaged.length > 0;
    const hasRadar = radarData.categories.length >= 2;

    if (!hasTopics && !hasTimeline && !hasEngaged && !hasRadar) return null;

    return (
        <section className="insight-charts-section">
            <div className="insight-charts-header">
                <h2><Layers size={18} aria-hidden="true" /> Deep Insights</h2>
            </div>

            {/* Row 1: Activity Timeline + Top Engaged */}
            <div className="insight-row insight-row-2col">
                {hasTimeline && (
                    <div className="insight-card insight-card-timeline">
                        <div className="insight-card-header">
                            <Activity size={16} aria-hidden="true" />
                            <h3>Publishing Activity</h3>
                            <span className="insight-subtitle">Last 24h by category</span>
                        </div>
                        <div className="insight-chart-wrapper" style={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timelineData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        {timelineData.categories.map((cat, i) => {
                                            const catEntry = Object.entries(CATEGORY_LABELS).find(([, label]) => label === cat);
                                            const color = catEntry ? (CATEGORY_COLORS[catEntry[0]] || '#6366f1') : ['#6366f1', '#ec4899', '#22c55e', '#06b6d4', '#eab308', '#f97316', '#a855f7', '#ef4444'][i % 8];
                                            return (
                                                <linearGradient key={cat} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                                                    <stop offset="100%" stopColor={color} stopOpacity={0.05} />
                                                </linearGradient>
                                            );
                                        })}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                    <XAxis
                                        dataKey="time"
                                        stroke="var(--text-muted)"
                                        fontSize={10}
                                        tickLine={false}
                                        interval="preserveStartEnd"
                                    />
                                    <YAxis
                                        stroke="var(--text-muted)"
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        allowDecimals={false}
                                    />
                                    <Tooltip content={<TimelineTooltip />} />
                                    {timelineData.categories.map((cat, i) => {
                                        const catEntry = Object.entries(CATEGORY_LABELS).find(([, label]) => label === cat);
                                        const color = catEntry ? (CATEGORY_COLORS[catEntry[0]] || '#6366f1') : ['#6366f1', '#ec4899', '#22c55e', '#06b6d4', '#eab308', '#f97316', '#a855f7', '#ef4444'][i % 8];
                                        return (
                                            <Area
                                                key={cat}
                                                type="monotone"
                                                dataKey={cat}
                                                name={cat}
                                                stackId="1"
                                                stroke={color}
                                                fill={`url(#grad-${i})`}
                                                strokeWidth={1.5}
                                            />
                                        );
                                    })}
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {hasEngaged && (
                    <div className="insight-card insight-card-leaderboard">
                        <div className="insight-card-header">
                            <Trophy size={16} aria-hidden="true" />
                            <h3>Engagement Leaders</h3>
                            <span className="insight-subtitle">Most community traction</span>
                        </div>
                        <div className="leaderboard-list">
                            {topEngaged.map((item, index) => {
                                const source = sourceMap[item.sourceId];
                                const barWidth = topEngaged[0].primaryEng.value > 0
                                    ? Math.max(8, (item.primaryEng.value / topEngaged[0].primaryEng.value) * 100)
                                    : 0;
                                const score = item.trendingScore || 0;
                                const tierColor = score >= 60 ? '#22c55e' : score >= 40 ? '#14b8a6' : score >= 20 ? '#3b82f6' : '#6366f1';

                                return (
                                    <a
                                        key={item.id}
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="leaderboard-item"
                                    >
                                        <span className="leaderboard-rank" style={{ color: index < 3 ? tierColor : 'var(--text-muted)' }}>
                                            {index + 1}
                                        </span>
                                        <div className="leaderboard-body">
                                            <div className="leaderboard-title-row">
                                                <span className="leaderboard-source">
                                                    {source?.icon && <span aria-hidden="true">{source.icon}</span>}
                                                    {source?.name || item.sourceId}
                                                </span>
                                                <span className="leaderboard-metric">
                                                    {formatNumber(item.primaryEng.value)} {item.primaryEng.label}
                                                </span>
                                            </div>
                                            <span className="leaderboard-title">{item.title}</span>
                                            <div className="leaderboard-bar-track">
                                                <div
                                                    className="leaderboard-bar-fill"
                                                    style={{
                                                        width: `${barWidth}%`,
                                                        background: `linear-gradient(90deg, ${tierColor}33 0%, ${tierColor}88 100%)`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Row 2: Trending Topics + Category Radar */}
            <div className="insight-row insight-row-2col">
                {hasTopics && (
                    <div className="insight-card insight-card-topics">
                        <div className="insight-card-header">
                            <Layers size={16} aria-hidden="true" />
                            <h3>Trending Topics</h3>
                            <span className="insight-subtitle">{topicData.length} topics detected</span>
                        </div>
                        <div className="insight-chart-wrapper" style={{ height: 240 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <Treemap
                                    data={topicData}
                                    dataKey="count"
                                    nameKey="name"
                                    content={<TreemapContent x={0} y={0} width={0} height={0} />}
                                >
                                    <Tooltip content={<TreemapTooltip />} />
                                </Treemap>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {hasRadar && (
                    <div className="insight-card insight-card-radar">
                        <div className="insight-card-header">
                            <Target size={16} aria-hidden="true" />
                            <h3>Category Fingerprint</h3>
                            <span className="insight-subtitle">Multi-dimensional comparison</span>
                        </div>
                        <div className="insight-chart-wrapper" style={{ height: 240 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData.data} cx="50%" cy="50%" outerRadius="70%">
                                    <PolarGrid stroke="var(--border-color)" />
                                    <PolarAngleAxis
                                        dataKey="dimension"
                                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                                    />
                                    <PolarRadiusAxis
                                        angle={90}
                                        domain={[0, 100]}
                                        tick={false}
                                        axisLine={false}
                                    />
                                    <Tooltip content={<RadarTooltip />} />
                                    {radarData.categories.map((cat) => (
                                        <Radar
                                            key={cat.key}
                                            name={cat.key}
                                            dataKey={cat.key}
                                            stroke={cat.color}
                                            fill={cat.color}
                                            fillOpacity={0.12}
                                            strokeWidth={2}
                                        />
                                    ))}
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="radar-legend">
                            {radarData.categories.map(cat => (
                                <span key={cat.key} className="radar-legend-item">
                                    <span className="radar-legend-dot" style={{ background: cat.color }} />
                                    {cat.key}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
