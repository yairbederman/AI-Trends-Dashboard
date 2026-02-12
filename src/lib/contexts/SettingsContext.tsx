'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { SOURCES } from '@/lib/config/sources';
import { TimeRange, CustomSourceConfig } from '@/types';
import { YouTubeChannelConfig } from '@/lib/config/youtube-channels';
import { SubredditConfig } from '@/lib/config/subreddit-sources';

function getAllSourceIds(customSources: CustomSourceConfig[] = []): string[] {
    return [...SOURCES.map((s) => s.id), ...customSources.map(cs => cs.id)];
}

interface SettingsContextValue {
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    timeRange: TimeRange;
    setTimeRange: (range: TimeRange) => void;
    enabledSources: Set<string>;
    toggleSource: (sourceId: string) => void;
    enableCategory: (sourceIds: string[]) => void;
    disableCategory: (sourceIds: string[]) => void;
    enableAll: () => void;
    disableAll: () => void;
    isSourceEnabled: (sourceId: string) => boolean;
    // Priority management
    priorities: Map<string, number>;
    setSourcePriority: (sourceId: string, priority: number) => void;
    getSourcePriority: (sourceId: string) => number;
    // Keyword boost
    boostKeywords: string[];
    setBoostKeywords: (keywords: string[]) => void;
    // YouTube channels
    youtubeChannels: YouTubeChannelConfig[];
    setYouTubeChannels: (channels: YouTubeChannelConfig[]) => void;
    // Custom subreddits
    customSubreddits: SubredditConfig[];
    setCustomSubreddits: (subreddits: SubredditConfig[]) => void;
    // Custom sources
    customSources: CustomSourceConfig[];
    deletedSources: string[];
    addCustomSource: (source: CustomSourceConfig) => void;
    deleteSource: (sourceId: string, isCustom: boolean) => void;
    restoreSource: (sourceId: string) => void;
    // Sync state
    isSyncing: boolean;
    syncError: string | null;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
    const [timeRange, setTimeRangeState] = useState<TimeRange>('24h');
    const [enabledSources, setEnabledSources] = useState<Set<string>>(new Set(getAllSourceIds()));
    const [priorities, setPriorities] = useState<Map<string, number>>(new Map());
    const [boostKeywords, setBoostKeywordsState] = useState<string[]>([]);
    const [youtubeChannels, setYouTubeChannelsState] = useState<YouTubeChannelConfig[]>([]);
    const [customSubreddits, setCustomSubredditsState] = useState<SubredditConfig[]>([]);
    const [customSources, setCustomSourcesState] = useState<CustomSourceConfig[]>([]);
    const [deletedSources, setDeletedSourcesState] = useState<string[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Initial fetch from API
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/settings');
                if (res.ok) {
                    const data = await res.json();
                    setThemeState(data.theme || 'dark');
                    document.documentElement.setAttribute('data-theme', data.theme || 'dark');
                    setTimeRangeState(data.timeRange || '24h');
                    setEnabledSources(new Set(data.enabledSources || getAllSourceIds()));
                    // Load priorities
                    if (data.priorities) {
                        setPriorities(new Map(Object.entries(data.priorities)));
                    }
                    // Load boost keywords
                    if (data.boostKeywords) {
                        setBoostKeywordsState(data.boostKeywords);
                    }
                    // Load YouTube channels
                    if (data.youtubeChannels) {
                        setYouTubeChannelsState(data.youtubeChannels);
                    }
                    // Load custom subreddits
                    if (data.customSubreddits) {
                        setCustomSubredditsState(data.customSubreddits);
                    }
                    // Load custom sources
                    if (data.customSources) {
                        setCustomSourcesState(data.customSources);
                    }
                    // Load deleted sources
                    if (data.deletedSources) {
                        setDeletedSourcesState(data.deletedSources);
                    }
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
                setEnabledSources(new Set(getAllSourceIds()));
            } finally {
                // Settings loaded (or failed with defaults)
            }
        };

