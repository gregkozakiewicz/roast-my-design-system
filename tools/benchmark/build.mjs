#!/usr/bin/env node
/**
 * Benchmark builder — scans a fleet of public repos and emits benchmark.json:
 * the "average repo" yardstick for the diagnosis page, alongside the curated
 * Ideal-2026 norms. Per-repo metric lists are kept so the page can compute
 * exact percentiles ("worse than 84% of scanned repos").
 *
 *   node tools/benchmark/build.mjs --clones <dir> [--repos repos.txt] [--out benchmark.json]
 *
 * Clone the fleet first (shallow), e.g.:
 *   while read r; do git clone --depth 1 https://github.com/$r; done < repos.txt
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, cloneDir } from './measure.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const clonesDir = resolve(arg('clones', '.'));
const reposFile = resolve(arg('repos', join(HERE, 'repos.txt')));
const outPath = resolve(arg('out', join(HERE, '../../skills/roast-my-design-system/scripts/benchmark/benchmark.json')));

import { IDEAL_2026 } from './ideal.mjs';

const wanted = readFileSync(reposFile, 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// Find each repo's clone dir (basename of org/repo, tolerate case differences)
const present = new Set(readdirSync(clonesDir));
const rows = [];
for (const full of wanted) {
  const dir = cloneDir(clonesDir, full, present);
  if (!dir || !existsSync(join(clonesDir, dir, '.git'))) { console.error(`  ✗ missing clone: ${full}`); continue; }
  const root = join(clonesDir, dir);
  const t0 = Date.now();
  try {
    // the scan's own harvest and the score's own metrics (measure.mjs)
    const { h, metrics } = measure(root);
    const framework = h.profile?.framework ?? 'unknown';
    if (!['next', 'remix', 'vite-react', 'react'].includes(framework)) {
      console.error(`  ✗ ${full}: not a React repo (${framework}) — skipped`);
      continue;
    }
    // the general table carries no kind-only tile
    const { paintTin, doorOverrides, kitColour, kitPx, ...general } = metrics;
    rows.push({ repo: full, framework, designSystem: h.profile?.designSystem?.kind ?? 'none', codeFiles: h.files?.code ?? 0, metrics: general });
    console.log(`  ✓ ${full} (${h.files?.code ?? 0} files, ${Date.now() - t0}ms)`);
  } catch (e) {
    console.error(`  ✗ ${full}: ${e.message}`);
  }
}

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
};

const metricNames = Object.keys(rows[0]?.metrics ?? {});
const stats = {};
for (const m of metricNames) {
  const values = rows.map((r) => r.metrics[m]).sort((a, b) => a - b);
  stats[m] = {
    values, // kept so the diagnosis can compute exact percentiles
    p25: quantile(values, 0.25),
    median: quantile(values, 0.5),
    p75: quantile(values, 0.75),
    p90: quantile(values, 0.9),
  };
}

writeFileSync(outPath, JSON.stringify({
  builtAt: new Date().toISOString(),
  repoCount: rows.length,
  ideal2026: IDEAL_2026,
  stats,
  repos: rows.map((r) => ({ repo: r.repo, designSystem: r.designSystem, codeFiles: r.codeFiles, ...r.metrics ? { metrics: r.metrics } : {} })),
}, null, 2));

console.log(`\n✓ Benchmark from ${rows.length} repos → ${outPath}`);
for (const m of ['colors', 'greys', 'spacing', 'typefaces', 'exactDuplicates', 'inlineStyles']) {
  console.log(`  ${m}: median ${stats[m].median} (p25 ${stats[m].p25} / p75 ${stats[m].p75} / p90 ${stats[m].p90})   ideal: ${IDEAL_2026[m]?.value ?? '—'}`);
}
