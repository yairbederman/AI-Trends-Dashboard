'use client';

import { TimeRange } from '@/types';

interface TimeRangeChipsProps {
  activeRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

const RANGES: TimeRange[] = ['1h', '12h', '24h', '48h', '7d'];

export function TimeRangeChips({ activeRange, onRangeChange }: TimeRangeChipsProps) {
  return (
    <div className="time-range-chips" role="group" aria-label="Time range filter">
      {RANGES.map((range) => (
        <button
          key={range}
          className={`time-chip ${activeRange === range ? 'active' : ''}`}
          onClick={() => onRangeChange(range)}
          aria-pressed={activeRange === range}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
