'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="error-page">
            <div className="error-content">
                <AlertTriangle size={64} className="error-icon" />
                <h1>Something went wrong</h1>
                <p className="error-message">
                    {error.message || 'An unexpected error occurred while loading this page.'}
                </p>
                {error.digest && (
                    <p className="error-digest">Error ID: {error.digest}</p>
                )}
                <div className="error-actions">
                    <button onClick={reset} className="retry-button">
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                    <Link href="/" className="home-button">
                        <Home size={18} />
                        Go Home
                    </Link>
                </div>
            </div>
            <style jsx>{`
                .error-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    background: var(--bg-primary);
                }

                .error-content {
                    text-align: center;
                    max-width: 500px;
                }

                .error-icon {
                    color: var(--error);
                    margin-bottom: 1.5rem;
                }

                h1 {
                    font-size: 1.75rem;
                    margin-bottom: 1rem;
                    color: var(--text-primary);
                }

                .error-message {
                    color: var(--text-secondary);
                    margin-bottom: 0.5rem;
                    line-height: 1.6;
                }

                .error-digest {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    font-family: monospace;
                    margin-bottom: 2rem;
                }

                .error-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    flex-wrap: wrap;
                }

                .retry-button,
                .home-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                }

                .retry-button {
                    background: var(--accent-primary);
                    color: white;
                    border: none;
                }

                .retry-button:hover {
                    background: var(--accent-secondary);
                }

                .home-button {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                    border: 1px solid var(--border-color);
                }

                .home-button:hover {
                    border-color: var(--border-hover);
                    background: var(--bg-card-hover);
                }
            `}</style>
        </div>
    );
}