        fetchSettings();
    }, []);

    // API Sync helper with rollback support
    const syncSetting = useCallback(async (
        type: string,
        payload: unknown,
        rollback?: () => void
    ): Promise<boolean> => {
        setIsSyncing(true);
        setSyncError(null);

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, payload }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to save settings');
            }

            return true;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to sync settings';
            console.error('Failed to sync setting:', message);
            setSyncError(message);

            // Rollback on failure
            if (rollback) {
                rollback();
            }

            // Clear error after 5 seconds
            setTimeout(() => setSyncError(null), 5000);
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, []);

    const setTheme = useCallback((newTheme: 'dark' | 'light') => {
        const oldTheme = theme;
        setThemeState(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);

        syncSetting('UPDATE_THEME', { theme: newTheme }, () => {
            setThemeState(oldTheme);
            document.documentElement.setAttribute('data-theme', oldTheme);
        });
    }, [theme, syncSetting]);

    const setTimeRange = useCallback((range: TimeRange) => {
        const oldRange = timeRange;
        setTimeRangeState(range);

        syncSetting('UPDATE_TIME_RANGE', { timeRange: range }, () => {
            setTimeRangeState(oldRange);
        });
    }, [timeRange, syncSetting]);

    const toggleSource = useCallback((sourceId: string) => {
        setEnabledSources((prev) => {
            const next = new Set(prev);
            const wasEnabled = next.has(sourceId);
            const isEnabled = !wasEnabled;

            if (wasEnabled) {
                next.delete(sourceId);
            } else {
                next.add(sourceId);
            }

            // Sync with rollback
            syncSetting('TOGGLE_SOURCE', { sourceId, enabled: isEnabled }, () => {
                setEnabledSources((current) => {
                    const rolled = new Set(current);
                    if (wasEnabled) {
                        rolled.add(sourceId);
                    } else {
                        rolled.delete(sourceId);
                    }
                    return rolled;
                });
            });

            return next;
        });
    }, [syncSetting]);

    const enableCategory = useCallback((sourceIds: string[]) => {
        setEnabledSources((prev) => {
            const next = new Set(prev);
            const previousState = new Set(prev);
            sourceIds.forEach((id) => next.add(id));

            syncSetting('TOGGLE_CATEGORY', { sourceIds, enabled: true }, () => {
                setEnabledSources(previousState);
            });

            return next;
        });
    }, [syncSetting]);

    const disableCategory = useCallback((sourceIds: string[]) => {
        setEnabledSources((prev) => {
            const next = new Set(prev);
            const previousState = new Set(prev);
            sourceIds.forEach((id) => next.delete(id));

            syncSetting('TOGGLE_CATEGORY', { sourceIds, enabled: false }, () => {
                setEnabledSources(previousState);
            });

            return next;
        });
    }, [syncSetting]);

    const enableAll = useCallback(() => {
        const allIds = getAllSourceIds(customSources);
        const previousState = new Set(enabledSources);
        setEnabledSources(new Set(allIds));

        syncSetting('ENABLE_ALL', { sourceIds: allIds }, () => {
            setEnabledSources(previousState);
        });
    }, [enabledSources, customSources, syncSetting]);

    const disableAll = useCallback(() => {
        const previousState = new Set(enabledSources);
        setEnabledSources(new Set());

        syncSetting('DISABLE_ALL', { sourceIds: getAllSourceIds(customSources) }, () => {
            setEnabledSources(previousState);
        });
    }, [enabledSources, customSources, syncSetting]);

    const isSourceEnabled = useCallback((sourceId: string) => enabledSources.has(sourceId), [enabledSources]);

    const getSourcePriority = useCallback((sourceId: string) => {
        return priorities.get(sourceId) ?? 3;
    }, [priorities]);

    const setSourcePriority = useCallback((sourceId: string, priority: number) => {
        const oldPriority = priorities.get(sourceId) ?? 3;
        setPriorities((prev) => {
            const next = new Map(prev);
            next.set(sourceId, priority);
            return next;
        });

        syncSetting('SET_PRIORITY', { sourceId, priority }, () => {
            setPriorities((prev) => {
                const rolled = new Map(prev);
                rolled.set(sourceId, oldPriority);
                return rolled;
            });
        });
    }, [priorities, syncSetting]);

    const setBoostKeywords = useCallback((keywords: string[]) => {
        const oldKeywords = boostKeywords;
        setBoostKeywordsState(keywords);

        syncSetting('SET_BOOST_KEYWORDS', { keywords }, () => {
            setBoostKeywordsState(oldKeywords);
        });
    }, [boostKeywords, syncSetting]);

    const setYouTubeChannels = useCallback((channels: YouTubeChannelConfig[]) => {
        const oldChannels = youtubeChannels;
        setYouTubeChannelsState(channels);

        syncSetting('SET_YOUTUBE_CHANNELS', { channels }, () => {
            setYouTubeChannelsState(oldChannels);
        });
    }, [youtubeChannels, syncSetting]);

    const setCustomSubreddits = useCallback((subreddits: SubredditConfig[]) => {
        const oldSubreddits = customSubreddits;
        setCustomSubredditsState(subreddits);

        syncSetting('SET_CUSTOM_SUBREDDITS', { subreddits }, () => {
            setCustomSubredditsState(oldSubreddits);
        });
    }, [customSubreddits, syncSetting]);

    const addCustomSource = useCallback((source: CustomSourceConfig) => {
        const oldCustomSources = customSources;
        const oldEnabledSources = new Set(enabledSources);
        setCustomSourcesState(prev => [...prev, source]);
        setEnabledSources(prev => {
            const next = new Set(prev);
            next.add(source.id);
            return next;
        });

        syncSetting('ADD_CUSTOM_SOURCE', { source }, () => {
            setCustomSourcesState(oldCustomSources);
            setEnabledSources(oldEnabledSources);
        });
    }, [customSources, enabledSources, syncSetting]);

    const deleteSource = useCallback((sourceId: string, isCustom: boolean) => {
        const oldCustomSources = customSources;
        const oldDeletedSources = deletedSources;
        const oldEnabledSources = new Set(enabledSources);

        if (isCustom) {
            setCustomSourcesState(prev => prev.filter(s => s.id !== sourceId));
        } else {
            setDeletedSourcesState(prev => [...prev, sourceId]);
        }
        setEnabledSources(prev => {
            const next = new Set(prev);
            next.delete(sourceId);
            return next;
        });

        syncSetting('DELETE_SOURCE', { sourceId, isCustom }, () => {
            setCustomSourcesState(oldCustomSources);
            setDeletedSourcesState(oldDeletedSources);
            setEnabledSources(oldEnabledSources);
        });
    }, [customSources, deletedSources, enabledSources, syncSetting]);

    const restoreSource = useCallback((sourceId: string) => {
        const oldDeletedSources = deletedSources;
        const oldEnabledSources = new Set(enabledSources);

        setDeletedSourcesState(prev => prev.filter(id => id !== sourceId));
        setEnabledSources(prev => {
            const next = new Set(prev);
            next.add(sourceId);
            return next;
        });

        syncSetting('RESTORE_SOURCE', { sourceId }, () => {
            setDeletedSourcesState(oldDeletedSources);
            setEnabledSources(oldEnabledSources);
        });
    }, [deletedSources, enabledSources, syncSetting]);

    return (
        <SettingsContext.Provider
            value={{
                theme,
                setTheme,
                timeRange,
                setTimeRange,
                enabledSources,
                toggleSource,
                enableCategory,
                disableCategory,
                enableAll,
                disableAll,
                isSourceEnabled,
                priorities,
                setSourcePriority,
                getSourcePriority,
                boostKeywords,
                setBoostKeywords,
                youtubeChannels,
                setYouTubeChannels,
                customSubreddits,
                setCustomSubreddits,
                customSources,
                deletedSources,
                addCustomSource,
                deleteSource,
                restoreSource,
                isSyncing,
                syncError,
            }}
        >
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
