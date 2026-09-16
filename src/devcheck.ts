/**
 * Headless sanity check for the data layer. Bundled and run under Node by
 * scripts/check-data.mjs — not part of the app bundle.
 */
import { buildDataset } from './data/dataset';
import { INDICATORS, INDICATOR_BY_ID } from './data/indicators';
import { computeBreaks, spearman } from './lib/stats';
import { LATEST_PERIOD } from './data/synth';

function pct(n: number, d: number): string {
  return d ? ((n / d) * 100).toFixed(1) + '%' : '—';
}

export async function run(): Promise<void> {
  const t0 = Date.now();
  const ds = await buildDataset();
  console.log(`dataset built in ${Date.now() - t0} ms`);
  console.log(`provinces=${ds.province.units.length} municipalities=${ds.municipality.units.length}`);
  console.log(`facilities=${ds.facilities.all.length}`);

  // Population plausibility
  const pops = ds.municipality.units
    .map((u) => ds.engine.denominator(u.pcode, 'population', LATEST_PERIOD))
    .sort((a, b) => a - b);
  const q = (p: number) => Math.round(pops[Math.floor(p * (pops.length - 1))]);
  console.log(
    `synthetic population per municipality: min=${q(0)} p25=${q(0.25)} median=${q(0.5)} p75=${q(0.75)} max=${q(1)}`,
  );
  console.log(`national synthetic total = ${Math.round(pops.reduce((a, b) => a + b, 0)).toLocaleString()}`);

  // Neighbour topology
  let noNbr = 0;
  let nbrTotal = 0;
  for (const [, list] of ds.municipality.neighborsByPcode) {
    if (!list.length) noNbr++;
    nbrTotal += list.length;
  }
  console.log(
    `municipal adjacency: mean neighbours=${(nbrTotal / ds.municipality.units.length).toFixed(2)}, islands with none=${noNbr}`,
  );

  // Every indicator renders a usable surface at both levels
  const problems: string[] = [];
  for (const ind of INDICATORS) {
    for (const level of ['municipality', 'province'] as const) {
      const s = ds.surface(ind.id, level, LATEST_PERIOD);
      const total = s.byPcode.size;
      if (total === 0) problems.push(`${ind.id}/${level}: empty surface`);
      if (level === 'municipality' && s.stats.n < total * 0.4) {
        problems.push(
          `${ind.id}/${level}: only ${s.stats.n}/${total} usable (${s.stats.nSuppressed} suppressed)`,
        );
      }
      if (s.stats.n > 0 && !Number.isFinite(s.stats.median)) {
        problems.push(`${ind.id}/${level}: non-finite median`);
      }
    }
  }

  // Detailed look at a few representative indicators
  const sample = [
    'util_outpatient_rate',
    'imm_measles',
    'com_tb_notification',
    'mch_facility_birth',
    'acc_nearest_inpatient_km',
    'wf_facilities_per_10k',
    'dem_pop_density',
  ];
  console.log('\nindicator                      level         n   miss  supp     min    median       max');
  for (const id of sample) {
    for (const level of ['municipality', 'province'] as const) {
      const s = ds.surface(id, level, LATEST_PERIOD);
      const st = s.stats;
      console.log(
        `${id.padEnd(28)} ${level.padEnd(13)} ${String(st.n).padStart(4)} ${String(st.nMissing).padStart(5)} ${String(
          st.nSuppressed,
        ).padStart(5)} ${fmt(st.min)} ${fmt(st.median)} ${fmt(st.max)}`,
      );
    }
  }

  // Suppression actually bites on rare events in small LGUs
  const rare = ds.surface('com_leptospirosis', 'municipality', LATEST_PERIOD);
  console.log(
    `\nleptospirosis suppression: ${rare.stats.nSuppressed}/${rare.byPcode.size} withheld (${pct(
      rare.stats.nSuppressed,
      rare.byPcode.size,
    )})`,
  );

  // Province aggregation reconciles with its municipalities
  const ind = INDICATOR_BY_ID['imm_measles'];
  const munS = ds.surface(ind.id, 'municipality', LATEST_PERIOD);
  const provS = ds.surface(ind.id, 'province', LATEST_PERIOD);
  let worst = 0;
  let worstName = '';
  for (const prov of ds.province.units) {
    const kids = ds.engine.municipalitiesInProvince(prov.pcode);
    let num = 0;
    let den = 0;
    for (const k of kids) {
      const o = munS.byPcode.get(k.pcode);
      if (o?.numerator != null && o.denominator) {
        num += o.numerator;
        den += o.denominator;
      }
    }
    const expected = den > 0 ? (num / den) * 100 : null;
    const actual = provS.byPcode.get(prov.pcode)?.value ?? null;
    if (expected != null && actual != null) {
      const d = Math.abs(expected - actual);
      if (d > worst) {
        worst = d;
        worstName = prov.name;
      }
    }
  }
  console.log(`province aggregation max discrepancy: ${worst.toExponential(2)} (${worstName})`);

  // Classification produces sane breaks on a skewed indicator
  const dengue = ds.surface('com_dengue', 'municipality', LATEST_PERIOD);
  for (const m of ['quantile', 'equal', 'jenks', 'stddev'] as const) {
    const b = computeBreaks(dengue.values, 5, m);
    console.log(`breaks/${m.padEnd(8)} k=${b.k} -> ${b.breaks.map((x) => x.toFixed(0)).join(', ')}`);
  }

  // Derived access metric
  const acc = ds.surface('acc_nearest_inpatient_km', 'municipality', LATEST_PERIOD);
  console.log(
    `\ndistance to nearest inpatient facility (km): median=${acc.stats.median.toFixed(1)} p90=${acc.stats.p90.toFixed(
      1,
    )} max=${acc.stats.max.toFixed(1)}`,
  );

  // Correlation structure: the Compare view is only meaningful if indicators
  // that share latent drivers actually co-vary.
  const pairs: Array<[string, string]> = [
    ['ncd_screening_coverage', 'ncd_hypertension_prev'],
    ['imm_zero_dose', 'mch_facility_birth'],
    ['wash_sanitation', 'com_diarrhea_under5'],
    ['acc_nearest_inpatient_km', 'imm_fic'],
    ['fin_insurance_coverage', 'fin_oop_share'],
    ['util_outpatient_rate', 'wf_doctors_per_10k'],
  ];
  console.log('\ncorrelations (municipality / province):');
  for (const [a, b] of pairs) {
    for (const level of ['municipality', 'province'] as const) {
      const sa = ds.surface(a, level, LATEST_PERIOD);
      const sb = ds.surface(b, level, LATEST_PERIOD);
      const xs: number[] = [];
      const ys: number[] = [];
      for (const [p, oa] of sa.byPcode) {
        const ob = sb.byPcode.get(p);
        if (oa.value != null && ob?.value != null) { xs.push(oa.value); ys.push(ob.value); }
      }
      console.log('  ' + (a + ' ~ ' + b).padEnd(52) + level.padEnd(14) + 'rho=' + spearman(xs, ys).toFixed(2) + '  n=' + xs.length);
    }
  }
  if (problems.length) {
    console.log('\nPROBLEMS:');
    for (const p of problems.slice(0, 30)) console.log('  - ' + p);
    console.log(`  (${problems.length} total)`);
  } else {
    console.log('\nno problems found');
  }
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '      —';
  if (Math.abs(v) >= 10000) return (v / 1000).toFixed(0).padStart(7) + 'k';
  return v.toFixed(Math.abs(v) < 10 ? 2 : 1).padStart(8);
}
