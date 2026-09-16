import type { Direction } from '../types';

/**
 * Colour rules for the map.
 *
 * Lightness always encodes magnitude (darker = more of the thing). Hue encodes
 * what "more" *means*, so an officer can read the sign of a map before reading
 * its legend:
 *   - warm red   -> more is worse
 *   - teal/blue  -> more is better
 *   - purple     -> more is neither, just different
 *
 * All ramps are ColorBrewer sequences (Cynthia Brewer, Mark Harrower, Penn
 * State), chosen for colour-vision-deficiency safety and print legibility.
 */

type RampTable = Record<number, string[]>;

const YL_OR_RD: RampTable = {
  3: ['#ffeda0', '#feb24c', '#f03b20'],
  4: ['#ffffb2', '#fecc5c', '#fd8d3c', '#e31a1c'],
  5: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'],
  6: ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#f03b20', '#bd0026'],
  7: ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'],
};

const YL_GN_BU: RampTable = {
  3: ['#edf8b1', '#7fcdbb', '#2c7fb8'],
  4: ['#ffffcc', '#a1dab4', '#41b6c4', '#225ea8'],
  5: ['#ffffcc', '#a1dab4', '#41b6c4', '#2c7fb8', '#253494'],
  6: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#2c7fb8', '#253494'],
  7: ['#ffffcc', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#0c2c84'],
};

const BU_PU: RampTable = {
  3: ['#e0ecf4', '#9ebcda', '#8856a7'],
  4: ['#edf8fb', '#b3cde3', '#8c96c6', '#88419d'],
  5: ['#edf8fb', '#b3cde3', '#8c96c6', '#8856a7', '#810f7c'],
  6: ['#edf8fb', '#bfd3e6', '#9ebcda', '#8c96c6', '#8856a7', '#810f7c'],
  7: ['#edf8fb', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#6e016b'],
};

const RD_BU: RampTable = {
  3: ['#ef8a62', '#f7f7f7', '#67a9cf'],
  5: ['#ca0020', '#f4a582', '#f7f7f7', '#92c5de', '#0571b0'],
  7: ['#b2182b', '#ef8a62', '#fddbc7', '#f7f7f7', '#d1e5f0', '#67a9cf', '#2166ac'],
};

function pick(table: RampTable, k: number): string[] {
  const clamped = Math.max(3, Math.min(7, k));
  const exact = table[clamped];
  if (exact) return exact.slice(0, k);
  const widest = table[7];
  return widest.slice(0, k);
}

export function rampForDirection(direction: Direction, k: number): string[] {
  if (direction === 'higher_is_worse') return pick(YL_OR_RD, k);
  if (direction === 'higher_is_better') return pick(YL_GN_BU, k);
  return pick(BU_PU, k);
}

export function divergingRamp(k: number): string[] {
  if (k <= 3) return RD_BU[3];
  if (k <= 5) return RD_BU[5];
  return RD_BU[7];
}

/**
 * 3x3 bivariate palette (Joshua Stevens' scheme). Index as PALETTE[yClass][xClass],
 * where class 0 is the lowest tercile.
 */
export const BIVARIATE_3X3: string[][] = [
  ['#e8e8e8', '#ace4e4', '#5ac8c8'],
  ['#dfb0d6', '#a5add3', '#5698b9'],
  ['#be64ac', '#8c62aa', '#3b4994'],
];

/** Okabe–Ito categorical palette — distinguishable under all common CVD types. */
export const CATEGORICAL = [
  '#0072B2',
  '#E69F00',
  '#009E73',
  '#CC79A7',
  '#56B4E9',
  '#D55E00',
  '#F0E442',
  '#7F7F7F',
];

/** Fills for units that have no usable value. Never reuse a ramp colour here. */
export const NO_DATA_FILL = '#d8dbe0';
export const SUPPRESSED_FILL = '#c2c6cf';
export const OUT_OF_SCOPE_FILL = '#eceef1';

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Relative luminance per WCAG, used to flip label colour over a fill. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readableTextOn(hex: string): string {
  return luminance(hex) > 0.45 ? '#12161c' : '#ffffff';
}
