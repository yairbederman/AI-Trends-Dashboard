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
            <div className="category-tabs-wrapper">
                <motion.div
                    className="category-tabs-pill"
                    initial="idle"
                    whileHover="hover"
                    animate="idle"
                >
                    {/* Container Hover/Bg Effects */}
                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity duration-500 pointer-events-none group-hover:opacity-100" />

                    {/* Cyber Shimmer Beam */}
                    <motion.div
                        variants={{
                            idle: { x: "-150%", opacity: 0 },
                            hover: {
                                x: "150%",
                                opacity: 0.5,
                                transition: {
                                    duration: 1.5,
                                    ease: "easeInOut",
                                    repeat: Infinity,
                                    repeatDelay: 0.5
                                }
                            }
                        }}
                        className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[rgba(20,184,166,0.1)] to-transparent -skew-x-12 pointer-events-none z-0"
                    />

                    {/* Buttons */}
                    <div className="relative z-10 flex items-center">
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
                </motion.div>
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
                relative flex items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium
                transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
                whitespace-nowrap cursor-pointer shrink-0 min-h-[44px]
                ${isActive
                    ? 'text-white'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }
            `}
        >
            {/* Active Background Slide */}
            {isActive && (
                <motion.div
                    layoutId="activeCategoryTab"
                    className="absolute inset-0 z-[-1] rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_0_20px_rgba(20,184,166,0.4)]"
                    initial={false}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                />
            )}

            {Icon && <Icon size={16} className={isActive ? "text-white drop-shadow-md" : "opacity-70"} aria-hidden="true" />}

            <span className="tracking-wide">{label}</span>

            {count !== undefined && count > 0 && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center
                    ${isActive ? 'bg-white/25 text-white' : 'bg-white/10 text-[var(--text-muted)]'}
                `}>
                    {count}
                </span>
            )}
        </button>
    );
}
