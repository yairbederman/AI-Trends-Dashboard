/**
 * Module-level tracker for background source refresh progress.
 * Lives in server memory — one active session at a time.
 */

export interface SourceRefreshEntry {
    id: string;
    name: string;
    icon: string;
    status: 'pending' | 'fetching' | 'done' | 'failed';
}

export interface RefreshSession {
    sources: Map<string, SourceRefreshEntry>;
    total: number;
    completed: number;
    startedAt: number;
}

let currentSession: RefreshSession | null = null;

export function startRefreshSession(
    sources: { id: string; name: string; icon?: string }[],
): void {
    const map = new Map<string, SourceRefreshEntry>();
    for (const s of sources) {
        map.set(s.id, {
            id: s.id,
            name: s.name,
            icon: s.icon || '',
            status: 'pending',
        });
    }
    currentSession = {
        sources: map,
        total: sources.length,
        completed: 0,
        startedAt: Date.now(),
    };
}

export function markSourceFetching(sourceId: string): void {
    const entry = currentSession?.sources.get(sourceId);
    if (entry) entry.status = 'fetching';
}

export function markSourceDone(sourceId: string): void {
    if (!currentSession) return;
    const entry = currentSession.sources.get(sourceId);
    if (entry && entry.status !== 'done' && entry.status !== 'failed') {
        entry.status = 'done';
        currentSession.completed++;
    }
}

export function markSourceFailed(sourceId: string): void {
    if (!currentSession) return;
    const entry = currentSession.sources.get(sourceId);
    if (entry && entry.status !== 'done' && entry.status !== 'failed') {
        entry.status = 'failed';
        currentSession.completed++;
    }
}

export function endRefreshSession(): void {
    currentSession = null;
}

export interface RefreshProgressSnapshot {
    active: true;
    sources: SourceRefreshEntry[];
    total: number;
    completed: number;
    percent: number;
}

export function getRefreshProgress(): RefreshProgressSnapshot | { active: false } {
    if (!currentSession) return { active: false };

    // Auto-expire stale sessions (>90s)
    if (Date.now() - currentSession.startedAt > 90_000) {
        currentSession = null;
        return { active: false };
    }

    const percent = currentSession.total > 0
        ? Math.round((currentSession.completed / currentSession.total) * 100)
        : 0;

    return {
        active: true,
        sources: [...currentSession.sources.values()],
        total: currentSession.total,
        completed: currentSession.completed,
        percent,
    };
}
