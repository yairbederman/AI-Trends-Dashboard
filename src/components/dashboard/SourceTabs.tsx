'use client';

import { SourceCategory, CATEGORY_LABELS } from '@/types';
import { LayoutDashboard } from 'lucide-react';

interface SourceTabsProps {
    categories: SourceCategory[];
    activeCategory: SourceCategory | 'all' | 'dashboard';
    onCategoryChange: (category: SourceCategory | 'all' | 'dashboard') => void;
}

export function SourceTabs({ categories, activeCategory, onCategoryChange }: SourceTabsProps) {
    return (
        <nav className="source-tabs" role="tablist" aria-label="Content categories">
            <button
                role="tab"
                aria-selected={activeCategory === 'dashboard'}
                aria-controls="main-content"
                className={`tab ${activeCategory === 'dashboard' ? 'active' : ''}`}
                onClick={() => onCategoryChange('dashboard')}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
                <LayoutDashboard size={14} />
                Dashboard
            </button>
            <button
                role="tab"
                aria-selected={activeCategory === 'all'}
                aria-controls="main-content"
                className={`tab ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => onCategoryChange('all')}
            >
                All Sources
            </button>
            {categories.map((category) => (
                <button
                    key={category}
                    role="tab"
                    aria-selected={activeCategory === category}
                    aria-controls="main-content"
                    className={`tab ${activeCategory === category ? 'active' : ''}`}
                    onClick={() => onCategoryChange(category)}
                >
                    {CATEGORY_LABELS[category]}
                </button>
            ))}
        </nav>
    );
}
