'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X, RefreshCw, Moon, Sun, AlertCircle, Star, Sparkles, Plus, Trash2, ChevronDown, ChevronUp, Bot, Palette, Code2, Users, Newspaper, MessageSquare, Mail, Trophy } from 'lucide-react';
import Link from 'next/link';
import { SourceCategory, CATEGORY_LABELS } from '@/types';
import { useSettings } from '@/lib/contexts/SettingsContext';

interface SourceInfo {
    id: string;
    name: string;
    icon?: string;
    enabled: boolean;
    requiresKey: boolean;
    method: string;
    // Quality tier info
    qualityTier: number;
    qualityTierLabel: string;
    qualityBaseline: number;
    engagementType: string;
    hasEngagementMetrics: boolean;
}

interface CategoryData {
    category: SourceCategory;
    sources: SourceInfo[];
}

interface SourcesResponse {
    categories: CategoryData[];
    totalSources: number;
    enabledSources: number;
}

const CATEGORY_ICONS: Record<string, typeof Bot> = {
    'ai-labs': Bot,
    'creative-ai': Palette,
    'dev-platforms': Code2,
    'social': Users,
    'news': Newspaper,
    'community': MessageSquare,
    'newsletters': Mail,
    'leaderboards': Trophy,
};

const PRIORITY_LABELS: Record<number, string> = {
    1: 'Low',
    2: 'Below Normal',
    3: 'Normal',
    4: 'High',
    5: 'Critical',
};

