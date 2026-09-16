import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ClassBreaks, Indicator, PCode } from './types';
import type { Dataset, IndicatorSurface } from './data/dataset';
import { buildDataset } from './data/dataset';
import { INDICATOR_BY_ID } from './data/indicators';
import { FACILITY_TYPES } from './data/facilities';
import { bboxOfFeatures } from './data/geo';
import { INITIAL_STATE, VIEWS, type Criterion, type SpatialState, type ViewId } from './state';
import {
  BIVARIATE_3X3,
  NO_DATA_FILL,
  OUT_OF_SCOPE_FILL,
  SUPPRESSED_FILL,
  rampForDirection,
} from './lib/color';
import { classIndex, computeBreaks, quantileSorted, spearman } from './lib/stats';
import { UNIT_SHORT, formatCount, formatValue, shortRegionName } from './lib/format';
import { MapView, type Bubble } from './components/MapView';
import {
  Legend,
  BivariateLegend,
  CountLegend,
  buildLegendClasses,
  type LegendClass,
} from './components/Legend';
import { ControlRail } from './components/ControlRail';
import { DetailPanel } from './components/DetailPanel';
import { RankList, type RankRow } from './components/RankList';
import { Distribution, Scatter, type ScatterPoint } from './components/charts';
import { MethodSheet } from './components/MethodSheet';
import { Timeline } from './components/Timeline';
import { formatPeriod } from './data/periods';
import {
  InfoIcon,
  PanelBottomIcon,
  PanelLeftIcon,
  PanelRightIcon,
  WarnIcon,
} from './components/icons';

/* ───────────────────────────── Model types ───────────────────────────── */

interface Scope {
  pcodes: Set<PCode>;
  label: string;
  /** Stable cache key for pooled-value lookups; changes whenever `pcodes` does. */
  key: string;
}

interface SingleModel {
  kind: 'single';
  colorByPcode: Map<PCode, string>;
  ind: Indicator;
  surface: IndicatorSurface;
  scopeValues: number[];
  breaks: ClassBreaks;
  ramp: string[];
  legendClasses: LegendClass[];
  highlight: Set<PCode> | null;
  nMissing: number;
  nSuppressed: number;
  nOutOfScope: number;
}

interface CompareModel {
  kind: 'compare';
  colorByPcode: Map<PCode, string>;
  xInd: Indicator;
  yInd: Indicator;
  sx: IndicatorSurface;
  sy: IndicatorSurface;
  points: ScatterPoint[];
  xMedian: number;
  yMedian: number;
  rho: number;
  nMissing: number;
  nOutOfScope: number;
}

interface ScreenModel {
  kind: 'screen';
  colorByPcode: Map<PCode, string>;
  crits: Array<{ c: Criterion; ind: Indicator }>;
  surfaces: IndicatorSurface[];
  countByPcode: Map<PCode, number>;
  unknownByPcode: Map<PCode, number>;
  ramp: string[];
  k: number;
  nOutOfScope: number;
}

type Model = SingleModel | CompareModel | ScreenModel;

/* ───────────────────────────── App ───────────────────────────── */

