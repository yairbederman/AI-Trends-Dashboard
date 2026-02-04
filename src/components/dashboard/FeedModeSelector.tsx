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
      className="relative flex items-center p-1.5 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-full backdrop-blur-xl overflow-hidden"
      role="tablist"
      aria-label="Feed mode"
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
      <div className="relative z-10 flex items-center gap-1">
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
              // Pro Max: Min-height 44px touch target (via py-3)
              className={`relative flex items-center justify-center gap-2.5 px-6 py-3 rounded-full text-sm font-medium transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] min-w-[124px] cursor-pointer min-h-[44px] ${isActive ? 'text-white' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`}
            >
              {/* Active Background Slide */}
              {isActive && (
                <motion.div
                  layoutId="activeModePill"
                  className="absolute inset-0 z-[-1] rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] shadow-[0_0_20px_rgba(20,184,166,0.4)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                />
              )}

              <Icon size={18} className={isActive ? "text-white drop-shadow-md" : "opacity-70 group-hover:opacity-100"} aria-hidden="true" />
              <span className="hidden sm:inline tracking-wide">{FEED_MODE_LABELS[mode]}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
