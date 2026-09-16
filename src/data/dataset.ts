import type { GeoLevel, GeoUnit, Indicator, Observation, PCode } from '../types';
import { loadGeoLayer, type GeoLayer } from './geo';
import { SyntheticEngine, PERIODS, LATEST_PERIOD } from './synth';
import { buildFacilities, nearestFacilityKm, type FacilityIndex } from './facilities';
import { INDICATOR_BY_ID } from './indicators';
import { haversineKm, mean, median, sortAsc, stdev, quantileSorted } from '../lib/stats';

/** Summary statistics for one indicator on one level in one period. */
export interface SurfaceStats {
  n: number;
  nMissing: number;
  nSuppressed: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  sd: number;
  p10: number;
  p90: number;
}

export interface IndicatorSurface {
  indicator: Indicator;
  level: GeoLevel;
  period: number;
  byPcode: Map<PCode, Observation>;
  /** Finite values only, unsorted then sorted — both are reused a lot. */
  values: number[];
  sorted: number[];
  stats: SurfaceStats;
}

export interface Dataset {
  province: GeoLayer;
  municipality: GeoLayer;
  engine: SyntheticEngine;
  facilities: FacilityIndex;
  periods: number[];
  latestPeriod: number;
  layer(level: GeoLevel): GeoLayer;
  units(level: GeoLevel): GeoUnit[];
  surface(indicatorId: string, level: GeoLevel, period: number): IndicatorSurface;
  /** Value for one unit across every period — for the trend sparkline. */
  series(indicatorId: string, level: GeoLevel, pcode: PCode): Array<{ period: number; value: number | null }>;
  facilityCount(pcode: PCode, level: GeoLevel): number;
}

function emptyStats(): SurfaceStats {
  return {
    n: 0,
    nMissing: 0,
    nSuppressed: 0,
    min: NaN,
    max: NaN,
    mean: NaN,
    median: NaN,
    sd: NaN,
    p10: NaN,
    p90: NaN,
  };
}

function summarise(byPcode: Map<PCode, Observation>): {
  values: number[];
  sorted: number[];
  stats: SurfaceStats;
} {
  const values: number[] = [];
  let nMissing = 0;
  let nSuppressed = 0;
  for (const obs of byPcode.values()) {
    if (obs.value == null || !Number.isFinite(obs.value)) {
      nMissing++;
      if (obs.missing === 'suppressed') nSuppressed++;
      continue;
    }
    values.push(obs.value);
  }
  const sorted = sortAsc(values);
  if (!sorted.length) {
    const s = emptyStats();
    s.nMissing = nMissing;
    s.nSuppressed = nSuppressed;
    return { values, sorted, stats: s };
  }
  return {
    values,
    sorted,
    stats: {
      n: sorted.length,
      nMissing,
      nSuppressed,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: mean(sorted),
      median: median(sorted),
      sd: stdev(sorted),
      p10: quantileSorted(sorted, 0.1),
      p90: quantileSorted(sorted, 0.9),
    },
  };
}

const UNIT_MULT: Record<string, number> = {
  per_1000: 1000,
  per_10k: 10000,
  per_100k: 100000,
  percent: 100,
};

