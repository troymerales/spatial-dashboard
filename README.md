# Spatial Health Intelligence

A geographic decision-support page for Philippine LGU health officers, planners
and administrators. Covers all 17 regions, 88 provinces and 1,642 cities and
municipalities.

> **Every health figure in this build is synthetic.** Administrative boundaries,
> land areas and centroids are real (OCHA/PSA/NAMRIA, CC BY-IGO). No
> consultation count, prevalence, coverage rate, workforce figure or facility is
> drawn from a real system. The disclosure is permanently visible in the header
> and explained in full in the method sheet.

```bash
npm install
npm run dev          # http://localhost:5180
npm run build
npm run typecheck
npm run check-data   # headless validation of the data layer
npm run catalogue    # regenerate CATALOGUE.md from src/data/*
```

**[CATALOGUE.md](CATALOGUE.md)** lists every category and indicator, with units,
denominators, direction, definitions and caveats. It is generated from the code,
so it cannot drift.

---

## What this is, and what it deliberately is not

The brief asked for "spatial maps". The harder requirement underneath it is that
an officer should be able to look at the page and **act** — which means the page
has to be at least as good at refusing to mislead as it is at drawing polygons.
Most of the design decisions below are about that.

### Four views, each answering one question

| View | Question it answers | Decision it informs |
|---|---|---|
| **Explore** | How does one indicator vary, and which areas stand out? | Where to send a team; which areas to ask for a report from |
| **Compare** | Where do two problems land in the same place? | Whether high burden and weak service actually coincide |
| **Screen** | Which areas cross thresholds *I* set? | Building a defensible shortlist for a programme |
| **Access** | Which populations are physically far from care? | Siting, outreach scheduling, referral planning |

### Timeline playback

The data is **weekly**: 156 reporting weeks, 2 January 2023 to 22 December 2025 (W01 2023
through W52 2025 — three full years), labelled
by ISO week. A Play button and a scrubber under the map step the whole country through the
weeks, and the LGU colours update as the period changes.

Four rules the implementation holds to:

- **Discrete steps, no interpolation.** The map holds each week then jumps to the next.
  A value halfway between two reporting weeks does not exist; drawing one would be an
  invention.
- **Fixed class breaks across the entire timeline.** Breaks are computed once over every
  week in view (`Dataset.pooledValues`), never per frame — otherwise the palette would be
  recalibrated on every step and an area could change shade while its value stood still.
  The legend's *break values* stay put; its *counts* change week to week.
- **Suppression is unchanged.** Weekly counts are ~1/52 of annual, so far more cells fall
  under the disclosure threshold. Nothing was relaxed to make the animation look better.
- **Scrubbing pauses playback**, so dragging never fights the timer.

Dengue at province level is the clearest demonstration: a 4.6x swing between trough and
peak week, peaking around W37, with provinces peaking anywhere from June to October.

#### What weekly costs you

Going from monthly to weekly is not free, and two consequences are worth stating plainly:

- **Municipal-level coverage collapses for anything but high-volume measures.** 16 of 62
  indicators now have under 40% of municipalities publishable in a given week — dengue
  1,621 of 1,642 withheld, leptospirosis all of them. Every one is fully readable at
  province level, and the "too sparse at this level" guard routes you there. Outpatient
  consultations, the default, still has zero suppression at either level.
- **Much of the week-to-week movement is noise.** ~49% of provinces change colour class
  between consecutive weeks for dengue, but the underlying seasonal movement over a single
  week is small — the rest is Poisson variation on smaller counts. The seasonal shape across
  many weeks is the trustworthy signal; one step is not. A 4-week rolling mean would damp
  this and is the obvious next addition, but it changes what the number means, so it is not
  applied silently.

### Collapsing panels

Three independent toggles in the top bar collapse the **controls** (left), the
**analysis strip** (bottom) and the **area details** (right). Each icon shows the
edge it controls, filled when that panel is open, so position and state read at a
glance. Collapse all three and the map takes the whole workspace — roughly 3× the
area — which is what you want for scanning the archipelago or projecting in a
meeting.

**Selecting an area reopens the detail panel**, because that panel exists to
describe the selection. The controls and the strip are deliberately left exactly
as you set them: reopening everything on every click would make separate toggles
pointless. Clicking empty sea only clears the selection, so you can keep scanning
without the chrome flickering in and out.