export default function SettingsPage() {
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [loading, setLoading] = useState(true);
    const [newKeyword, setNewKeyword] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Smart header state
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show if scrolling up or at top
            if (currentScrollY < 10) {
                setIsHeaderVisible(true);
            } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
                // Scrolling down & passed threshold -> Hide
                setIsHeaderVisible(false);
            } else if (currentScrollY < lastScrollY.current) {
                // Scrolling up -> Show
                setIsHeaderVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Use shared context
    const {
        theme,
        setTheme,
        enabledSources,
        toggleSource,
        enableCategory,
        disableCategory,
        enableAll,
        disableAll,
        getSourcePriority,
        setSourcePriority,
        boostKeywords,
        setBoostKeywords,
        isSyncing,
        syncError,
    } = useSettings();

    useEffect(() => {
        fetchSources();
    }, []);

    const fetchSources = async () => {
        try {
            const response = await fetch('/api/sources');
            const data: SourcesResponse = await response.json();
            setCategories(data.categories);
        } catch (error) {
            console.error('Failed to fetch sources:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleCategory = (category: SourceCategory, enable: boolean) => {
        const cat = categories.find((c) => c.category === category);
        if (!cat) return;

        const sourceIds = cat.sources
            .filter((s) => !s.requiresKey || s.enabled)
            .map((s) => s.id);

        if (enable) {
            enableCategory(sourceIds);
        } else {
            disableCategory(sourceIds);
        }
    };

    const handleAddKeyword = () => {
        const keyword = newKeyword.trim().toLowerCase();
        if (keyword && !boostKeywords.includes(keyword)) {
            setBoostKeywords([...boostKeywords, keyword]);
            setNewKeyword('');
        }
    };

    const handleRemoveKeyword = (keyword: string) => {
        setBoostKeywords(boostKeywords.filter(k => k !== keyword));
    };

    const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddKeyword();
        }
    };

    const toggleCollapse = (category: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(category)) {
            newExpanded.delete(category);
        } else {
            newExpanded.add(category);
        }
        setExpandedCategories(newExpanded);
    };

    if (loading) {
        return (
            <div className="settings-page">
                <header className="settings-header" role="banner">
                    <div className="skeleton-shimmer" style={{ width: 160, height: 18 }} />
                    <div className="skeleton-shimmer" style={{ width: 100, height: 24 }} />
                </header>
                <main className="settings-main" role="main">
                    <section className="settings-section">
                        <div className="skeleton-shimmer" style={{ width: 140, height: 20, marginBottom: 16 }} />
                        <div className="skeleton-settings-row">
                            <div className="skeleton-settings-row-left">
                                <div className="skeleton-shimmer" style={{ width: 80, height: 16 }} />
                                <div className="skeleton-shimmer" style={{ width: 200, height: 13 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div className="skeleton-shimmer" style={{ width: 80, height: 38, borderRadius: 8 }} />
                                <div className="skeleton-shimmer" style={{ width: 80, height: 38, borderRadius: 8 }} />
                            </div>
                        </div>
                        <div className="skeleton-settings-row">
                            <div className="skeleton-settings-row-left">
                                <div className="skeleton-shimmer" style={{ width: 120, height: 16 }} />
                                <div className="skeleton-shimmer" style={{ width: 240, height: 13 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <div className="skeleton-shimmer" style={{ width: 90, height: 38, borderRadius: 8 }} />
                                <div className="skeleton-shimmer" style={{ width: 90, height: 38, borderRadius: 8 }} />
                            </div>
                        </div>
                    </section>
                    <section className="settings-section">
                        <div className="skeleton-shimmer" style={{ width: 190, height: 20, marginBottom: 16 }} />
                        <div className="skeleton-settings-row">
                            <div className="skeleton-settings-row-left">
                                <div className="skeleton-shimmer" style={{ width: 130, height: 16 }} />
                                <div className="skeleton-shimmer" style={{ width: 260, height: 13 }} />
                            </div>
                        </div>
                    </section>
                    {[0, 1, 2, 3].map(i => (
                        <section key={i} className="settings-section collapsed">
                            <div className="skeleton-category-header">
                                <div className="skeleton-shimmer" style={{ width: 20, height: 20, borderRadius: 4 }} />
                                <div className="skeleton-shimmer" style={{ width: 130 + i * 25, height: 20 }} />
                                <div className="skeleton-shimmer" style={{ width: 28, height: 18, borderRadius: 10 }} />
                            </div>
                        </section>
                    ))}
                </main>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <header className={`settings-header ${!isHeaderVisible ? 'header-hidden' : ''}`} role="banner">
                <Link href="/" className="back-link" aria-label="Go back to dashboard">
                    <ArrowLeft size={20} aria-hidden="true" />
                    Back to Dashboard
                </Link>
                <h1>Settings</h1>
                {isSyncing && (
                    <span className="sync-indicator" aria-live="polite">
                        <RefreshCw size={14} className="spinning" aria-hidden="true" />
                        Saving...
                    </span>
                )}
            </header>

            {syncError && (
                <div className="settings-error" role="alert">
                    <AlertCircle size={16} aria-hidden="true" />
                    {syncError}
                </div>
            )}

            <main className="settings-main" id="main-content" role="main">
                {/* Global Settings */}
                <section className="settings-section">
                    <h2>Global Settings</h2>

                    <div className="setting-row">
                        <div className="setting-label">
                            <span>Theme</span>
                            <span className="setting-hint">Choose your preferred appearance</span>
                        </div>
                        <div className="theme-toggle">
                            <button
                                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                onClick={() => setTheme('dark')}
                            >
                                <Moon size={16} />
                                Dark
                            </button>
                            <button
                                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                onClick={() => setTheme('light')}
                            >
                                <Sun size={16} />
                                Light
                            </button>
                        </div>
                    </div>

                    <div className="setting-row">
                        <div className="setting-label">
                            <span>All Sources</span>
                            <span className="setting-hint">
                                {enabledSources.size} of {categories.reduce((sum, c) => sum + c.sources.length, 0)} sources enabled
                            </span>
                        </div>
                        <div className="global-toggle">
                            <button
                                className="category-btn enable"
                                onClick={enableAll}
                            >
                                Enable All
                            </button>
                            <button
                                className="category-btn disable"
                                onClick={disableAll}
                            >
                                Disable All
                            </button>
                        </div>
                    </div>
                </section>

                {/* Ranking Settings */}
                <section className="settings-section">
                    <h2>
                        <Sparkles size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                        Ranking & Prioritization
                    </h2>

                    <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                        <div className="setting-label">
                            <span>Boost Keywords</span>
                            <span className="setting-hint">
                                Content matching these keywords will be ranked higher
                            </span>
                        </div>
                        <div className="keyword-input-row">
                            <input
                                type="text"
                                value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)}
                                onKeyDown={handleKeywordKeyDown}
                                placeholder="Enter keyword (e.g., Claude, GPT-5)"
                                className="keyword-input"
                                aria-label="Add boost keyword"
                            />
                            <button
                                onClick={handleAddKeyword}
                                className="add-keyword-btn"
                                disabled={!newKeyword.trim()}
                                aria-label="Add keyword"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                        {boostKeywords.length > 0 && (
                            <div className="keywords-list">
                                {boostKeywords.map((keyword) => (
                                    <span key={keyword} className="keyword-chip">
                                        {keyword}
                                        <button
                                            onClick={() => handleRemoveKeyword(keyword)}
                                            className="remove-keyword-btn"
                                            aria-label={`Remove ${keyword}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {boostKeywords.length === 0 && (
                            <p className="setting-hint" style={{ margin: 0 }}>
                                No boost keywords configured. Add keywords to prioritize specific content.
                            </p>
                        )}
                    </div>
                </section>

                {/* Sources by Category */}
                {categories.map((cat) => (
                    <section
                        key={cat.category}
                        className={`settings-section ${!expandedCategories.has(cat.category) ? 'collapsed' : ''}`}
                    >
                        <div className="category-header">
                            <button
                                className="category-title-btn"
                                onClick={() => toggleCollapse(cat.category)}
                                aria-expanded={expandedCategories.has(cat.category)}
                            >
                                {expandedCategories.has(cat.category) ? (
                                    <ChevronUp size={20} className="category-chevron" />
                                ) : (
                                    <ChevronDown size={20} className="category-chevron" />
                                )}
                                <h2>{CATEGORY_LABELS[cat.category]}</h2>
                                <span className="category-count">
                                    {cat.sources.filter(s => enabledSources.has(s.id)).length}/{cat.sources.length}
                                </span>
                            </button>
                            <div className="category-actions">
                                <button
                                    className="category-btn enable"
                                    onClick={() => handleToggleCategory(cat.category, true)}
                                >
                                    Enable All
                                </button>
                                <button
                                    className="category-btn disable"
                                    onClick={() => handleToggleCategory(cat.category, false)}
                                >
                                    Disable All
                                </button>
                            </div>
                        </div>

                        {expandedCategories.has(cat.category) && (
                            <div className="source-list">
                                {cat.sources.map((source) => (
                                    <div
                                        key={source.id}
                                        className={`source-item ${enabledSources.has(source.id) ? 'enabled' : 'disabled'}`}
                                    >
                                        <div className="source-info">
                                            {(() => { const Icon = CATEGORY_ICONS[cat.category]; return <Icon size={20} className="source-icon" />; })()}
                                            <span className="source-name">{source.name}</span>
                                            {source.requiresKey && (
                                                <span className={`api-badge ${source.enabled ? 'has-key' : 'needs-key'}`}>
                                                    {source.enabled ? 'API Key ✓' : 'Needs API Key'}
                                                </span>
                                            )}
                                            <span className={`tier-badge tier-${source.qualityTier}`} title={`Quality Tier ${source.qualityTier}: ${source.qualityTierLabel} (baseline: ${(source.qualityBaseline * 100).toFixed(0)}%)`}>
                                                {source.hasEngagementMetrics ? (
                                                    <>T{source.qualityTier} + {source.engagementType}</>
                                                ) : (
                                                    <>Tier {source.qualityTier}</>
                                                )}
                                            </span>
                                            <span className="method-badge">{source.method.toUpperCase()}</span>
                                        </div>
                                        <div className="source-actions">
                                            <div className="priority-selector" title="Source priority">
                                                <Star size={14} className="priority-icon" />
                                                <select
                                                    value={getSourcePriority(source.id)}
                                                    onChange={(e) => setSourcePriority(source.id, Number(e.target.value))}
                                                    className="priority-select"
                                                    aria-label={`Priority for ${source.name}`}
                                                >
                                                    {[1, 2, 3, 4, 5].map((p) => (
                                                        <option key={p} value={p}>
                                                            {p} - {PRIORITY_LABELS[p]}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button
                                                className="toggle-btn"
                                                onClick={() => toggleSource(source.id)}
                                                disabled={source.requiresKey && !source.enabled}
                                                aria-label={enabledSources.has(source.id) ? `Disable ${source.name}` : `Enable ${source.name}`}
                                            >
                                                {enabledSources.has(source.id) ? (
                                                    <Check size={18} />
                                                ) : (
                                                    <X size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                ))}
            </main>
        </div>
    );
}
