'use client';

import { FeedMode, FEED_MODE_LABELS, FEED_MODE_DESCRIPTIONS } from '@/types';
import { Flame, TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

interface FeedModeSelectorProps {
  activeMode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

const MODES: FeedMode[] = ['hot', 'rising', 'top'];

const MODE_ICONS: Record<FeedMode, typeof Flame> = {
  hot: Flame,
  rising: TrendingUp,
  top: Trophy,
};

export function FeedModeSelector({ activeMode, onModeChange }: FeedModeSelectorProps) {
  return (
    <div
      className="flex items-center gap-3"
      role="tablist"
      aria-label="Feed mode"
    >
      {MODES.map((mode) => {
        const Icon = MODE_ICONS[mode];
        const isActive = activeMode === mode;

        return (
          <button
            key={mode}
            role="tab"
            aria-selected={isActive}
            onClick={() => onModeChange(mode)}
            title={FEED_MODE_DESCRIPTIONS[mode]}
            className={`relative flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] ${isActive
                ? 'text-[var(--accent-primary)] drop-shadow-[0_0_8px_rgba(var(--accent-primary-rgb),0.5)]'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
          >
            {/* Inactive Border (Visible only when not active) */}
            {!isActive && (
              <div className="absolute inset-0 rounded-full border border-white/10" />
            )}

            {/* Active Glowing Ring (Animated) */}
            {isActive && (
              <motion.div
                layoutId="activeModeRing"
                className="absolute inset-0 z-10 rounded-full border-2 border-[var(--accent-primary)] shadow-[0_0_15px_var(--accent-glow)] bg-transparent"
                initial={false}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}

            {/* Content */}
            <span className="relative z-20 flex items-center gap-2">
              <Icon size={14} className={isActive ? "text-[var(--accent-primary)]" : "text-gray-500"} aria-hidden="true" />
              <span className="hidden sm:inline">{FEED_MODE_LABELS[mode]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
