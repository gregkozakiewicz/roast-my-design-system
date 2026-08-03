#!/usr/bin/env node
/**
 * Harvest — step 1 of the Proffer pipeline. Non-destructive scan of a repo:
 * components (real props, real usages), all styling, implicit tokens with
 * frequency counts, duplicates, context files. Writes harvest.json; prints a
 * one-screen summary (the seed of the step-2 diagnosis).
 *
 *   node src/harvest/index.mjs <repo-path> [--out harvest.json]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { walkRepo, profileRepo } from './walk.mjs';
import { harvestComponents } from './components.mjs';
import { harvestTokens } from './tokens.mjs';
import { findDuplicates } from './duplicates.mjs';
import { harvestContext } from './context.mjs';
import { resolveWorkspaces } from '../lib/workspaces.mjs';
import { nearColorPairs } from '../lib/nearpairs.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const target = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!target) {
  console.error('Usage: node src/harvest/index.mjs <repo-path> [--out harvest.json]');
  process.exit(1);
}
const outPath = resolve(arg('out', 'harvest.json'));

const t0 = Date.now();
const files = walkRepo(target);
const profile = profileRepo(target, files);
const { components } = harvestComponents(target, files.code);
const tokens = harvestTokens(target, files.styles, files.code);
const duplicates = findDuplicates(components, profile.uiDir, target);
const context = harvestContext(target);

// ---------- per-package pass (monorepos) ----------
// Styling is measured inside each package, but usage is counted repo-wide: a
// component another package imports is adopted, not dead. Files are already
// walked, so this re-reads each package's own files once, not the whole repo
// per package. Packages with too little UI to judge are listed, never scored.
const workspaces = resolveWorkspaces(target);
const packages = [];
if (workspaces.length > 1) {
  const inDir = (f, dir) => f === dir || f.startsWith(`${dir}/`);
  // deepest-first so apps/web/sub is attributed to itself, not to apps/web
  const byDepth = [...workspaces].sort((a, b) => b.dir.split('/').length - a.dir.split('/').length);
  const claimed = new Map();
  const claim = (f) => byDepth.find((w) => inDir(f, w.dir))?.dir ?? null;
  for (const f of files.code) { const d = claim(f); if (d) (claimed.get(d) ?? claimed.set(d, { code: [], styles: [] }).get(d)).code.push(f); }
  for (const f of files.styles) { const d = claim(f); if (d) (claimed.get(d) ?? claimed.set(d, { code: [], styles: [] }).get(d)).styles.push(f); }

  // Only packages that actually contain UI are worth reading twice: a backend
  // or config package has no styling to judge, and scanning it would cost time
  // to produce a meaningless perfect score. Biggest UI packages first, capped,
  // so a 100-package monorepo cannot blow the scan budget.
  const UI_RE = /\.(tsx|jsx|vue|svelte)$/;
  const uiCount = (w) => {
    const own = claimed.get(w.dir);
    return own ? own.code.filter((f) => UI_RE.test(f)).length + own.styles.length : 0;
  };
  const candidates = workspaces
    .map((w) => ({ w, ui: uiCount(w) }))
    .sort((a, b) => b.ui - a.ui);
  const scanning = new Set(candidates.filter((c) => c.ui >= 8).slice(0, 30).map((c) => c.w.dir));

  for (const w of workspaces) {
    const own = claimed.get(w.dir);
    if (!own) continue;
    const codeCount = own.code.length, styleCount = own.styles.length;
    const entry = { name: w.name, dir: w.dir, codeFiles: codeCount, styleFiles: styleCount, scored: false };
    if (!scanning.has(w.dir)) { packages.push(entry); continue; }
    const t = harvestTokens(target, own.styles, own.code);
    const comps = components.filter((c) => inDir(c.file, w.dir));
    const dupes = duplicates.exactDuplicates.filter((d) => !d.wrapped
      && d.files.every((f) => inDir(typeof f === 'string' ? f : f.file, w.dir)));
    const colorTokens = t.colors.filter((c) => c.isToken).length;
    const signal = t.colors.length + t.spacing.length + t.inlineStyles.count
      + (t.tailwind.colors.length + t.tailwind.spacing.length);
    if (signal < 5) { packages.push(entry); continue; }   // nothing to judge, so no verdict
    entry.scored = true;
    entry.metrics = {
      colors: t.colors.length,
      colorTokens,
      colorStrays: t.colors.length - colorTokens,
      greys: t.greyCount,
      greyStrays: t.colors.filter((c) => !c.isToken && c.value.startsWith('#')).length,
      spacing: t.spacing.length + t.tailwind.spacing.filter((v) => v.value.startsWith('[')).length,
      exactDuplicates: dupes.length,
      inlineStyles: t.inlineStyles.count,
      nearPairs: nearColorPairs(t.colors).length,
      important: t.important?.count ?? 0,
      neverImported: neverImportedComponents(comps, null).length,
      arbitrary: (t.tailwind.arbitrary ?? []).reduce((sum, a) => sum + a.count, 0),
      components: comps.filter((c) => !c.isPage).length,
    };
    packages.push(entry);
  }
}

const harvest = {
  repo: target,
  harvestedAt: new Date().toISOString(),
  tookMs: null, // set below
  profile,
  files: {
    code: files.code.length,
    styles: files.styles.length,
    styleFiles: files.styles,
  },
  components,
  tokens,
  duplicates,
  context,
  packages,
};
harvest.tookMs = Date.now() - t0;

writeFileSync(outPath, JSON.stringify(harvest, null, 2));

// ---------- one-screen summary ----------
const nonPage = components.filter((c) => !c.isPage);
const hexColors = tokens.colors.filter((c) => c.value.startsWith('#'));
const top = (list, n = 5) => list.slice(0, n).map((e) => `${e.value} ×${e.count}`).join(', ');

console.log(`\nHarvest: ${profile.name ?? target}`);
console.log(`  framework: ${profile.framework}${profile.typescript ? ' + TS' : ''}   design system: ${profile.designSystem.kind}${profile.designSystem.name ? ` (${profile.designSystem.name})` : ''}   styling: ${profile.stylingDeps.join(', ') || 'none detected'}`);
console.log(`  files: ${files.code.length} code, ${files.styles.length} style`);
console.log(`\n  components: ${components.length} defined (${nonPage.length} reusable, ${components.length - nonPage.length} pages)`);
console.log(`  duplicates: ${duplicates.exactDuplicates.length} exact same-name, ${duplicates.families.length} name families`);
for (const d of duplicates.exactDuplicates.slice(0, 3)) console.log(`    · ${d.name} defined in ${d.files.length} files`);
for (const f of duplicates.families.slice(0, 3)) console.log(`    · ${f.root} family: ${f.members.map((m) => m.name).join(', ')}`);
console.log(`\n  colours: ${tokens.colors.length} distinct (${hexColors.length} hex, of which ${tokens.greyCount} greys)   top: ${top(tokens.colors, 4)}`);
console.log(`  spacing: ${tokens.spacing.length} distinct CSS values   top: ${top(tokens.spacing, 5)}`);
console.log(`  radii: ${tokens.radii.length}   font sizes: ${tokens.fontSizes.length}   font families: ${tokens.fontFamilies.length}   shadows: ${tokens.shadows.length}`);
console.log(`  tailwind: ${tokens.tailwind.colors.length} colour utils, ${tokens.tailwind.spacing.length} spacing utils, ${tokens.tailwind.textSizes.length} text sizes`);
console.log(`  inline styles: ${tokens.inlineStyles.count} blocks`);
console.log(`  context files: ${context.map((c) => c.file).join(', ') || 'none'}`);
console.log(`\n  → ${outPath}   (${harvest.tookMs}ms)\n`);
