'use client';

import { SourceCategory, CATEGORY_LABELS } from '@/types';
import { LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface CollapsibleSourceTabsProps {
    categories: SourceCategory[];
    activeCategory: SourceCategory | 'all' | 'dashboard';
    onCategoryChange: (category: SourceCategory | 'all' | 'dashboard') => void;
    itemCounts: Record<string, number>;
    totalCount: number;
}

type CategoryType = SourceCategory | 'all' | 'dashboard';

export function CollapsibleSourceTabs({ categories, activeCategory, onCategoryChange, itemCounts, totalCount }: CollapsibleSourceTabsProps) {
    // Build full category list
    const allCategories: CategoryType[] = ['dashboard', 'all', ...categories];
    const [isMobile, setIsMobile] = useState(false);

    // Detect mobile view
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Mobile carousel state
    const [currentIndex, setCurrentIndex] = useState(() => {
        return allCategories.indexOf(activeCategory);
    });
    const [direction, setDirection] = useState(0);

    // Desktop scroll state
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [showScrollIndicators, setShowScrollIndicators] = useState(false);

    // Sync mobile carousel with external activeCategory changes
    useEffect(() => {
        if (!isMobile) return;
        const newIndex = allCategories.indexOf(activeCategory);
        if (newIndex !== currentIndex) {
            setDirection(newIndex > currentIndex ? 1 : -1);
            setCurrentIndex(newIndex);
        }
    }, [activeCategory, isMobile]);

    // Desktop: Check scroll state
    const checkScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        setCanScrollLeft(scrollLeft > 10);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        setShowScrollIndicators(scrollWidth > clientWidth);
    };

    useEffect(() => {
        if (isMobile) return;
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [categories, isMobile]);

    // Desktop: Auto-scroll active tab into view
    useEffect(() => {
        if (isMobile) return;
        const container = scrollContainerRef.current;
        if (!container) return;

        const activeButton = container.querySelector('[aria-selected="true"]') as HTMLElement;
        if (!activeButton) return;

        activeButton.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    }, [activeCategory, isMobile]);

    const scrollDesktop = (direction: 'left' | 'right') => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollAmount = 300;
        const newScrollLeft = direction === 'left'
            ? container.scrollLeft - scrollAmount
            : container.scrollLeft + scrollAmount;

        container.scrollTo({
            left: newScrollLeft,
            behavior: 'smooth'
        });
    };

    // Mobile: Navigation functions
    const navigate = (newDirection: number) => {
        const newIndex = currentIndex + newDirection;
        if (newIndex < 0 || newIndex >= allCategories.length) return;

        setDirection(newDirection);
        setCurrentIndex(newIndex);
        onCategoryChange(allCategories[newIndex]);
    };

    const goToDot = (index: number) => {
        if (index === currentIndex) return;
        setDirection(index > currentIndex ? 1 : -1);
        setCurrentIndex(index);
        onCategoryChange(allCategories[index]);
    };

    const currentCategory = allCategories[currentIndex];
    const canGoLeft = currentIndex > 0;
    const canGoRight = currentIndex < allCategories.length - 1;
    const [showHint, setShowHint] = useState(true);

    // Hide hint after 3 seconds
    useEffect(() => {
        if (!isMobile) return;
        const timer = setTimeout(() => setShowHint(false), 3000);
        return () => clearTimeout(timer);
    }, [isMobile]);

    // Mobile: Keyboard navigation
    useEffect(() => {
        if (!isMobile) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && canGoLeft) {
                navigate(-1);
            } else if (e.key === 'ArrowRight' && canGoRight) {
                navigate(1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canGoLeft, canGoRight, currentIndex, isMobile]);

    // Mobile: Touch swipe support
    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isMobile) return;
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isMobile) return;
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!isMobile || !touchStart || !touchEnd) return;

        const distance = touchStart - touchEnd;
        const minSwipeDistance = 50;

        if (Math.abs(distance) < minSwipeDistance) return;

        if (distance > 0 && canGoRight) {
            navigate(1);
        } else if (distance < 0 && canGoLeft) {
            navigate(-1);
        }

        setTouchStart(0);
        setTouchEnd(0);
    };

    // Get category details (for mobile carousel)
    const getCategoryInfo = (cat: CategoryType) => {
        if (cat === 'dashboard') {
            return { label: 'Dashboard', icon: LayoutDashboard, count: undefined };
        }
        if (cat === 'all') {
            return { label: 'All', icon: undefined, count: totalCount };
        }
        return { label: CATEGORY_LABELS[cat], icon: undefined, count: itemCounts[cat] };
    };

    const categoryInfo = getCategoryInfo(currentCategory);
    const Icon = categoryInfo.icon;

    const slideVariants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 100 : -100,
            opacity: 0,
            scale: 0.9,
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1,
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -100 : 100,
            opacity: 0,
            scale: 0.9,
        }),
    };

    // Render mobile carousel
    if (isMobile) {
        return (
            <nav
                className="category-tabs-container"
                aria-label="Content categories"
            >
                <div className="single-category-carousel">
                    {/* Left Navigation Button */}
                    <motion.button
                        onClick={() => navigate(-1)}
                        disabled={!canGoLeft}
                        className="carousel-nav-button carousel-nav-left"
                        aria-label="Previous category"
                        type="button"
                        whileHover={{ scale: canGoLeft ? 1.1 : 1 }}
                        whileTap={{ scale: canGoLeft ? 0.9 : 1 }}
                        animate={{
                            opacity: canGoLeft ? 1 : 0.3,
                            cursor: canGoLeft ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <ChevronLeft size={24} aria-hidden="true" />
                    </motion.button>

                    {/* Category Display with Animation */}
                    <div
                        className="single-category-display"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        <AnimatePresence mode="wait" custom={direction}>
                            <motion.div
                                key={currentCategory}
                                custom={direction}
                                variants={slideVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                transition={{
                                    x: { type: "spring", stiffness: 300, damping: 30 },
                                    opacity: { duration: 0.2 },
                                    scale: { duration: 0.2 },
                                }}
                                className="category-content"
                            >
                                <div className="category-inner">
                                    {Icon && <Icon size={20} className="category-icon" aria-hidden="true" />}
                                    <span className="category-label">{categoryInfo.label}</span>
                                    {categoryInfo.count !== undefined && categoryInfo.count > 0 && (
                                        <span className="category-count-badge">
                                            {categoryInfo.count}
                                        </span>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Right Navigation Button */}
                    <motion.button
                        onClick={() => navigate(1)}
                        disabled={!canGoRight}
                        className="carousel-nav-button carousel-nav-right"
                        aria-label="Next category"
                        type="button"
                        whileHover={{ scale: canGoRight ? 1.1 : 1 }}
                        whileTap={{ scale: canGoRight ? 0.9 : 1 }}
                        animate={{
                            opacity: canGoRight ? 1 : 0.3,
                            cursor: canGoRight ? 'pointer' : 'not-allowed',
                        }}
                    >
                        <ChevronRight size={24} aria-hidden="true" />
                    </motion.button>

                    {/* Dot Indicators */}
                    <div className="carousel-dots" role="tablist">
                        {allCategories.map((cat, index) => (
                            <button
                                key={cat}
                                role="tab"
                                aria-selected={index === currentIndex}
                                aria-label={`Go to ${getCategoryInfo(cat).label}`}
                                onClick={() => goToDot(index)}
                                className={`carousel-dot ${index === currentIndex ? 'active' : ''}`}
                                type="button"
                            >
                                <span className="sr-only">{getCategoryInfo(cat).label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Navigation Hint */}
                    {showHint && allCategories.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 0.6, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.5 }}
                            className="carousel-hint"
                            aria-hidden="true"
                        >
                            Use ← → arrows or swipe to navigate
                        </motion.div>
                    )}
                </div>
            </nav>
        );
    }

    // Render desktop horizontal scroll tabs
    return (
        <nav
            className="category-tabs-container"
            aria-label="Content categories"
        >
            <div className="category-tabs-carousel-wrapper">
                {/* Left Scroll Button */}
                {showScrollIndicators && canScrollLeft && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => scrollDesktop('left')}
                        className="carousel-scroll-button carousel-scroll-left"
                        aria-label="Scroll categories left"
                        type="button"
                        tabIndex={0}
                    >
                        <ChevronLeft size={20} aria-hidden="true" />
                    </motion.button>
                )}

                {/* Scrollable Container */}
                <div
                    ref={scrollContainerRef}
                    onScroll={checkScroll}
                    className="category-tabs-wrapper w-full"
                >
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

                {/* Right Scroll Button */}
                {showScrollIndicators && canScrollRight && (
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => scrollDesktop('right')}
                        className="carousel-scroll-button carousel-scroll-right"
                        aria-label="Scroll categories right"
                        type="button"
                        tabIndex={0}
                    >
                        <ChevronRight size={20} aria-hidden="true" />
                    </motion.button>
                )}

                {/* Left Fade Gradient */}
                {showScrollIndicators && canScrollLeft && (
                    <div className="carousel-fade-left" aria-hidden="true" />
                )}

                {/* Right Fade Gradient */}
                {showScrollIndicators && canScrollRight && (
                    <div className="carousel-fade-right" aria-hidden="true" />
                )}
            </div>
        </nav>
    );
}

// Desktop Tab Button Component
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
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${label}${count !== undefined ? ` (${count} items)` : ''}`}
            className={`
                relative md:flex-1 md:min-w-0 flex-shrink-0 flex items-center justify-center gap-2 px-5 sm:px-6 md:px-4 py-2.5 rounded-full text-[13px] sm:text-[13px] font-medium
                transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2
                whitespace-nowrap cursor-pointer min-h-[44px] scroll-snap-align-start
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

