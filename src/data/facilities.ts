import type { Facility, FacilityType, GeoUnit, PCode } from '../types';
import type { GeoLayer } from './geo';
import { pointInFeature, bboxOfFeature } from './geo';
import { hashString, mulberry32, SYNTHETIC_SEED, type SyntheticEngine } from './synth';
import { CATEGORICAL } from '../lib/color';

/**
 * Synthetic facility register.
 *
 * Positions are drawn by rejection sampling inside each LGU's real polygon, so
 * every point genuinely falls within the municipality it is attributed to and
 * island geography is respected. The facilities themselves — names, types,
 * counts — are invented.
 */

export const FACILITY_TYPES: FacilityType[] = [
  { id: 'bhs', label: 'Barangay health station', inpatient: false, color: CATEGORICAL[4] },
  { id: 'rhu', label: 'Rural health unit / city health centre', inpatient: false, color: CATEGORICAL[2] },
  { id: 'birthing', label: 'Birthing home', inpatient: false, color: CATEGORICAL[3] },
  { id: 'private_clinic', label: 'Private clinic', inpatient: false, color: CATEGORICAL[6] },
  { id: 'infirmary', label: 'Infirmary', inpatient: true, color: CATEGORICAL[1] },
  { id: 'district_hospital', label: 'District hospital', inpatient: true, color: CATEGORICAL[5] },
  { id: 'provincial_hospital', label: 'Provincial / city hospital', inpatient: true, color: CATEGORICAL[0] },
];

export const FACILITY_TYPE_BY_ID: Record<string, FacilityType> = Object.fromEntries(
  FACILITY_TYPES.map((t) => [t.id, t]),
);

export interface FacilityIndex {
  all: Facility[];
  byPcode: Map<PCode, Facility[]>;
  /** Spatial bucket index, 0.5° cells, for nearest-facility queries. */
  grid: Map<string, Facility[]>;
  inpatientGrid: Map<string, Facility[]>;
}

const CELL = 0.5;
const cellKey = (lon: number, lat: number) =>
  `${Math.floor(lon / CELL)}:${Math.floor(lat / CELL)}`;

function addToGrid(grid: Map<string, Facility[]>, f: Facility) {
  const k = cellKey(f.lon, f.lat);
  const list = grid.get(k);
  if (list) list.push(f);
  else grid.set(k, [f]);
}

/** Draw a point inside the unit's polygon, falling back to its centroid. */
function samplePointInUnit(
  layer: GeoLayer,
  unit: GeoUnit,
  rand: () => number,
): [number, number] {
  const idx = layer.idxByPcode.get(unit.pcode);
  const feat = idx != null ? layer.geojson.features[idx] : undefined;
  if (feat) {
    const [minX, minY, maxX, maxY] = bboxOfFeature(feat.geometry);
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = minX + rand() * (maxX - minX);
      const y = minY + rand() * (maxY - minY);
      if (pointInFeature(x, y, feat.geometry)) return [x, y];
    }
  }
  // Very thin or fragmented polygons can defeat rejection sampling; the
  // published centroid is the honest fallback.
  return [unit.lon, unit.lat];
}

function facilityCounts(pop: number, capacity: number, urbanicity: number, rand: () => number) {
  const jitter = () => 0.75 + rand() * 0.5;
  const bhs = Math.min(14, Math.max(1, Math.round((pop / 8500) * jitter())));
  const rhu = Math.max(1, Math.round((pop / 32000) * jitter()));
  const birthing = Math.round((pop / 55000) * jitter() * (0.5 + capacity));
  const privateClinic = Math.round((pop / 38000) * jitter() * (0.3 + urbanicity * 1.6));
  const infirmary = rand() < 0.18 + capacity * 0.3 ? 1 : 0;
  const district = rand() < 0.1 + capacity * 0.28 ? 1 : 0;
  return { bhs, rhu, birthing, private_clinic: privateClinic, infirmary, district_hospital: district };
}

