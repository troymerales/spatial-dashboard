import { useMemo } from 'react';
import type { GeoLevel, Indicator, PCode } from '../types';
import type { Dataset, IndicatorSurface } from '../data/dataset';
import {
  median,
  percentileRank,
  reliabilityBand,
  sortAsc,
  wilsonInterval,
} from '../lib/stats';
import { formatCount, formatSigned, formatValue, ordinal, shortRegionName } from '../lib/format';
import { Sparkline } from './charts';
import { formatPeriod, formatPeriodShort } from '../data/periods';

import { InfoIcon, WarnIcon } from './icons';
import { DETAIL_SECTIONS } from '../data/ui-taxonomy';

/** Section headings come from the shared taxonomy so the docs cannot drift. */
const SECTION: Record<string, string> = Object.fromEntries(
  DETAIL_SECTIONS.map((sec) => [sec.id, sec.title]),
);

/**
 * What an officer gets after clicking a polygon.
 *
 * A value on its own is close to useless — "84.2%" answers nothing. Everything
 * here exists to turn it into a judgement: is that high or low for this
 * province, is it moving, is it different from the areas next door, and is the
 * estimate even stable enough to act on.
 */
export function DetailPanel({
  ds,
  indicator,
  level,
  period,
  surface,
  scopePcodes,
  scopeLabel,
  selectedPcode,
  onClear,
}: {
  ds: Dataset;
  indicator: Indicator;
  level: GeoLevel;
  period: number;
  surface: IndicatorSurface;
  scopePcodes: Set<PCode>;
  scopeLabel: string;
  selectedPcode: PCode | null;
  onClear: () => void;
}) {
  const layer = ds.layer(level);
  const unit = selectedPcode ? layer.unitByPcode.get(selectedPcode) : undefined;

  const analysis = useMemo(() => {
    if (!unit) return null;
    const obs = surface.byPcode.get(unit.pcode) ?? null;

    const scopeValues: number[] = [];
    for (const p of scopePcodes) {
      const v = surface.byPcode.get(p)?.value;
      if (v != null && Number.isFinite(v)) scopeValues.push(v);
    }
    const scopeSorted = sortAsc(scopeValues);

    // Rank is 1 = highest value, which is not the same as 1 = best.
    let rank: number | null = null;
    if (obs?.value != null) {
      rank = 1;
      for (const v of scopeValues) if (v > obs.value) rank++;
    }

    const siblings =
      level === 'municipality' && unit.provincePcode
        ? ds.engine
            .municipalitiesInProvince(unit.provincePcode)
            .map((u) => surface.byPcode.get(u.pcode)?.value)
            .filter((v): v is number => v != null && Number.isFinite(v))
        : [];

    const neighborPcodes = layer.neighborsByPcode.get(unit.pcode) ?? [];
    const neighborValues = neighborPcodes
      .map((p) => surface.byPcode.get(p)?.value)
      .filter((v): v is number => v != null && Number.isFinite(v));
    const neighborMedian = neighborValues.length ? median(neighborValues) : null;

    const series = ds.series(indicator.id, level, unit.pcode);
    const firstReported = series.find((s) => s.value != null);
    const change =
      obs?.value != null && firstReported?.value != null && firstReported.value !== 0
        ? ((obs.value - firstReported.value) / Math.abs(firstReported.value)) * 100
        : null;

    const ci =
      indicator.valueType === 'proportion' && obs?.numerator != null && obs?.denominator
        ? wilsonInterval(obs.numerator, obs.denominator)
        : null;

    const facilityCount = ds.facilityCount(unit.pcode, level);
    const accessObs = ds.surface('acc_nearest_inpatient_km', level, period).byPcode.get(unit.pcode);
    const popObs = ds.surface('dem_population', level, period).byPcode.get(unit.pcode);

    return {
      obs,
      scopeSorted,
      rank,
      scopeN: scopeSorted.length,
      siblingMedian: siblings.length ? median(siblings) : null,
      siblingCount: siblings.length,
      neighborMedian,
      neighborCount: neighborValues.length,
      neighborTotal: neighborPcodes.length,
      series,
      change,
      ci,
      facilityCount,
      nearestInpatientKm: accessObs?.value ?? null,
      population: popObs?.value ?? null,
    };
  }, [unit, surface, scopePcodes, level, ds, indicator.id, indicator.valueType, period, layer]);

  if (!unit || !analysis) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </div>
        <div className="empty-state__title">No area selected</div>
        <p className="empty-state__body">
          Click any area on the map, or pick one from the ranked list below, to see how it compares
          with its province, its immediate neighbours and its own recent history.
        </p>
      </div>
    );
  }

  const { obs } = analysis;
  const band = reliabilityBand(obs?.rse ?? null);
  const pct =
    obs?.value != null && analysis.scopeSorted.length
      ? percentileRank(analysis.scopeSorted, obs.value)
      : null;

  const deltaClass = (d: number | null) => {
    if (d == null || Math.abs(d) < 0.5) return 'delta--flat';
    const worse = indicator.direction === 'higher_is_worse' ? d > 0 : d < 0;
    if (indicator.direction === 'neutral') return 'delta--flat';
    return worse ? 'delta--up' : 'delta--down';
  };

  return (
    <>
      <div className="detail__header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="detail__name">{unit.name}</h2>
            <div className="detail__parent">
              {level === 'municipality' && unit.provinceName ? `${unit.provinceName} · ` : ''}
              {shortRegionName(unit.regionName)}
            </div>
          </div>
          <button className="btn btn--subtle" onClick={onClear} aria-label="Clear selection">
            Clear
          </button>
        </div>

        <div className="bignum">
          <span className="bignum__value num">
            {obs?.value != null ? formatValue(obs.value, indicator) : '—'}
          </span>
          {band && (
            <span className={`flag flag--${band}`}>
              {band === 'good' ? 'stable' : band === 'moderate' ? 'moderate' : 'unstable'}
            </span>
          )}
        </div>
        <div className="bignum__label">
          {indicator.name} · {formatPeriod(period)}
        </div>

        {obs?.value == null && (
          <div className="notice notice--warn" style={{ marginTop: 10 }}>
            <WarnIcon />
            <span>
              {obs?.missing === 'suppressed' ? (
                <>
                  <strong>Withheld.</strong> This area recorded fewer than{' '}
                  {indicator.minNumerator ?? 10} cases, too few to publish without risking
                  identification of individuals. The underlying count is still included in the
                  province total.
                </>
              ) : obs?.missing === 'no_denominator' ? (
                <>
                  <strong>No denominator.</strong> The population base needed for this rate is not
                  available for this area.
                </>
              ) : (
                <>
                  <strong>No report.</strong> This area did not submit data for this indicator in{' '}
                  {formatPeriod(period)}. It is drawn as "no report" rather than zero, because those
                  mean very different things.
                </>
              )}
            </span>
          </div>
        )}

        {band === 'unstable' && obs?.value != null && (
          <div className="notice notice--warn" style={{ marginTop: 10 }}>
            <WarnIcon />
            <span>
              Built on only {formatCount(obs.numerator)} cases, so this rate will swing widely from
              period to period. Treat the direction as a hint, not a finding.
            </span>
          </div>
        )}
      </div>

      {obs?.value != null && (
        <div className="section">
          <h3 className="section__title">{SECTION.position}</h3>
          <div className="statgrid">
            <div className="statgrid__cell">
              <div className="statgrid__label">Rank (highest first)</div>
              <div className="statgrid__value num">
                {analysis.rank != null ? ordinal(analysis.rank) : '—'}
              </div>
              <div className="statgrid__sub">of {analysis.scopeN} in {scopeLabel}</div>
            </div>
            <div className="statgrid__cell">
              <div className="statgrid__label">Percentile</div>
              <div className="statgrid__value num">
                {pct != null ? ordinal(Math.round(pct * 100)) : '—'}
              </div>
              <div className="statgrid__sub">within {scopeLabel}</div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="compare-row">
              <span className="compare-row__label">vs national median</span>
              <span className={`compare-row__value num ${deltaClass(obs.value - surface.stats.median)}`}>
                {formatSigned(obs.value - surface.stats.median, indicator.decimals)}
              </span>
            </div>

            {analysis.siblingMedian != null && (
              <div className="compare-row">
                <span className="compare-row__label">
                  vs {unit.provinceName} median ({analysis.siblingCount})
                </span>
                <span
                  className={`compare-row__value num ${deltaClass(obs.value - analysis.siblingMedian)}`}
                >
                  {formatSigned(obs.value - analysis.siblingMedian, indicator.decimals)}
                </span>
              </div>
            )}

            <div className="compare-row">
              <span className="compare-row__label">
                vs adjacent areas
                {analysis.neighborTotal > 0 && ` (${analysis.neighborCount}/${analysis.neighborTotal})`}
              </span>
              <span
                className={`compare-row__value num ${
                  analysis.neighborMedian != null
                    ? deltaClass(obs.value - analysis.neighborMedian)
                    : ''
                }`}
              >
                {analysis.neighborMedian != null
                  ? formatSigned(obs.value - analysis.neighborMedian, indicator.decimals)
                  : '—'}
              </span>
            </div>
          </div>

          {analysis.neighborTotal === 0 && (
            <p className="field__hint">
              This area shares no land border with another — it is an island or otherwise isolated —
              so there is no neighbour comparison to make.
            </p>
          )}

          {analysis.ci && (
            <p className="field__hint">
              95% confidence interval {(analysis.ci[0] * 100).toFixed(1)}% –{' '}
              {(analysis.ci[1] * 100).toFixed(1)}%, from {formatCount(obs.numerator)} of{' '}
              {formatCount(obs.denominator)}.
            </p>
          )}
        </div>
      )}

      <div className="section">
        <h3 className="section__title">
          {SECTION.trend}
          {analysis.change != null && (
            <span className={`num ${deltaClass(analysis.change)}`} style={{ fontSize: 11 }}>
              {formatSigned(analysis.change, 1)}% since {formatPeriodShort(analysis.series[0].period)}
            </span>
          )}
        </h3>
        <Sparkline points={analysis.series} indicator={indicator} width={296} height={46} />
        <p className="field__hint">
          Synthetic weekly series, {analysis.series.length} weeks. Week-to-week movement in a small
          area is mostly sampling noise — read the shape, not the steps.
        </p>
      </div>

      {obs != null && (obs.numerator != null || obs.denominator != null) && (
        <div className="section">
          <h3 className="section__title">{SECTION.composition}</h3>
          <div className="statgrid">
            <div className="statgrid__cell">
              <div className="statgrid__label">Numerator</div>
              <div className="statgrid__value num">{formatCount(obs.numerator)}</div>
              <div className="statgrid__sub">cases counted</div>
            </div>
            <div className="statgrid__cell">
              <div className="statgrid__label">Denominator</div>
              <div className="statgrid__value num">{formatCount(obs.denominator)}</div>
              <div className="statgrid__sub">
                {indicator.denominator ? indicator.denominator.replace(/_/g, ' ') : 'population base'}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="section">
        <h3 className="section__title">{SECTION.context}</h3>
        <div className="statgrid">
          <div className="statgrid__cell">
            <div className="statgrid__label">Population</div>
            <div className="statgrid__value num">{formatCount(analysis.population)}</div>
            <div className="statgrid__sub">synthetic, {formatPeriodShort(period)}</div>
          </div>
          <div className="statgrid__cell">
            <div className="statgrid__label">Land area</div>
            <div className="statgrid__value num">{formatCount(unit.areaSqKm)} km²</div>
            <div className="statgrid__sub">from boundary file</div>
          </div>
          <div className="statgrid__cell">
            <div className="statgrid__label">Facilities</div>
            <div className="statgrid__value num">{formatCount(analysis.facilityCount)}</div>
            <div className="statgrid__sub">all types</div>
          </div>
          <div className="statgrid__cell">
            <div className="statgrid__label">Nearest inpatient</div>
            <div className="statgrid__value num">
              {analysis.nearestInpatientKm != null
                ? analysis.nearestInpatientKm.toFixed(1) + ' km'
                : '—'}
            </div>
            <div className="statgrid__sub">straight line</div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="section__title">{SECTION.about}</h3>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: 'var(--text-2)' }}>
          {indicator.definition}
        </p>
        {indicator.mapNote && (
          <div className="notice notice--info" style={{ marginTop: 9 }}>
            <InfoIcon />
            <span>{indicator.mapNote}</span>
          </div>
        )}
      </div>
    </>
  );
}
