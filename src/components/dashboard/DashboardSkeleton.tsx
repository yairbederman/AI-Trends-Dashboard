'use client';

export function DashboardSkeleton() {
    return (
        <div className="dashboard-skeleton" aria-label="Loading dashboard..." role="status">
            {/* KPI Cards */}
            <div className="kpi-grid">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="kpi-card">
                        <div className="skeleton-shimmer" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                        <span className="skeleton-shimmer" style={{ width: '60%', height: 12 }} />
                        <span className="skeleton-shimmer" style={{ width: '80%', height: 20 }} />
                        <span className="skeleton-shimmer" style={{ width: '50%', height: 10 }} />
                    </div>
                ))}
            </div>

            {/* Highlights Lanes */}
            <div className="highlights-lanes">
                {Array.from({ length: 3 }).map((_, laneIdx) => (
                    <div key={laneIdx} className="highlight-lane">
                        <div className="skeleton-shimmer" style={{ width: 120, height: 16, marginBottom: 12 }} />
                        {Array.from({ length: 3 }).map((_, cardIdx) => (
                            <div key={cardIdx} className="highlight-card" style={{ padding: '0.75rem' }}>
                                <div className="skeleton-shimmer" style={{ width: '90%', height: 14, marginBottom: 8 }} />
                                <div className="skeleton-shimmer" style={{ width: '60%', height: 10 }} />
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Chart Placeholders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 8 }} />
                <div className="skeleton-shimmer" style={{ height: 200, borderRadius: 8 }} />
            </div>

            <span className="sr-only">Loading dashboard content...</span>
        </div>
    );
}
