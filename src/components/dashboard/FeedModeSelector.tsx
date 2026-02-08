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
    <motion.div
      className="relative flex items-center p-1.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-full backdrop-blur-xl overflow-hidden w-full"
      role="tablist"
      aria-label="Feed mode"
    >
      {/* Buttons */}
      <div className="relative z-10 flex items-center gap-2 w-full">
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
              className={`relative flex-1 min-w-0 flex items-center justify-center gap-4 px-4 py-2.5 rounded-full text-[13px] font-medium transition-all duration-300 outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-primary)] cursor-pointer min-h-[42px] ${isActive ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5 active:scale-95'
                }`}
            >
              {/* Active Background Slide */}
              {isActive && (
                <motion.div
                  layoutId="activeModePill"
                  className="absolute inset-0 z-[-1] rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_4px_12px_rgba(20,184,166,0.25)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <Icon size={14} className={isActive ? "text-white drop-shadow-sm" : "opacity-60"} aria-hidden="true" />
              <span className="hidden sm:inline tracking-tight">{FEED_MODE_LABELS[mode]}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
