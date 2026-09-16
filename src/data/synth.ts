import type {
  DenominatorId,
  GeoUnit,
  Indicator,
  LatentId,
  Observation,
  PCode,
  Unit,
} from '../types';
import { DEFAULT_MIN_NUMERATOR } from './indicators';
import { poissonRse } from '../lib/stats';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  SYNTHETIC DATA ENGINE — every health number in this build comes from here.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Nothing in this file is real. It is not a model of Philippine health, it is
 * not derived from any survey or registry, and no value should ever be quoted.
 * Boundaries, land area and centroids are the only real inputs, and they come
 * from the published administrative boundary file.
 *
 * The generator is deliberately *not* uniform noise. Random values per LGU
 * would produce a map that looks like television static, which would make the
 * interface impossible to evaluate. Instead values are driven by smooth spatial
 * fields plus per-LGU idiosyncrasy, which reproduces the three properties that
 * actually stress a spatial health tool:
 *
 *   1. Spatial autocorrelation — neighbouring LGUs resemble each other, so
 *      "clusters" and "neighbour gaps" mean something.
 *   2. Correlated indicators — a shared latent structure, so the bivariate map
 *      and the scatter show real association rather than a shapeless blob.
 *   3. Small-number instability — count-based rates are drawn from Poisson and
 *      binomial distributions over the actual denominator, so tiny LGUs really
 *      do produce wild rates. That is what lets suppression and reliability
 *      flagging be demonstrated honestly instead of mocked up.
 *
 * Values are generated at municipality level only. Province figures are true
 * aggregates of their municipalities, so drilling down always reconciles.
 */

export const SYNTHETIC_SEED = 20260916;
export const PERIODS = [2021, 2022, 2023, 2024, 2025];
export const LATEST_PERIOD = PERIODS[PERIODS.length - 1];

// ───────────────────────────────── PRNG ─────────────────────────────────

/** Deterministic 32-bit hash, so a given p-code always yields the same draw. */
function hashString(str: string, seed = 0): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough for demo data. */
function mulberry32(a: number): () => number {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller standard normal. */
function normalFrom(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ─────────────────────────── Spatial noise fields ───────────────────────────

const PH_MIN_LON = 116.0;
const PH_MAX_LON = 127.4;
const PH_MIN_LAT = 4.2;
const PH_MAX_LAT = 21.6;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Value noise over the archipelago. Several octaves of a seeded lattice with
 * smoothstep interpolation, normalised to roughly 0..1. This is what gives the
 * map coherent regional structure rather than per-LGU confetti.
 */
function makeField(seed: number, octaves = 3): (lon: number, lat: number) => number {
  const layers: Array<{ res: number; grid: Float64Array; amp: number }> = [];
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const res = 3 * 2 ** o;
    const rand = mulberry32(seed + o * 7919);
    const grid = new Float64Array((res + 1) * (res + 1));
    for (let i = 0; i < grid.length; i++) grid[i] = rand();
    layers.push({ res, grid, amp });
    total += amp;
    amp *= 0.5;
  }

  return (lon: number, lat: number): number => {
    const nx = Math.min(1, Math.max(0, (lon - PH_MIN_LON) / (PH_MAX_LON - PH_MIN_LON)));
    const ny = Math.min(1, Math.max(0, (lat - PH_MIN_LAT) / (PH_MAX_LAT - PH_MIN_LAT)));
    let sum = 0;
    for (const { res, grid, amp: a } of layers) {
      const fx = nx * res;
      const fy = ny * res;
      const x0 = Math.min(res - 1, Math.floor(fx));
      const y0 = Math.min(res - 1, Math.floor(fy));
      const tx = smoothstep(fx - x0);
      const ty = smoothstep(fy - y0);
      const at = (ix: number, iy: number) => grid[iy * (res + 1) + ix];
      const v00 = at(x0, y0);
      const v10 = at(x0 + 1, y0);
      const v01 = at(x0, y0 + 1);
      const v11 = at(x0 + 1, y0 + 1);
      const top = v00 + (v10 - v00) * tx;
      const bot = v01 + (v11 - v01) * tx;
      sum += (top + (bot - top) * ty) * a;
    }
    return sum / total;
  };
}

// ─────────────────────────── Distribution samplers ───────────────────────────

/** Poisson draw. Knuth for small means, normal approximation above 30. */
function poisson(lambda: number, rand: () => number): number {
  if (!(lambda > 0)) return 0;
  if (lambda > 30) {
    const v = Math.round(lambda + Math.sqrt(lambda) * normalFrom(rand));
    return Math.max(0, v);
  }
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L && k < 1000);
  return k - 1;
}

