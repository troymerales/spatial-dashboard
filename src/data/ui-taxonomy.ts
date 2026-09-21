import type { ClassMethod, GeoLevel } from '../types';

/**
 * Taxonomies for the map controls and the detail pane.
 *
 * These live here rather than inline in the components so the generated
 * documentation reads the same list the UI renders. `ControlRail` and
 * `DetailPanel` import from this file; `scripts/gen-catalogue.mjs` does too.
 */

export const CLASS_METHODS: Array<{ id: ClassMethod; label: string; note: string }> = [
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

/** Selectable class counts for the choropleth. */
export const CLASS_COUNTS = [3, 4, 5, 6, 7];

export const GEO_LEVELS: Array<{ id: GeoLevel; label: string }> = [
  { id: 'province', label: 'Provinces' },
  { id: 'municipality', label: 'Cities & municipalities' },
];

export const OVERLAYS: Array<{ id: string; label: string; hint: string }> = [
  {
    id: 'facilities',
    label: 'Facility locations',
    hint: 'Points, not shading — a facility is a place, not a property of an area.',
  },
  {
    id: 'population',
    label: 'Population as proportional circles',
    hint: 'The honest encoding for a count. Shading a polygon by population maps land area, not people.',
  },
  {
    id: 'basemap',
    label: 'Street basemap',
    hint: 'Off by default: a busy basemap competes with the fill colours. Requires internet.',
  },
];

/**
 * What the right-hand pane reports about a selected area, grouped by the
 * section headings it renders. `DetailPanel` takes its headings from `title`.
 */
export const DETAIL_SECTIONS: Array<{ id: string; title: string; metrics: string[] }> = [
  {
    id: 'headline',
    title: 'Headline',
    metrics: [
      'Area name, parent province and region',
      'Value for the selected indicator and period',
      'Reliability flag (stable / moderate / unstable)',
      'Withheld, no-report or no-denominator explanation when there is no value',
    ],
  },
  {
    id: 'position',
    title: 'Where this sits',
    metrics: [
      'Rank among areas in the current filter',
      'Percentile within the current filter',
      'Difference from the national median',
      'Difference from the parent province median',
      'Difference from contiguous neighbours',
      '95% confidence interval (proportions only)',
    ],
  },
  {
    id: 'trend',
    title: 'Trend',
    metrics: ['Sparkline across all months', 'Percentage change since the first month'],
  },
  {
    id: 'composition',
    title: 'How the number is built',
    metrics: ['Numerator (cases counted)', 'Denominator (population base)'],
  },
  {
    id: 'context',
    title: 'Area context',
    metrics: [
      'Population',
      'Land area',
      'Facility count',
      'Straight-line distance to the nearest inpatient facility',
    ],
  },
  {
    id: 'about',
    title: 'About this indicator',
    metrics: ['Definition', 'Mapping caveat, where one applies'],
  },
];
