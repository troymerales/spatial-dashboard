import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Indicator, PCode } from '../types';
import { classIndex, histogram, quantileSorted } from '../lib/stats';
import { formatBare, formatValue } from '../lib/format';
import { formatPeriod, formatPeriodShort } from '../data/periods';

/** Measure a container so SVG charts can size themselves without distortion. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}

// ───────────────────────────── Sparkline ─────────────────────────────

export function Sparkline({
  points,
  indicator,
  width = 210,
  height = 42,
}: {
  points: Array<{ period: number; value: number | null }>;
  indicator: Indicator;
  width?: number;
  height?: number;
}) {
  const finite = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (finite.length < 2) {
    return (
      <div className="field__hint" style={{ marginTop: 6 }}>
        Not enough periods with a reported value to draw a trend.
      </div>
    );
  }

  const pad = { t: 6, r: 4, b: 12, l: 4 };
  const vals = finite.map((p) => p.value as number);
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (min === max) {
    min -= Math.abs(min) * 0.05 || 1;
    max += Math.abs(max) * 0.05 || 1;
  }
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - ((v - min) / (max - min)) * innerH;

  // Break the line where a period has no value rather than interpolating over it.
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  points.forEach((p, i) => {
    if (p.value == null || !Number.isFinite(p.value)) {
      if (current.length) segments.push(current);
      current = [];
    } else {
      current.push([x(i), y(p.value)]);
    }
  });
  if (current.length) segments.push(current);

  const last = points[points.length - 1];
  const lastIdx = points.length - 1;

  return (
    <svg
      className="chart"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Trend from ${formatPeriod(points[0].period)} to ${formatPeriod(last.period)}`}
    >
      {segments.map((seg, i) => {
        const d = seg.map((p, j) => `${j ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        const area =
          seg.length > 1
            ? `${d} L${seg[seg.length - 1][0].toFixed(1)},${(pad.t + innerH).toFixed(1)} L${seg[0][0].toFixed(
                1,
              )},${(pad.t + innerH).toFixed(1)} Z`
            : '';
        return (
          <g key={i}>
            {area && <path className="sparkline__area" d={area} />}
            <path className="sparkline__line" d={d} />
          </g>
        );
      })}
      {last.value != null && Number.isFinite(last.value) && (
        <circle className="sparkline__dot" cx={x(lastIdx)} cy={y(last.value)} r={2.6} />
      )}
      <text x={pad.l} y={height - 2} textAnchor="start">
        {formatPeriodShort(points[0].period)}
      </text>
      <text x={width - pad.r} y={height - 2} textAnchor="end">
        {formatPeriodShort(last.period)}
      </text>
      <title>
        {points
          .map((p) => `${formatPeriodShort(p.period)}: ${p.value == null ? 'no data' : formatValue(p.value, indicator)}`)
          .join('\n')}
      </title>
    </svg>
  );
}

// ───────────────────────────── Distribution ─────────────────────────────

export function Distribution({
  values,
  breaks,
  colors,
  indicator,
  markerValue,
  markerLabel,
  referenceValue,
}: {
  values: number[];
  breaks: number[];
  colors: string[];
  indicator: Indicator;
  markerValue?: number | null;
  markerLabel?: string;
  referenceValue?: number | null;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const binCount = Math.max(12, Math.min(44, Math.floor(size.w / 14) || 24));
  const { edges, counts } = histogram(values, binCount);

  const pad = { t: 8, r: 8, b: 20, l: 8 };
  const w = Math.max(160, size.w);
  const h = Math.max(80, size.h);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const maxCount = counts.length ? Math.max(...counts) : 0;
  const x0 = edges.length ? edges[0] : 0;
  const x1 = edges.length ? edges[edges.length - 1] : 1;
  const sx = (v: number) => pad.l + (x1 === x0 ? 0.5 : (v - x0) / (x1 - x0)) * innerW;

  // Min, median and max — but drop the median label when a skewed distribution
  // pushes it close enough to an end that the two would overprint.
  const ticks: Array<{ v: number; anchor: 'start' | 'middle' | 'end' }> = [];
  if (values.length) {
    const mid = quantileSorted([...values].sort((a, b) => a - b), 0.5);
    ticks.push({ v: x0, anchor: 'start' });
    if (Math.abs(sx(mid) - sx(x0)) > 34 && Math.abs(sx(x1) - sx(mid)) > 34) {
      ticks.push({ v: mid, anchor: 'middle' });
    }
    ticks.push({ v: x1, anchor: 'end' });
  }

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {!values.length ? (
        <div className="empty-state" style={{ padding: 16 }}>
          <div className="empty-state__body">No values to plot.</div>
        </div>
      ) : (
        <svg className="chart" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
          aria-label={`Distribution of ${indicator.name} across areas`}>
          {counts.map((c, i) => {
            const bx = sx(edges[i]);
            const bw = Math.max(1, sx(edges[i + 1]) - bx - 1);
            const bh = maxCount ? (c / maxCount) * innerH : 0;
            const mid = (edges[i] + edges[i + 1]) / 2;
            const ci = Math.min(colors.length - 1, classIndex(mid, breaks));
            return (
              <rect
                key={i}
                x={bx}
                y={pad.t + innerH - bh}
                width={bw}
                height={bh}
                fill={colors[ci] ?? '#ccc'}
                stroke="rgba(0,0,0,.12)"
                strokeWidth={0.5}
              >
                <title>{`${formatBare(edges[i], indicator)}–${formatBare(edges[i + 1], indicator)}: ${c} areas`}</title>
              </rect>
            );
          })}

          <line className="axis-line" x1={pad.l} y1={pad.t + innerH} x2={w - pad.r} y2={pad.t + innerH} />

          {referenceValue != null && Number.isFinite(referenceValue) && (
            <g>
              <line
                className="ref-line"
                x1={sx(referenceValue)}
                y1={pad.t}
                x2={sx(referenceValue)}
                y2={pad.t + innerH}
              />
            </g>
          )}

          {markerValue != null && Number.isFinite(markerValue) && (
            <g>
              <line
                x1={sx(markerValue)}
                y1={pad.t - 2}
                x2={sx(markerValue)}
                y2={pad.t + innerH}
                stroke="var(--text)"
                strokeWidth={1.6}
              />
              <polygon
                points={`${sx(markerValue) - 4},${pad.t - 6} ${sx(markerValue) + 4},${pad.t - 6} ${sx(
                  markerValue,
                )},${pad.t - 1}`}
                fill="var(--text)"
              />
              <title>{markerLabel}</title>
            </g>
          )}

          {ticks.map((t, i) => (
            <text key={i} x={sx(t.v)} y={h - 6} textAnchor={t.anchor}>
              {formatBare(t.v, indicator)}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}

// ───────────────────────────── Scatter ─────────────────────────────

export interface ScatterPoint {
  pcode: PCode;
  name: string;
  x: number;
  y: number;
  color: string;
}

export function Scatter({
  points,
  xInd,
  yInd,
  xMedian,
  yMedian,
  selectedPcode,
  onSelect,
  onHover,
}: {
  points: ScatterPoint[];
  xInd: Indicator;
  yInd: Indicator;
  xMedian: number;
  yMedian: number;
  selectedPcode: PCode | null;
  onSelect: (p: PCode) => void;
  onHover: (p: PCode | null) => void;
}) {
  const [ref, size] = useSize<HTMLDivElement>();
  const pad = { t: 10, r: 12, b: 26, l: 44 };
  const w = Math.max(220, size.w);
  const h = Math.max(120, size.h);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = xs.length ? Math.min(...xs) : 0;
  const xMax = xs.length ? Math.max(...xs) : 1;
  const yMin = ys.length ? Math.min(...ys) : 0;
  const yMax = ys.length ? Math.max(...ys) : 1;

  const sx = (v: number) => pad.l + (xMax === xMin ? 0.5 : (v - xMin) / (xMax - xMin)) * innerW;
  const sy = (v: number) => pad.t + innerH - (yMax === yMin ? 0.5 : (v - yMin) / (yMax - yMin)) * innerH;

  const r = points.length > 900 ? 1.9 : points.length > 300 ? 2.6 : 3.4;

  return (
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      <svg className="chart" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
        aria-label={`${yInd.name} against ${xInd.name}`}>
        {/* Median cross-hairs define the four quadrants that make the plot readable. */}
        <line className="gridline" x1={sx(xMedian)} y1={pad.t} x2={sx(xMedian)} y2={pad.t + innerH} />
        <line className="gridline" x1={pad.l} y1={sy(yMedian)} x2={w - pad.r} y2={sy(yMedian)} />

        {points.map((p) => {
          const selected = p.pcode === selectedPcode;
          return (
            <circle
              key={p.pcode}
              className={`point${selected ? ' point--selected' : ''}`}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={selected ? r + 2.5 : r}
              fill={p.color}
              fillOpacity={0.85}
              onClick={() => onSelect(p.pcode)}
              onMouseEnter={() => onHover(p.pcode)}
              onMouseLeave={() => onHover(null)}
            >
              <title>{`${p.name}\n${xInd.short}: ${formatValue(p.x, xInd)}\n${yInd.short}: ${formatValue(
                p.y,
                yInd,
              )}`}</title>
            </circle>
          );
        })}

        <line className="axis-line" x1={pad.l} y1={pad.t + innerH} x2={w - pad.r} y2={pad.t + innerH} />
        <line className="axis-line" x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + innerH} />

        <text x={pad.l} y={h - 6} textAnchor="start">{formatBare(xMin, xInd)}</text>
        <text x={w - pad.r} y={h - 6} textAnchor="end">
          {formatBare(xMax, xInd)} {xInd.short}
        </text>
        <text x={pad.l - 6} y={pad.t + 8} textAnchor="end">{formatBare(yMax, yInd)}</text>
        <text x={pad.l - 6} y={pad.t + innerH} textAnchor="end">{formatBare(yMin, yInd)}</text>
        <text
          transform={`translate(11,${pad.t + innerH / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {yInd.short}
        </text>
      </svg>
    </div>
  );
}

/** Small helper for panels that need a debounce-free "did this change" effect. */
export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