/** Binomial draw. Normal approximation when both tails are fat enough. */
function binomial(n: number, p: number, rand: () => number): number {
  const nn = Math.max(0, Math.round(n));
  if (nn === 0) return 0;
  const pp = Math.min(1, Math.max(0, p));
  if (nn * pp > 12 && nn * (1 - pp) > 12) {
    const v = Math.round(nn * pp + Math.sqrt(nn * pp * (1 - pp)) * normalFrom(rand));
    return Math.min(nn, Math.max(0, v));
  }
  if (nn > 4000) {
    // Avoid an O(n) loop on huge denominators; the approximation is fine here.
    const v = Math.round(nn * pp + Math.sqrt(nn * pp * (1 - pp)) * normalFrom(rand));
    return Math.min(nn, Math.max(0, v));
  }
  let k = 0;
  for (let i = 0; i < nn; i++) if (rand() < pp) k++;
  return k;
}

const logit = (p: number) => Math.log(p / (1 - p));
const invLogit = (x: number) => 1 / (1 + Math.exp(-x));

// ─────────────────────────────── Unit profile ───────────────────────────────

export interface UnitProfile {
  pcode: PCode;
  latents: Record<LatentId, number>;
  /** Population by period. */
  population: Record<number, number>;
  under5Share: number;
  over60Share: number;
  women1549Share: number;
  adultShare: number;
  householdSize: number;
  crudeBirthRate: number;
}

const UNIT_MULTIPLIER: Partial<Record<Unit, number>> = {
  per_1000: 1000,
  per_10k: 10000,
  per_100k: 100000,
  percent: 100,
};

export class SyntheticEngine {
  readonly profiles = new Map<PCode, UnitProfile>();
  private readonly cache = new Map<string, Map<number, Map<PCode, Observation>>>();
  private readonly munUnits: GeoUnit[];
  private readonly munByProvince = new Map<string, GeoUnit[]>();

