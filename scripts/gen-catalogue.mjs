// Regenerates CATALOGUE.md from the actual source of truth (src/data/*.ts), so
// the document cannot drift from the code.
//
//   node scripts/gen-catalogue.mjs
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

const result = await build({
  stdin: {
    contents: `
      export { CATEGORIES, INDICATORS, DENOMINATORS, DEFAULT_MIN_NUMERATOR } from './src/data/indicators';
      export { FACILITY_TYPES } from './src/data/facilities';
      export { PERIODS, SYNTHETIC_SEED } from './src/data/synth';
      export { formatPeriodShort, formatPeriodDate } from './src/data/periods';
      export { VIEWS } from './src/state';
      export {
        CLASS_METHODS, CLASS_COUNTS, GEO_LEVELS, OVERLAYS, DETAIL_SECTIONS,
      } from './src/data/ui-taxonomy';
    `,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  define: { 'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'false' },
});

const mod = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);

const {
  CATEGORIES,
  INDICATORS,
  DENOMINATORS,
  DEFAULT_MIN_NUMERATOR,
  FACILITY_TYPES,
  PERIODS,
  SYNTHETIC_SEED,
  formatPeriodShort,
  formatPeriodDate,
  VIEWS,
  CLASS_METHODS,
  CLASS_COUNTS,
  GEO_LEVELS,
  OVERLAYS,
  DETAIL_SECTIONS,
} = mod;

// Regions and their provinces come from the published boundary file, so the
// list is the real administrative hierarchy rather than a hand-kept copy.
const topo = JSON.parse(
  await readFile(path.join(root, 'public', 'geo', 'ph-provinces.topojson'), 'utf8'),
);
const provinceProps = topo.objects.provinces.geometries.map((g) => g.properties);
const REGIONS = [];
for (const p of provinceProps) {
  let r = REGIONS.find((x) => x.pcode === p.adm1_pcode);
  if (!r) {
    r = { pcode: p.adm1_pcode, name: p.adm1_name, provinces: [] };
    REGIONS.push(r);
  }
  r.provinces.push(p.name);
}
REGIONS.sort((a, b) => a.name.localeCompare(b.name));
for (const r of REGIONS) r.provinces.sort((a, b) => a.localeCompare(b));

const UNIT_LABEL = {
  per_1000: 'per 1,000',
  per_10k: 'per 10,000',
  per_100k: 'per 100,000',
  percent: '%',
  count: 'count',
  ratio: 'ratio',
  index: 'index',
  per_sqkm: 'per km²',
  km: 'km',
  years: 'years',
};

const DIRECTION_LABEL = {
  higher_is_better: 'higher is better',
  higher_is_worse: 'higher is worse',
  neutral: 'neither',
};

const DENOM_LABEL = Object.fromEntries(DENOMINATORS.map((d) => [d.id, d.label]));

const esc = (s) => String(s).replace(/\|/g, '\\|');

// GitHub's heading-anchor rule: lowercase, drop anything that is not a letter,
// number, space or hyphen, then turn each remaining space into a hyphen.
const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/ /g, '-');

const lines = [];
const w = (s = '') => lines.push(s);

w('# Indicator catalogue');
w();
w('> **Auto-generated — do not edit by hand.**');
w('> `node scripts/gen-catalogue.mjs` rebuilds this from `src/data/indicators.ts`,');
w('> `src/data/facilities.ts`, `src/data/synth.ts` and `src/state.ts`.');
w();
w(
  `**Every health figure described here is synthetic**, generated in the browser from seed \`${SYNTHETIC_SEED}\`. ` +
    'Only the geography (boundaries, land area, centroids) is real. Nothing in this document should be read as a ' +
    'statement about health in the Philippines.',
);
w();

// ── Summary ──
const mappable = INDICATORS.filter((i) => i.mappable).length;
const countBased = INDICATORS.filter((i) => i.gen?.countBased).length;

w('## At a glance');
w();
w('| | |');
w('|---|---|');
w(`| Categories | ${CATEGORIES.length} |`);
w(`| Indicators | ${INDICATORS.length} |`);
w(`| Mappable | ${mappable} |`);
w(`| Deliberately not mapped | ${INDICATORS.length - mappable} |`);
w(`| Count-based (get suppression + reliability flags) | ${countBased} |`);
w(`| Population bases | ${DENOMINATORS.length} |`);
w(`| Facility types | ${FACILITY_TYPES.length} |`);
w(
  `| Periods | ${PERIODS.length} weeks (${formatPeriodShort(PERIODS[0])} – ${formatPeriodShort(
    PERIODS[PERIODS.length - 1],
  )}) |`,
);
w(`| Default disclosure threshold | ${DEFAULT_MIN_NUMERATOR} cases |`);
w();

// ── Contents ──
w('## Contents');
w();
for (const c of CATEGORIES) {
  const n = INDICATORS.filter((i) => i.category === c.id).length;
  w(`- [${c.label}](#${slug(c.label)}) — ${n} indicator${n === 1 ? '' : 's'}`);
}
w(`- [Population bases](#${slug('Population bases')})`);
w(`- [Facility types](#${slug('Facility types')})`);
w(`- [Analysis views](#${slug('Analysis views')})`);
w(`- [Indicators excluded from mapping](#${slug('Indicators excluded from mapping')})`);
w();

