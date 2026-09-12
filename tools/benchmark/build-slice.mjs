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
import { walkRepo, profileRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestComponents } from '../../skills/roast-my-design-system/scripts/harvest/components.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { findDuplicates } from '../../skills/roast-my-design-system/scripts/harvest/duplicates.mjs';
import { countPaint } from '../../skills/roast-my-design-system/scripts/harvest/paint.mjs';
import { decideProfile, profileOf } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';
import { distinctTypefaces } from '../../skills/roast-my-design-system/scripts/lib/typefaces.mjs';
import { nearColorPairs } from '../../skills/roast-my-design-system/scripts/lib/nearpairs.mjs';
import { neverImportedComponents } from '../../skills/roast-my-design-system/scripts/lib/neverimported.mjs';
import { IDEAL_2026 } from './ideal.mjs';

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
  const name = full.split('/')[1];
  const dir = [name, name.toLowerCase()].find((d) => present.has(d) && existsSync(join(clonesDir, d, '.git')));
  if (!dir) { console.error(`  ✗ missing clone: ${full}`); continue; }
  const root = join(clonesDir, dir);
  const t0 = Date.now();
  try {
    const files = walkRepo(root);
    const profile = profileRepo(root, files);
    const { components } = harvestComponents(root, files.code);
    decideProfile(profile, components, files, root);
    const P = profileOf(profile);
    if (P.kind !== kind) { console.log(`  · ${full}: ${P.kind}, not in the ${kind} slice`); continue; }
    const tokens = harvestTokens(root, files.styles, files.code);
    const dupes = findDuplicates(components, profile.uiDir, root);
    const reusable = components.filter((c) => !c.isPage);
    // the tiles only this kind measures, counted as the harvest counts them
    const installed = [...P.uiDirs, ...(profile.shadcn?.registryDirs ?? [])];
    const doorFiles = new Set([...installed.flatMap((d) => files.code.filter((f) => f.startsWith(`${d}/`))), ...(profile.shadcn?.blockFiles ?? [])]);
    const kitNames = new Set(components.filter((c) => doorFiles.has(c.file)).map((c) => c.name));
    const paint = countPaint(root, files.code, { uiDirs: [...installed, ...(profile.shadcn?.blockFiles ?? [])], kitNames });
    rows.push({
      repo: full,
      confidence: P.confidence,
      style: profile.shadcn?.kit?.style ?? null,
      baseColor: profile.shadcn?.kit?.baseColor ?? null,
      tailwind: profile.shadcn?.kit?.tailwind ?? null,
      codeFiles: files.code.length,
      ownFiles: paint.ownFiles,
      metrics: {
        colors: tokens.colors.length,
        greys: tokens.greyCount,
        spacing: tokens.spacing.length + tokens.tailwind.spacing.filter((v) => v.value.startsWith('[')).length,
        typefaces: distinctTypefaces(tokens.fontFamilies).length,
        fontSizes: tokens.fontSizes.length + tokens.tailwind.textSizes.length,
        radii: tokens.radii.length + tokens.tailwind.radii.length,
        shadows: tokens.shadows.length,
        exactDuplicates: dupes.exactDuplicates.length,
        inlineStyles: tokens.inlineStyles.count,
        arbitrary: (tokens.tailwind.arbitrary ?? []).reduce((sum, a) => sum + a.count, 0),
        nearPairs: nearColorPairs(tokens.colors).length,
        important: tokens.important?.count ?? 0,
        neverImported: neverImportedComponents(components, profile.uiDir).length,
        components: reusable.length,
        paintTin: paint.tin.per100,
        doorOverrides: paint.doors.per100,
      },
    });
    console.log(`  ✓ ${full} (${P.confidence}, ${files.code.length} files, ${Date.now() - t0}ms)`);
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
for (const m of Object.keys(rows[0].metrics)) {
  const values = rows.map((r) => r.metrics[m]).sort((a, b) => a - b);
  stats[m] = { values, p25: quantile(values, 0.25), median: quantile(values, 0.5), p75: quantile(values, 0.75), p90: quantile(values, 0.9) };
}

const bench = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { ideal2026: {}, stats: {}, repos: [] };
// the curated ideals for the tiles only this kind measures join the general
// ideal table; an ideal the file already has is never overwritten here
bench.ideal2026 = bench.ideal2026 ?? {};
for (const m of Object.keys(stats)) if (!bench.ideal2026[m] && IDEAL_2026[m]) bench.ideal2026[m] = IDEAL_2026[m];
bench.slices = bench.slices ?? {};
bench.slices[kind] = {
  builtAt: new Date().toISOString(),
  repoCount: rows.length,
  note: `every repo in the fleet the scanner reads as ${kind}; the "cleaner than" line on a ${kind} repo reads against these`,
  stats,
  repos: rows,
};
writeFileSync(outPath, JSON.stringify(bench, null, 2));
console.log(`\n✓ ${kind} slice from ${rows.length} repos → ${outPath}`);
for (const m of ['colors', 'exactDuplicates', 'arbitrary', 'paintTin', 'doorOverrides']) {
  console.log(`  ${m}: median ${stats[m].median} (p25 ${stats[m].p25} / p75 ${stats[m].p75})   ideal: ${bench.ideal2026[m]?.value ?? '—'}`);
}