The top bar never hides. It carries the view tabs and the synthetic-data
disclosure, and that disclosure should not be dismissible.

---

## Judgement calls, and why

### I rejected the composite "priority score"

The brief floated combining population, burden, utilisation, access and
indicators into a priority index. I did not build one. A weighted sum of
normalised indicators moves the entire answer into weights that nobody sees, and
an officer asked "why is my municipality red?" would have no answer.

Two honest replacements are implemented instead:

- **Compare** — a 3×3 bivariate choropleth plus a linked scatter. Two measures
  read at once, no weights, nothing summed. The top-right quadrant *is* the
  "both are bad here" list, and it is derived rather than asserted.
- **Screen** — explicit user-set criteria. Areas are shaded by **how many
  criteria they meet**, and selecting one shows every criterion, its threshold,
  the area's value, and the margin. The shortlist is always explainable.

### Utilisation is an indicator, not a separate map

The brief proposed a standalone utilisation map. Utilisation is structurally
identical to every other rate — a numerator over a population base — so it lives
in the catalogue with full numerator/denominator transparency instead of a
duplicate screen. The specific risk the brief flagged (raw counts misleading) is
handled directly: **"Outpatient consultations (total count)" is flagged
non-mappable**, and choosing it replaces the choropleth with an explanation plus
the ranked table.

### Not all 117 indicators belong behind a dropdown

62 indicators across 10 categories are implemented, browsable by category with
free-text search over names and definitions. More importantly, each carries the
metadata the map needs to render it *correctly*: denominator, direction
(high = good or high = bad), decimals, disclosure threshold, and whether it is
safe to map at all.

**Four indicators are marked `mappable: false` on purpose.** A field existing at
LGU level is not a reason to paint it:

- *Outpatient consultations (count)* and *Total population* — a raw-count
  choropleth is a map of land area, not of people.
- *Maternal deaths* — rare events; most areas record 0–2 a year, so a map shows
  noise, and a single death can be identifiable.
- *HIV prevalence* — small counts plus a facility roster can re-identify
  individuals, and the stigma makes that harm severe and irreversible.

### Municipality first, barangay not at all

Province is the default level because 1,642 municipal rates are noisy enough
that the national picture reads better pooled; municipality is one click away and
is the right level once you filter to a region or province.

**Barangay mapping is excluded.** At ~42,000 units, a shaded polygon plus a
facility roster can identify individual patients. This is a deliberate refusal,
not a missing feature.

### Straight-line distance is labelled as such

The access metric is a genuine great-circle computation from each area's centroid
to the nearest facility — which may sit in a neighbouring LGU. It is **not**
travel time, and the caveat sits on the map itself, because straight-line
distance flatters exactly the island and upland areas that are hardest to reach.
The data model has room for travel time; the routing network does not exist yet,
so nothing pretends otherwise.

---

## How the page avoids lying to you

- **Classification is a control, not a constant.** Quantile, natural breaks,
  equal interval and standard deviation, with 3–7 classes. The choice materially
  changes which areas look alarming, so it is exposed with a note on each
  method's failure mode. Breaks are recomputed over the areas in view.
- **Missing is not zero.** Suppressed, unreported and out-of-filter each get a
  distinct non-ramp fill and their own legend rows and counts.
- **Disclosure control.** Cells built on fewer than the indicator's minimum case
  count (10 by default) are withheld — and still contribute to the province
  total, so nothing is lost, only hidden.
- **Reliability is shown.** Count-based rates carry a Poisson relative standard
  error and are flagged *stable / moderate / unstable*. Proportions get a Wilson
  confidence interval. An estimate you cannot act on looks different from one you
  can.
- **Sparse indicators say so.** When over half the areas in view have no
  publishable value, the map says it and offers a one-click switch to a level
  where pooling makes the measure usable. (Leptospirosis at municipal level is
  95% suppressed — the page tells you rather than showing you a grey map.)
- **Direction is encoded in hue.** Warm red = more is worse, teal = more is
  better, purple = neither. Lightness always encodes magnitude. All ramps are
  ColorBrewer sequences chosen for colour-vision-deficiency safety.
- **Neighbour comparison is real.** Contiguity comes from shared TopoJSON arcs,
  not a distance guess. The 45 island municipalities with no land border are told
  they have no neighbour comparison rather than being given a fabricated one.
- **Counts are drawn as circles, not shading.** Population is available as
  area-proportional symbols — the honest encoding for a count.

