/**
 * Time model.
 *
 * A period is one **week**, encoded as the integer `YYYYMMDD` of its Monday
 * (20250303 = the week beginning 3 March 2025). An integer keyed on the week's
 * start date was chosen over an ISO `YYYYWW` code because week-numbering years
 * do not line up with calendar years — 2026-W01 begins on 29 December 2025 —
 * and a key that sorts wrongly at the year boundary would corrupt the timeline.
 * The ISO week number is still what gets displayed, because that is the
 * vernacular of surveillance reporting.
 *
 * Replacing the synthetic layer with real date-level consultation data means
 * bucketing rows with `toPeriod(date)` and returning the same `Observation`
 * shape — nothing else in the application needs to know where the weeks came
 * from. Changing the granularity (to months, or to days) is this file plus
 * `PERIOD_YEAR_FRACTION`; the generator and the UI are written against those
 * and do not assume weeks.
 */

export type Period = number;

/**
 * 2 January 2023 — a Monday, and ISO week 2023-W01, so the timeline starts on a
 * clean week boundary with no partial week at either end.
 */
const TIMELINE_START_UTC = Date.UTC(2023, 0, 2);

/** Three full years: W01 2023 through W52 2025. */
export const WEEKS = 156;

const MS_PER_DAY = 86_400_000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

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

/** Date -> YYYYMMDD of the Monday that starts its week. */
export function toPeriod(date: Date): Period {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // getUTCDay: 0 = Sunday. Shift so Monday is the first day of the week.
  const dow = (new Date(utc).getUTCDay() + 6) % 7;
  return fromUtc(utc - dow * MS_PER_DAY);
}

function fromUtc(ms: number): Period {
  const d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** YYYYMMDD -> the UTC Date of that week's Monday. */
export function periodDate(p: Period): Date {
  const y = Math.floor(p / 10000);
  const m = Math.floor((p % 10000) / 100) - 1;
  const d = p % 100;
  return new Date(Date.UTC(y, m, d));
}

export function periodYear(p: Period): number {
  return Math.floor(p / 10000);
}

/** 0-based calendar month of the week's Monday. */
export function periodMonth(p: Period): number {
  return Math.floor((p % 10000) / 100) - 1;
}

export function addWeeks(p: Period, n: number): Period {
  return fromUtc(periodDate(p).getTime() + n * MS_PER_WEEK);
}

/** Weeks elapsed since the start of the timeline; also the index into PERIODS. */
export function periodOffset(p: Period): number {
  return Math.round((periodDate(p).getTime() - TIMELINE_START_UTC) / MS_PER_WEEK);
}

/**
 * ISO 8601 week number. Week 1 is the week containing the first Thursday of the
 * year, which is why this shifts to the Thursday before counting.
 */
export function isoWeek(p: Period): { week: number; year: number } {
  const d = periodDate(p);
  // Monday-based; move to that week's Thursday.
  d.setUTCDate(d.getUTCDate() + 3);
  const isoYear = d.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / MS_PER_WEEK);
  return { week, year: isoYear };
}

/** "Week 9 · 26 Feb – 3 Mar 2025" */
export function formatPeriod(p: Period): string {
  const { week } = isoWeek(p);
  const start = periodDate(p);
  const end = new Date(start.getTime() + 6 * MS_PER_DAY);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = sameMonth
    ? `${start.getUTCDate()}`
    : `${start.getUTCDate()} ${MONTH_ABBR[start.getUTCMonth()]}`;
  return `Week ${week} · ${startLabel}–${end.getUTCDate()} ${MONTH_ABBR[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
}

/** "W09 2025" — for tight spaces like axis ticks. */
export function formatPeriodShort(p: Period): string {
  const { week, year } = isoWeek(p);
  return `W${String(week).padStart(2, '0')} ${year}`;
}

/** "3 Mar 2025" — the week-start date on its own. */
export function formatPeriodDate(p: Period): string {
  const d = periodDate(p);
  return `${d.getUTCDate()} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Position within the calendar year, 0..1. Seasonality is expressed against
 * this rather than a month index so the generator does not care whether a
 * period is a week, a month or a day.
 */
export function yearFraction(p: Period): number {
  const d = periodDate(p);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const yearEnd = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
  return (d.getTime() - yearStart) / (yearEnd - yearStart);
}

/** The full timeline, ascending. */
export const PERIODS: Period[] = Array.from({ length: WEEKS }, (_, i) =>
  fromUtc(TIMELINE_START_UTC + i * MS_PER_WEEK),
);

export const FIRST_PERIOD = PERIODS[0];
export const LATEST_PERIOD = PERIODS[PERIODS.length - 1];

/** Index of a period within PERIODS, or -1. */
export function periodIndex(p: Period): number {
  const i = periodOffset(p);
  return i >= 0 && i < PERIODS.length ? i : -1;
}

/**
 * Fraction of a year one period covers. Flow measures (incidence,
 * consultations, births) are defined per year in the indicator catalogue and
 * scaled by this to become per-period quantities; stock measures (coverage,
 * workforce) are not. Uses 365.25/7 weeks per year rather than a flat 52.
 */
export const PERIOD_YEAR_FRACTION = 7 / 365.25;
