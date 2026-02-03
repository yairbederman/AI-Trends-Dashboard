'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function SettingsError({ error, reset }: ErrorProps) {
    useEffect(() => {
        console.error('Settings error:', error);
    }, [error]);

    return (
        <div className="settings-page">
            <header className="settings-header">
                <Link href="/" className="back-link">
                    <ArrowLeft size={20} />
                    Back to Dashboard
                </Link>
                <h1>Settings</h1>
            </header>
            <main className="settings-main">
                <div className="error-container">
                    <AlertTriangle size={48} style={{ color: 'var(--error)', marginBottom: '1rem' }} />
                    <h2>Failed to load settings</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        {error.message || 'An error occurred while loading settings.'}
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem 1.5rem',
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                        }}
                    >
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                </div>
            </main>
            <style jsx>{`
                .error-container {
                    text-align: center;
                    padding: 3rem;
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                }
                h2 {
                    margin-bottom: 0.5rem;
                }
            `}</style>
        </div>
    );
}
