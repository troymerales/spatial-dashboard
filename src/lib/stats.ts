import type { ClassBreaks, ClassMethod } from '../types';

/** Ascending numeric sort that tolerates the odd NaN. */
export function sortAsc(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
}

/** Type-7 quantile on an already-sorted array. */
export function quantileSorted(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export function median(values: number[]): number {
  return quantileSorted(sortAsc(values), 0.5);
}

export function mean(values: number[]): number {
  const v = values.filter(Number.isFinite);
  if (!v.length) return NaN;
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
}

export function stdev(values: number[]): number {
  const v = values.filter(Number.isFinite);
  if (v.length < 2) return NaN;
  const m = mean(v);
  let s = 0;
  for (const x of v) s += (x - m) * (x - m);
  return Math.sqrt(s / (v.length - 1));
}

/** Pearson correlation over paired finite values. */
export function pearson(xs: number[], ys: number[]): number {
  const px: number[] = [];
  const py: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      px.push(xs[i]);
      py.push(ys[i]);
    }
  }
  if (px.length < 3) return NaN;
  const mx = mean(px);
  const my = mean(py);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < px.length; i++) {
    const a = px[i] - mx;
    const b = py[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? NaN : num / den;
}

/** Spearman rank correlation — resistant to the skew most health rates carry. */
export function spearman(xs: number[], ys: number[]): number {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < xs.length; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) pairs.push([xs[i], ys[i]]);
  }
  if (pairs.length < 3) return NaN;
  const rank = (vals: number[]): number[] => {
    const idx = vals.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    const out = new Array<number>(vals.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const r = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) out[idx[k][1]] = r;
      i = j + 1;
    }
    return out;
  };
  return pearson(rank(pairs.map((p) => p[0])), rank(pairs.map((p) => p[1])));
}

/**
 * Jenks natural breaks via the standard dynamic-programming formulation.
 * Capped at a sample of 400 values — the optimum is stable well below that and
 * the algorithm is O(n²k), which would otherwise stall on 1,642 municipalities.
 */
function jenksBreaks(sorted: number[], k: number): number[] {
  const MAX = 400;
  let data = sorted;
  if (sorted.length > MAX) {
    data = [];
    const step = (sorted.length - 1) / (MAX - 1);
    for (let i = 0; i < MAX; i++) data.push(sorted[Math.round(i * step)]);
  }
  const n = data.length;
  if (n <= k) return data.slice(1);

  const mat1: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0));
  const mat2: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) {
    mat1[1][j] = 1;
    mat2[1][j] = 0;
  }
  for (let l = 2; l <= n; l++) {
    let s1 = 0;
    let s2 = 0;
    let w = 0;
    for (let m = 1; m <= l; m++) {
      const i3 = l - m + 1;
      const val = data[i3 - 1];
      s2 += val * val;
      s1 += val;
      w += 1;
      const v = s2 - (s1 * s1) / w;
      const i4 = i3 - 1;
      if (i4 !== 0) {
        for (let j = 2; j <= k; j++) {
          if (mat2[l][j] >= v + mat2[i4][j - 1]) {
            mat1[l][j] = i3;
            mat2[l][j] = v + mat2[i4][j - 1];
          }
        }
      }
    }
    mat1[l][1] = 1;
    mat2[l][1] = s2 - (s1 * s1) / w;
  }

  const breaks: number[] = [];
  let kk = n;
  for (let j = k; j >= 2; j--) {
    const id = mat1[kk][j] - 1;
    breaks.unshift(data[id]);
    kk = mat1[kk][j] - 1;
  }
  return breaks;
}

/**
 * Compute class breaks.
 *
 * The method is a first-class control in the UI rather than a hidden constant,
 * because the choice materially changes which LGUs look alarming. Quantile is
 * the default: it guarantees every class is populated, which keeps the map
 * readable, at the cost of exaggerating differences in a tight distribution.
 */
export function computeBreaks(values: number[], k: number, method: ClassMethod): ClassBreaks {
  const sorted = sortAsc(values);
  if (!sorted.length) return { method, breaks: [], min: NaN, max: NaN, k: 0 };

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const uniq = Array.from(new Set(sorted));
  if (uniq.length === 1) return { method, breaks: [], min, max, k: 1 };

  const kk = Math.min(k, uniq.length);
  let breaks: number[] = [];

  if (method === 'quantile') {
    for (let i = 1; i < kk; i++) breaks.push(quantileSorted(sorted, i / kk));
  } else if (method === 'equal') {
    const step = (max - min) / kk;
    for (let i = 1; i < kk; i++) breaks.push(min + step * i);
  } else if (method === 'stddev') {
    const m = mean(sorted);
    const s = stdev(sorted);
    if (!Number.isFinite(s) || s === 0) {
      for (let i = 1; i < kk; i++) breaks.push(quantileSorted(sorted, i / kk));
    } else {
      // Classes at -1.5, -0.5, +0.5, +1.5 SD (trimmed to k-1 interior cuts).
      const offs = [-1.5, -0.5, 0.5, 1.5];
      breaks = offs.slice(0, kk - 1).map((o) => m + o * s);
      breaks = breaks.filter((b) => b > min && b < max);
    }
  } else {
    breaks = jenksBreaks(sorted, kk);
  }

  // Strictly increasing, inside the domain.
  breaks = breaks
    .filter((b) => Number.isFinite(b) && b > min && b < max)
    .sort((a, b) => a - b)
    .filter((b, i, arr) => i === 0 || b > arr[i - 1]);

  return { method, breaks, min, max, k: breaks.length + 1 };
}

/** Index of the class a value falls into, given interior breaks. */
export function classIndex(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

/** Percentile rank of a value within a sorted array, 0..1. */
export function percentileRank(sorted: number[], value: number): number {
  if (!sorted.length) return NaN;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo / (sorted.length - 1 || 1);
}

/**
 * Wilson score interval for a proportion — behaves sensibly at the extremes and
 * with small n, where the normal approximation falls apart.
 */
export function wilsonInterval(successes: number, n: number, z = 1.96): [number, number] {
  if (n <= 0) return [NaN, NaN];
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (centre - half) / d), Math.min(1, (centre + half) / d)];
}

/** Relative standard error of a count-based rate, assuming Poisson variance. */
export function poissonRse(count: number): number {
  if (!count || count <= 0) return NaN;
  return 1 / Math.sqrt(count);
}

/**
 * Reliability banding for a rate. An estimate an LGU cannot act on should look
 * different from one it can, rather than being coloured with equal confidence.
 */
export function reliabilityBand(rse: number | null): 'good' | 'moderate' | 'unstable' | null {
  if (rse == null || !Number.isFinite(rse)) return null;
  if (rse < 0.15) return 'good';
  if (rse < 0.3) return 'moderate';
  return 'unstable';
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Simple histogram over a fixed bin count. */
export function histogram(values: number[], bins: number): { edges: number[]; counts: number[] } {
  const v = sortAsc(values);
  if (!v.length) return { edges: [], counts: [] };
  const min = v[0];
  const max = v[v.length - 1];
  if (min === max) return { edges: [min, max], counts: [v.length] };
  const step = (max - min) / bins;
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) edges.push(min + step * i);
  const counts = new Array<number>(bins).fill(0);
  for (const x of v) {
    let idx = Math.floor((x - min) / step);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }
  return { edges, counts };
}