// ── Categories ──
w('---');
w();
w('## Indicator categories');
w();

for (const cat of CATEGORIES) {
  const items = INDICATORS.filter((i) => i.category === cat.id);
  w(`### ${cat.label}`);
  w();
  w(`_${cat.blurb}_`);
  w();
  w(`\`${cat.id}\` · ${items.length} indicator${items.length === 1 ? '' : 's'}`);
  w();
  w('| Indicator | Unit | Denominator | Direction | Mapped |');
  w('|---|---|---|---|---|');
  for (const i of items) {
    w(
      `| **${esc(i.name)}**<br><sub>\`${i.id}\`</sub> | ${UNIT_LABEL[i.unit] ?? i.unit} | ${
        i.denominator ? DENOM_LABEL[i.denominator] ?? i.denominator : '—'
      } | ${DIRECTION_LABEL[i.direction]} | ${i.mappable ? 'yes' : '**no**'} |`,
    );
  }
  w();
  for (const i of items) {
    w(`- **${i.name}** — ${i.definition}`);
    if (i.mapNote) w(`  - _Caveat:_ ${i.mapNote}`);
  }
  w();
}

// ── Denominators ──
w('---');
w();
w('## Population bases');
w();
w('Denominators available to rates. All synthetic.');
w();
w('| Base | `id` | Notes |');
w('|---|---|---|');
for (const d of DENOMINATORS) w(`| ${d.label} | \`${d.id}\` | ${esc(d.note)} |`);
w();

// ── Facility types ──
w('---');
w();
w('## Facility types');
w();
w(
  'Synthetic register. Positions are drawn by rejection sampling inside each area’s real polygon. ' +
    '"Inpatient" types are the ones the nearest-inpatient access metric searches.',
);
w();
w('| Type | `id` | Inpatient |');
w('|---|---|---|');
for (const f of FACILITY_TYPES) w(`| ${f.label} | \`${f.id}\` | ${f.inpatient ? 'yes' : 'no'} |`);
w();

// ── Views ──
w('---');
w();
w('## Analysis views');
w();
w('| View | Question it answers |');
w('|---|---|');
for (const v of VIEWS) w(`| **${v.label}** (\`${v.id}\`) | ${esc(v.question)} |`);
w();

// ── Non-mappable ──
w('---');
w();
w('## Indicators excluded from mapping');
w();
w(
  'A field existing at LGU level is not a reason to paint it on a choropleth. ' +
    'Selecting one of these replaces the map with the explanation below; the ranked table still shows every value.',
);
w();
for (const i of INDICATORS.filter((x) => !x.mappable)) {
  w(`### ${i.name}`);
  w();
  w(`\`${i.id}\` · ${CATEGORIES.find((c) => c.id === i.category)?.label}`);
  w();
  w(i.mapNote ?? '_No reason recorded._');
  w();
}

await writeFile(path.join(root, 'CATALOGUE.md'), lines.join('\n'), 'utf8');
console.log(
  `wrote CATALOGUE.md — ${CATEGORIES.length} categories, ${INDICATORS.length} indicators, ${lines.length} lines`,
);

// ── CONTENTS.md — the bare outline: category, then its members indented ──
const toc = ['# Contents', ''];
const group = (label, items) => {
  toc.push(`- ${label}`);
  for (const it of items) toc.push(`  - ${it}`);
};

toc.push('## Indicators', '');
for (const cat of CATEGORIES) {
  group(
    cat.label,
    INDICATORS.filter((x) => x.category === cat.id).map((i) => i.name),
  );
}

toc.push('', '## Map controls', '');
group('Geographic level', GEO_LEVELS.map((g) => g.label));
group('Timeline', [
  'Granularity: weekly',
  `${PERIODS.length} periods`,
  `${formatPeriodShort(PERIODS[0])} (${formatPeriodDate(PERIODS[0])}) – ${formatPeriodShort(
    PERIODS[PERIODS.length - 1],
  )} (${formatPeriodDate(PERIODS[PERIODS.length - 1])})`,
]);
group('Classification — break method', CLASS_METHODS.map((m) => m.label));
group('Classification — classes', CLASS_COUNTS.map((n) => `${n} classes`));
group('Overlays', OVERLAYS.map((o) => o.label));
group('Analysis views', VIEWS.map((v) => v.label));

toc.push('', '## Area detail pane', '');
for (const sec of DETAIL_SECTIONS) group(sec.title, sec.metrics);

toc.push('', '## Population bases', '');
group('Denominators', DENOMINATORS.map((d) => d.label));

toc.push('', '## Facility types', '');
group('All types', FACILITY_TYPES.map((f) => f.label));

toc.push('', `## Regions and provinces`, '');
for (const r of REGIONS) group(r.name, r.provinces);

toc.push('');

await writeFile(path.join(root, 'CONTENTS.md'), toc.join('\n'), 'utf8');
console.log(`wrote CONTENTS.md — ${toc.length - 3} lines`);
