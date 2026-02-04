'use client';

import { FeedMode, FEED_MODE_LABELS, FEED_MODE_DESCRIPTIONS } from '@/types';
import { LiquidButton, type ColorVariant } from '@/components/ui/liquid-glass-button';
import { Flame, TrendingUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedModeSelectorProps {
  activeMode: FeedMode;
  onModeChange: (mode: FeedMode) => void;
}

const MODE_ICONS: Record<FeedMode, typeof Flame> = {
  hot: Flame,
  rising: TrendingUp,
  top: Trophy,
};

const MODE_COLORS: Record<FeedMode, ColorVariant> = {
  hot: 'error',      // Red/orange tones for hot
  rising: 'success', // Green tones for rising
  top: 'gold',       // Golden tones for top
};

const MODE_INACTIVE_COLORS: ColorVariant = 'default'; // Subtle glass gray when inactive

export function FeedModeSelector({ activeMode, onModeChange }: FeedModeSelectorProps) {
  return (
    <div className="flex items-center gap-3 p-1" role="tablist" aria-label="Feed mode">
      {(['hot', 'rising', 'top'] as FeedMode[]).map((mode) => {
        const Icon = MODE_ICONS[mode];
        const isActive = activeMode === mode;

        return (
          <LiquidButton
            key={mode}
            role="tab"
            aria-selected={isActive}
            variant={isActive ? MODE_COLORS[mode] : MODE_INACTIVE_COLORS}
            onClick={() => onModeChange(mode)}
            title={FEED_MODE_DESCRIPTIONS[mode]}
            className="gap-2 !h-10 !px-5"
          >
            <Icon size={16} className="shrink-0" aria-hidden="true" />
            <span className="font-semibold">{FEED_MODE_LABELS[mode]}</span>
          </LiquidButton>
        );
      })}
    </div>
  );
}
