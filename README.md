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
npm run dev      # http://localhost:5180
npm run build
npm run typecheck
node scripts/check-data.mjs   # headless validation of the data layer
```

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

**Five indicators are marked `mappable: false` on purpose.** A field existing at
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

## Verification

`node scripts/check-data.mjs` bundles the data layer for Node and checks it
end-to-end. Current output confirms:

- 88 provinces and 1,642 municipalities load with unique p-codes, no null geometry
- dataset builds in ~260 ms; 12,433 synthetic facilities placed by rejection
  sampling **inside** each area's real polygon
- mean 4.52 contiguous neighbours per municipality; 45 islands correctly have none
- **province aggregates reconcile exactly** with their municipalities (max
  discrepancy 0.00) — drilling down never contradicts the level above
- suppression bites where it should (leptospirosis 95%, maternal deaths 99% at
  municipal level — both are rare-event measures)
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
- **Five annual periods only**, so trends cannot be separated from noise. The
  sparkline says so.
- **No export.** CSV/PNG export of the current view is the most likely next ask.
- **Bundle is ~1.4 MB** (390 KB gzipped), dominated by MapLibre.
