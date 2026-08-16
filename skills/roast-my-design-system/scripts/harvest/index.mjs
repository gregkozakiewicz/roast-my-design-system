#!/usr/bin/env node
/**
 * Harvest — step 1 of the pipeline. Non-destructive scan of a repo:
 * components (real props, real usages), all styling, implicit tokens with
 * frequency counts, duplicates, context files. Writes harvest.json; prints a
 * one-screen summary (the seed of the step-2 diagnosis).
 *
 *   node src/harvest/index.mjs <repo-path> [--out harvest.json]
 *                              [--exclude <path>] (repeatable, comma-separated ok)
 *
 * Exclusions also come from a .roastignore file at the repo root (one
 * repo-relative path per line). Every active pattern lands in the harvest
 * JSON with the number of files it removed — visible, never silent.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { walkRepo, profileRepo } from './walk.mjs';
import { headerLines, detailLines } from './summary.mjs';
import { harvestComponents } from './components.mjs';
import { harvestTokens } from './tokens.mjs';
import { findDuplicates } from './duplicates.mjs';
import { harvestContext } from './context.mjs';
import { resolveWorkspaces } from '../lib/workspaces.mjs';
import { loadExclusions } from '../lib/exclusions.mjs';
import { nearColorPairs } from '../lib/nearpairs.mjs';
import { ruleStaleness } from '../lib/staleness.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

// --exclude is repeatable and each value may be comma-separated
function argAll(name) {
  const out = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === `--${name}` && process.argv[i + 1]) {
      out.push(...process.argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean));
    }
  }
  return out;
}

const target = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!target) {
  console.error('Usage: node src/harvest/index.mjs <repo-path> [--out harvest.json]');
  process.exit(1);
}
const outPath = resolve(arg('out', 'harvest.json'));

const t0 = Date.now();
const exclusions = loadExclusions(target, argAll('exclude'));
const files = walkRepo(target, 14, exclusions);
const profile = profileRepo(target, files);
const { components } = harvestComponents(target, files.code);
const tokens = harvestTokens(target, files.styles, files.code);
const duplicates = findDuplicates(components, profile.uiDir, target);
const context = harvestContext(target);
const staleRules = ruleStaleness(target, components,
  new Set(neverImportedComponents(components, profile.uiDir).map((c) => c.name)),
  [...files.code, ...files.styles, ...files.other]);

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
    // kept even when unscored: the report names packages with real components
    // but no raw styling instead of hiding them
    entry.uiComponents = comps.filter((c) => !c.isPage).length;
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
  staleRules,
  packages,
  // Active user exclusions with per-pattern removal counts. Present only when
  // something was excluded, so downstream renderers can trust its presence.
  ...(exclusions.patterns.length ? {
    exclusions: {
      patterns: exclusions.patterns,
      filesExcluded: exclusions.patterns.reduce((sum, p) => sum + p.files, 0),
    },
  } : {}),
};
harvest.tookMs = Date.now() - t0;

writeFileSync(outPath, JSON.stringify(harvest, null, 2));

// ---------- one-screen summary ----------
// The npx wrapper reorders the story (header, then the diagnosis, then these
// details), so the lines live in summary.mjs and the wrapper prints details
// itself from harvest.json. Run directly (the skill flow), everything prints
// here in one go, with the real output path at the end.
for (const l of headerLines(harvest)) console.log(l);
if (process.env.ROAST_EPHEMERAL_OUT !== '1') {
  for (const l of detailLines(harvest)) console.log(l);
  console.log(`\n  → ${outPath}   (${harvest.tookMs}ms)`);
}
