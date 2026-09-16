import { useMemo } from 'react';
import type { ClassMethod, GeoLevel } from '../types';
import type { Dataset } from '../data/dataset';
import type { Criterion, SpatialState } from '../state';
import { INDICATOR_BY_ID, INDICATORS } from '../data/indicators';
import { FACILITY_TYPES } from '../data/facilities';
import { IndicatorPicker } from './IndicatorPicker';
import { shortRegionName } from '../lib/format';
import { TrashIcon, PlusIcon, InfoIcon } from './icons';

const CLASS_METHODS: Array<{ id: ClassMethod; label: string; note: string }> = [
  {
    id: 'quantile',
    label: 'Quantile',
    note: 'Equal number of areas per class. Always readable, but exaggerates differences when values are tightly bunched.',
  },
  {
    id: 'jenks',
    label: 'Natural breaks',
    note: 'Cuts at the natural gaps in the distribution. Usually the fairest default when the data is lumpy.',
  },
  {
    id: 'equal',
    label: 'Equal interval',
    note: 'Equal value ranges. Honest about absolute distance, but a single outlier can leave most classes empty.',
  },
  {
    id: 'stddev',
    label: 'Std deviation',
    note: 'Classes around the mean. Useful for spotting genuine outliers, misleading when the distribution is skewed.',
  },
];

