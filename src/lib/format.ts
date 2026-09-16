import type { Indicator, Unit } from '../types';

const UNIT_SUFFIX: Record<Unit, string> = {
  per_1000: ' per 1,000',
  per_10k: ' per 10,000',
  per_100k: ' per 100,000',
  percent: '%',
  count: '',
  ratio: '',
  index: '',
  per_sqkm: '/km²',
  km: ' km',
  years: ' yrs',
};

/** Compact unit label for legends and axes, where space is tight. */
export const UNIT_SHORT: Record<Unit, string> = {
  per_1000: '/1k',
  per_10k: '/10k',
  per_100k: '/100k',
  percent: '%',
  count: '',
  ratio: '',
  index: '',
  per_sqkm: '/km²',
  km: 'km',
  years: 'yrs',
};

export function formatNumber(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Full value with its unit, e.g. "84.2%" or "1,450 per 1,000". */
export function formatValue(value: number | null | undefined, ind: Indicator): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return formatNumber(value, ind.decimals) + UNIT_SUFFIX[ind.unit];
}

/** Value without the unit — for axis ticks and legend stops. */
export function formatBare(value: number | null | undefined, ind: Indicator): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  // Legends get unreadable fast with six-figure numbers at full precision.
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (abs >= 10_000) return Math.round(value / 1000) + 'k';
  const d = abs >= 100 ? Math.min(ind.decimals, 0) : ind.decimals;
  return formatNumber(value, d);
}

export function formatCount(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return Math.round(value).toLocaleString('en-PH');
}

export function formatSigned(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return '—';
  const s = formatNumber(Math.abs(value), decimals);
  if (value > 0) return '+' + s;
  if (value < 0) return '−' + s;
  return s;
}

/** Ordinal suffix for ranks: 1st, 2nd, 23rd. */
export function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return n + 'st';
  if (j === 2 && k !== 12) return n + 'nd';
  if (j === 3 && k !== 13) return n + 'rd';
  return n + 'th';
}

/**
 * Region names in the source data are long ("Region VII (Central Visayas)").
 * Keep the roman numeral where there is one, otherwise the acronym.
 */
export function shortRegionName(name: string): string {
  const paren = name.match(/\(([^)]+)\)/);
  const head = name.replace(/\s*\([^)]*\)\s*/, '').trim();
  if (paren && head) return `${head} · ${paren[1]}`;
  return name;
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
