'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { SourceConstellation, ConstellationSource, NodeStatus } from './SourceConstellation';
import { SOURCES } from '@/lib/config/sources';

interface SourceEntry {
    id: string;
    name: string;
    icon: string;
    status: 'pending' | 'fetching' | 'done' | 'failed';
}

interface RefreshStatusResponse {
    active: boolean;
    done?: boolean;
    sources?: SourceEntry[];
    total?: number;
    completed?: number;
    percent?: number;
}

interface ConstellationRefreshWrapperProps {
    initialSources: { id: string; name: string; icon: string }[];
    onComplete: () => void;
}

export function ConstellationRefreshWrapper({
    initialSources,
    onComplete,
}: ConstellationRefreshWrapperProps) {
    // Build category map synchronously from static config
    const catMap = useMemo(() => {
        const map: Record<string, string> = {};
        SOURCES.forEach(s => { map[s.id] = s.category; });
        return map;
    }, []);

    const [sources, setSources] = useState<ConstellationSource[]>(
        initialSources.map(s => ({
            ...s,
            category: catMap[s.id] || 'other',
            status: 'pending' as NodeStatus,
        }))
    );
    const [percent, setPercent] = useState(0);
    const [isDone, setIsDone] = useState(false);
    const completedRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const poll = useCallback(async () => {
        if (completedRef.current) return;

        try {
            const res = await fetch('/api/feed/refresh-status');
            if (!res.ok) return;
            const data: RefreshStatusResponse = await res.json();

            if (data.active && data.sources) {
                setSources(data.sources.map(s => ({
                    id: s.id,
                    name: s.name,
                    icon: s.icon,
                    category: catMap[s.id] || 'other',
                    status: s.status as NodeStatus,
                })));

                if (data.percent !== undefined) setPercent(data.percent);

                if (data.done) {
                    setPercent(100);
                    setIsDone(true);
                    completedRef.current = true;
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
            } else if (!data.active) {
                setSources(prev => prev.map(s =>
                    s.status === 'pending' || s.status === 'fetching'
                        ? { ...s, status: 'done' as NodeStatus }
                        : s
                ));
                setPercent(100);
                setIsDone(true);
                completedRef.current = true;
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
        } catch {
            // Silently ignore polling errors
        }
    }, [catMap]);

    useEffect(() => {
        poll();
        intervalRef.current = setInterval(poll, 1500);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [poll]);

    const handleTransitionComplete = useCallback(() => {
        onComplete();
    }, [onComplete]);

    return (
        <SourceConstellation
            sources={sources}
            percent={percent}
            isDone={isDone}
            mode="refresh"
            onTransitionComplete={handleTransitionComplete}
        />
    );
}