export function buildFacilities(
  munLayer: GeoLayer,
  engine: SyntheticEngine,
  period: number,
): FacilityIndex {
  const all: Facility[] = [];
  const byPcode = new Map<PCode, Facility[]>();
  const grid = new Map<string, Facility[]>();
  const inpatientGrid = new Map<string, Facility[]>();

  // One provincial/city hospital per province, in its highest-capacity LGU.
  const bestByProvince = new Map<string, { unit: GeoUnit; score: number }>();

  for (const unit of munLayer.units) {
    const profile = engine.profiles.get(unit.pcode);
    if (!profile) continue;
    const pop = profile.population[period] ?? 0;
    const { serviceCapacity, urbanicity } = profile.latents;
    const rand = mulberry32(hashString('fac|' + unit.pcode, SYNTHETIC_SEED));

    const counts = facilityCounts(pop, serviceCapacity, urbanicity, rand);
    const list: Facility[] = [];
    let n = 0;

    for (const [typeId, count] of Object.entries(counts)) {
      for (let i = 0; i < (count as number); i++) {
        const [lon, lat] = samplePointInUnit(munLayer, unit, rand);
        const type = FACILITY_TYPE_BY_ID[typeId];
        const f: Facility = {
          id: `${unit.pcode}-${typeId}-${i}`,
          name: `${unit.name} ${type.label}${(count as number) > 1 ? ` ${i + 1}` : ''}`,
          typeId,
          pcode: unit.pcode,
          lat,
          lon,
        };
        list.push(f);
        all.push(f);
        addToGrid(grid, f);
        if (type.inpatient) addToGrid(inpatientGrid, f);
        n++;
      }
    }
    byPcode.set(unit.pcode, list);

    if (unit.provincePcode) {
      const score = serviceCapacity * 0.6 + Math.log10(Math.max(1, pop)) * 0.15;
      const cur = bestByProvince.get(unit.provincePcode);
      if (!cur || score > cur.score) bestByProvince.set(unit.provincePcode, { unit, score });
    }
    void n;
  }

  for (const [provincePcode, { unit }] of bestByProvince) {
    const rand = mulberry32(hashString('provhosp|' + provincePcode, SYNTHETIC_SEED));
    const [lon, lat] = samplePointInUnit(munLayer, unit, rand);
    const f: Facility = {
      id: `${provincePcode}-provincial_hospital`,
      name: `${unit.name} Provincial / City Hospital`,
      typeId: 'provincial_hospital',
      pcode: unit.pcode,
      lat,
      lon,
    };
    all.push(f);
    byPcode.get(unit.pcode)?.push(f);
    addToGrid(grid, f);
    addToGrid(inpatientGrid, f);
  }

  return { all, byPcode, grid, inpatientGrid };
}

/**
 * Nearest facility to a point, searching outward through grid rings. Returns
 * great-circle distance in km — explicitly not travel time.
 */
export function nearestFacilityKm(
  grid: Map<string, Facility[]>,
  lon: number,
  lat: number,
  haversine: (a: number, b: number, c: number, d: number) => number,
): { facility: Facility | null; km: number } {
  const cx = Math.floor(lon / CELL);
  const cy = Math.floor(lat / CELL);
  let best: Facility | null = null;
  let bestKm = Infinity;

  // Expand ring by ring, then scan one ring beyond the first hit: a facility
  // just across a cell boundary can be nearer than one found in the inner ring.
  let firstHitRing = -1;

  for (let ring = 0; ring <= 60; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        // Only the perimeter of the ring is new.
        if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const list = grid.get(`${cx + dx}:${cy + dy}`);
        if (!list) continue;
        for (const f of list) {
          const km = haversine(lat, lon, f.lat, f.lon);
          if (km < bestKm) {
            bestKm = km;
            best = f;
          }
        }
      }
    }
    if (best && firstHitRing < 0) firstHitRing = ring;
    if (firstHitRing >= 0 && ring >= firstHitRing + 1) break;
  }

  return { facility: best, km: best ? bestKm : NaN };
}
