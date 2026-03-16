'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface SourceHealth {
    lastSuccessAt: string | null;
    consecutiveFailures: number;
    lastError: string | null;
    lastItemCount: number;
}

interface SourceInfo {
    id: string;
    name: string;
    icon?: string;
    enabled: boolean;
    health?: SourceHealth;
}

interface SourcesResponse {
    categories: { sources: SourceInfo[] }[];
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

/**
 * Shows a compact banner on the dashboard when enabled sources are
 * experiencing issues (consecutive failures >= 3).
 */
export function SourceHealthBanner() {
    const [dismissed, setDismissed] = useState(false);

    const { data } = useSWR<SourcesResponse>('/api/sources', fetcher, {
        revalidateOnFocus: false,
        refreshInterval: 5 * 60 * 1000, // Check every 5 minutes
        dedupingInterval: 60_000,
    });

    if (dismissed || !data) return null;

    const unhealthySources = data.categories
        .flatMap(c => c.sources)
        .filter(s => s.enabled && s.health && s.health.consecutiveFailures >= 3);

    if (unhealthySources.length === 0) return null;

    const names = unhealthySources.map(s => `${s.icon || ''} ${s.name}`.trim());
    const label = unhealthySources.length === 1
        ? `${names[0]} is not returning data`
        : `${unhealthySources.length} sources are not returning data`;

    return (
        <div className="source-health-banner" role="status" aria-live="polite">
            <AlertTriangle size={15} className="shb-icon" aria-hidden="true" />
            <span className="shb-text">
                {label}
                {unhealthySources.length <= 3 && unhealthySources.length > 1 && (
                    <span className="shb-names"> ({names.join(', ')})</span>
                )}
            </span>
            <Link href="/settings" className="shb-link">
                Details <ExternalLink size={12} />
            </Link>
            <button
                className="shb-dismiss"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss health warning"
            >
                <X size={14} />
            </button>
        </div>
    );
}
