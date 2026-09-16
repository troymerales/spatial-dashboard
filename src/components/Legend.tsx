import type { ClassBreaks, Indicator } from '../types';
import { formatBare } from '../lib/format';
import { NO_DATA_FILL, SUPPRESSED_FILL, OUT_OF_SCOPE_FILL, BIVARIATE_3X3 } from '../lib/color';

export interface LegendClass {
  color: string;
  lower: number;
  upper: number;
  count: number;
}

export function buildLegendClasses(
  cb: ClassBreaks,
  colors: string[],
  values: number[],
): LegendClass[] {
  if (!cb.k) return [];
  const bounds = [cb.min, ...cb.breaks, cb.max];
  const classes: LegendClass[] = [];
  for (let i = 0; i < cb.k; i++) {
    const lower = bounds[i];
    const upper = bounds[i + 1];
    let count = 0;
    for (const v of values) {
      const inLast = i === cb.k - 1;
      if (v >= lower && (inLast ? v <= upper : v < upper)) count++;
    }
    classes.push({ color: colors[i] ?? '#ccc', lower, upper, count });
  }
  return classes;
}

export function Legend({
  indicator,
  classes,
  nMissing,
  nSuppressed,
  nOutOfScope,
  activeClass,
  onHoverClass,
  note,
}: {
  indicator: Indicator;
  classes: LegendClass[];
  nMissing: number;
  nSuppressed: number;
  nOutOfScope: number;
  activeClass: number | null;
  onHoverClass: (i: number | null) => void;
  note?: string;
}) {
  return (
    <div className="map-card" style={{ maxWidth: 258 }}>
      <p className="legend__title">
        {indicator.short}
        {indicator.unit === 'percent' ? ' (%)' : ''}
      </p>

      {/* Highest class first: the map reads top-down the same way the eye scans it. */}
      {[...classes].reverse().map((c, ri) => {
        const i = classes.length - 1 - ri;
        return (
          <div
            key={i}
            className={`legend__row legend__row--interactive${activeClass === i ? ' legend__row--active' : ''}`}
            onMouseEnter={() => onHoverClass(i)}
            onMouseLeave={() => onHoverClass(null)}
          >
            <span className="legend__swatch" style={{ background: c.color }} />
            <span className="num">
              {formatBare(c.lower, indicator)} – {formatBare(c.upper, indicator)}
            </span>
            <span className="legend__count num">{c.count}</span>
          </div>
        );
      })}

      {nSuppressed > 0 && (
        <div className="legend__row">
          <span className="legend__swatch" style={{ background: SUPPRESSED_FILL }} />
          <span>Withheld (too few cases)</span>
          <span className="legend__count num">{nSuppressed}</span>
        </div>
      )}
      {nMissing > 0 && (
        <div className="legend__row">
          <span className="legend__swatch" style={{ background: NO_DATA_FILL }} />
          <span>No report</span>
          <span className="legend__count num">{nMissing}</span>
        </div>
      )}
      {nOutOfScope > 0 && (
        <div className="legend__row">
          <span className="legend__swatch" style={{ background: OUT_OF_SCOPE_FILL }} />
          <span>Outside filter</span>
          <span className="legend__count num">{nOutOfScope}</span>
        </div>
      )}

      {note && <p className="legend__note">{note}</p>}
    </div>
  );
}

export function BivariateLegend({
  xInd,
  yInd,
}: {
  xInd: Indicator;
  yInd: Indicator;
}) {
  return (
    <div className="map-card" style={{ maxWidth: 240 }}>
      <p className="legend__title">Two indicators at once</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            fontSize: 10,
            color: 'var(--text-3)',
            textAlign: 'center',
            maxHeight: 66,
            overflow: 'hidden',
          }}
        >
          {yInd.short} →
        </div>
        <div>
          <div className="legend__bivariate">
            {[2, 1, 0].map((row) =>
              [0, 1, 2].map((col) => (
                <div key={`${row}-${col}`} style={{ background: BIVARIATE_3X3[row][col] }} />
              )),
            )}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{xInd.short} →</div>
        </div>
      </div>
      <p className="legend__note">
        Each axis is split at its terciles. Dark blue is high on both, grey is low on both. No weights
        are applied and nothing is added together — you are reading two measures at once, not a score.
      </p>
    </div>
  );
}

export function CountLegend({
  title,
  items,
  note,
}: {
  title: string;
  items: Array<{ color: string; label: string; count?: number }>;
  note?: string;
}) {
  return (
    <div className="map-card" style={{ maxWidth: 250 }}>
      <p className="legend__title">{title}</p>
      {items.map((it) => (
        <div className="legend__row" key={it.label}>
          <span
            className="legend__swatch"
            style={{ background: it.color, borderRadius: '50%', width: 11 }}
          />
          <span>{it.label}</span>
          {it.count != null && <span className="legend__count num">{it.count.toLocaleString()}</span>}
        </div>
      ))}
      {note && <p className="legend__note">{note}</p>}
    </div>
  );
}
