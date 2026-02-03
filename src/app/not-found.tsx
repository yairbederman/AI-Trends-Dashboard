import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="not-found-page">
            <div className="not-found-content">
                <FileQuestion size={64} className="not-found-icon" />
                <h1>Page Not Found</h1>
                <p>The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
                <div className="not-found-actions">
                    <Link href="/" className="home-button">
                        <Home size={18} />
                        Go to Dashboard
                    </Link>
                </div>
            </div>
            <style>{`
                .not-found-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem;
                    background: var(--bg-primary);
                }

                .not-found-content {
                    text-align: center;
                    max-width: 500px;
                }

                .not-found-icon {
                    color: var(--text-muted);
                    margin-bottom: 1.5rem;
                }

                .not-found-page h1 {
                    font-size: 1.75rem;
                    margin-bottom: 1rem;
                    color: var(--text-primary);
                }

                .not-found-page p {
                    color: var(--text-secondary);
                    margin-bottom: 2rem;
                    line-height: 1.6;
                }

                .not-found-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }

                .home-button {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    background: var(--accent-primary);
                    color: white;
                    text-decoration: none;
                    transition: all 0.2s;
                }

                .home-button:hover {
                    background: var(--accent-secondary);
                }
            `}</style>
        </div>
    );
}
