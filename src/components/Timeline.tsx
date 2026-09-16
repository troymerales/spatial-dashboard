import { useMemo } from 'react';
import {
  MONTH_ABBR,
  formatPeriod,
  formatPeriodShort,
  periodMonth,
  periodYear,
  type Period,
} from '../data/periods';

/**
 * Month-by-month playback.
 *
 * Deliberately discrete: the scrubber steps whole months and the colours jump
 * from one month's value to the next. There is no tweening, because a value
 * halfway between March and April does not exist and drawing one would be an
 * invention. The dwell time is what makes it readable, not interpolation.
 */
export function Timeline({
  periods,
  period,
  playing,
  speedMs,
  onScrub,
  onTogglePlay,
  onSpeedChange,
  disabled,
}: {
  periods: Period[];
  period: Period;
  playing: boolean;
  speedMs: number;
  onScrub: (p: Period) => void;
  onTogglePlay: () => void;
  onSpeedChange: (ms: number) => void;
  disabled?: boolean;
}) {
  const index = Math.max(0, periods.indexOf(period));
  const last = periods.length - 1;

  // A tick under each January, plus the first month, so the year is readable
  // without labelling all 24 steps.
  const ticks = useMemo(
    () =>
      periods
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => i === 0 || periodMonth(p) === 0),
    [periods],
  );

  return (
    <div className="timeline">
      <button
        className="timeline__play"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={playing ? 'Pause playback' : 'Play through the months'}
        title={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>

      <div className="timeline__now num" aria-live="off">
        {formatPeriod(period)}
      </div>

      <div className="timeline__track">
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={index}
          disabled={disabled}
          onChange={(e) => onScrub(periods[Number(e.target.value)])}
          aria-label="Month"
          aria-valuetext={formatPeriod(period)}
        />
        <div className="timeline__ticks" aria-hidden="true">
          {ticks.map(({ p, i }) => (
            <span
              key={p}
              className="timeline__tick"
              style={{ left: `${last === 0 ? 0 : (i / last) * 100}%` }}
            >
              {periodMonth(p) === 0 ? periodYear(p) : MONTH_ABBR[periodMonth(p)]}
            </span>
          ))}
        </div>
      </div>

      <div className="timeline__range num" aria-hidden="true">
        {formatPeriodShort(periods[0])} – {formatPeriodShort(periods[last])}
      </div>

      <label className="timeline__speed">
        <span className="visually-hidden">Playback speed</span>
        <select
          value={speedMs}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={disabled}
          aria-label="Playback speed"
        >
          <option value={1200}>Slow</option>
          <option value={700}>Normal</option>
          <option value={350}>Fast</option>
        </select>
      </label>
    </div>
  );
}