export async function buildDataset(signal?: AbortSignal): Promise<Dataset> {
  const [province, municipality] = await Promise.all([
    loadGeoLayer('province', signal),
    loadGeoLayer('municipality', signal),
  ]);

  const engine = new SyntheticEngine(municipality.units);
  const facilities = buildFacilities(municipality, engine, LATEST_PERIOD);

  // ── Derived spatial metrics, computed once from geometry + the register ──
  const nearestAnyKm = new Map<PCode, number>();
  const nearestInpatientKm = new Map<PCode, number>();
  for (const u of municipality.units) {
    nearestAnyKm.set(u.pcode, nearestFacilityKm(facilities.grid, u.lon, u.lat, haversineKm).km);
    nearestInpatientKm.set(
      u.pcode,
      nearestFacilityKm(facilities.inpatientGrid, u.lon, u.lat, haversineKm).km,
    );
  }

  const surfaceCache = new Map<string, IndicatorSurface>();

  const municipalObs = (ind: Indicator, period: number): Map<PCode, Observation> => {
    // Derived indicators bypass the generator entirely.
    if (ind.id === 'dem_population' || ind.id === 'dem_pop_density') {
      const out = new Map<PCode, Observation>();
      for (const u of municipality.units) {
        const pop = engine.denominator(u.pcode, 'population', period);
        const value = ind.id === 'dem_population' ? pop : u.areaSqKm > 0 ? pop / u.areaSqKm : null;
        out.set(u.pcode, {
          indicatorId: ind.id,
          pcode: u.pcode,
          period,
          value: value != null && Number.isFinite(value) ? value : null,
          numerator: Math.round(pop),
          denominator: ind.id === 'dem_pop_density' ? u.areaSqKm : null,
          missing: value == null ? 'no_denominator' : null,
          rse: null,
        });
      }
      return out;
    }

    if (ind.id === 'wf_facilities_per_10k') {
      const out = new Map<PCode, Observation>();
      for (const u of municipality.units) {
        const count = facilities.byPcode.get(u.pcode)?.length ?? 0;
        const pop = engine.denominator(u.pcode, 'population', period);
        out.set(u.pcode, {
          indicatorId: ind.id,
          pcode: u.pcode,
          period,
          value: pop > 0 ? (count / pop) * 10000 : null,
          numerator: count,
          denominator: pop,
          missing: pop > 0 ? null : 'no_denominator',
          rse: null,
        });
      }
      return out;
    }

    if (ind.id === 'acc_nearest_facility_km' || ind.id === 'acc_nearest_inpatient_km') {
      const src = ind.id === 'acc_nearest_facility_km' ? nearestAnyKm : nearestInpatientKm;
      const out = new Map<PCode, Observation>();
      for (const u of municipality.units) {
        const km = src.get(u.pcode);
        out.set(u.pcode, {
          indicatorId: ind.id,
          pcode: u.pcode,
          period,
          value: km != null && Number.isFinite(km) ? km : null,
          numerator: null,
          denominator: null,
          missing: km != null && Number.isFinite(km) ? null : 'not_reported',
          rse: null,
        });
      }
      return out;
    }

    return engine.municipalSeries(ind).get(period) ?? new Map();
  };

  /**
   * Province values are genuine aggregates of their municipalities, so the two
   * levels reconcile. Count-based measures pool numerators and denominators;
   * everything else is a population-weighted mean, which is the only sensible
   * way to roll up a rate that has no underlying count.
   */
  const aggregateToProvince = (
    ind: Indicator,
    period: number,
    munObs: Map<PCode, Observation>,
  ): Map<PCode, Observation> => {
    const out = new Map<PCode, Observation>();
    const mult = UNIT_MULT[ind.unit] ?? 1;

    for (const prov of province.units) {
      const children = engine.municipalitiesInProvince(prov.pcode);
      if (!children.length) {
        out.set(prov.pcode, {
          indicatorId: ind.id,
          pcode: prov.pcode,
          period,
          value: null,
          numerator: null,
          denominator: null,
          missing: 'not_reported',
          rse: null,
        });
        continue;
      }

      let num = 0;
      let den = 0;
      let wSum = 0;
      let wValue = 0;
      let contributing = 0;
      let haveCounts = false;

      for (const child of children) {
        const obs = munObs.get(child.pcode);
        if (!obs) continue;
        const pop = engine.denominator(child.pcode, 'population', period);

        if (obs.numerator != null && obs.denominator != null && obs.denominator > 0) {
          num += obs.numerator;
          den += obs.denominator;
          haveCounts = true;
          contributing++;
        } else if (obs.value != null && Number.isFinite(obs.value)) {
          wValue += obs.value * pop;
          wSum += pop;
          contributing++;
        }
      }

      let value: number | null = null;
      let numerator: number | null = null;
      let denominator: number | null = null;

      if (haveCounts && den > 0) {
        numerator = num;
        denominator = den;
        value = ind.valueType === 'count' ? num : (num / den) * mult;
      } else if (wSum > 0) {
        value = wValue / wSum;
      }

      // Special cases where pooling numerators is meaningless.
      if (ind.id === 'dem_population') {
        // A population count rolls up by addition, never by averaging.
        let pop = 0;
        for (const child of children) pop += engine.denominator(child.pcode, 'population', period);
        value = pop;
        numerator = Math.round(pop);
        denominator = null;
      } else if (ind.id === 'dem_pop_density') {
        let pop = 0;
        let area = 0;
        for (const child of children) {
          pop += engine.denominator(child.pcode, 'population', period);
          area += child.areaSqKm;
        }
        value = area > 0 ? pop / area : null;
        numerator = Math.round(pop);
        denominator = area;
      } else if (ind.id === 'acc_nearest_facility_km' || ind.id === 'acc_nearest_inpatient_km') {
        let w = 0;
        let acc = 0;
        for (const child of children) {
          const obs = munObs.get(child.pcode);
          if (!obs || obs.value == null) continue;
          const pop = engine.denominator(child.pcode, 'population', period);
          acc += obs.value * pop;
          w += pop;
        }
        value = w > 0 ? acc / w : null;
        numerator = null;
        denominator = null;
      }

      out.set(prov.pcode, {
        indicatorId: ind.id,
        pcode: prov.pcode,
        period,
        value: value != null && Number.isFinite(value) ? value : null,
        numerator,
        denominator,
        missing: value == null ? 'not_reported' : null,
        rse: numerator != null && numerator > 0 ? 1 / Math.sqrt(numerator) : null,
      });
      void contributing;
    }
    return out;
  };

  const surface = (indicatorId: string, level: GeoLevel, period: number): IndicatorSurface => {
    const key = `${indicatorId}|${level}|${period}`;
    const hit = surfaceCache.get(key);
    if (hit) return hit;

    const ind = INDICATOR_BY_ID[indicatorId];
    if (!ind) throw new Error(`Unknown indicator "${indicatorId}"`);

    const munObs = municipalObs(ind, period);
    const byPcode = level === 'municipality' ? munObs : aggregateToProvince(ind, period, munObs);
    const { values, sorted, stats } = summarise(byPcode);

    const built: IndicatorSurface = { indicator: ind, level, period, byPcode, values, sorted, stats };
    surfaceCache.set(key, built);
    return built;
  };

  return {
    province,
    municipality,
    engine,
    facilities,
    periods: PERIODS,
    latestPeriod: LATEST_PERIOD,
    layer: (level) => (level === 'province' ? province : municipality),
    units: (level) => (level === 'province' ? province.units : municipality.units),
    surface,
    series: (indicatorId, level, pcode) =>
      PERIODS.map((period) => ({
        period,
        value: surface(indicatorId, level, period).byPcode.get(pcode)?.value ?? null,
      })),
    facilityCount: (pcode, level) => {
      if (level === 'municipality') return facilities.byPcode.get(pcode)?.length ?? 0;
      let total = 0;
      for (const child of engine.municipalitiesInProvince(pcode)) {
        total += facilities.byPcode.get(child.pcode)?.length ?? 0;
      }
      return total;
    },
  };
}