export function ControlRail({
  ds,
  state,
  update,
}: {
  ds: Dataset;
  state: SpatialState;
  update: (patch: Partial<SpatialState>) => void;
}) {
  const regions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of ds.province.units) if (!seen.has(u.regionPcode)) seen.set(u.regionPcode, u.regionName);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ds]);

  const provinces = useMemo(() => {
    const list = state.regionPcode
      ? ds.province.units.filter((u) => u.regionPcode === state.regionPcode)
      : ds.province.units;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [ds, state.regionPcode]);

  const methodNote = CLASS_METHODS.find((m) => m.id === state.classMethod)?.note ?? '';

  return (
    <>
      {/* ── Geography ── */}
      <div className="section">
        <h3 className="section__title">Geography</h3>

        <div className="field">
          <span className="field__label">Map areas as</span>
          <div className="segmented" role="group" aria-label="Geographic level">
            {(['province', 'municipality'] as GeoLevel[]).map((lv) => (
              <button
                key={lv}
                aria-pressed={state.level === lv}
                onClick={() => update({ level: lv, selectedPcode: null })}
              >
                {lv === 'province' ? `Provinces (${ds.province.units.length})` : `Cities & municipalities`}
              </button>
            ))}
          </div>
          <p className="field__hint">
            {state.level === 'province'
              ? '88 provinces. The right level for a national scan — municipal rates are noisy enough that the country-wide picture is easier to read pooled.'
              : `${ds.municipality.units.length.toLocaleString()} areas. Filter to a region or province before reading this level closely.`}
          </p>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ctl-region">
            Region
          </label>
          <select
            id="ctl-region"
            value={state.regionPcode ?? ''}
            onChange={(e) =>
              update({
                regionPcode: e.target.value || null,
                provincePcode: null,
                selectedPcode: null,
              })
            }
          >
            <option value="">Whole country</option>
            {regions.map(([pcode, name]) => (
              <option key={pcode} value={pcode}>
                {shortRegionName(name)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ctl-province">
            Province
          </label>
          <select
            id="ctl-province"
            value={state.provincePcode ?? ''}
            onChange={(e) => update({ provincePcode: e.target.value || null, selectedPcode: null })}
            disabled={state.level === 'province' && !state.regionPcode ? false : false}
          >
            <option value="">{state.regionPcode ? 'All in region' : 'All provinces'}</option>
            {provinces.map((p) => (
              <option key={p.pcode} value={p.pcode}>
                {p.name}
              </option>
            ))}
          </select>
          {state.level === 'province' && state.provincePcode && (
            <p className="field__hint">
              Selecting one province while mapping provinces leaves a single shape. Switch to cities
              &amp; municipalities to see inside it.
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor="ctl-period">
            Period
          </label>
          <select
            id="ctl-period"
            value={state.period}
            onChange={(e) => update({ period: Number(e.target.value) })}
          >
            {ds.periods.map((p) => (
              <option key={p} value={p}>
                {p}
                {p === ds.latestPeriod ? ' (latest)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── What is mapped ── */}
      {state.view === 'explore' && (
        <div className="section">
          <h3 className="section__title">What is mapped</h3>
          <IndicatorPicker valueId={state.indicatorId} onChange={(id) => update({ indicatorId: id })} />
        </div>
      )}

      {state.view === 'compare' && (
        <div className="section">
          <h3 className="section__title">Two indicators</h3>
          <IndicatorPicker
            label="Horizontal axis"
            valueId={state.compareXId}
            onChange={(id) => update({ compareXId: id })}
            allowUnmappable={false}
            excludeId={state.compareYId}
          />
          <div style={{ height: 10 }} />
          <IndicatorPicker
            label="Vertical axis"
            valueId={state.compareYId}
            onChange={(id) => update({ compareYId: id })}
            allowUnmappable={false}
            excludeId={state.compareXId}
          />
          <div className="notice notice--info" style={{ marginTop: 10 }}>
            <InfoIcon />
            <span>
              This replaces a weighted "priority score". Adding normalised indicators together hides
              the weights that decide the answer; showing both measures at once does not.
            </span>
          </div>
        </div>
      )}

      {state.view === 'screen' && (
        <ScreenControls ds={ds} state={state} update={update} />
      )}

      {state.view === 'access' && (
        <div className="section">
          <h3 className="section__title">Access measure</h3>
          <div className="field">
            <select
              value={state.accessMetricId}
              onChange={(e) => update({ accessMetricId: e.target.value })}
              aria-label="Access measure"
            >
              <option value="acc_nearest_inpatient_km">Distance to nearest inpatient facility</option>
              <option value="acc_nearest_facility_km">Distance to nearest facility of any type</option>
              <option value="wf_facilities_per_10k">Facilities per 10,000 population</option>
              <option value="wf_beds_per_10k">Hospital beds per 10,000 population</option>
            </select>
            <p className="field__hint">{INDICATOR_BY_ID[state.accessMetricId]?.definition}</p>
          </div>
        </div>
      )}

      {/* ── Classification ── */}
      {state.view !== 'compare' && state.view !== 'screen' && (
        <div className="section">
          <h3 className="section__title">Classification</h3>
          <div className="field">
            <label className="field__label" htmlFor="ctl-method">
              Break method
            </label>
            <select
              id="ctl-method"
              value={state.classMethod}
              onChange={(e) => update({ classMethod: e.target.value as ClassMethod })}
            >
              {CLASS_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="field__hint">{methodNote}</p>
            <p className="field__hint">
              Breaks are recomputed over the areas currently in view, so filtering to a region
              rescales the colours. Switch method to see how much the story depends on the cut
              points.
            </p>
          </div>
          <div className="field">
            <span className="field__label">Classes</span>
            <div className="segmented" role="group" aria-label="Number of classes">
              {[3, 4, 5, 6, 7].map((k) => (
                <button key={k} aria-pressed={state.classCount === k} onClick={() => update({ classCount: k })}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      <div className="section">
        <h3 className="section__title">Overlays</h3>

        <label className="check">
          <input
            type="checkbox"
            checked={state.showFacilities}
            onChange={(e) => update({ showFacilities: e.target.checked })}
          />
          <span>
            Facility locations
            <span className="field__hint" style={{ marginTop: 1 }}>
              Points, not shading — a facility is a place, not a property of an area.
            </span>
          </span>
        </label>

        {state.showFacilities && (
          <div style={{ paddingLeft: 22, marginTop: 2 }}>
            {FACILITY_TYPES.map((t) => (
              <label className="check" key={t.id} style={{ padding: '2px 0' }}>
                <input
                  type="checkbox"
                  checked={state.facilityTypes.includes(t.id)}
                  onChange={(e) =>
                    update({
                      facilityTypes: e.target.checked
                        ? [...state.facilityTypes, t.id]
                        : state.facilityTypes.filter((x) => x !== t.id),
                    })
                  }
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: t.color,
                      flex: '0 0 auto',
                    }}
                  />
                  {t.label}
                </span>
              </label>
            ))}
          </div>
        )}

        <label className="check">
          <input
            type="checkbox"
            checked={state.showPopulation}
            onChange={(e) => update({ showPopulation: e.target.checked })}
          />
          <span>
            Population as proportional circles
            <span className="field__hint" style={{ marginTop: 1 }}>
              The honest encoding for a count. Shading a polygon by population maps land area, not
              people.
            </span>
          </span>
        </label>

        <label className="check">
          <input
            type="checkbox"
            checked={state.basemap}
            onChange={(e) => update({ basemap: e.target.checked })}
          />
          <span>
            Street basemap
            <span className="field__hint" style={{ marginTop: 1 }}>
              Off by default: a busy basemap competes with the fill colours. Requires internet.
            </span>
          </span>
        </label>
      </div>
    </>
  );
}

/** Threshold screening: explicit criteria the officer sets and can see. */
function ScreenControls({
  ds,
  state,
  update,
}: {
  ds: Dataset;
  state: SpatialState;
  update: (patch: Partial<SpatialState>) => void;
}) {
  const setCriterion = (id: string, patch: Partial<Criterion>) =>
    update({ criteria: state.criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const remove = (id: string) => update({ criteria: state.criteria.filter((c) => c.id !== id) });

  const add = () => {
    const used = new Set(state.criteria.map((c) => c.indicatorId));
    const next = INDICATORS.find((i) => i.mappable && !used.has(i.id));
    if (!next) return;
    const surface = ds.surface(next.id, state.level, state.period);
    update({
      criteria: [
        ...state.criteria,
        {
          id: `c${Date.now()}`,
          indicatorId: next.id,
          op: next.direction === 'higher_is_better' ? 'lte' : 'gte',
          threshold: Number((surface.stats.median ?? 0).toFixed(next.decimals)),
        },
      ],
    });
  };

  return (
    <div className="section">
      <h3 className="section__title">
        Screening criteria
        <button className="btn btn--subtle" onClick={add} disabled={state.criteria.length >= 6}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <PlusIcon /> Add
          </span>
        </button>
      </h3>

      {state.criteria.length === 0 && (
        <p className="field__hint">Add a criterion to start screening.</p>
      )}

      {state.criteria.map((c) => {
        const ind = INDICATOR_BY_ID[c.indicatorId];
        if (!ind) return null;
        const surface = ds.surface(c.indicatorId, state.level, state.period);
        return (
          <div className="criterion" key={c.id}>
            <div className="criterion__head">
              <span className="criterion__name" title={ind.name}>
                {ind.name}
              </span>
              <button className="icon-btn" onClick={() => remove(c.id)} aria-label={`Remove ${ind.name}`}>
                <TrashIcon />
              </button>
            </div>

            <select
              value={c.indicatorId}
              onChange={(e) => {
                const nextInd = INDICATOR_BY_ID[e.target.value];
                const s = ds.surface(e.target.value, state.level, state.period);
                setCriterion(c.id, {
                  indicatorId: e.target.value,
                  threshold: Number((s.stats.median ?? 0).toFixed(nextInd?.decimals ?? 1)),
                });
              }}
              style={{ marginBottom: 6 }}
              aria-label="Criterion indicator"
            >
              {INDICATORS.filter((i) => i.mappable).map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>

            <div className="criterion__controls">
              <select
                value={c.op}
                onChange={(e) => setCriterion(c.id, { op: e.target.value as 'gte' | 'lte' })}
                aria-label="Comparison"
              >
                <option value="gte">at least</option>
                <option value="lte">at most</option>
              </select>
              <input
                type="number"
                value={c.threshold}
                step={ind.decimals > 0 ? 0.1 : 1}
                onChange={(e) => setCriterion(c.id, { threshold: Number(e.target.value) })}
                aria-label="Threshold"
              />
            </div>

            <div className="criterion__meta">
              Median {surface.stats.median?.toFixed(ind.decimals) ?? '—'} · range{' '}
              {surface.stats.min?.toFixed(ind.decimals) ?? '—'}–
              {surface.stats.max?.toFixed(ind.decimals) ?? '—'}
            </div>
          </div>
        );
      })}

      <div className="notice notice--info" style={{ marginTop: 8 }}>
        <InfoIcon />
        <span>
          Areas are shaded by <strong>how many criteria they meet</strong>, not by a score. Nothing
          is weighted or added, so you can always say exactly why an area is highlighted.
        </span>
      </div>
    </div>
  );
}