export default function App() {
  const [state, setState] = useState<SpatialState>(INITIAL_STATE);
  const [ds, setDs] = useState<Dataset | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ pcode: PCode; x: number; y: number } | null>(null);
  const [legendClass, setLegendClass] = useState<number | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<SpatialState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );

  useEffect(() => {
    const ac = new AbortController();
    buildDataset(ac.signal)
      .then(setDs)
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setLoadError(e instanceof Error ? e.message : 'Unknown error loading boundary data.');
      });
    return () => ac.abort();
  }, []);

  // ── Timeline playback ──
  // A plain interval stepping whole months. No requestAnimationFrame and no
  // tweening: the map holds each month, then jumps to the next.
  useEffect(() => {
    if (!state.playing || !ds) return undefined;
    const periods = ds.periods;
    const id = window.setInterval(() => {
      setState((s) => {
        const i = periods.indexOf(s.period);
        const next = periods[(i + 1) % periods.length];
        return { ...s, period: next };
      });
    }, state.playSpeedMs);
    return () => window.clearInterval(id);
  }, [state.playing, state.playSpeedMs, ds]);

  // ── Scope: which units the current filters leave in play ──
  const scope = useMemo<Scope | null>(() => {
    if (!ds) return null;
    const layer = ds.layer(state.level);
    const pcodes = new Set<PCode>();
    for (const u of layer.units) {
      if (state.regionPcode && u.regionPcode !== state.regionPcode) continue;
      if (state.provincePcode) {
        const match =
          state.level === 'province'
            ? u.pcode === state.provincePcode
            : u.provincePcode === state.provincePcode;
        if (!match) continue;
      }
      pcodes.add(u.pcode);
    }
    const provName = state.provincePcode
      ? ds.province.unitByPcode.get(state.provincePcode)?.name ?? null
      : null;
    const regName = state.regionPcode
      ? ds.province.units.find((u) => u.regionPcode === state.regionPcode)?.regionName ?? null
      : null;
    return {
      pcodes,
      label: provName ?? (regName ? shortRegionName(regName) : 'the Philippines'),
      // Cache key for pooled values: must change whenever `pcodes` does.
      key: `${state.level}|${state.regionPcode ?? '*'}|${state.provincePcode ?? '*'}`,
    };
  }, [ds, state.level, state.regionPcode, state.provincePcode]);

  /**
   * Class breaks are computed ONCE over the whole timeline, not per month.
   * If they were recomputed each frame the palette would be recalibrated on
   * every step and an area could change colour while its value stood still —
   * which would make the animation actively misleading. Deliberately not keyed
   * on `state.period`.
   */
  const fixedBreaks = useMemo(() => {
    if (!ds || !scope) return null;
    const indId =
      state.view === 'access'
        ? state.accessMetricId
        : state.view === 'explore'
          ? state.indicatorId
          : null;
    if (!indId) return null;
    const ind = INDICATOR_BY_ID[indId];
    if (!ind?.mappable) return null;
    const pooled = ds.pooledValues(indId, state.level, scope.key, scope.pcodes);
    return computeBreaks(pooled, state.classCount, state.classMethod);
  }, [
    ds,
    scope,
    state.view,
    state.indicatorId,
    state.accessMetricId,
    state.level,
    state.classCount,
    state.classMethod,
  ]);

  // ── Colour + legend model, per view ──
  const model = useMemo<Model | null>(() => {
    if (!ds || !scope) return null;
    const layer = ds.layer(state.level);
    const colorByPcode = new Map<PCode, string>();
    let nOutOfScope = 0;
    for (const u of layer.units) {
      if (!scope.pcodes.has(u.pcode)) {
        colorByPcode.set(u.pcode, OUT_OF_SCOPE_FILL);
        nOutOfScope++;
      }
    }

    // ---------- Compare: bivariate, no weights, nothing summed ----------
    if (state.view === 'compare') {
      const xInd = INDICATOR_BY_ID[state.compareXId];
      const yInd = INDICATOR_BY_ID[state.compareYId];
      const sx = ds.surface(xInd.id, state.level, state.period);
      const sy = ds.surface(yInd.id, state.level, state.period);

      const xs: number[] = [];
      const ys: number[] = [];
      for (const p of scope.pcodes) {
        const a = sx.byPcode.get(p)?.value;
        const b = sy.byPcode.get(p)?.value;
        if (a != null && Number.isFinite(a)) xs.push(a);
        if (b != null && Number.isFinite(b)) ys.push(b);
      }
      xs.sort((a, b) => a - b);
      ys.sort((a, b) => a - b);
      const xCuts = [quantileSorted(xs, 1 / 3), quantileSorted(xs, 2 / 3)];
      const yCuts = [quantileSorted(ys, 1 / 3), quantileSorted(ys, 2 / 3)];

      const points: ScatterPoint[] = [];
      let nMissing = 0;
      for (const p of scope.pcodes) {
        const a = sx.byPcode.get(p)?.value;
        const b = sy.byPcode.get(p)?.value;
        if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
          colorByPcode.set(p, NO_DATA_FILL);
          nMissing++;
          continue;
        }
        const color = BIVARIATE_3X3[classIndex(b, yCuts)][classIndex(a, xCuts)];
        colorByPcode.set(p, color);
        points.push({ pcode: p, name: layer.unitByPcode.get(p)?.name ?? p, x: a, y: b, color });
      }

      return {
        kind: 'compare',
        colorByPcode,
        xInd,
        yInd,
        sx,
        sy,
        points,
        xMedian: quantileSorted(xs, 0.5),
        yMedian: quantileSorted(ys, 0.5),
        rho: spearman(
          points.map((p) => p.x),
          points.map((p) => p.y),
        ),
        nMissing,
        nOutOfScope,
      };
    }

    // ---------- Screen: count of criteria met ----------
    if (state.view === 'screen') {
      const crits = state.criteria
        .map((c) => ({ c, ind: INDICATOR_BY_ID[c.indicatorId] }))
        .filter((x): x is { c: Criterion; ind: Indicator } => Boolean(x.ind));
      const surfaces = crits.map((x) => ds.surface(x.ind.id, state.level, state.period));
      const k = crits.length;
      const ramp = rampForDirection('higher_is_worse', Math.max(3, Math.min(7, k + 1)));
      const countByPcode = new Map<PCode, number>();
      const unknownByPcode = new Map<PCode, number>();

      for (const p of scope.pcodes) {
        let met = 0;
        let unknown = 0;
        crits.forEach((x, i) => {
          const v = surfaces[i].byPcode.get(p)?.value;
          if (v == null || !Number.isFinite(v)) {
            unknown++;
            return;
          }
          if (x.c.op === 'gte' ? v >= x.c.threshold : v <= x.c.threshold) met++;
        });
        countByPcode.set(p, met);
        unknownByPcode.set(p, unknown);
        if (k > 0 && unknown === k) {
          colorByPcode.set(p, NO_DATA_FILL);
        } else {
          const idx = k > 0 ? Math.round((met / k) * (ramp.length - 1)) : 0;
          colorByPcode.set(p, ramp[idx]);
        }
      }

      return {
        kind: 'screen',
        colorByPcode,
        crits,
        surfaces,
        countByPcode,
        unknownByPcode,
        ramp,
        k,
        nOutOfScope,
      };
    }

    // ---------- Explore / Access: single-indicator choropleth ----------
    const indId = state.view === 'access' ? state.accessMetricId : state.indicatorId;
    const ind = INDICATOR_BY_ID[indId];
    const surface = ds.surface(ind.id, state.level, state.period);

    const scopeValues: number[] = [];
    let nMissing = 0;
    let nSuppressed = 0;
    for (const p of scope.pcodes) {
      const obs = surface.byPcode.get(p);
      const v = obs?.value;
      if (v == null || !Number.isFinite(v)) {
        nMissing++;
        if (obs?.missing === 'suppressed') nSuppressed++;
        continue;
      }
      scopeValues.push(v);
    }

    // Fixed across the timeline (see `fixedBreaks`); falls back to this month's
    // values only when the indicator is not mapped and no pooled set exists.
    const breaks =
      fixedBreaks ?? computeBreaks(scopeValues, state.classCount, state.classMethod);
    const ramp = rampForDirection(ind.direction, Math.max(1, breaks.k));

    if (ind.mappable) {
      for (const p of scope.pcodes) {
        const obs = surface.byPcode.get(p);
        const v = obs?.value;
        if (v == null || !Number.isFinite(v)) {
          colorByPcode.set(p, obs?.missing === 'suppressed' ? SUPPRESSED_FILL : NO_DATA_FILL);
          continue;
        }
        colorByPcode.set(p, ramp[Math.min(ramp.length - 1, classIndex(v, breaks.breaks))]);
      }
    } else {
      // The indicator exists but must not be painted; the map goes inert and the
      // table below carries the values instead.
      for (const p of scope.pcodes) colorByPcode.set(p, OUT_OF_SCOPE_FILL);
    }

    let highlight: Set<PCode> | null = null;
    if (legendClass != null && ind.mappable) {
      highlight = new Set<PCode>();
      for (const p of scope.pcodes) {
        const v = surface.byPcode.get(p)?.value;
        if (v == null || !Number.isFinite(v)) continue;
        if (classIndex(v, breaks.breaks) === legendClass) highlight.add(p);
      }
    }

    return {
      kind: 'single',
      colorByPcode,
      ind,
      surface,
      scopeValues,
      breaks,
      ramp,
      legendClasses: buildLegendClasses(breaks, ramp, scopeValues),
      highlight,
      nMissing,
      nSuppressed,
      nOutOfScope,
    };
  }, [ds, scope, state, legendClass, fixedBreaks]);

  // ── Camera: fit to the filtered area ──
  const fitBounds = useMemo(() => {
    if (!ds) return null;
    if (!state.regionPcode && !state.provincePcode) return null;
    const layer = ds.layer(state.level);
    return bboxOfFeatures(layer.geojson as never, (props) => {
      const p = props as { pcode: string; adm1_pcode?: string; adm2_pcode?: string };
      if (state.regionPcode && p.adm1_pcode !== state.regionPcode) return false;
      if (state.provincePcode) {
        const match =
          state.level === 'province'
            ? p.pcode === state.provincePcode
            : p.adm2_pcode === state.provincePcode;
        if (!match) return false;
      }
      return true;
    });
  }, [ds, state.level, state.regionPcode, state.provincePcode]);

  // ── Overlays ──
  const facilities = useMemo(() => {
    if (!ds || !state.showFacilities) return null;
    const types = new Set(state.facilityTypes);
    return ds.facilities.all.filter((f) => {
      if (!types.has(f.typeId)) return false;
      const u = ds.municipality.unitByPcode.get(f.pcode);
      if (!u) return false;
      if (state.regionPcode && u.regionPcode !== state.regionPcode) return false;
      if (state.provincePcode && u.provincePcode !== state.provincePcode) return false;
      return true;
    });
  }, [ds, state.showFacilities, state.facilityTypes, state.regionPcode, state.provincePcode]);

  const bubbles = useMemo<Bubble[] | null>(() => {
    if (!ds || !state.showPopulation || !scope) return null;
    const layer = ds.layer(state.level);
    const pop = ds.surface('dem_population', state.level, state.period);
    const rows: Array<{ pcode: PCode; lon: number; lat: number; v: number }> = [];
    for (const p of scope.pcodes) {
      const u = layer.unitByPcode.get(p);
      const v = pop.byPcode.get(p)?.value;
      if (!u || v == null || !Number.isFinite(v)) continue;
      rows.push({ pcode: p, lon: u.lon, lat: u.lat, v });
    }
    if (!rows.length) return null;
    const maxV = Math.max(...rows.map((r) => r.v));
    // Area-proportional: twice the circle area means twice the people.
    return rows.map((r) => ({
      pcode: r.pcode,
      lon: r.lon,
      lat: r.lat,
      radius: Math.max(1.5, Math.sqrt(r.v / maxV) * (state.level === 'province' ? 26 : 16)),
    }));
  }, [ds, state.showPopulation, state.level, state.period, scope]);

  // ── Ranked rows for the strip ──
  const rankRows = useMemo<RankRow[]>(() => {
    if (!ds || !scope || !model || model.kind !== 'single') return [];
    const layer = ds.layer(state.level);
    const rows: RankRow[] = [];
    for (const p of scope.pcodes) {
      const v = model.surface.byPcode.get(p)?.value;
      if (v == null || !Number.isFinite(v)) continue;
      const u = layer.unitByPcode.get(p);
      rows.push({
        pcode: p,
        name: u?.name ?? p,
        parent: u?.provinceName ?? null,
        value: v,
        // An unmapped indicator has no colour encoding to borrow, so the bars
        // fall back to a neutral tone and carry magnitude by length alone.
        color: model.ind.mappable ? model.colorByPcode.get(p) ?? NO_DATA_FILL : '#94a0b0',
      });
    }
    return rows;
  }, [ds, scope, model, state.level]);

  const hoverUnit = ds && hover ? ds.layer(state.level).unitByPcode.get(hover.pcode) : undefined;

  // ── Loading / failure ──
  if (loadError) {
    return (
      <div className="boot" role="alert">
        <div className="boot__title">Boundary data could not be loaded</div>
        <p className="boot__body">
          {loadError}
          <br />
          <br />
          The page needs <code>geo/ph-provinces.topojson</code> and{' '}
          <code>geo/ph-municipalities.topojson</code> to be served alongside the app.
        </p>
        <button className="btn" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (!ds || !scope || !model) {
    return (
      <div className="boot">
        <div className="spinner" />
        <div className="boot__title">Preparing the spatial workspace</div>
        <p className="boot__body">
          Loading 88 provinces and 1,642 cities and municipalities, then generating the synthetic
          indicator set in your browser.
        </p>
      </div>
    );
  }

  const activeView = VIEWS.find((v) => v.id === state.view)!;
  const mostlyMissing =
    model.kind === 'single' && scope.pcodes.size > 0
      ? model.nMissing / scope.pcodes.size > 0.5
      : false;

  return (
    <div
      className="app"
      data-rail={state.railHidden ? 'hidden' : 'shown'}
      data-detail={state.detailHidden ? 'hidden' : 'shown'}
      data-strip={state.stripHidden ? 'hidden' : 'shown'}
    >
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__title">Spatial Health Intelligence</div>
          <div className="topbar__sub">SugboDoc · Philippines · {scope.label}</div>
        </div>

        <div className="tabs" role="tablist" aria-label="Analysis view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              className="tab"
              aria-selected={state.view === v.id}
              onClick={() => update({ view: v.id as ViewId })}
              title={v.question}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="topbar__spacer" />

        <div className="panel-toggles" role="group" aria-label="Show or hide panels">
          <button
            aria-pressed={!state.railHidden}
            aria-label={state.railHidden ? 'Show controls panel' : 'Hide controls panel'}
            title={state.railHidden ? 'Show controls' : 'Hide controls'}
            onClick={() => update({ railHidden: !state.railHidden })}
          >
            <PanelLeftIcon on={!state.railHidden} />
          </button>
          <button
            aria-pressed={!state.stripHidden}
            aria-label={state.stripHidden ? 'Show analysis strip' : 'Hide analysis strip'}
            title={state.stripHidden ? 'Show distribution and ranking' : 'Hide distribution and ranking'}
            onClick={() => update({ stripHidden: !state.stripHidden })}
          >
            <PanelBottomIcon on={!state.stripHidden} />
          </button>
          <button
            aria-pressed={!state.detailHidden}
            aria-label={state.detailHidden ? 'Show detail panel' : 'Hide detail panel'}
            title={
              state.detailHidden
                ? 'Show area details — selecting an area also reopens this'
                : 'Hide area details'
            }
            onClick={() => update({ detailHidden: !state.detailHidden })}
          >
            <PanelRightIcon on={!state.detailHidden} />
          </button>
        </div>

        <button
          className="synthetic-chip"
          onClick={() => setSheetOpen(true)}
          title="Every health figure on this page is simulated. Click for details."
        >
          <span className="synthetic-chip__dot" />
          Synthetic data — not real health figures
        </button>
      </header>

      <div className="workspace">
        <aside className="rail" aria-label="Map controls">
          <ControlRail ds={ds} state={state} update={update} />
        </aside>

        <main className="stage">
          <div className="map-wrap">
            <MapView
              layer={ds.layer(state.level)}
              colorByPcode={model.colorByPcode}
              provinceOverlay={state.level === 'municipality' ? ds.province : null}
              selectedPcode={state.selectedPcode}
              hoverPcode={hover?.pcode ?? null}
              onHover={(pcode, pt) => setHover(pcode && pt ? { pcode, x: pt.x, y: pt.y } : null)}
              // Picking an area is a request to read about it, so the detail
              // panel comes back. The rail and strip are left as the user set
              // them — reopening everything on every click would defeat the
              // point of having separate toggles. Clicking empty sea only
              // clears the selection.
              onSelect={(pcode) =>
                update(pcode ? { selectedPcode: pcode, detailHidden: false } : { selectedPcode: null })
              }
              resizeKey={`${state.railHidden}|${state.detailHidden}|${state.stripHidden}`}
              facilities={facilities}
              bubbles={bubbles}
              highlightPcodes={model.kind === 'single' ? model.highlight : null}
              fitBounds={fitBounds}
              basemap={state.basemap}
            />

            <div className="map-overlay map-overlay--tl">
              <div className="map-card">
                <h2 className="map-title">
                  {model.kind === 'compare'
                    ? `${model.yInd.short} against ${model.xInd.short}`
                    : model.kind === 'screen'
                      ? `Screening on ${model.k} ${model.k === 1 ? 'criterion' : 'criteria'}`
                      : model.ind.name}
                </h2>
                <p className="map-subtitle">
                  {activeView.question} · {scope.pcodes.size.toLocaleString()}{' '}
                  {state.level === 'province' ? 'provinces' : 'cities & municipalities'} ·{' '}
                  {formatPeriod(state.period)}
                </p>

                {model.kind === 'single' && !model.ind.mappable && (
                  <div className="map-caveat">
                    <WarnIcon />
                    <span>
                      <strong>Deliberately not mapped.</strong> {model.ind.mapNote} The ranked table
                      below still gives you every value.
                    </span>
                  </div>
                )}

                {model.kind === 'single' && model.ind.mappable && model.ind.mapNote && (
                  <div className="map-caveat">
                    <WarnIcon />
                    <span>{model.ind.mapNote}</span>
                  </div>
                )}

                {mostlyMissing && model.kind === 'single' && model.ind.mappable && (
                  <div className="map-caveat">
                    <WarnIcon />
                    <span>
                      {model.nMissing.toLocaleString()} of {scope.pcodes.size.toLocaleString()} areas
                      have no publishable value
                      {model.nSuppressed > 0 &&
                        ` (${model.nSuppressed.toLocaleString()} withheld for too few cases)`}
                      . This measure is too sparse to read at this level
                      {state.level === 'municipality' ? (
                        <>
                          {' — '}
                          <button
                            className="btn btn--subtle"
                            onClick={() => update({ level: 'province', selectedPcode: null })}
                          >
                            switch to provinces
                          </button>
                        </>
                      ) : (
                        ', where pooling cannot help further'
                      )}
                      .
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="map-overlay map-overlay--bl">
              {model.kind === 'single' && model.ind.mappable && (
                <Legend
                  indicator={model.ind}
                  classes={model.legendClasses}
                  nMissing={model.nMissing - model.nSuppressed}
                  nSuppressed={model.nSuppressed}
                  nOutOfScope={model.nOutOfScope}
                  activeClass={legendClass}
                  onHoverClass={setLegendClass}
                  note={`${state.classMethod} breaks · ${scope.pcodes.size.toLocaleString()} areas in view`}
                />
              )}
              {model.kind === 'compare' && <BivariateLegend xInd={model.xInd} yInd={model.yInd} />}
              {model.kind === 'screen' && model.k > 0 && (
                <CountLegend
                  title="Criteria met"
                  items={model.ramp.map((c, i) => ({
                    color: c,
                    label: `${Math.round((i / (model.ramp.length - 1)) * model.k)} of ${model.k}`,
                  }))}
                  note="Shaded by how many of your criteria an area meets. Click an area to see exactly which."
                />
              )}
            </div>

            {state.showFacilities && facilities && facilities.length > 0 && (
              <div className="map-overlay map-overlay--br" style={{ bottom: 44 }}>
                <CountLegend
                  title={`Facilities (${facilities.length.toLocaleString()})`}
                  items={FACILITY_TYPES.filter((t) => state.facilityTypes.includes(t.id)).map((t) => ({
                    color: t.color,
                    label: t.label,
                    count: facilities.filter((f) => f.typeId === t.id).length,
                  }))}
                  note="Simulated register. Each point is sampled inside its area's real boundary."
                />
              </div>
            )}

            {hover && hoverUnit && (
              <div
                className="map-tooltip"
                style={{
                  left: Math.min(hover.x + 14, Math.max(0, window.innerWidth - 300)),
                  top: Math.max(8, hover.y - 10),
                }}
                role="status"
              >
                <div className="map-tooltip__name">{hoverUnit.name}</div>
                <div className="map-tooltip__parent">
                  {hoverUnit.provinceName ? `${hoverUnit.provinceName} · ` : ''}
                  {shortRegionName(hoverUnit.regionName)}
                </div>
                <TooltipBody model={model} pcode={hover.pcode} />
              </div>
            )}
          </div>

          <Timeline
            periods={ds.periods}
            period={state.period}
            playing={state.playing}
            speedMs={state.playSpeedMs}
            onScrub={(p) => update({ period: p, playing: false })}
            onTogglePlay={() => update({ playing: !state.playing })}
            onSpeedChange={(ms) => update({ playSpeedMs: ms })}
          />

          <div className="strip">
            <StripContent
              ds={ds}
              state={state}
              update={update}
              model={model}
              scope={scope}
              rankRows={rankRows}
              onHoverPcode={(p) =>
                setHover(p ? { pcode: p, x: -9999, y: -9999 } : null)
              }
            />
          </div>
        </main>

        <aside className="panel" aria-label="Selected area details">
          {model.kind === 'screen' ? (
            <ScreenDetail
              ds={ds}
              state={state}
              model={model}
              onClear={() => update({ selectedPcode: null })}
            />
          ) : (
            <DetailPanel
              ds={ds}
              indicator={model.kind === 'single' ? model.ind : model.yInd}
              level={state.level}
              period={state.period}
              surface={model.kind === 'single' ? model.surface : model.sy}
              scopePcodes={scope.pcodes}
              scopeLabel={scope.label}
              selectedPcode={state.selectedPcode}
              onClear={() => update({ selectedPcode: null })}
            />
          )}
        </aside>
      </div>

      <MethodSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}

/* ───────────────────────────── Tooltip body ───────────────────────────── */

function TooltipBody({ model, pcode }: { model: Model; pcode: PCode }) {
  if (model.kind === 'compare') {
    const x = model.sx.byPcode.get(pcode)?.value ?? null;
    const y = model.sy.byPcode.get(pcode)?.value ?? null;
    return (
      <>
        <div className="map-tooltip__meta">
          {model.xInd.short}: <strong>{formatValue(x, model.xInd)}</strong>
        </div>
        <div className="map-tooltip__meta">
          {model.yInd.short}: <strong>{formatValue(y, model.yInd)}</strong>
        </div>
      </>
    );
  }

  if (model.kind === 'screen') {
    const met = model.countByPcode.get(pcode);
    if (met == null) return <div className="map-tooltip__meta">Outside the current filter</div>;
    return (
      <>
        <div className="map-tooltip__value num">
          {met} of {model.k}
        </div>
        <div className="map-tooltip__meta">criteria met</div>
      </>
    );
  }

  const obs = model.surface.byPcode.get(pcode);
  return (
    <>
      <div className="map-tooltip__value num">
        {obs?.value != null
          ? formatValue(obs.value, model.ind)
          : obs?.missing === 'suppressed'
            ? 'Withheld'
            : 'No report'}
      </div>
      {obs?.numerator != null && obs?.denominator != null && (
        <div className="map-tooltip__meta">
          {formatCount(obs.numerator)} of {formatCount(obs.denominator)}
        </div>
      )}
      {obs?.value == null && obs?.missing === 'suppressed' && (
        <div className="map-tooltip__meta">Fewer than {model.ind.minNumerator ?? 10} cases</div>
      )}
    </>
  );
}

/* ───────────────────────────── Bottom strip ───────────────────────────── */

function StripContent({
  ds,
  state,
  update,
  model,
  scope,
  rankRows,
  onHoverPcode,
}: {
  ds: Dataset;
  state: SpatialState;
  update: (p: Partial<SpatialState>) => void;
  model: Model;
  scope: Scope;
  rankRows: RankRow[];
  onHoverPcode: (p: PCode | null) => void;
}) {
  if (model.kind === 'compare') {
    const highBoth = model.points
      .filter((p) => p.x >= model.xMedian && p.y >= model.yMedian)
      .sort((a, b) => b.y - a.y);

    return (
      <>
        <div className="strip__pane">
          <div className="strip__head">
            <span className="strip__title">
              {model.yInd.short} against {model.xInd.short}
            </span>
            <span className="strip__hint">
              Spearman ρ = {Number.isFinite(model.rho) ? model.rho.toFixed(2) : '—'} · association
              between areas, never between people
            </span>
          </div>
          <div className="strip__body">
            <Scatter
              points={model.points}
              xInd={model.xInd}
              yInd={model.yInd}
              xMedian={model.xMedian}
              yMedian={model.yMedian}
              selectedPcode={state.selectedPcode}
              onSelect={(p) => update({ selectedPcode: p })}
              onHover={onHoverPcode}
            />
          </div>
        </div>
        <div className="strip__pane strip__pane--rank">
          <div className="strip__head">
            <span className="strip__title">Above median on both ({highBoth.length})</span>
            <span className="strip__hint">Top-right quadrant</span>
          </div>
          <div className="strip__body">
            <div className="ranklist">
              {highBoth.slice(0, 80).map((p, i) => (
                <button
                  key={p.pcode}
                  className="rankrow"
                  aria-current={p.pcode === state.selectedPcode}
                  onClick={() => update({ selectedPcode: p.pcode })}
                  onMouseEnter={() => onHoverPcode(p.pcode)}
                  onMouseLeave={() => onHoverPcode(null)}
                >
                  <span className="rankrow__rank num">{i + 1}</span>
                  <span className="rankrow__name">{p.name}</span>
                  <span className="rankrow__bar">
                    <span className="rankrow__fill" style={{ width: '100%', background: p.color }} />
                  </span>
                  <span className="rankrow__val num">{formatValue(p.y, model.yInd)}</span>
                </button>
              ))}
              {!highBoth.length && (
                <div className="empty-state" style={{ padding: 16 }}>
                  <div className="empty-state__body">
                    No area sits above the median on both measures in the current filter.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (model.kind === 'screen') {
    if (model.k === 0) {
      return (
        <div className="strip__pane">
          <div className="empty-state" style={{ padding: 22 }}>
            <div className="empty-state__title">No criteria yet</div>
            <div className="empty-state__body">
              Add a criterion in the left panel to start screening. Every area will be shaded by how
              many of your conditions it meets — no weighting, no composite score.
            </div>
          </div>
        </div>
      );
    }

    const layer = ds.layer(state.level);
    const rows = [...model.countByPcode.entries()]
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([p, n]) => ({
        pcode: p,
        name: layer.unitByPcode.get(p)?.name ?? p,
        parent: layer.unitByPcode.get(p)?.provinceName ?? null,
        n,
      }));

    const hist = new Array<number>(model.k + 1).fill(0);
    for (const n of model.countByPcode.values()) hist[n]++;
    const maxBar = Math.max(...hist, 1);

    return (
      <>
        <div className="strip__pane">
          <div className="strip__head">
            <span className="strip__title">How many areas meet how many criteria</span>
            <span className="strip__hint">{scope.pcodes.size.toLocaleString()} areas in view</span>
          </div>
          <div
            className="strip__body"
            style={{ display: 'flex', alignItems: 'flex-end', gap: 10, paddingBottom: 20 }}
          >
            {hist.map((count, i) => (
              <div
                key={i}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}
              >
                <div
                  className="num"
                  style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'center' }}
                >
                  {count.toLocaleString()}
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                  <div
                    style={{
                      width: '100%',
                      height: `${(count / maxBar) * 100}%`,
                      minHeight: count > 0 ? 3 : 0,
                      background:
                        model.ramp[Math.round((i / Math.max(1, model.k)) * (model.ramp.length - 1))],
                      borderRadius: 2,
                      border: '1px solid rgba(0,0,0,.12)',
                    }}
                  />
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 4, textAlign: 'center' }}>
                  {i} of {model.k}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="strip__pane strip__pane--rank">
          <div className="strip__head">
            <span className="strip__title">
              Meeting at least one ({rows.length.toLocaleString()})
            </span>
            <span className="strip__hint">Click to inspect</span>
          </div>
          <div className="strip__body">
            <div className="ranklist">
              {rows.slice(0, 150).map((r) => (
                <button
                  key={r.pcode}
                  className="rankrow"
                  aria-current={r.pcode === state.selectedPcode}
                  onClick={() => update({ selectedPcode: r.pcode })}
                  onMouseEnter={() => onHoverPcode(r.pcode)}
                  onMouseLeave={() => onHoverPcode(null)}
                  title={r.parent ?? r.name}
                >
                  <span className="rankrow__rank num">{r.n}</span>
                  <span className="rankrow__name">{r.name}</span>
                  <span className="rankrow__bar">
                    <span
                      className="rankrow__fill"
                      style={{
                        width: `${(r.n / Math.max(1, model.k)) * 100}%`,
                        background:
                          model.ramp[
                            Math.round((r.n / Math.max(1, model.k)) * (model.ramp.length - 1))
                          ],
                      }}
                    />
                  </span>
                  <span className="rankrow__val num">
                    {r.n}/{model.k}
                  </span>
                </button>
              ))}
              {!rows.length && (
                <div className="empty-state" style={{ padding: 16 }}>
                  <div className="empty-state__title">Nothing meets your criteria</div>
                  <div className="empty-state__body">
                    Loosen a threshold on the left, or widen the geographic filter.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  const selectedValue = state.selectedPcode
    ? model.surface.byPcode.get(state.selectedPcode)?.value ?? null
    : null;
  const selectedName = state.selectedPcode
    ? ds.layer(state.level).unitByPcode.get(state.selectedPcode)?.name ?? undefined
    : undefined;

  return (
    <>
      <div className="strip__pane">
        <div className="strip__head">
          <span className="strip__title">Distribution across areas in view</span>
          <span className="strip__hint">
            {model.scopeValues.length.toLocaleString()} with a value · dashed line = national median
          </span>
        </div>
        <div className="strip__body">
          <Distribution
            values={model.scopeValues}
            breaks={model.breaks.breaks}
            colors={model.ramp}
            indicator={model.ind}
            markerValue={selectedValue}
            markerLabel={selectedName}
            referenceValue={model.surface.stats.median}
          />
        </div>
      </div>
      <div className="strip__pane strip__pane--rank">
        <div className="strip__head">
          <span className="strip__title">Ranked areas</span>
          <span className="strip__hint">
            {scope.label}
            {UNIT_SHORT[model.ind.unit] ? ` · ${UNIT_SHORT[model.ind.unit]}` : ''}
          </span>
        </div>
        <div className="strip__body">
          <RankList
            rows={rankRows}
            indicator={model.ind}
            selectedPcode={state.selectedPcode}
            onSelect={(p) => update({ selectedPcode: p })}
            onHover={onHoverPcode}
          />
        </div>
      </div>
    </>
  );
}

/* ─────────────────────── Screening detail panel ─────────────────────── */

function ScreenDetail({
  ds,
  state,
  model,
  onClear,
}: {
  ds: Dataset;
  state: SpatialState;
  model: ScreenModel;
  onClear: () => void;
}) {
  const layer = ds.layer(state.level);
  const unit = state.selectedPcode ? layer.unitByPcode.get(state.selectedPcode) : undefined;

  if (!unit) {
    return (
      <div className="empty-state">
        <div className="empty-state__title">No area selected</div>
        <p className="empty-state__body">
          Click an area to see exactly which of your {model.k}{' '}
          {model.k === 1 ? 'criterion' : 'criteria'} it meets, and by how much. Nothing is scored —
          you see the raw comparisons.
        </p>
      </div>
    );
  }

  const met = model.countByPcode.get(unit.pcode) ?? 0;
  const unknown = model.unknownByPcode.get(unit.pcode) ?? 0;

  return (
    <>
      <div className="detail__header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="detail__name">{unit.name}</h2>
            <div className="detail__parent">
              {unit.provinceName ? `${unit.provinceName} · ` : ''}
              {shortRegionName(unit.regionName)}
            </div>
          </div>
          <button className="btn btn--subtle" onClick={onClear}>
            Clear
          </button>
        </div>
        <div className="bignum">
          <span className="bignum__value num">
            {met}
            <span style={{ fontSize: 17, color: 'var(--text-3)' }}> / {model.k}</span>
          </span>
        </div>
        <div className="bignum__label">criteria met in {formatPeriod(state.period)}</div>

        {unknown > 0 && (
          <div className="notice notice--warn" style={{ marginTop: 10 }}>
            <WarnIcon />
            <span>
              {unknown} {unknown === 1 ? 'criterion has' : 'criteria have'} no value for this area, so
              it cannot be judged against {unknown === 1 ? 'it' : 'them'}. A low count here may mean
              missing data, not good performance.
            </span>
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section__title">Criterion by criterion</h3>
        {model.crits.map((x, i) => {
          const v = model.surfaces[i].byPcode.get(unit.pcode)?.value;
          const has = v != null && Number.isFinite(v);
          const isMet = has && (x.c.op === 'gte' ? v >= x.c.threshold : v <= x.c.threshold);
          return (
            <div key={x.c.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{x.ind.name}</div>
              <div className="compare-row" style={{ borderBottom: 0, padding: 0 }}>
                <span className="compare-row__label">
                  {x.c.op === 'gte' ? 'at least' : 'at most'} {formatValue(x.c.threshold, x.ind)}
                </span>
                <span className="compare-row__value num">{has ? formatValue(v, x.ind) : '—'}</span>
              </div>
              <div className="chiplist">
                <span className={`chip${isMet ? ' chip--hit' : ''}`}>
                  {!has ? 'no value' : isMet ? 'meets criterion' : 'does not meet'}
                </span>
                {has && (
                  <span className="chip num">
                    {v > x.c.threshold ? '+' : ''}
                    {(v - x.c.threshold).toFixed(x.ind.decimals)} vs threshold
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="section">
        <div className="notice notice--info">
          <InfoIcon />
          <span>
            Criteria are combined by counting, not weighting. Two areas with the same count are not
            necessarily comparable — open each to see which criteria drove it.
          </span>
        </div>
      </div>
    </>
  );
}
