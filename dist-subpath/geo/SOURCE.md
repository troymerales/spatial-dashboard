# Boundary data provenance

`ph-provinces.topojson` and `ph-municipalities.topojson` are derived from:

**Philippines — Subnational Administrative Boundaries**
Common Operational Dataset (COD-AB), published by UN OCHA on the Humanitarian
Data Exchange.

- Dataset: https://data.humdata.org/dataset/cod-ab-phl
- Original sources: NAMRIA (National Mapping and Resource Information Authority)
  and the Philippine Statistics Authority (PSA)
- Licence: **Creative Commons Attribution for Intergovernmental Organisations
  (CC BY-IGO)** — attribution is required wherever the boundaries are displayed
  and is rendered in the map's attribution control and in the method sheet.
- Source file: `phl_admin_boundaries.geojson.zip`, layers `phl_admin2` (province)
  and `phl_admin3` (city/municipality), version v03, valid on 2025-02-13.

## What was changed

The published national files are full-resolution (roughly 500 MB per level) and
unusable on the web. The build applied, in order:

1. **Property projection** — kept only `adm*_pcode`, `adm*_name`, `area_sqkm`,
   `center_lat`, `center_lon`. `pcode` values are PSGC-derived and are the stable
   join key used throughout the application; nothing joins on display names.
2. **Coordinate snapping** to 4 decimal places (about 11 m) with removal of
   consecutive duplicate vertices.
3. **Topology construction** (`topojson-server`) so shared borders are stored
   once. This is what makes adjacency recoverable exactly — contiguous
   neighbours share arc indices, which the app uses for the "compared with
   adjacent areas" analysis rather than guessing from centroid distance.
4. **Simplification** (`topojson-simplify`, area-weighted) and ring filtering to
   drop slivers, then **quantisation**.

Result: 88 provinces in ~0.5 MB, 1,642 cities and municipalities in ~1.4 MB.
All 1,730 units survive with unique p-codes and non-null geometry. Because
simplification is topological, neighbouring polygons still share edges exactly —
no gaps or overlaps appear along borders.

`area_sqkm`, `center_lat` and `center_lon` are carried through from the source
unchanged and are genuine. They are the only real quantities the application
uses; **every health figure is synthetic** (see `src/data/synth.ts`).

## Regenerating

The pipeline is not committed as a build step because it needs a 1 GB download
and several minutes of processing. To redo it:

1. Download `phl_admin_boundaries.geojson.zip` from the HDX dataset above.
2. Extract `phl_admin2.geojson` and `phl_admin3.geojson`.
3. Stream-filter and thin each file (property projection + coordinate snapping).
4. `geo2topo` → `toposimplify` → `topoquantize`, writing the two files here.

Barangay boundaries (`phl_admin4`, ~42,000 units) are deliberately **not**
included. See the privacy section of the method sheet.
