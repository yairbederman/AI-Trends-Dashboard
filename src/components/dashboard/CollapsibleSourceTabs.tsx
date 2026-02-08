'use client';

import { SourceCategory, CATEGORY_LABELS } from '@/types';
import { LayoutDashboard } from 'lucide-react';
import { motion } from 'framer-motion';

interface CollapsibleSourceTabsProps {
    categories: SourceCategory[];
    activeCategory: SourceCategory | 'all' | 'dashboard';
    onCategoryChange: (category: SourceCategory | 'all' | 'dashboard') => void;
    itemCounts: Record<string, number>;
    totalCount: number;
}

export function CollapsibleSourceTabs({ categories, activeCategory, onCategoryChange, itemCounts, totalCount }: CollapsibleSourceTabsProps) {
    return (
        <nav
            className="category-tabs-container"
            aria-label="Content categories"
        >
            <div className="category-tabs-wrapper w-full">
                <div className="category-tabs-pill w-full md:w-full min-w-max md:min-w-0 bg-[rgba(255,255,255,0.02)] border-[0.5px] border-[rgba(255,255,255,0.1)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                    {/* Buttons container */}
                    <div className="relative z-10 flex items-center gap-4 w-full md:w-full min-w-max md:min-w-0">
                        {/* 1. Dashboard Tab */}
                        <TabButton
                            isActive={activeCategory === 'dashboard'}
                            onClick={() => onCategoryChange('dashboard')}
                            icon={LayoutDashboard}
                            label="Dashboard"
                        />

                        {/* 2. All Sources Tab */}
                        <TabButton
                            isActive={activeCategory === 'all'}
                            onClick={() => onCategoryChange('all')}
                            label="All"
                            count={totalCount}
                        />

                        <div className="w-[1px] h-4 bg-white/10 mx-2 shrink-0" />

                        {/* 3. Dynamic Categories */}
                        {categories.map((category) => (
                            <TabButton
                                key={category}
                                isActive={activeCategory === category}
                                onClick={() => onCategoryChange(category)}
                                label={CATEGORY_LABELS[category]}
                                count={itemCounts[category]}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </nav>
    );
}

// Sub-component matching FeedModeSelector style
function TabButton({
    isActive,
    onClick,
    label,
    icon: Icon,
    count
}: {
    isActive: boolean;
    onClick: () => void;
    label: string;
    icon?: any;
    count?: number;
}) {
    return (
        <button
            onClick={onClick}
            className={`
                relative md:flex-1 md:min-w-0 flex-shrink-0 flex items-center justify-center gap-3 px-8 md:px-4 py-2.5 rounded-full text-[13px] font-medium
                transition-all duration-300 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)]
                whitespace-nowrap cursor-pointer min-h-[42px]
                ${isActive
                    ? 'text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 active:scale-95'
                }
            `}
        >
            {/* Active Background Slide */}
            {isActive && (
                <motion.div
                    layoutId="activeCategoryTab"
                    className="absolute inset-0 z-[-1] rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_4px_12px_rgba(20,184,166,0.25)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
            )}

            {Icon && <Icon size={14} className={isActive ? "text-white drop-shadow-sm" : "opacity-60"} aria-hidden="true" />}

            <span className="tracking-tight">{label}</span>

            {count !== undefined && count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center transition-colors duration-300
                    ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'}
                `}>
                    {count}
                </span>
            )}
        </button>
    );
}
