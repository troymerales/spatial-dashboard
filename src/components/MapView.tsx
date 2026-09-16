import { useEffect, useRef, useState, memo } from 'react';
import maplibregl, { type Map as MlMap, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Facility, PCode } from '../types';
import type { GeoLayer } from '../data/geo';
import { PH_BOUNDS } from '../data/geo';
import { NO_DATA_FILL } from '../lib/color';
import { FACILITY_TYPE_BY_ID } from '../data/facilities';

/**
 * The map surface.
 *
 * MapLibre GL was chosen over Leaflet, Mapbox and deck.gl for concrete reasons:
 *  - BSD-3 licensed with no account, token or per-view billing, so an LGU can
 *    deploy it inside its own network without a commercial dependency;
 *  - vector rendering with `feature-state`, so switching indicator recolours
 *    1,600 polygons without re-uploading geometry;
 *  - it renders fine with no basemap at all, which matters because a busy
 *    street basemap actively fights a choropleth.
 *
 * There are deliberately no text labels on the map: symbol layers need a glyph
 * endpoint, which would make the page depend on an external font server. Unit
 * identity comes from the hover tooltip, the selection outline and the ranked
 * list instead.
 */

export interface Bubble {
  pcode: PCode;
  lon: number;
  lat: number;
  /** Radius in pixels, already scaled by the caller. */
  radius: number;
}

export interface MapViewProps {
  layer: GeoLayer;
  /** Fill colour per unit. Units absent from the map get the no-data fill. */
  colorByPcode: Map<PCode, string>;
  /** Province boundaries drawn on top, for orientation at municipality level. */
  provinceOverlay: GeoLayer | null;
  selectedPcode: PCode | null;
  hoverPcode: PCode | null;
  onHover: (pcode: PCode | null, screen: { x: number; y: number } | null) => void;
  onSelect: (pcode: PCode | null) => void;
  facilities: Facility[] | null;
  bubbles: Bubble[] | null;
  /** Units to outline, e.g. everything matching a hovered legend class. */
  highlightPcodes: Set<PCode> | null;
  fitBounds: [number, number, number, number] | null;
  basemap: boolean;
  onMapReady?: () => void;
}

const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

function baseStyle(basemap: boolean): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      units: {
        type: 'geojson',
        data: EMPTY_FC,
        // CC BY-IGO requires attribution wherever the boundaries are shown.
        attribution:
          'Boundaries: <a href="https://data.humdata.org/dataset/cod-ab-phl" target="_blank" rel="noreferrer">OCHA / PSA / NAMRIA</a> (CC BY-IGO) · health figures are synthetic',
      },
      provinceLines: { type: 'geojson', data: EMPTY_FC },
      facilities: { type: 'geojson', data: EMPTY_FC },
      bubbles: { type: 'geojson', data: EMPTY_FC },
    },
    layers: [
      {
        id: 'bg',
        type: 'background',
        paint: { 'background-color': readCssVar('--map-bg', '#e9edf1') },
      },
    ],
  };

  if (basemap) {
    style.sources.basemap = {
      type: 'raster',
      tiles: ['https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    };
    style.layers.push({
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      paint: { 'raster-opacity': 0.55, 'raster-saturation': -0.6 },
    });
  }

  style.layers.push(
    {
      id: 'unit-fill',
      type: 'fill',
      source: 'units',
      paint: {
        'fill-color': ['to-color', ['coalesce', ['feature-state', 'c'], NO_DATA_FILL]],
        'fill-opacity': basemap ? 0.82 : 1,
      },
    },
    {
      id: 'unit-line',
      type: 'line',
      source: 'units',
      paint: {
        'line-color': readCssVar('--map-outline', '#ffffff'),
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.25, 8, 0.7, 11, 1.1],
        'line-opacity': 0.85,
      },
    },
    {
      id: 'province-overlay',
      type: 'line',
      source: 'provinceLines',
      paint: {
        'line-color': readCssVar('--text-3', '#858e9c'),
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 9, 1.2],
        'line-opacity': 0.5,
      },
    },
    {
      id: 'unit-highlight',
      type: 'line',
      source: 'units',
      filter: ['==', ['get', 'idx'], -1],
      paint: {
        'line-color': readCssVar('--text', '#16191d'),
        'line-width': 1.4,
        'line-opacity': 0.75,
      },
    },
    {
      id: 'unit-hover',
      type: 'line',
      source: 'units',
      filter: ['==', ['get', 'idx'], -1],
      paint: { 'line-color': '#111418', 'line-width': 1.6 },
    },
    {
      id: 'unit-select',
      type: 'line',
      source: 'units',
      filter: ['==', ['get', 'idx'], -1],
      paint: {
        'line-color': '#111418',
        'line-width': 2.6,
        'line-opacity': 0.95,
      },
    },
    {
      id: 'bubble-circles',
      type: 'circle',
      source: 'bubbles',
      paint: {
        'circle-radius': ['get', 'r'],
        'circle-color': '#1c5fb8',
        'circle-opacity': 0.28,
        'circle-stroke-color': '#1c5fb8',
        'circle-stroke-width': 1,
        'circle-stroke-opacity': 0.75,
      },
    },
    {
      id: 'facility-circles',
      type: 'circle',
      source: 'facilities',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 8, 2.8, 12, 5],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.9,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0, 9, 0.6],
      },
    },
  );

  return style;
}

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function facilityFC(facilities: Facility[]) {
  return {
    type: 'FeatureCollection' as const,
    features: facilities.map((f) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      properties: {
        color: FACILITY_TYPE_BY_ID[f.typeId]?.color ?? '#666',
        name: f.name,
        typeId: f.typeId,
      },
    })),
  };
}

