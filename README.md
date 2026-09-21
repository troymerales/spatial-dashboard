# Spatial Health Intelligence

A static web page that maps health indicators across the Philippines at province
and city/municipality level, for LGU health officers, planners and
administrators. 17 regions, 88 provinces, 1,642 cities and municipalities,
62 indicators, 156 weekly reporting periods.

Built with React 19, MapLibre GL and TopoJSON. No backend, no API key, no
database.

> ### Every health figure in this build is synthetic
>
> Boundaries, land areas and centroids are real (UN OCHA COD-AB, from NAMRIA and
> the PSA, CC BY-IGO). Everything else — consultation counts, prevalence,
> coverage rates, workforce figures, facility locations — is generated in the
> browser from a fixed seed by `src/data/synth.ts`. Nothing here describes real
> health in the Philippines. The disclosure is permanently visible in the page
> header and detailed in the in-app method sheet.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:5180
npm run build        # tsc -b && vite build  ->  dist/
npm run typecheck
npm run check-data   # headless validation of the data layer (see Verification)
npm run catalogue    # regenerate CATALOGUE.md from src/data/*
```

Vite 7 sets the floor at Node 20.19+ / 22.12+. The browser needs WebGL for the
map; without it the map degrades to an explanatory message and the ranked table
and distribution chart still work. `check-data` uses esbuild, which arrives with
Vite — no extra install.

## Documentation in this repo

| File | What it holds |
|---|---|
| **[CATALOGUE.md](CATALOGUE.md)** | Every category and indicator with units, denominators, direction, definitions and caveats. Generated from `src/data/*` by `npm run catalogue`, so it cannot drift from the code. |
| **[CONTENTS.md](CONTENTS.md)** | Flat inventory of everything the UI exposes — indicators, controls, detail-pane fields, population bases, facility types, regions and provinces. |
| **[public/geo/SOURCE.md](public/geo/SOURCE.md)** | Boundary provenance, licence, and exactly what the simplification pipeline did to the source files. |

---

## What the page does

### Four views

| View | Question | Typical use |
|---|---|---|
| **Explore** | How does one indicator vary, and which areas stand out? | Where to send a team; which areas to ask for a report from |
| **Compare** | Where do two problems land in the same place? | Whether high burden and weak service actually coincide |
| **Screen** | Which areas cross thresholds I set? | Building a defensible shortlist for a programme |
| **Access** | Which populations are physically far from care? | Siting, outreach scheduling, referral planning |

**Compare** draws a 3×3 bivariate choropleth with a linked scatter — two
measures read at once, nothing summed into a composite index, so the
"both are bad here" quadrant is derived rather than asserted. **Screen** shades
areas by *how many* user-set criteria they meet, and selecting an area lists
every criterion, its threshold, the area's value and the margin.

### Timeline playback

156 weekly periods, 2 January 2023 – 22 December 2025 (W01 2023 – W52 2025),
labelled by ISO week. A Play button and scrubber step the whole country through
the weeks and the LGU colours update as the period changes.

- **Discrete steps, no interpolation.** The map holds each week, then jumps.
- **Fixed class breaks across the timeline.** Breaks are computed once over every
  week in view (`Dataset.pooledValues`), not per frame, so an area cannot change
  shade while its value stands still. The legend's break values stay put; its
  counts change week to week.
- **Scrubbing pauses playback**, so dragging never fights the timer.

Dengue at province level shows this best: a 4.59× swing between trough and peak
week, peaking around W37, with individual provinces peaking anywhere from June
to October — most in July and August, a few as late as October.

### Collapsing panels

Three independent toggles in the top bar collapse the controls (left), the
analysis strip (bottom) and the area details (right). Each icon shows the edge
it controls, filled when that panel is open. Collapse all three and the map gets
roughly 3× the area — useful for scanning the archipelago or projecting in a
meeting. Selecting an area reopens the detail panel only; the other two stay as
you set them. Clicking empty sea clears the selection without moving any chrome.
The top bar never hides, because it carries the synthetic-data disclosure.

### Indicators

62 indicators across 10 categories, browsable by category with free-text search
over names and definitions. Each carries the metadata the map needs to render it
correctly: denominator, direction (higher is better / worse / neither), decimals,
disclosure threshold, whether it is a flow or a stock, and whether it is safe to
map at all.

**Four indicators are marked `mappable: false`.** Selecting one replaces the
choropleth with an explanation plus the ranked table:

- *Outpatient consultations (count)* and *Total population* — a raw-count
  choropleth is a map of land area, not of people.
- *Maternal deaths* — rare events; most areas record 0–2 a year, so a map shows
  noise, and a single death can be identifiable.
- *HIV prevalence* — small counts plus a facility roster can re-identify
  individuals.

**Barangay level is not included.** At ~42,000 units a shaded polygon plus a
facility roster can identify individual patients, so `phl_admin4` was left out of
the boundary build entirely.

---

## How values are handled

- **Classification is a control.** Quantile, natural breaks (Jenks), equal
  interval and standard deviation, 3–7 classes, recomputed over the areas in
  view. Each method carries a note on its failure mode, because the choice
  changes which areas look alarming. The class count is a request, not a
  guarantee: `computeBreaks` drops breaks that fall outside the domain or
  duplicate one another, so the legend can come back with fewer classes than
  asked for — natural breaks and standard deviation both return 4 where quantile
  and equal interval return 5 on the same data.
- **Missing is not zero.** Suppressed, unreported and out-of-filter each get a
  distinct non-ramp fill and their own legend rows and counts.
- **Disclosure control.** Cells built on fewer than the indicator's minimum case
  count (10 by default) are withheld — and still contribute to the province
  total, so nothing is lost, only hidden.
- **Reliability is shown.** Count-based rates carry a Poisson relative standard
  error and are flagged stable / moderate / unstable; proportions get a Wilson
  confidence interval.
- **Sparse indicators say so.** When over half the areas in view have no
  publishable value, the map says it and offers a one-click switch to a level
  where pooling makes the measure usable. Leptospirosis at municipal level is
  ~100% suppressed at a weekly step; the page tells you rather than showing a
  grey map.
- **Direction is encoded in hue.** Warm red = more is worse, teal = more is
  better, purple = neither; lightness always encodes magnitude. Ramps are
  ColorBrewer sequences chosen for colour-vision-deficiency safety.
- **Neighbour comparison is real.** Contiguity comes from shared TopoJSON arcs,
  not centroid distance. The 45 island municipalities with no land border are
  told they have no neighbour comparison rather than given a fabricated one.
- **Counts are drawn as circles**, not shading — population is available as
  area-proportional symbols.
- **Distance is straight-line and labelled as such.** The access metric is a
  great-circle computation from each area's centroid to the nearest facility,
  which may sit in a neighbouring LGU. It is not travel time; the caveat sits on
  the map, because straight-line distance flatters exactly the island and upland
  areas that are hardest to reach. Across municipalities the distance to the
  nearest inpatient facility runs median 6.5 km, p90 16.3 km, max 99.2 km — so
  the tail the metric understates most is also the part that matters most.

### Weekly granularity, and what it costs

- **Municipal coverage collapses for low-volume measures.** 16 of 62 indicators
  have under 40% of municipalities publishable in a given week (dengue: 1,631 of
  1,642 withheld; leptospirosis: all 1,642). Every one is readable at province
  level, and the sparse-data guard routes you there. Outpatient consultations,
  the default indicator, has zero suppression at either level — 1,612 of 1,642
  municipalities carry a value, and the 30 that do not are `not_reported`, not
  withheld.
- **Much of the week-to-week movement is noise.** 50.7% of provinces change
  colour class between consecutive weeks for dengue (33.0% of municipalities for
  outpatient consultations), but the underlying seasonal movement over one week
  is small — the rest is Poisson variation on small counts. The seasonal shape
  across many weeks is the signal; one step is not.

---

## Architecture

Geography and health data are separate all the way down. A `GeoUnit` never
carries a value; observations are keyed by `(indicatorId, pcode, period)` and
joined at render time. The same map infrastructure therefore serves any number
of indicators without change, and the synthetic layer can be swapped for a real
warehouse by replacing one module.

```
src/
  types.ts              Domain model. Indicator metadata drives all rendering.
  state.ts              View state shape and defaults.
  data/
    geo.ts              TopoJSON loading, contiguity, point-in-polygon, bboxes.
    periods.ts          Week model: toPeriod, addWeeks, isoWeek, formatters.
    indicators.ts       62-indicator catalogue with full metadata.
    synth.ts            -- THE ONLY SOURCE OF HEALTH NUMBERS --
    facilities.ts       Synthetic register + nearest-facility search.
    dataset.ts          Joins geography + values, aggregates to province.
    ui-taxonomy.ts      Category/control labelling for the UI and CONTENTS.md.
  lib/
    stats.ts            Breaks (incl. Jenks), quantiles, Wilson CI, haversine.
    color.ts            Direction-aware ramps, bivariate palette.
    format.ts           Units, ordinals, number formatting.
  components/           MapView, Legend, ControlRail, DetailPanel, Timeline,
                        RankList, IndicatorPicker, MethodSheet, charts, icons.
  devcheck.ts           Headless data-layer check, run by npm run check-data.
scripts/
  check-data.mjs        Bundles devcheck.ts for Node with a fetch shim.
  gen-catalogue.mjs     Regenerates CATALOGUE.md from src/data/*.
```

### Why MapLibre GL

BSD-3, no account, no token, no per-view billing — an LGU can deploy it inside
its own network. `feature-state` recolours 1,642 polygons without re-uploading
geometry, and it renders fine with no basemap, which matters because a busy
street basemap fights a choropleth. The basemap is opt-in and the page works
fully offline without it.

There are no text labels on the map: symbol layers need a glyph endpoint, which
would make the page depend on an external font server. Identity comes from the
hover tooltip, the selection outline and the ranked list.

### Swapping in real data

Everything funnels through `Dataset.surface(indicatorId, level, period)`, which
returns observations keyed by p-code plus summary statistics.

1. Point `municipalObs()` in `data/dataset.ts` at your warehouse instead of
   `SyntheticEngine`.
2. Keep returning `Observation` — including `numerator`, `denominator`, `rse` and
   an explicit `missing` reason. Suppression display, reliability flags and
   confidence intervals are driven entirely by those fields, so they start
   working on real data for free.
3. Join on `pcode` (PSGC). Never on name — names collide and change.
4. Bucket by week. A period is the integer `YYYYMMDD` of the week's Monday
   (`20250303` = the week beginning 3 March 2025); date-level rows become periods
   with `toPeriod(date)`. The key is the week-start date rather than an ISO
   `YYYYWW` code because week-numbering years do not line up with calendar years
   — 2026-W01 begins in December 2025 — and a key that sorted wrongly at that
   boundary would corrupt the timeline.
5. Mark each indicator `temporal: 'flow' | 'stock'`. This alone decides what gets
   scaled to the period: consultations and notifications are flows, coverage and
   workforce ratios are stocks. Getting it wrong silently makes a rate fifty
   times too big or too small.
6. Changing granularity is `src/data/periods.ts` alone — the generator and the UI
   are written against `PERIOD_YEAR_FRACTION` and `yearFraction()`, not weeks.

Province aggregation, classification, reliability flagging, suppression display
and every chart carry over untouched.

---

## Deployment

Fully static. No server, no API, no database, no SSR, no build-time secrets.
`npm run build` emits six files, and any static host will serve them: GitHub
Pages, Netlify, Cloudflare Pages, S3 + CloudFront, Azure Static Web Apps, or
plain nginx/Apache on an LGU's own box.

```
dist/index.html                          0.6 kB
dist/assets/index-*.js                 1413 kB   (389 kB gzipped)
dist/assets/index-*.css                  89 kB   ( 14 kB gzipped)
dist/geo/ph-provinces.topojson          496 kB   (120 kB gzipped)
dist/geo/ph-municipalities.topojson    1469 kB   (330 kB gzipped)
dist/geo/SOURCE.md                        3 kB   (provenance; not loaded at runtime)
```

Roughly **3.4 MB raw, ~855 kB over the wire** with gzip, in six requests.

- **Serve compressed.** Gzip/brotli cuts the payload ~75%, and the TopoJSON files
  compress especially well (1.4 MB to 330 kB); most of the practical load time is
  decided here. On nginx, put `application/octet-stream` or the `.topojson`
  extension in `gzip_types`.
- **`.topojson` MIME type does not matter.** Verified against a server returning
  `application/octet-stream` — `fetch().json()` ignores `Content-Type`.
- **No SPA fallback rewrite needed.** Single route, no client-side router, so
  there are no deep links for a static host to 404 on.
- **Subpath hosting works.** The app reads `import.meta.env.BASE_URL` rather than
  hardcoding `/`, so boundary fetches resolve correctly. Verified end-to-end
  under `/spatial/` on a plain static server: 6 requests, 0 failures.
  ```bash
  npm run build -- --base=/spatial/
  ```
- **Cache headers.** `assets/*` are content-hashed, so
  `Cache-Control: public, max-age=31536000, immutable` is safe. Files under
  `geo/` are **not** hashed — cache them for hours or days, not a year, or rename
  them when the boundary vintage changes.
- **Works offline once loaded.** The only outbound request is the optional CARTO
  raster basemap, off by default. With it off the page makes no third-party
  requests at all.
- **Needs HTTP, not `file://`.** Boundaries load with `fetch`, which the `file://`
  origin blocks; double-clicking `dist/index.html` will not work.

---

## Verification

`npm run check-data` bundles the data layer for Node and exercises it
end-to-end. Current output confirms:

- 88 provinces and 1,642 municipalities load with unique p-codes, no null geometry
- dataset builds in ~300–340 ms; 12,433 synthetic facilities placed by rejection
  sampling **inside** each area's real polygon
- mean 4.52 contiguous neighbours per municipality; 45 islands correctly have none
- province aggregates reconcile exactly with their municipalities (max
  discrepancy 0.00e+0) — drilling down never contradicts the level above
- suppression bites where it should, and hard at a weekly step: leptospirosis
  1,642/1,642 withheld, dengue 1,631/1,642, TB 1,510/1,642 at municipal level —
  and 0 at province level, where pooling makes all three readable
- seasonality is real and geographically phased: dengue swings 4.59× between
  trough and peak week (peak W37), with provinces peaking across June–October
  (6:6 7:35 8:34 9:11 10:2) rather than together
- indicators sharing latent drivers genuinely co-vary, so Compare is meaningful.
  At province level: utilisation ↔ physicians ρ = 0.81, sanitation ↔ under-5
  diarrhoea ρ = −0.74, insurance ↔ out-of-pocket share ρ = −0.76, zero-dose ↔
  facility births ρ = −0.60. Every pair is weaker at municipal level
  (0.59, −0.47, −0.38, −0.24), which is the small-area noise showing up as it
  should.
- the 16 indicators falling below 40% municipal coverage are listed explicitly as
  `PROBLEMS` rather than passing silently

The script does **not** measure memory; see Known gaps for where that figure
comes from.

Browser-verified: all four views, both levels, map click/hover selection, region
and province filtering, facility overlay, classification switching, the
non-mappable and sparse-data guards, and the stacked mobile layout.

Not verified: real-device touch interaction, and behaviour below 1080 px in an
actual narrow viewport — the stacked rules were validated by applying them
directly rather than by resizing the window.

---

## Known gaps

- **No age standardisation.** Prevalence comparisons between areas with different
  age structures are crude rates. This matters most for NCDs.
- **No travel time.** Access is straight-line distance only; the data model has
  room for travel time but no routing network exists yet.
- **No catchment modelling.** Facilities are attributed to the host LGU, not the
  population they serve, so a municipality with the district hospital looks
  extremely well supplied and its neighbours poorly supplied. The beds indicator
  carries this caveat on the map.
- **156 weekly periods** show three seasonal cycles but cannot separate trend
  from noise. The sparkline says so.
- **No temporal smoothing.** A 4-week rolling mean would damp the weekly noise
  and is the obvious next addition, but it changes what the number means, so it
  is not applied silently.
- **Memory is ~230 MB** once several indicators have been viewed, and switching to
  an unseen indicator costs ~600 ms to generate. Both figures are browser
  observations, not assertions of `npm run check-data`, which does not measure
  either. What is verifiable in the code: one indicator at weekly granularity is
  156 × 1,642 observations, and the surface cache is bounded at
  `MAX_CACHED_SURFACES = 630` in `data/dataset.ts` — about two indicators across
  both levels. Columnar typed-array storage would cut the footprint
  several-fold.
- **Seasonality is asserted, not inferred.** Each indicator's amplitude and peak
  month are parameters in the catalogue, chosen to be plausible; with real data
  they would come out of the data.
- **No export.** CSV/PNG export of the current view is the most likely next ask.
- **Bundle is ~1.4 MB** (389 kB gzipped), dominated by MapLibre.
- **No map labels.** Self-hosted glyphs are the obvious next step.

---

## Licence and attribution

Boundary data: UN OCHA Common Operational Dataset for the Philippines (COD-AB),
derived from NAMRIA and PSA sources, **CC BY-IGO**. Attribution is required
wherever the boundaries are displayed and is rendered in the map's attribution
control and in the method sheet. See [public/geo/SOURCE.md](public/geo/SOURCE.md)
for the full provenance and processing record.
