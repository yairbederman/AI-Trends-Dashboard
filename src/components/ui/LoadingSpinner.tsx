'use client';

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
    message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
    return (
        <div className="loading-container">
            <Loader2 className="spinner" size={32} />
            <p>{message}</p>
        </div>
    );
}