function bubbleFC(bubbles: Bubble[]) {
  return {
    type: 'FeatureCollection' as const,
    features: bubbles.map((b) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [b.lon, b.lat] },
      properties: { r: b.radius, pcode: b.pcode },
    })),
  };
}

function MapViewImpl(props: MapViewProps) {
  const {
    layer,
    colorByPcode,
    provinceOverlay,
    selectedPcode,
    hoverPcode,
    onHover,
    onSelect,
    facilities,
    bubbles,
    highlightPcodes,
    fitBounds,
    basemap,
    onMapReady,
  } = props;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // Latest callbacks, so the map's own listeners never hold a stale closure.
  const cbRef = useRef({ onHover, onSelect });
  cbRef.current = { onHover, onSelect };

  // ── create / destroy ──
  useEffect(() => {
    if (!containerRef.current) return undefined;
    let map: MlMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: baseStyle(basemap),
        bounds: PH_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        minZoom: 3.5,
        maxZoom: 13,
        maxBounds: [
          [PH_BOUNDS[0] - 8, PH_BOUNDS[1] - 6],
          [PH_BOUNDS[2] + 8, PH_BOUNDS[3] + 6],
        ],
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        keyboard: true,
        refreshExpiredTiles: false,
      });
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'WebGL is unavailable in this browser.');
      return undefined;
    }

    mapRef.current = map;
    if (import.meta.env.DEV) {
      (window as unknown as { __map?: MlMap }).__map = map;
    }
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: 'metric' }), 'bottom-left');

    const handleMove = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ['unit-fill'] });
      const pcode = feats.length ? (feats[0].properties?.pcode as string) : null;
      map.getCanvas().style.cursor = pcode ? 'pointer' : '';
      cbRef.current.onHover(pcode, pcode ? { x: e.point.x, y: e.point.y } : null);
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = '';
      cbRef.current.onHover(null, null);
    };
    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ['unit-fill'] });
      cbRef.current.onSelect(feats.length ? (feats[0].properties?.pcode as string) : null);
    };

    map.on('mousemove', handleMove);
    map.on('mouseout', handleLeave);
    map.on('click', handleClick);
    map.on('load', () => {
      // React can mount the container before layout settles, which leaves the
      // initial `bounds` fit computed against the wrong size. Re-fit once the
      // canvas genuinely has its final dimensions.
      map.resize();
      map.fitBounds(
        [
          [PH_BOUNDS[0], PH_BOUNDS[1]],
          [PH_BOUNDS[2], PH_BOUNDS[3]],
        ],
        { padding: 24, duration: 0 },
      );
      setReady(true);
      onMapReady?.();
    });
    map.on('error', (e) => {
      // Raster tile hiccups should not take the whole map down.
      if (import.meta.env.DEV) console.warn('[map]', e.error?.message ?? e);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Rebuilding the style is the supported way to add/remove the raster source.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap]);

  // ── boundary data ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('units') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(layer.geojson as never);
    // setData clears feature state, so colours must be re-applied afterwards.
    applyColors(map, layer, colorByPcode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('provinceLines') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData((provinceOverlay ? provinceOverlay.geojson : EMPTY_FC) as never);
  }, [provinceOverlay, ready]);

  // ── colours ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyColors(map, layer, colorByPcode);
  }, [colorByPcode, layer, ready]);

  // ── hover / selection / highlight outlines ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const idx = hoverPcode != null ? layer.idxByPcode.get(hoverPcode) ?? -1 : -1;
    map.setFilter('unit-hover', ['==', ['get', 'idx'], idx]);
  }, [hoverPcode, layer, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const idx = selectedPcode != null ? layer.idxByPcode.get(selectedPcode) ?? -1 : -1;
    map.setFilter('unit-select', ['==', ['get', 'idx'], idx]);
  }, [selectedPcode, layer, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!highlightPcodes || highlightPcodes.size === 0) {
      map.setFilter('unit-highlight', ['==', ['get', 'idx'], -1]);
      return;
    }
    const idxs: number[] = [];
    for (const p of highlightPcodes) {
      const i = layer.idxByPcode.get(p);
      if (i != null) idxs.push(i);
    }
    map.setFilter('unit-highlight', ['in', ['get', 'idx'], ['literal', idxs]]);
  }, [highlightPcodes, layer, ready]);

  // ── overlays ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('facilities') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData((facilities && facilities.length ? facilityFC(facilities) : EMPTY_FC) as never);
  }, [facilities, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const src = map.getSource('bubbles') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData((bubbles && bubbles.length ? bubbleFC(bubbles) : EMPTY_FC) as never);
  }, [bubbles, ready]);

  // ── camera ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fitBounds) return;
    const [w, s, e, n] = fitBounds;
    if (![w, s, e, n].every(Number.isFinite)) return;
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 48, duration: 650, maxZoom: 11 },
    );
  }, [fitBounds, ready]);

  if (failed) {
    return (
      <div className="boot" role="alert">
        <div className="boot__title">The map could not start</div>
        <p className="boot__body">
          {failed} This page needs WebGL. Try a different browser, or enable hardware acceleration.
          The ranked table and distribution below still work without the map.
        </p>
      </div>
    );
  }

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} aria-hidden="true" />;
}

function applyColors(map: MlMap, layer: GeoLayer, colorByPcode: Map<PCode, string>) {
  if (!map.getSource('units')) return;
  for (let i = 0; i < layer.pcodeByIdx.length; i++) {
    const c = colorByPcode.get(layer.pcodeByIdx[i]);
    map.setFeatureState({ source: 'units', id: i }, { c: c ?? NO_DATA_FILL });
  }
}

export const MapView = memo(MapViewImpl);