  constructor(municipalities: GeoUnit[]) {
    this.munUnits = municipalities;

    const fUrban = makeField(SYNTHETIC_SEED + 11, 4);
    const fDeprive = makeField(SYNTHETIC_SEED + 23, 3);
    const fCapacity = makeField(SYNTHETIC_SEED + 37, 3);
    const fSeeking = makeField(SYNTHETIC_SEED + 53, 3);

    for (const u of municipalities) {
      const rand = mulberry32(hashString(u.pcode, SYNTHETIC_SEED));
      const jitter = (scale: number) => (rand() - 0.5) * scale;

      const urbanicity = clamp01(fUrban(u.lon, u.lat) + jitter(0.28));
      const deprivation = clamp01(fDeprive(u.lon, u.lat) * 0.8 + (1 - urbanicity) * 0.25 + jitter(0.24));
      const serviceCapacity = clamp01(
        fCapacity(u.lon, u.lat) * 0.55 + urbanicity * 0.35 + (1 - deprivation) * 0.2 + jitter(0.22),
      );
      // Remoteness leans on real geography: small land area far from the field's
      // urban cores tends to be an island or an upland municipality.
      const areaTerm = 1 - Math.min(1, Math.log10(Math.max(1, u.areaSqKm)) / 3.2);
      const remoteness = clamp01((1 - urbanicity) * 0.65 + areaTerm * 0.2 + jitter(0.3));
      const healthSeeking = clamp01(
        fSeeking(u.lon, u.lat) * 0.5 + (1 - deprivation) * 0.3 + serviceCapacity * 0.2 + jitter(0.24),
      );

      const latents: Record<LatentId, number> = {
        urbanicity,
        remoteness,
        deprivation,
        serviceCapacity,
        healthSeeking,
      };

      // Log-normal population, pushed up by urbanicity and by land area.
      const areaBoost = Math.log10(Math.max(1, u.areaSqKm)) * 0.28;
      const lnPop = 9.55 + 0.85 * normalFrom(rand) + 2.15 * (urbanicity - 0.5) + areaBoost;
      const basePop = Math.max(1200, Math.round(Math.exp(lnPop)));
      const growth = 0.008 + 0.018 * urbanicity + (rand() - 0.5) * 0.008;

      const population: Record<number, number> = {};
      PERIODS.forEach((year, i) => {
        population[year] = Math.round(basePop * (1 + growth) ** (i - (PERIODS.length - 1)));
      });

      this.profiles.set(u.pcode, {
        pcode: u.pcode,
        latents,
        population,
        under5Share: 0.102 + 0.022 * (deprivation - 0.5) - 0.012 * (urbanicity - 0.5),
        over60Share: 0.091 + 0.028 * (remoteness - 0.5) - 0.015 * (deprivation - 0.5),
        women1549Share: 0.252 + 0.02 * (urbanicity - 0.5),
        adultShare: 0.69 - 0.05 * (deprivation - 0.5),
        householdSize: 4.1 + 0.9 * (deprivation - 0.5) - 0.4 * (urbanicity - 0.5),
        crudeBirthRate: 0.0186 + 0.006 * (deprivation - 0.5) - 0.002 * (urbanicity - 0.5),
      });

      if (u.provincePcode) {
        const list = this.munByProvince.get(u.provincePcode);
        if (list) list.push(u);
        else this.munByProvince.set(u.provincePcode, [u]);
      }
    }
  }

  municipalitiesInProvince(provincePcode: string): GeoUnit[] {
    return this.munByProvince.get(provincePcode) ?? [];
  }

  denominator(pcode: PCode, id: DenominatorId, period: number): number {
    const p = this.profiles.get(pcode);
    if (!p) return NaN;
    const pop = p.population[period] ?? p.population[LATEST_PERIOD];
    switch (id) {
      case 'population':
        return pop;
      case 'children_under_5':
        return pop * p.under5Share;
      case 'women_15_49':
        return pop * p.women1549Share;
      case 'pop_15_plus':
        return pop * p.adultShare;
      case 'pop_60_plus':
        return pop * p.over60Share;
      case 'households':
        return pop / p.householdSize;
      case 'live_births':
        return pop * p.crudeBirthRate;
      default:
        return pop;
    }
  }

