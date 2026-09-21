import { useMemo } from 'react';
import {
  MONTH_ABBR,
  formatPeriod,
  formatPeriodDate,
  periodDate,
  periodMonth,
  periodYear,
  type Period,
} from '../data/periods';

/**
 * Week-by-week playback.
 *
 * Deliberately discrete: the scrubber steps whole weeks and the colours jump
 * from one week's value to the next. There is no tweening, because a value
 * halfway between two reporting weeks does not exist and drawing one would be
 * an invention. Dwell time is what makes it readable, not interpolation.
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

  // Weekly steps are far too many to label individually. Tick month boundaries
  // at a spacing that keeps roughly 6-10 labels on the track however long the
  // timeline is: quarterly up to about two years, half-yearly beyond that.
  const ticks = useMemo(() => {
    const monthStep = periods.length > 120 ? 6 : 3;
    const out: Array<{ p: Period; i: number; label: string }> = [];
    let lastMonth = -1;
    periods.forEach((p, i) => {
      const m = periodMonth(p);
      if (m % monthStep !== 0 || m === lastMonth) return;
      // Only tick the week that actually contains the 1st of the month.
      if (periodDate(p).getUTCDate() > 7) return;
      lastMonth = m;
      out.push({ p, i, label: m === 0 ? String(periodYear(p)) : MONTH_ABBR[m] });
    });
    return out;
  }, [periods]);

  return (
    <div className="timeline">
      <button
        className="timeline__play"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={playing ? 'Pause playback' : 'Play through the weeks'}
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

      <div className="timeline__now num" aria-live="off" title={formatPeriod(period)}>
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
          aria-label="Week"
          aria-valuetext={formatPeriod(period)}
        />
        <div className="timeline__ticks" aria-hidden="true">
          {ticks.map(({ p, i, label }) => (
            <span
              key={p}
              className="timeline__tick"
              style={{ left: `${last === 0 ? 0 : (i / last) * 100}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="timeline__range num" aria-hidden="true">
        {formatPeriodDate(periods[0])} – {formatPeriodDate(periods[last])}
      </div>

      <label className="timeline__speed">
        <span className="visually-hidden">Playback speed</span>
        <select
          value={speedMs}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          disabled={disabled}
          aria-label="Playback speed"
        >
          <option value={400}>Slow</option>
          <option value={200}>Normal</option>
          <option value={90}>Fast</option>
          <option value={10}>Very Fast</option>
        </select>
      </label>
    </div>
  );
}
