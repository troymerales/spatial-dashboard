import { useMemo } from 'react';
import type { Indicator, PCode } from '../types';
import { formatNumber } from '../lib/format';

export interface RankRow {
  pcode: PCode;
  name: string;
  parent: string | null;
  value: number;
  color: string;
}

/**
 * Ranked list, showing both ends rather than a "top 10".
 *
 * A single-ended ranking quietly decides what "top" means. For an indicator
 * where high is good, the informative end is the bottom; for one where high is
 * bad it is the top. Showing both, with the middle collapsed, avoids making
 * that call on the officer's behalf.
 */
export function RankList({
  rows,
  indicator,
  selectedPcode,
  onSelect,
  onHover,
  edgeCount = 8,
}: {
  rows: RankRow[];
  indicator: Indicator;
  selectedPcode: PCode | null;
  onSelect: (p: PCode) => void;
  onHover: (p: PCode | null) => void;
  edgeCount?: number;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.value - a.value), [rows]);

  const { max, min } = useMemo(() => {
    if (!sorted.length) return { max: 1, min: 0 };
    return { max: sorted[0].value, min: sorted[sorted.length - 1].value };
  }, [sorted]);

  if (!sorted.length) {
    return (
      <div className="empty-state" style={{ padding: 20 }}>
        <div className="empty-state__title">Nothing to rank</div>
        <div className="empty-state__body">
          No area in the current filter has a usable value for this indicator and period.
        </div>
      </div>
    );
  }

  const span = max - min || 1;
  const widthOf = (v: number) => 4 + ((v - min) / span) * 96;

  const showAll = sorted.length <= edgeCount * 2 + 2;
  const head = showAll ? sorted : sorted.slice(0, edgeCount);
  const tail = showAll ? [] : sorted.slice(-edgeCount);
  const hiddenCount = sorted.length - head.length - tail.length;

  const highestLabel =
    indicator.direction === 'higher_is_worse'
      ? 'Highest — usually where to look first'
      : indicator.direction === 'higher_is_better'
        ? 'Highest — performing best'
        : 'Highest';
  const lowestLabel =
    indicator.direction === 'higher_is_better'
      ? 'Lowest — usually where to look first'
      : indicator.direction === 'higher_is_worse'
        ? 'Lowest — performing best'
        : 'Lowest';

  const renderRow = (r: RankRow, rank: number) => (
    <button
      key={r.pcode}
      type="button"
      className="rankrow"
      aria-current={r.pcode === selectedPcode}
      onClick={() => onSelect(r.pcode)}
      onMouseEnter={() => onHover(r.pcode)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(r.pcode)}
      onBlur={() => onHover(null)}
      title={r.parent ? `${r.name} — ${r.parent}` : r.name}
    >
      <span className="rankrow__rank num">{rank}</span>
      <span className="rankrow__name">{r.name}</span>
      <span className="rankrow__bar">
        <span
          className="rankrow__fill"
          style={{ width: `${widthOf(r.value)}%`, background: r.color }}
        />
      </span>
      <span className="rankrow__val num">{formatNumber(r.value, indicator.decimals)}</span>
    </button>
  );

  return (
    <div className="ranklist">
      <div className="rank-divider">{highestLabel}</div>
      {head.map((r, i) => renderRow(r, i + 1))}
      {hiddenCount > 0 && (
        <div className="rank-divider">{hiddenCount.toLocaleString()} more areas</div>
      )}
      {tail.length > 0 && <div className="rank-divider">{lowestLabel}</div>}
      {tail.map((r, i) => renderRow(r, sorted.length - tail.length + i + 1))}
    </div>
  );
}