  /**
   * Municipality-level observations for one indicator across all periods.
   * Memoised: each indicator costs one pass over 1,642 units x 5 periods.
   */
  municipalSeries(ind: Indicator): Map<number, Map<PCode, Observation>> {
    const hit = this.cache.get(ind.id);
    if (hit) return hit;

    const byPeriod = new Map<number, Map<PCode, Observation>>();
    for (const period of PERIODS) byPeriod.set(period, new Map());

    const mult = UNIT_MULTIPLIER[ind.unit] ?? 1;
    const minN = ind.minNumerator ?? DEFAULT_MIN_NUMERATOR;
    const exposureId: DenominatorId = ind.gen.exposure ?? ind.denominator ?? 'population';
    const exposureScale = ind.gen.exposureScale ?? 1;

    for (const u of this.munUnits) {
      const profile = this.profiles.get(u.pcode);
      if (!profile) continue;

      const rand = mulberry32(hashString(ind.id + '|' + u.pcode, SYNTHETIC_SEED));

      // Latent pressure on this indicator, roughly -1..+1.
      let z = 0;
      for (const [k, w] of Object.entries(ind.gen.loads)) {
        z += (w as number) * (profile.latents[k as LatentId] - 0.5) * 2;
      }
      // Signal-to-noise matters: if per-unit idiosyncrasy swamps the shared
      // latent structure, indicators stop co-varying and the two-indicator view
      // degenerates into a shapeless cloud. These weights keep total dispersion
      // roughly where the `spread` parameter intends while leaving the latent
      // fields dominant, so association between related indicators survives.
      const idio = normalFrom(rand) * 0.3;
      const drive = ind.gen.spread * (z * 0.95 + idio);

      // Some units simply never filed a report.
      const neverReports = ind.gen.missingRate ? rand() < ind.gen.missingRate : false;

      PERIODS.forEach((period, ti) => {
        const map = byPeriod.get(period)!;
        const tOffset = ti - (PERIODS.length - 1);
        const periodRand = mulberry32(hashString(ind.id + '|' + u.pcode + '|' + period, SYNTHETIC_SEED));

        if (neverReports) {
          map.set(u.pcode, {
            indicatorId: ind.id,
            pcode: u.pcode,
            period,
            value: null,
            numerator: null,
            denominator: null,
            missing: 'not_reported',
            rse: null,
          });
          return;
        }

        const trendFactor = (1 + ind.gen.trend) ** tOffset;
        const wobble = 1 + (periodRand() - 0.5) * 0.06;

        const exposure = this.denominator(u.pcode, exposureId, period) * exposureScale;
        const displayDenom = ind.denominator
          ? this.denominator(u.pcode, ind.denominator, period)
          : exposure;

        let value: number | null = null;
        let numerator: number | null = null;
        let rse: number | null = null;

        if (ind.valueType === 'proportion') {
          const p0 = Math.min(0.995, Math.max(0.002, ind.gen.base / 100));
          let p = invLogit(logit(p0) + drive + Math.log(trendFactor) * 3.2);
          p = Math.min(0.999, Math.max(0.0005, p * wobble));
          if (ind.gen.countBased) {
            const n = Math.max(0, Math.round(exposure));
            numerator = binomial(n, p, periodRand);
            value = n > 0 ? (numerator / n) * 100 : null;
            rse = numerator > 0 && n > 0 ? Math.sqrt((p * (1 - p)) / n) / p : null;
          } else {
            value = p * 100;
          }
        } else if (ind.valueType === 'count') {
          const perUnit = ind.gen.base * Math.exp(drive) * trendFactor * wobble;
          const lambda = perUnit * exposure;
          numerator = poisson(lambda, periodRand);
          value = numerator;
          rse = poissonRse(numerator);
        } else {
          // rate, ratio, index, density
          const rate = ind.gen.base * Math.exp(drive) * trendFactor * wobble;
          if (ind.gen.countBased) {
            const lambda = (rate / mult) * exposure;
            numerator = poisson(lambda, periodRand);
            value = displayDenom > 0 ? (numerator / displayDenom) * mult : null;
            rse = poissonRse(numerator);
          } else {
            value = rate;
          }
        }

        // Disclosure control: never publish a cell built on a handful of cases.
        let missing: Observation['missing'] = null;
        if (numerator != null && numerator < minN && ind.gen.countBased) {
          missing = 'suppressed';
          value = null;
        }

        map.set(u.pcode, {
          indicatorId: ind.id,
          pcode: u.pcode,
          period,
          value,
          numerator,
          denominator: Number.isFinite(displayDenom) ? displayDenom : null,
          missing,
          rse,
        });
      });
    }

    this.cache.set(ind.id, byPeriod);
    return byPeriod;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export { hashString, mulberry32, normalFrom, poisson, binomial };