---

## Architecture

Geography and health data are separate all the way down. A `GeoUnit` never
carries a value; observations are keyed by `(indicatorId, pcode, period)` and
joined at render time. That is what lets the same map infrastructure serve any
number of indicators without change — and what will let the synthetic layer be
swapped for a real warehouse by replacing one module.

```
src/
  types.ts              Domain model. Indicator metadata drives all rendering.
  state.ts              View state shape and defaults.
  data/
    geo.ts              TopoJSON loading, contiguity, point-in-polygon, bboxes.
    indicators.ts       62-indicator catalogue with full metadata.
    synth.ts            ── THE ONLY SOURCE OF HEALTH NUMBERS ──
    facilities.ts       Synthetic register + nearest-facility search.
    dataset.ts          Joins geography + values, aggregates to province.
  lib/
    stats.ts            Breaks (incl. Jenks), quantiles, Wilson CI, haversine.
    color.ts            Direction-aware ramps, bivariate palette.
    format.ts           Units, ordinals, number formatting.
  components/           MapView, Legend, ControlRail, DetailPanel, charts, …
```

### Replacing the synthetic layer with real data

Everything funnels through `Dataset.surface(indicatorId, level, period)`, which
returns observations keyed by p-code plus summary statistics. To go live:

1. Point `municipalObs()` in `data/dataset.ts` at your warehouse instead of
   `SyntheticEngine`.
2. Keep returning `Observation` — including `numerator`, `denominator`, `rse` and
   an explicit `missing` reason. The UI's honesty features are driven entirely by
   those fields, so they start working on real data for free.
3. Join on `pcode` (PSGC). Never on name — names collide and change.
4. Bucket by week. A period is the integer `YYYYMMDD` of the week's Monday (`20250303` =
   the week beginning 3 March 2025); see `src/data/periods.ts` for `toPeriod`, `addWeeks`,
   `isoWeek` and the formatters. Date-level consultation rows become periods with
   `toPeriod(date)` and nothing else needs to know where the weeks came from. The key is the
   week-start date rather than an ISO `YYYYWW` code because week-numbering years do not line
   up with calendar years — 2026-W01 begins in December 2025 — and a key that sorted wrongly
   at that boundary would corrupt the timeline.
5. Mark each indicator `temporal: 'flow' | 'stock'`. This is the only thing that decides
   what gets scaled to the period — consultations and notifications are flows, coverage and
   workforce ratios are stocks. Getting it wrong silently makes a rate fifty times too big
   or too small.
6. Changing granularity is `src/data/periods.ts` alone. The generator and the UI are written
   against `PERIOD_YEAR_FRACTION` and `yearFraction()`, not against weeks.

Province aggregation, classification, reliability flagging, suppression display
and every chart carry over untouched.

### Why MapLibre GL

BSD-3, no account, no token, no per-view billing — an LGU can deploy it inside
its own network. `feature-state` recolours 1,642 polygons without re-uploading
geometry. And it renders fine with no basemap, which matters because a busy
street basemap fights a choropleth; the basemap is opt-in and the page works
fully offline without it.

There are no text labels on the map: symbol layers need a glyph endpoint, which
would make the page depend on an external font server. Identity comes from the
hover tooltip, the selection outline and the ranked list. Self-hosted glyphs are
the obvious next step.

---

## Deployment

**It is a fully static site.** No server, no API, no database, no SSR, no build-time
secrets. `npm run build` emits six files, and any static host will serve them:
GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront, Azure Static Web Apps,
or plain nginx/Apache on an LGU's own box.

```
dist/index.html                          0.6 kB
dist/assets/index-*.js                 1399 kB   (389 kB gzipped)
dist/assets/index-*.css                  87 kB   ( 14 kB gzipped)
dist/geo/ph-provinces.topojson          496 kB   (120 kB gzipped)
dist/geo/ph-municipalities.topojson    1469 kB   (330 kB gzipped)
dist/geo/SOURCE.md                        3 kB   (provenance; not loaded at runtime)
```

Roughly **3.4 MB raw, ~855 kB over the wire** with gzip, in six requests.

### Notes that actually matter

- **Serve compressed.** Gzip/brotli cuts the payload by about 75%. The TopoJSON
  files compress especially well (1.4 MB → 330 kB); most of the practical load
  time is decided here. On nginx, make sure `application/octet-stream` or the
  `.topojson` extension is in `gzip_types`.
