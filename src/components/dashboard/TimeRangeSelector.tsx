'use client';

import { TimeRange } from '@/types';
import { motion } from 'framer-motion';

interface TimeRangeSelectorProps {
    activeRange: TimeRange;
    onRangeChange: (range: TimeRange) => void;
}

const RANGES: { value: TimeRange; label: string }[] = [
    { value: '1h', label: '1H' },
    { value: '12h', label: '12H' },
    { value: '24h', label: '24H' },
    { value: '48h', label: '48H' },
    { value: '7d', label: '7D' },
];

export function TimeRangeSelector({ activeRange, onRangeChange }: TimeRangeSelectorProps) {
    const activeIndex = RANGES.findIndex(r => r.value === activeRange);

    return (
        <div className="flex flex-col justify-center w-[300px] h-[40px] px-4">
            <div className="relative w-full h-8 flex items-center">
                {/* Base Line */}
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/10 -translate-y-1/2 rounded-full" />

                {/* Animated Fill Line */}
                <motion.div
                    className="absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] -translate-y-1/2 rounded-full origin-left"
                    initial={false}
                    animate={{ width: `${(activeIndex / (RANGES.length - 1)) * 100}%` }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />

                {/* Nodes */}
                <div className="absolute inset-0 flex justify-between items-center z-10">
                    {RANGES.map((range, index) => {
                        const isActive = index === activeIndex;
                        const isPast = index < activeIndex;

                        return (
                            <button
                                key={range.value}
                                onClick={() => onRangeChange(range.value)}
                                className="group relative focus:outline-none"
                                aria-label={`Select ${range.label} range`}
                            >
                                {/* The Dot */}
                                <div className="relative flex items-center justify-center">
                                    {/* Active Glow/Ring */}
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeGlow"
                                            className="absolute w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 shadow-[0_0_15px_var(--accent-glow)] blur-sm"
                                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                        />
                                    )}

                                    {/* The Node Itself */}
                                    <motion.div
                                        className={`w-2.5 h-2.5 rounded-full border-2 transition-colors duration-300 ${isActive || isPast
                                                ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                                                : 'bg-[var(--bg-secondary)] border-white/20 group-hover:border-white/40'
                                            }`}
                                        animate={{
                                            scale: isActive ? 1.4 : 1,
                                            backgroundColor: isActive ? 'var(--bg-surface)' : (isPast ? 'var(--accent-primary)' : 'var(--bg-secondary)')
                                        }}
                                    />
                                </div>

                                {/* Label */}
                                <span className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 text-[10px] font-medium tracking-wider transition-colors duration-200 ${isActive ? 'text-[var(--accent-primary)]' : 'text-gray-500 group-hover:text-gray-400'
                                    }`}>
                                    {range.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
