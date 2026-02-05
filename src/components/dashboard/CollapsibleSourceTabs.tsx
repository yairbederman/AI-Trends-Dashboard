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
            className="w-full max-w-[var(--content-max-width)] mx-auto mb-8 overflow-hidden pl-1"
            aria-label="Content categories"
        >
            <div
                className="
                    flex items-center gap-5 overflow-x-auto no-scrollbar 
                    py-4 px-4 mask-linear-fade
                "
            >
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
                    label="All Sources"
                    count={totalCount}
                />

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
        </nav>
    );
}

// Sub-component for cleaner code & shared layout animations
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
        <motion.button
            layout
            onClick={onClick}
            transition={{
                layout: { duration: 0.25, type: "spring", stiffness: 300, damping: 30 }
            }}
            className={`
                relative flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full 
                transition-colors duration-200 whitespace-nowrap min-w-fit
                cursor-pointer shrink-0 border
                ${isActive
                    ? 'text-white border-transparent'
                    : 'bg-white/5 border-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white hover:border-white/20'
                }
            `}
        >
            {/* Active Background Slide (layoutId for smooth morph) */}
            {isActive && (
                <motion.div
                    layoutId="activeTabBackground"
                    className="absolute inset-0 z-[-1] rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_0_20px_rgba(20,184,166,0.5)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            <div className="relative z-10 flex items-center gap-2">
                {Icon && <Icon size={18} className={isActive ? "text-white" : ""} />}

                <span className={`
                    block transition-all duration-200 text-[15px]
                    ${isActive ? 'font-bold tracking-wide' : 'font-medium tracking-normal'}
                `}>
                    {label}
                </span>

                {count !== undefined && count > 0 && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center
                        ${isActive ? 'bg-white/25 text-white' : 'bg-white/10 text-[var(--text-muted)]'}
                    `}>
                        {count}
                    </span>
                )}
            </div>
        </motion.button>
    );
}
