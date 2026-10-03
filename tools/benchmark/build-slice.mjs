#!/usr/bin/env node
/**
 * Slice builder — the yardstick for one kind of repo. A shadcn install is
 * fairly compared with other shadcn installs, not with Material or Chakra, so
 * the report's "cleaner than X%" line for a shadcn repo reads against the
 * shadcn repos in the fleet. The slice is written INTO benchmark.json under
 * `slices.<kind>`, next to the general stats; the general stats and the
 * curated ideals are left exactly as they were.
 *
 *   node tools/benchmark/build-slice.mjs --clones <dir> [--kind shadcn] [--repos repos.txt] [--out benchmark.json]
 *   node tools/benchmark/build-slice.mjs --clones <dir> --kind tailwind --repos tools/benchmark/tailwind-repos.txt
 *
 * Which repos belong to the slice is decided by the engine's own profile
 * layer (profiles/), never by a hand list: the slice is "every repo in the
 * fleet the scanner reads as this kind", so the ruler and the reading can not
 * drift apart. Metrics are computed the way the fleet builder computes them,
 * plus the tiles only this kind measures.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, cloneDir } from './measure.mjs';
import { benchKind } from '../../skills/roast-my-design-system/scripts/diagnose/score.mjs';
import { IDEAL_2026, IDEAL_BY_KIND } from './ideal.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const clonesDir = resolve(arg('clones', '.'));
const reposFile = resolve(arg('repos', join(HERE, 'repos.txt')));
const outPath = resolve(arg('out', join(HERE, '../../skills/roast-my-design-system/scripts/benchmark/benchmark.json')));
const kind = arg('kind', 'shadcn');

const wanted = readFileSync(reposFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
const present = new Set(readdirSync(clonesDir));
const rows = [];
for (const full of wanted) {
  const dir = cloneDir(clonesDir, full, present);
  if (!dir || !existsSync(join(clonesDir, dir, '.git'))) { console.error(`  ✗ missing clone: ${full}`); continue; }
  const root = join(clonesDir, dir);
  const t0 = Date.now();
  try {
    // the scan's own harvest and the score's own metrics (measure.mjs): the
    // kind, the paint tiles and the kit tiles are exactly the report's
    const { h, P, metrics } = measure(root);
    // membership is the engine's benchmark group (benchKind): a kit product by
    // its kit, a web-components library by its stack
    const group = benchKind(h);
    if (group !== kind) { console.log(`  · ${full}: ${group}, not in the ${kind} slice`); continue; }
    // a theme nobody uses yet is shown, not scored, so it is no yardstick either
    if (kind === 'tailwind' && !h.profile?.tailwind?.adopted) { console.log(`  · ${full}: theme not adopted yet, not in the slice`); continue; }
    const sc = h.profile?.shadcn ?? null, tw = h.profile?.tailwind ?? null;
    const { kitColour, kitPx, ...rest } = metrics;
    rows.push({
      repo: full,
      confidence: P.confidence,
      style: sc?.kit?.style ?? null,
      baseColor: sc?.kit?.baseColor ?? null,
      tailwind: sc?.kit?.tailwind ?? h.profile?.tailwindVersion ?? null,
      ...(kind === 'tailwind' && tw ? { themeNames: tw.names?.length ?? 0, retuned: tw.retuned?.length ?? 0, themeUses: tw.uses ?? 0 } : {}),
      codeFiles: h.files?.code ?? 0,
      ownFiles: (P.isTailwind ? tw?.paint : sc?.paint)?.ownFiles ?? null,
      metrics: { ...rest, ...(h.profile?.kit ? { kitColour, kitPx } : {}) },
    });
    console.log(`  ✓ ${full} (${P.confidence}, ${h.files?.code ?? 0} files, ${Date.now() - t0}ms)`);
  } catch (e) {
    console.error(`  ✗ ${full}: ${e.message}`);
  }
}
if (rows.length < 5) { console.error(`\n✗ only ${rows.length} ${kind} repos in the fleet: too few for a median worth printing. Nothing written.`); process.exit(1); }

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
};
const stats = {};
if (kind === 'tailwind') for (const r of rows) delete r.metrics.doorOverrides;
// a kit product measures neither shadcn tile
if (!['shadcn', 'registry', 'tailwind'].includes(kind)) for (const r of rows) { delete r.metrics.doorOverrides; delete r.metrics.paintTin; }
for (const m of Object.keys(rows[0].metrics)) {
  const values = rows.map((r) => r.metrics[m]).sort((a, b) => a - b);
  stats[m] = { values, p25: quantile(values, 0.25), median: quantile(values, 0.5), p75: quantile(values, 0.75), p90: quantile(values, 0.9) };
}

const bench = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { ideal2026: {}, stats: {}, repos: [] };
// the curated ideals for the tiles only this kind measures join the general
// ideal table; an ideal the file already has is never overwritten here
bench.ideal2026 = bench.ideal2026 ?? {};
// the 2 shadcn ideals are owned by the slice and always refreshed from ideal.mjs
for (const m of Object.keys(stats)) if ((!bench.ideal2026[m] || ['paintTin', 'doorOverrides'].includes(m)) && IDEAL_2026[m]) bench.ideal2026[m] = IDEAL_2026[m];
bench.slices = bench.slices ?? {};
bench.slices[kind] = {
  builtAt: new Date().toISOString(),
  repoCount: rows.length,
  note: `every repo in the fleet the scanner reads as ${kind}; the "cleaner than" line on a ${kind} repo reads against these`,
  ...(IDEAL_BY_KIND[kind] ? { ideal2026: IDEAL_BY_KIND[kind] } : {}),
  stats,
  repos: rows,
};
writeFileSync(outPath, JSON.stringify(bench, null, 2));
console.log(`\n✓ ${kind} slice from ${rows.length} repos → ${outPath}`);
for (const m of ['colors', 'exactDuplicates', 'arbitrary', 'paintTin', 'doorOverrides', 'kitColour', 'kitPx']) {
  if (!stats[m]) continue;
  console.log(`  ${m}: median ${stats[m].median} (p25 ${stats[m].p25} / p75 ${stats[m].p75})   ideal: ${(IDEAL_BY_KIND[kind]?.[m] ?? bench.ideal2026[m])?.value ?? '—'}`);
}
