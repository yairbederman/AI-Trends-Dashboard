'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X, RefreshCw, Moon, Sun, AlertCircle, Star, Sparkles, Plus, Trash2, ChevronDown, ChevronUp, Bot, Palette, Code2, Users, Newspaper, MessageSquare, Mail, Trophy, Pencil, Loader2 } from 'lucide-react';
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
    const [newChannel, setNewChannel] = useState('');
    const [isResolvingChannel, setIsResolvingChannel] = useState(false);
    const [channelError, setChannelError] = useState('');
    const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
    const [editChannelValue, setEditChannelValue] = useState('');
    const [isResolvingEdit, setIsResolvingEdit] = useState(false);
    const [editChannelError, setEditChannelError] = useState('');
    const [newSubreddit, setNewSubreddit] = useState('');
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
        youtubeChannels,
        setYouTubeChannels,
        customSubreddits,
        setCustomSubreddits,
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

    const parseChannelInput = (input: string): { type: 'id'; value: string } | { type: 'handle'; value: string } | null => {
        const trimmed = input.trim();
        if (!trimmed) return null;
        // Direct channel ID (UC...)
        if (/^UC[\w-]{22}$/.test(trimmed)) return { type: 'id', value: trimmed };
        // URL with /channel/UC...
        const channelMatch = trimmed.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
        if (channelMatch) return { type: 'id', value: channelMatch[1] };
        // URL with @handle
        const handleUrlMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/);
        if (handleUrlMatch) return { type: 'handle', value: `@${handleUrlMatch[1]}` };
        // Bare @handle
        if (/^@[\w.-]+$/.test(trimmed)) return { type: 'handle', value: trimmed };
        return null;
    };

    const resolveChannel = async (input: string): Promise<{ channelId: string; name: string } | { error: string }> => {
        const parsed = parseChannelInput(input);
        if (!parsed) return { error: 'Invalid input' };

        if (parsed.type === 'id') {
            return { channelId: parsed.value, name: parsed.value };
        }

        // Resolve @handle via API
        try {
            const res = await fetch(`/api/youtube/resolve?input=${encodeURIComponent(parsed.value)}`);
            const data = await res.json();
            if (!res.ok) return { error: data.error || 'Failed to resolve channel' };
            return { channelId: data.channelId, name: data.name };
        } catch {
            return { error: 'Network error resolving channel' };
        }
    };

    const handleAddChannel = async () => {
        const parsed = parseChannelInput(newChannel);
        if (!parsed || isResolvingChannel) return;
        setChannelError('');

        if (parsed.type === 'id') {
            if (youtubeChannels.some(ch => ch.channelId === parsed.value)) {
                setChannelError('Channel already added');
                return;
            }
            setYouTubeChannels([...youtubeChannels, { channelId: parsed.value, name: parsed.value }]);
            setNewChannel('');
            return;
        }

        // Handle @handle resolution
        setIsResolvingChannel(true);
        const result = await resolveChannel(newChannel);
        setIsResolvingChannel(false);

        if ('error' in result) {
            setChannelError(result.error);
            return;
        }

        if (youtubeChannels.some(ch => ch.channelId === result.channelId)) {
            setChannelError('Channel already added');
            return;
        }

        setYouTubeChannels([...youtubeChannels, { channelId: result.channelId, name: result.name }]);
        setNewChannel('');
    };

    const handleRemoveChannel = (channelId: string) => {
        setYouTubeChannels(youtubeChannels.filter(ch => ch.channelId !== channelId));
    };

    const handleChannelKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddChannel();
        }
    };

    const startEditChannel = (channelId: string) => {
        setEditingChannelId(channelId);
        setEditChannelValue(`youtube.com/channel/${channelId}`);
        setEditChannelError('');
    };

    const cancelEditChannel = () => {
        setEditingChannelId(null);
        setEditChannelValue('');
        setEditChannelError('');
    };

    const saveEditChannel = async () => {
        if (!editingChannelId || isResolvingEdit) return;
        setEditChannelError('');

        const parsed = parseChannelInput(editChannelValue);
        if (!parsed) {
            setEditChannelError('Invalid input');
            return;
        }

        setIsResolvingEdit(true);
        const result = await resolveChannel(editChannelValue);
        setIsResolvingEdit(false);

        if ('error' in result) {
            setEditChannelError(result.error);
            return;
        }

        // Check for duplicates (excluding the channel being edited)
        if (youtubeChannels.some(ch => ch.channelId === result.channelId && ch.channelId !== editingChannelId)) {
            setEditChannelError('Channel already exists');
            return;
        }

        setYouTubeChannels(
            youtubeChannels.map(ch =>
                ch.channelId === editingChannelId
                    ? { channelId: result.channelId, name: result.name }
                    : ch
            )
        );
        setEditingChannelId(null);
        setEditChannelValue('');
    };

    const handleEditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEditChannel();
        } else if (e.key === 'Escape') {
            cancelEditChannel();
        }
    };

    const handleAddSubreddit = () => {
        const name = newSubreddit.trim().replace(/^r\//, '');
        if (name && !customSubreddits.some(s => s.name.toLowerCase() === name.toLowerCase())) {
            setCustomSubreddits([...customSubreddits, { name }]);
            setNewSubreddit('');
        }
    };

    const handleRemoveSubreddit = (name: string) => {
        setCustomSubreddits(customSubreddits.filter(s => s.name !== name));
    };

    const handleSubredditKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSubreddit();
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

                {/* YouTube Channels */}
                <section className="settings-section">
                    <h2>
                        <span style={{ display: 'inline', marginRight: '0.5rem' }}>📺</span>
                        YouTube Channels
                    </h2>

                    <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                        <div className="setting-label">
                            <span>Monitored Channels</span>
                            <span className="setting-hint">
                                Videos from these channels are fetched via RSS (no API quota cost). Add a @handle, channel URL, or ID.
                            </span>
                        </div>
                        <div className="keyword-input-row">
                            <input
                                type="text"
                                value={newChannel}
                                onChange={(e) => { setNewChannel(e.target.value); setChannelError(''); }}
                                onKeyDown={handleChannelKeyDown}
                                placeholder="@handle, channel URL, or ID (e.g., @Fireship)"
                                className="keyword-input"
                                aria-label="Add YouTube channel"
                            />
                            <button
                                onClick={handleAddChannel}
                                className="add-keyword-btn"
                                disabled={!parseChannelInput(newChannel) || isResolvingChannel}
                                aria-label="Add channel"
                            >
                                {isResolvingChannel ? (
                                    <Loader2 size={16} className="spinning" />
                                ) : (
                                    <Plus size={16} />
                                )}
                                {isResolvingChannel ? 'Resolving...' : 'Add'}
                            </button>
                        </div>
                        {channelError && (
                            <p className="setting-hint" style={{ margin: 0, color: 'var(--error)' }}>
                                {channelError}
                            </p>
                        )}
                        {youtubeChannels.length > 0 && (
                            <div className="keywords-list">
                                {youtubeChannels.map((channel) => (
                                    editingChannelId === channel.channelId ? (
                                        <div key={channel.channelId} className="channel-edit-row">
                                            <input
                                                type="text"
                                                value={editChannelValue}
                                                onChange={(e) => { setEditChannelValue(e.target.value); setEditChannelError(''); }}
                                                onKeyDown={handleEditKeyDown}
                                                className="keyword-input"
                                                autoFocus
                                                aria-label="Edit channel"
                                            />
                                            <button
                                                onClick={saveEditChannel}
                                                className="add-keyword-btn"
                                                disabled={!parseChannelInput(editChannelValue) || isResolvingEdit}
                                                aria-label="Save channel"
                                            >
                                                {isResolvingEdit ? (
                                                    <Loader2 size={14} className="spinning" />
                                                ) : (
                                                    <Check size={14} />
                                                )}
                                            </button>
                                            <button
                                                onClick={cancelEditChannel}
                                                className="channel-edit-btn"
                                                aria-label="Cancel edit"
                                            >
                                                <X size={14} />
                                            </button>
                                            {editChannelError && (
                                                <span style={{ color: 'var(--error)', fontSize: '0.75rem' }}>{editChannelError}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <span key={channel.channelId} className="keyword-chip" title={`youtube.com/channel/${channel.channelId}`}>
                                            {channel.name}
                                            <button
                                                onClick={() => startEditChannel(channel.channelId)}
                                                className="channel-edit-btn"
                                                aria-label={`Edit ${channel.name}`}
                                            >
                                                <Pencil size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleRemoveChannel(channel.channelId)}
                                                className="remove-keyword-btn"
                                                aria-label={`Remove ${channel.name}`}
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    )
                                ))}
                            </div>
                        )}
                        {youtubeChannels.length === 0 && (
                            <p className="setting-hint" style={{ margin: 0 }}>
                                No YouTube channels configured. Add channels to monitor their latest videos.
                            </p>
                        )}
                    </div>
                </section>

                {/* Subreddits */}
                <section className="settings-section">
                    <h2>
                        <span style={{ display: 'inline', marginRight: '0.5rem' }}>🔴</span>
                        Subreddits
                    </h2>

                    <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
                        <div className="setting-label">
                            <span>Monitored Subreddits</span>
                            <span className="setting-hint">
                                Posts from these subreddits are fetched via Reddit&apos;s public JSON API. Add a subreddit name (with or without r/ prefix).
                            </span>
                        </div>
                        <div className="keyword-input-row">
                            <input
                                type="text"
                                value={newSubreddit}
                                onChange={(e) => setNewSubreddit(e.target.value)}
                                onKeyDown={handleSubredditKeyDown}
                                placeholder="Subreddit name (e.g., ClaudeAI or r/ClaudeAI)"
                                className="keyword-input"
                                aria-label="Add subreddit"
                            />
                            <button
                                onClick={handleAddSubreddit}
                                className="add-keyword-btn"
                                disabled={!newSubreddit.trim().replace(/^r\//, '')}
                                aria-label="Add subreddit"
                            >
                                <Plus size={16} />
                                Add
                            </button>
                        </div>
                        {customSubreddits.length > 0 && (
                            <div className="keywords-list">
                                {customSubreddits.map((sub) => (
                                    <span key={sub.name} className="keyword-chip">
                                        r/{sub.name}
                                        <button
                                            onClick={() => handleRemoveSubreddit(sub.name)}
                                            className="remove-keyword-btn"
                                            aria-label={`Remove r/${sub.name}`}
                                        >
                                            <X size={12} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {customSubreddits.length === 0 && (
                            <p className="setting-hint" style={{ margin: 0 }}>
                                No subreddits configured. Add subreddits to monitor their latest posts.
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
