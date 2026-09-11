#!/usr/bin/env node
/**
 * Reference-systems builder — scans 10 reputable public design systems and
 * merges a `referenceSystems` section into benchmark.json: the second
 * yardstick ("Reputable systems") next to the product-repo average.
 *
 * Unlike the product benchmark, each system is scanned at a curated SCOPE
 * (the canonical package), because repo roots mix in docs sites, demo
 * galleries and multi-theme registries that say nothing about discipline.
 * Every scope decision and its measurement caveat lives in SCOPES below.
 *
 *   node tools/benchmark/build-refs.mjs --clones <dir> [--out benchmark.json]
 *
 * Clone the fleet first (shallow), dir names = org-repo with '/' -> '-'
 * (shadcn-ui/ui may also be cloned as plain `ui`; both are found).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkRepo } from '../../skills/roast-my-design-system/scripts/harvest/walk.mjs';
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
const outPath = resolve(arg('out', join(HERE, '../../skills/roast-my-design-system/scripts/benchmark/benchmark.json')));

// The curated fleet. `scope` is the canonical-system subdir; `note` records
// why the raw numbers look the way they do (surfaced during curation, kept
// here so a rebuild never loses the context).
const SCOPES = [
  { name: 'shadcn/ui', repo: 'shadcn-ui/ui', scope: 'apps/v4/registry/new-york-v4/ui',
    note: 'zero raw values by design; tokens live in one theme file, components use semantic utilities' },
  { name: 'Primer', repo: 'primer/react', scope: 'packages/react/src',
    note: 'colour count inflated by hex fallbacks in var() and vendored multi-theme palettes' },
  { name: 'Polaris', repo: 'Shopify/polaris', scope: 'polaris-react/src',
    note: 'tokens live in the separate polaris-tokens package outside this scope' },
  { name: 'Carbon', repo: 'carbon-design-system/carbon', scope: 'packages/react/src',
    note: 'styling lives in separate Sass packages, so colour and radii counts are near zero' },
  { name: 'Material UI', repo: 'mui/material-ui', scope: 'packages/mui-material/src',
    note: 'colour count is the reference palette shipped as JS; CSS-in-JS theme values are invisible' },
  { name: 'Chakra UI', repo: 'chakra-ui/chakra-ui', scope: 'packages/react/src',
    note: 'colour count is the token definitions themselves; CSS-in-JS hides spacing and radii' },
  { name: 'Ant Design', repo: 'ant-design/ant-design', scope: 'components',
    note: 'inline style count is dominated by demos co-located with components' },
  { name: 'GOV.UK Frontend', repo: 'alphagov/govuk-frontend', scope: 'packages/govuk-frontend/src',
    note: 'Nunjucks + Sass, so component count is zero by scanner definition; colours are the full government palette' },
  { name: 'Adobe Spectrum', repo: 'adobe/react-spectrum', scope: 'packages/@react-spectrum',
    note: 'styling lives in separate spectrum-css packages; duplicate count is mostly re-export patterns' },
  { name: 'Cloudscape', repo: 'cloudscape-design/components', scope: 'src',
    note: 'token-driven SCSS keeps colours low; shadow count comes from elevation and motion scss' },
];

const systems = [];
for (const s of SCOPES) {
  const dashed = s.repo.replace('/', '-');
  const base = s.repo.split('/')[1];
  const dir = [dashed, base, base.toLowerCase()].find((d) => existsSync(join(clonesDir, d)));
  if (!dir) { console.error(`  ✗ missing clone: ${s.repo}`); continue; }
  const root = join(clonesDir, dir, s.scope);
  if (!existsSync(root)) { console.error(`  ✗ ${s.repo}: scope ${s.scope} not found`); continue; }
  const t0 = Date.now();
  try {
    const files = walkRepo(root);
    const { components } = harvestComponents(root, files.code);
    const tokens = harvestTokens(root, files.styles, files.code);
    const dupes = findDuplicates(components, null, root);
    const reusable = components.filter((c) => !c.isPage);
    systems.push({
      name: s.name, repo: s.repo, scope: s.scope, note: s.note,
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
        neverImported: neverImportedComponents(components, null).length,
        components: reusable.length,
      },
    });
    console.log(`  ✓ ${s.name} (${files.code.length} files, ${Date.now() - t0}ms)`);
  } catch (e) {
    console.error(`  ✗ ${s.repo}: ${e.message}`);
  }
}

const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
};

const METRICS = ['colors', 'greys', 'spacing', 'typefaces', 'fontSizes', 'radii', 'shadows', 'exactDuplicates', 'inlineStyles', 'arbitrary', 'nearPairs', 'important', 'neverImported', 'components'];
const stats = {};
for (const m of METRICS) {
  const values = systems.map((s) => s.metrics[m]).sort((a, b) => a - b);
  stats[m] = { values, median: quantile(values, 0.5) };
}

const bench = JSON.parse(readFileSync(outPath, 'utf8'));
bench.referenceSystems = {
  builtAt: new Date().toISOString(),
  count: systems.length,
  note: 'Curated scoped scans of reputable public design systems. Not comparable head-to-head with product repos: see per-system notes.',
  stats,
  systems,
};
writeFileSync(outPath, JSON.stringify(bench, null, 2));
console.log(`\n→ merged referenceSystems (${systems.length} systems) into ${outPath}`);
console.log('  medians:', METRICS.map((m) => `${m} ${stats[m].median}`).join(', '));
