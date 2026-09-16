import { feature, neighbors } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import type { GeoLevel, GeoUnit, PCode } from '../types';

/**
 * Boundary loading.
 *
 * Boundaries ship as TopoJSON rather than GeoJSON for two reasons that matter
 * here: shared borders are stored once (a third of the bytes), and — more
 * importantly — adjacency is recoverable exactly, because neighbouring units
 * literally share arc indices. That gives us true contiguity for the
 * "compared with its neighbours" analysis instead of a distance guess.
 */

export interface BoundaryProps {
  pcode: string;
  name: string;
  area_sqkm: number | null;
  lat: number | null;
  lon: number | null;
  adm1_pcode?: string;
  adm1_name?: string;
  adm2_pcode?: string;
  adm2_name?: string;
}

export interface GeoLayer {
  level: GeoLevel;
  /** Rendered directly by MapLibre; `id` is set to a stable numeric index for feature-state. */
  geojson: FeatureCollection<Polygon | MultiPolygon, BoundaryProps & { idx: number }>;
  units: GeoUnit[];
  unitByPcode: Map<PCode, GeoUnit>;
  /** Numeric feature id <-> pcode, needed because feature-state keys must be numeric or string ids. */
  idxByPcode: Map<PCode, number>;
  pcodeByIdx: string[];
  /** Contiguous neighbours, derived from shared TopoJSON arcs. */
  neighborsByPcode: Map<PCode, PCode[]>;
}

const LEVEL_FILE: Record<GeoLevel, { url: string; object: string }> = {
  province: { url: 'geo/ph-provinces.topojson', object: 'provinces' },
  municipality: { url: 'geo/ph-municipalities.topojson', object: 'municipalities' },
};

function toUnit(p: BoundaryProps, level: GeoLevel): GeoUnit {
  const isProvince = level === 'province';
  return {
    pcode: p.pcode,
    name: p.name,
    level,
    regionPcode: p.adm1_pcode ?? '',
    regionName: p.adm1_name ?? '',
    provincePcode: isProvince ? null : p.adm2_pcode ?? null,
    provinceName: isProvince ? null : p.adm2_name ?? null,
    areaSqKm: p.area_sqkm ?? 0,
    lat: p.lat ?? 0,
    lon: p.lon ?? 0,
  };
}

export async function loadGeoLayer(level: GeoLevel, signal?: AbortSignal): Promise<GeoLayer> {
  const { url, object } = LEVEL_FILE[level];
  const res = await fetch(`${import.meta.env.BASE_URL}${url}`, { signal });
  if (!res.ok) {
    throw new Error(`Could not load ${level} boundaries (HTTP ${res.status}).`);
  }
  const topo = (await res.json()) as Topology;
  const collection = topo.objects[object] as GeometryCollection;
  if (!collection) throw new Error(`Boundary file is missing the "${object}" layer.`);

  const fc = feature(topo, collection) as unknown as FeatureCollection<
    Polygon | MultiPolygon,
    BoundaryProps
  >;

  // Adjacency from shared arcs, computed before we mutate anything.
  const nbrIdx = neighbors(collection.geometries);

  const units: GeoUnit[] = [];
  const unitByPcode = new Map<PCode, GeoUnit>();
  const idxByPcode = new Map<PCode, number>();
  const pcodeByIdx: string[] = [];

  fc.features.forEach((f, i) => {
    const props = f.properties;
    const unit = toUnit(props, level);
    units.push(unit);
    unitByPcode.set(unit.pcode, unit);
    idxByPcode.set(unit.pcode, i);
    pcodeByIdx.push(unit.pcode);
    // MapLibre feature-state needs a top-level feature id.
    (f as { id?: number }).id = i;
    (f.properties as BoundaryProps & { idx: number }).idx = i;
  });

  const neighborsByPcode = new Map<PCode, PCode[]>();
  nbrIdx.forEach((list, i) => {
    neighborsByPcode.set(
      pcodeByIdx[i],
      list.map((j) => pcodeByIdx[j]).filter(Boolean),
    );
  });

  return {
    level,
    geojson: fc as FeatureCollection<Polygon | MultiPolygon, BoundaryProps & { idx: number }>,
    units,
    unitByPcode,
    idxByPcode,
    pcodeByIdx,
    neighborsByPcode,
  };
}

/** Ray-casting point-in-ring test. */
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(x: number, y: number, rings: number[][][]): boolean {
  if (!rings.length || !pointInRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(x, y, rings[i])) return false; // inside a hole
  }
  return true;
}

export function pointInFeature(
  x: number,
  y: number,
  geom: Polygon | MultiPolygon | null | undefined,
): boolean {
  if (!geom) return false;
  if (geom.type === 'Polygon') return pointInPolygon(x, y, geom.coordinates);
  return geom.coordinates.some((poly) => pointInPolygon(x, y, poly));
}

export function bboxOfFeature(geom: Polygon | MultiPolygon): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const scan = (ring: number[][]) => {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  };
  if (geom.type === 'Polygon') geom.coordinates.forEach(scan);
  else geom.coordinates.forEach((poly) => poly.forEach(scan));
  return [minX, minY, maxX, maxY];
}

/** Bounding box over a set of features, for fit-to-selection. */
export function bboxOfFeatures(
  fc: FeatureCollection<Polygon | MultiPolygon, unknown>,
  keep: (props: unknown) => boolean,
): [number, number, number, number] | null {
  let box: [number, number, number, number] | null = null;
  for (const f of fc.features) {
    if (!keep(f.properties)) continue;
    const b = bboxOfFeature(f.geometry);
    box = box
      ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])]
      : b;
  }
  return box;
}

/** Philippines extent, used as the initial camera and as a pan constraint. */
export const PH_BOUNDS: [number, number, number, number] = [116.0, 4.2, 127.2, 21.5];
