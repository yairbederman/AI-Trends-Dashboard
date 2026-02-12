'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

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

interface RefreshProgressProps {
    /** Initial source list from the feed response (shown before first poll) */
    initialSources: { id: string; name: string; icon: string }[];
    /** Called when refresh completes so parent can revalidate data */
    onComplete: () => void;
}

export function RefreshProgress({ initialSources, onComplete }: RefreshProgressProps) {
    const [sources, setSources] = useState<SourceEntry[]>(
        initialSources.map(s => ({ ...s, status: 'pending' as const }))
    );
    const [percent, setPercent] = useState(0);
    const [done, setDone] = useState(false);
    const completedRef = useRef(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const poll = useCallback(async () => {
        if (completedRef.current) return;

        try {
            const res = await fetch('/api/feed/refresh-status');
            if (!res.ok) return;
            const data: RefreshStatusResponse = await res.json();

            if (data.active && data.sources) {
                setSources(data.sources);
                if (data.percent !== undefined) setPercent(data.percent);

                // Server reports refresh is done (session still alive for grace period)
                if (data.done) {
                    setPercent(100);
                    setDone(true);
                    completedRef.current = true;
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
            } else if (!data.active) {
                // Session expired or never started — mark as done
                setSources(prev => prev.map(s =>
                    s.status === 'pending' || s.status === 'fetching'
                        ? { ...s, status: 'done' }
                        : s
                ));
                setPercent(100);
                setDone(true);
                completedRef.current = true;
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
        } catch {
            // Silently ignore polling errors
        }
    }, []);

    useEffect(() => {
        poll();
        intervalRef.current = setInterval(poll, 1500);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [poll]);

    // When done, wait briefly then notify parent exactly once
    useEffect(() => {
        if (!done) return;
        const timer = setTimeout(() => onComplete(), 2000);
        return () => clearTimeout(timer);
    }, [done, onComplete]);

    const statusIcon = (status: SourceEntry['status']) => {
        switch (status) {
            case 'done':
                return <Check size={12} className="refresh-icon-done" />;
            case 'failed':
                return <X size={12} className="refresh-icon-failed" />;
            case 'fetching':
                return <Loader2 size={12} className="refresh-icon-fetching" />;
            default:
                return <span className="refresh-icon-pending" />;
        }
    };

    return (
        <div className="refresh-progress" role="status" aria-live="polite" aria-label="Source refresh progress">
            <div className="refresh-progress-header">
                <span className="refresh-progress-label">
                    {done ? 'Sources updated' : 'Updating sources...'}
                </span>
                <span className="refresh-progress-percent">{percent}%</span>
            </div>
            <div className="refresh-progress-bar">
                <div
                    className="refresh-progress-bar-fill"
                    style={{ width: `${percent}%` }}
                />
            </div>
            <div className="refresh-progress-list">
                {sources.map(s => (
                    <div
                        key={s.id}
                        className={`refresh-progress-item refresh-status-${s.status}`}
                    >
                        {statusIcon(s.status)}
                        <span className="refresh-source-icon">{s.icon}</span>
                        <span className="refresh-source-name">{s.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