- **`.topojson` MIME type does not matter.** Verified against a server that
  returns `application/octet-stream` for it — `fetch().json()` ignores
  `Content-Type`. No host configuration is needed.
- **No SPA fallback rewrite needed.** The page is a single route with no
  client-side router, so there are no deep links for a static host to 404 on.
- **Subpath hosting works** (e.g. project sites at `example.org/spatial/`).
  Build with the base flag and everything, including the boundary fetches,
  resolves correctly — the app reads `import.meta.env.BASE_URL` rather than
  hardcoding `/`:
  ```bash
  npm run build -- --base=/spatial/
  ```
  Verified end-to-end under `/spatial/` on a plain static server: 6 requests,
  0 failures.
- **Cache headers.** `assets/*` are content-hashed, so
  `Cache-Control: public, max-age=31536000, immutable` is safe. The files under
  `geo/` are **not** hashed — cache them for hours/days, not a year, or rename
  them when the boundary vintage changes.
- **Works fully offline once loaded.** The only outbound request is the optional
  street basemap (CARTO raster tiles), which is off by default. With it off, the
  page makes no third-party requests at all — which is the point for an LGU
  deployment behind a restrictive network.
- **Needs HTTP, not `file://`.** Boundaries are loaded with `fetch`, which the
  `file://` origin blocks. Opening `dist/index.html` by double-clicking will not
  work; serve it over HTTP (any static server will do).
- **Requires WebGL.** If it is unavailable the map degrades to an explanatory
  message and the ranked table and distribution still work.

---

## Verification

`node scripts/check-data.mjs` bundles the data layer for Node and checks it
end-to-end. Current output confirms:

- 88 provinces and 1,642 municipalities load with unique p-codes, no null geometry
- dataset builds in ~260 ms; 12,433 synthetic facilities placed by rejection
  sampling **inside** each area's real polygon
- mean 4.52 contiguous neighbours per municipality; 45 islands correctly have none
- **province aggregates reconcile exactly** with their municipalities (max
  discrepancy 0.00) — drilling down never contradicts the level above
- suppression bites where it should, and hard at a weekly step (leptospirosis 100%, dengue
  99% withheld at municipal level; 0% at province level, where pooling makes them readable)
- seasonality is real and geographically phased: dengue swings 4.6x between its trough and
  peak week, and provinces peak anywhere from June to October rather than all at once
- memory plateaus (~229 MB after six indicators, measured with forced GC) rather than
  growing without bound
- indicators that share latent drivers genuinely co-vary, so the Compare view is
  meaningful (zero-dose ↔ facility births ρ = −0.59; utilisation ↔ physicians
  ρ = 0.64)

Browser-verified: all four views, province and municipality levels, map
click/hover selection, region and province filtering, facility overlay,
classification switching, the non-mappable and sparse-data guards, and the
stacked mobile layout.

Not verified: real-device touch interaction, and the page has not been tested
below 1080 px in an actual narrow viewport — the stacked rules were validated by
applying them directly rather than by resizing, because window resizing was not
available in the test environment.

---

## Known gaps

- **No age standardisation.** Prevalence comparisons between areas with different
  age structures are crude rates. This matters for NCDs and is the most important
  analytical gap.
- **No travel time.** See above.
- **No catchment modelling.** Facilities are attributed to the host LGU, not the
  population they serve — a municipality with the district hospital looks
  extremely well supplied and its neighbours extremely poorly supplied. The beds
  indicator carries this caveat on the map.
- **156 weekly periods**, enough to show three seasonal cycles but not enough to separate a
  trend from noise. The sparkline says so.
- **No temporal smoothing.** Weekly counts are noisy and nothing damps them. A rolling mean
  is the obvious next step.
- **Memory is ~230 MB** once several indicators have been viewed. One indicator at weekly
  granularity is 156 x 1,642 observations, and the caches are bounded to two indicators;
  switching to an unseen indicator costs ~600 ms to generate. Storing observations
  columnarly in typed arrays would cut this several-fold if it ever matters.
- **Seasonality is asserted, not inferred.** Each indicator's seasonal amplitude and peak
  month are parameters in the catalogue, chosen to be plausible. With real data they would
  come out of the data instead.
- **No export.** CSV/PNG export of the current view is the most likely next ask.
- **Bundle is ~1.4 MB** (390 KB gzipped), dominated by MapLibre.
