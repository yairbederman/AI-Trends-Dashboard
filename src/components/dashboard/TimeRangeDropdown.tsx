'use client';

import { useState, useRef, useEffect } from 'react';
import { TimeRange, TIME_RANGES } from '@/types';
import { Clock, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TimeRangeDropdownProps {
    activeRange: TimeRange;
    onRangeChange: (range: TimeRange) => void;
}

export function TimeRangeDropdown({ activeRange, onRangeChange }: TimeRangeDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeLabel = TIME_RANGES[activeRange];
    const rangeEntries = Object.entries(TIME_RANGES) as [TimeRange, string][];

    return (
        <div className="relative z-50" ref={containerRef}>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
                whileTap={{ scale: 0.98 }}
                className={`
          flex items-center gap-2.5 px-4 py-2.5 
          min-h-[44px] min-w-[140px] justify-between
          rounded-xl border backdrop-blur-md outline-none
          transition-colors duration-200 cursor-pointer
          ${isOpen
                        ? 'bg-white/10 border-[var(--accent-primary)] text-white shadow-[0_0_15px_rgba(20,184,166,0.15)]'
                        : 'bg-white/5 border-white/10 text-[var(--text-secondary)] hover:text-white hover:border-white/20'
                    }
        `}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <Clock size={16} className={isOpen ? "text-[var(--accent-primary)]" : "opacity-70"} />
                    <span className="text-sm font-medium">{activeLabel}</span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown size={14} className="opacity-50" />
                </motion.div>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.ul
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute right-0 mt-2 w-[220px] p-2 
              bg-[rgba(22,22,31,0.95)] border border-white/20 
              rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden"
                        role="listbox"
                    >
                        {rangeEntries.map(([value, label]) => {
                            const isSelected = activeRange === value;

                            return (
                                <li key={value}>
                                    <button
                                        onClick={() => {
                                            onRangeChange(value);
                                            setIsOpen(false);
                                        }}
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`
                      w-full flex items-center justify-between px-4 py-3
                      min-h-[48px] rounded-xl text-sm font-medium text-left
                      transition-all duration-200 outline-none cursor-pointer
                      ${isSelected
                                                ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-white'
                                            }
                    `}
                                    >
                                        <span>{label}</span>
                                        {isSelected && (
                                            <motion.div
                                                layoutId="activeCheck"
                                                initial={{ opacity: 0, scale: 0.5 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                            >
                                                <Check size={16} strokeWidth={3} />
                                            </motion.div>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
