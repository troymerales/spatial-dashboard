/**
 * Domain types for the Spatial Health Intelligence page.
 *
 * Design rule: geography and health data are separate all the way down.
 * A `GeoUnit` never carries an indicator value; observations are keyed by
 * (indicatorId, pcode, period) and joined at render time. That is what lets the
 * same map infrastructure serve any number of indicators later without change.
 */

/** Administrative level. Barangay (adm4) is deliberately out of scope for the MVP. */
export type GeoLevel = 'province' | 'municipality';

/** PSGC-derived p-code from the OCHA/PSA common operational dataset, e.g. "PH072217000". */
export type PCode = string;

export interface GeoUnit {
  pcode: PCode;
  name: string;
  level: GeoLevel;
  /** Region p-code and name (present at both levels). */
  regionPcode: string;
  regionName: string;
  /** Parent province — null when the unit *is* a province. */
  provincePcode: string | null;
  provinceName: string | null;
  /** Real geographic area from the boundary source, km². */
  areaSqKm: number;
  /** Representative point from the boundary source. */
  lat: number;
  lon: number;
}

/** Population bases available as denominators. All synthetic in this build. */
export type DenominatorId =
  | 'population'
  | 'women_15_49'
  | 'children_under_5'
  | 'live_births'
  | 'households'
  | 'pop_15_plus'
  | 'pop_60_plus';

export interface DenominatorMeta {
  id: DenominatorId;
  label: string;
  /** Short description of what the base counts. */
  note: string;
}

export type IndicatorCategoryId =
  | 'utilization'
  | 'maternal_child'
  | 'immunization'
  | 'communicable'
  | 'ncd'
  | 'nutrition'
  | 'workforce'
  | 'wash'
  | 'financing'
  | 'demography';

export interface IndicatorCategory {
  id: IndicatorCategoryId;
  label: string;
  blurb: string;
}

/**
 * How a value should be read. This drives formatting, the legend, whether a
 * colour ramp is oriented "high = good" or "high = bad", and whether the value
 * is safe to put on a choropleth at all.
 */
export type ValueType = 'rate' | 'proportion' | 'count' | 'ratio' | 'index' | 'density';

export type Unit =
  | 'per_1000'
  | 'per_10k'
  | 'per_100k'
  | 'percent'
  | 'count'
  | 'ratio'
  | 'index'
  | 'per_sqkm'
  | 'km'
  | 'years';

export type Direction = 'higher_is_better' | 'higher_is_worse' | 'neutral';

/** Latent drivers used only by the synthetic generator (see data/synth.ts). */
export type LatentId =
  | 'urbanicity'
  | 'remoteness'
  | 'deprivation'
  | 'serviceCapacity'
  | 'healthSeeking';

export interface IndicatorGenSpec {
  /** Central value on the indicator's own scale. */
  base: number;
  /** Dispersion. Log-scale for rates/counts, logit-scale for proportions. */
  spread: number;
  /** How strongly each latent field pushes the value up (+) or down (-). */
  loads: Partial<Record<LatentId, number>>;
  /** Proportional drift per period. */
  trend: number;
  /**
   * When true the generator draws an integer numerator from a Poisson draw on
   * (rate x denominator). This is what makes small LGUs genuinely unstable and
   * lets suppression and reliability flags be demonstrated honestly.
   */
  countBased: boolean;
  /** Share of units with no report at all, 0..1. */
  missingRate?: number;
  /**
   * Population base the Poisson/binomial draw is taken over, when it differs
   * from the indicator's display denominator. "Hypertension controlled" is
   * reported as a share of enrolled patients but must be drawn over adults.
   */
  exposure?: DenominatorId;
  /** Multiplier on the exposure, for bases that are a fraction of a population. */
  exposureScale?: number;
}

export interface Indicator {
  id: string;
  name: string;
  /** Compact label for legends and dense lists. */
  short: string;
  category: IndicatorCategoryId;
  valueType: ValueType;
  unit: Unit;
  /** Population base the rate is expressed over; null for counts and indices. */
  denominator: DenominatorId | null;
  direction: Direction;
  /**
   * False for measures that are real but should not be painted onto a
   * choropleth. `mapNote` explains why, and the UI surfaces that instead of
   * silently colouring something misleading.
   */
  mappable: boolean;
  mapNote?: string;
  definition: string;
  /** Decimal places for display. */
  decimals: number;
  /** Numerator below which a cell is suppressed for disclosure control. */
  minNumerator?: number;
  gen: IndicatorGenSpec;
}

/** Why a unit has no usable value. */
export type MissingReason = 'suppressed' | 'not_reported' | 'no_denominator';

export interface Observation {
  indicatorId: string;
  pcode: PCode;
  period: number;
  /** null when withheld or unreported — never coerce this to 0. */
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  missing: MissingReason | null;
  /**
   * Relative standard error of the rate, when it is count-based. Used to flag
   * estimates that are too unstable to act on rather than hiding the problem.
   */
  rse: number | null;
}

export interface FacilityType {
  id: string;
  label: string;
  /** Whether the type offers inpatient/24h capability — used by the access metric. */
  inpatient: boolean;
  color: string;
}

export interface Facility {
  id: string;
  name: string;
  typeId: string;
  pcode: PCode;
  lat: number;
  lon: number;
}

/** Classification scheme for the choropleth. Exposed because breaks change the story. */
export type ClassMethod = 'quantile' | 'equal' | 'jenks' | 'stddev';

export interface ClassBreaks {
  method: ClassMethod;
  /** k-1 interior break values, ascending. */
  breaks: number[];
  /** Domain min/max of the classified values. */
  min: number;
  max: number;
  /** Number of classes actually produced (may be < requested for sparse data). */
  k: number;
}
