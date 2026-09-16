import type { ClassMethod, GeoLevel, PCode } from './types';

export type ViewId = 'explore' | 'compare' | 'screen' | 'access';

export interface Criterion {
  id: string;
  indicatorId: string;
  op: 'gte' | 'lte';
  /** Threshold on the indicator's own scale. */
  threshold: number;
}

export interface SpatialState {
  view: ViewId;
  level: GeoLevel;
  period: number;

  indicatorId: string;
  compareXId: string;
  compareYId: string;
  accessMetricId: string;

  classMethod: ClassMethod;
  classCount: number;

  regionPcode: string | null;
  provincePcode: string | null;

  showFacilities: boolean;
  facilityTypes: string[];
  showPopulation: boolean;
  basemap: boolean;

  criteria: Criterion[];
  selectedPcode: PCode | null;
}

export const VIEWS: Array<{ id: ViewId; label: string; question: string }> = [
  {
    id: 'explore',
    label: 'Explore',
    question: 'How does one indicator vary across the country, and which areas stand out?',
  },
  {
    id: 'compare',
    label: 'Compare',
    question: 'Where do two problems land in the same place?',
  },
  {
    id: 'screen',
    label: 'Screen',
    question: 'Which areas cross thresholds I set myself?',
  },
  {
    id: 'access',
    label: 'Access',
    question: 'Which populations are physically far from care?',
  },
];

export const INITIAL_STATE: SpatialState = {
  view: 'explore',
  level: 'province',
  period: 2025,

  indicatorId: 'util_outpatient_rate',
  compareXId: 'ncd_screening_coverage',
  compareYId: 'ncd_hypertension_prev',
  accessMetricId: 'acc_nearest_inpatient_km',

  classMethod: 'quantile',
  classCount: 5,

  regionPcode: null,
  provincePcode: null,

  showFacilities: false,
  facilityTypes: ['infirmary', 'district_hospital', 'provincial_hospital'],
  showPopulation: false,
  basemap: false,

  criteria: [
    { id: 'c1', indicatorId: 'imm_zero_dose', op: 'gte', threshold: 7 },
    { id: 'c2', indicatorId: 'mch_facility_birth', op: 'lte', threshold: 80 },
    { id: 'c3', indicatorId: 'acc_nearest_inpatient_km', op: 'gte', threshold: 12 },
  ],
  selectedPcode: null,
};
