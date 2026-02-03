'use client';

import { SourceCategory, CATEGORY_LABELS } from '@/types';

interface SourceTabsProps {
    categories: SourceCategory[];
    activeCategory: SourceCategory | 'all';
    onCategoryChange: (category: SourceCategory | 'all') => void;
}

export function SourceTabs({ categories, activeCategory, onCategoryChange }: SourceTabsProps) {
    return (
        <nav className="source-tabs" role="tablist" aria-label="Content categories">
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
