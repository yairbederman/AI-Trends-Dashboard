'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, RefreshCw, Moon, Sun, AlertCircle, Star, Sparkles, Plus, Trash2 } from 'lucide-react';
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

    if (loading) {
        return (
            <div className="settings-page">
                <div className="loading-container">
                    <RefreshCw className="spinner" size={32} />
                    <p>Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <header className="settings-header" role="banner">
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
                    <section key={cat.category} className="settings-section">
                        <div className="category-header">
                            <h2>{CATEGORY_LABELS[cat.category]}</h2>
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

                        <div className="source-list">
                            {cat.sources.map((source) => (
                                <div
                                    key={source.id}
                                    className={`source-item ${enabledSources.has(source.id) ? 'enabled' : 'disabled'}`}
                                >
                                    <div className="source-info">
                                        <span className="source-icon">{source.icon}</span>
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
                    </section>
                ))}
            </main>
        </div>
    );
}
