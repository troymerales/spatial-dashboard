/**
 * Time model.
 *
 * A period is one calendar month, encoded as the integer `YYYYMM` (202503 =
 * March 2025). An integer was chosen over a Date or an ISO string because it is
 * cheap to compare and sort, safe as a `Map` key, and survives round-tripping
 * through a `<select>` or a range input without parsing.
 *
 * Replacing the synthetic layer with real date-level consultation data means
 * bucketing rows by `toPeriod(year, month)` and returning the same `Observation`
 * shape — nothing else in the application needs to know where the months came
 * from. Extending or shortening the timeline is `TIMELINE_START` / `MONTHS`.
 */

export type Period = number;

/** First month of the synthetic timeline. */
const TIMELINE_START = { year: 2024, month: 0 }; // January 2024
/** Two full seasonal cycles: enough to see a pattern repeat rather than one wiggle. */
export const MONTHS = 24;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_ABBR = MONTH_NAMES.map((m) => m.slice(0, 3));

/** year + 0-based month -> YYYYMM */
export function toPeriod(year: number, monthIndex0: number): Period {
  const y = year + Math.floor(monthIndex0 / 12);
  const m = ((monthIndex0 % 12) + 12) % 12;
  return y * 100 + (m + 1);
}

export function periodYear(p: Period): number {
  return Math.floor(p / 100);
}

/** 0-based calendar month (0 = January). */
export function periodMonth(p: Period): number {
  return (p % 100) - 1;
}

/** Months elapsed since the start of the timeline; also the index into PERIODS. */
export function periodOffset(p: Period): number {
  return (periodYear(p) - TIMELINE_START.year) * 12 + (periodMonth(p) - TIMELINE_START.month);
}

export function addMonths(p: Period, n: number): Period {
  return toPeriod(periodYear(p), periodMonth(p) + n);
}

/** "March 2025" */
export function formatPeriod(p: Period): string {
  return `${MONTH_NAMES[periodMonth(p)]} ${periodYear(p)}`;
}

/** "Mar 2025" — for tight spaces like the scrubber and axis ticks. */
export function formatPeriodShort(p: Period): string {
  return `${MONTH_ABBR[periodMonth(p)]} ${periodYear(p)}`;
}

/** "Mar" — for dense tick rows where the year is shown separately. */
export function formatMonthOnly(p: Period): string {
  return MONTH_ABBR[periodMonth(p)];
}

/** The full timeline, ascending. */
export const PERIODS: Period[] = Array.from({ length: MONTHS }, (_, i) =>
  toPeriod(TIMELINE_START.year, TIMELINE_START.month + i),
);

export const FIRST_PERIOD = PERIODS[0];
export const LATEST_PERIOD = PERIODS[PERIODS.length - 1];

/** Index of a period within PERIODS, or -1. */
export function periodIndex(p: Period): number {
  const i = periodOffset(p);
  return i >= 0 && i < PERIODS.length ? i : -1;
}

/**
 * Fraction of a year one period covers. Flow measures (incidence, consultations,
 * births) are defined per year in the indicator catalogue and scaled by this to
 * become per-month quantities; stock measures (coverage, workforce) are not.
 */
export const PERIOD_YEAR_FRACTION = 1 / 12;
