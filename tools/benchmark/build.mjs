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
import { walkRepo, profileRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
import { harvestComponents } from '../../skills/roast-my-design-system/scripts/harvest/components.mjs';
import { harvestTokens } from '../../skills/roast-my-design-system/scripts/harvest/tokens.mjs';
import { findDuplicates } from '../../skills/roast-my-design-system/scripts/harvest/duplicates.mjs';
import { distinctTypefaces } from '../../skills/roast-my-design-system/scripts/lib/typefaces.mjs';
import { nearColorPairs } from '../../skills/roast-my-design-system/scripts/lib/nearpairs.mjs';
import { neverImportedComponents } from '../../skills/roast-my-design-system/scripts/lib/neverimported.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const clonesDir = resolve(arg('clones', '.'));
const reposFile = resolve(arg('repos', join(HERE, 'repos.txt')));
const outPath = resolve(arg('out', join(HERE, '../../skills/roast-my-design-system/scripts/benchmark/benchmark.json')));

// The curated norms — what a real design system looks like in 2026.
// These are design judgment (Greg's), not statistics. The page shows them
// as the TARGET; the scanned average is only the (low) peer bar.
const IDEAL_2026 = {
  colors: { value: 24, note: '12-24: brand hue + tints, accent, greys, status' },
  greys: { value: 13, note: 'up to 13 tones (Material neutral palette)' },
  spacing: { value: 12, note: 'off-scale values; a dozen deliberate exceptions' },
  typefaces: { value: 3, note: 'sans for UI, serif accent, mono for code' },
  fontSizes: { value: 10, note: 'a type scale, up to 10 steps' },
  radii: { value: 10, note: 'up to a 10-step corner scale' },
  shadows: { value: 6, note: 'up to 6 elevation levels (0-5)' },
  exactDuplicates: { value: 0, note: 'one canonical implementation each' },
  inlineStyles: { value: 0, note: 'styling belongs to the system' },
  nearPairs: { value: 0, note: 'near-identical colours are copy-paste, not decisions' },
  important: { value: 0, note: '!important is the cascade admitting defeat' },
  neverImported: { value: 0, note: 'a system component nobody imports is dead weight' },
  arbitrary: { value: 20, note: 'bracket escape hatches; a handful of deliberate exceptions' },
  zIndexes: { value: 6, note: 'a fixed layer scale, ~6 layers' },
  fontWeights: { value: 4, note: 'regular, medium, semibold, bold' },
  lineHeights: { value: 5, note: '~1.5 body, ~1.2-1.3 headings' },
  breakpoints: { value: 5, note: 'Tailwind 5, Bootstrap 6, Carbon 5' },
  animationDurations: { value: 6, note: 'a few named durations, 160-360ms' },
  easings: { value: 4, note: 'in, out, in-out, linear' },
  borderWidths: { value: 2, note: 'hairline + emphasis' },
  opacities: { value: 5, note: 'disabled, overlay, hover tints' },
};

const wanted = readFileSync(reposFile, 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// Find each repo's clone dir (basename of org/repo, tolerate case differences)
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
    if (!['next', 'remix', 'vite-react', 'react'].includes(profile.framework)) {
      console.error(`  ✗ ${full}: not a React repo (${profile.framework}) — skipped`);
      continue;
    }
    const { components } = harvestComponents(root, files.code);
    const tokens = harvestTokens(root, files.styles, files.code);
    const dupes = findDuplicates(components, profile.uiDir, root);
    const reusable = components.filter((c) => !c.isPage);
    rows.push({
      repo: full,
      framework: profile.framework,
      designSystem: profile.designSystem.kind,
      codeFiles: files.code.length,
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
      },
    });
    console.log(`  ✓ ${full} (${files.code.length} files, ${Date.now() - t0}ms)`);
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
