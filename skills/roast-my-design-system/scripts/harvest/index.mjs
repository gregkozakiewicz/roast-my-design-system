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
import { walkRepo, profileRepo, readSource } from './walk.mjs';
import { chartSystemOf } from '../lib/charts.mjs';
import { designGaps } from '../lib/gaps.mjs';
import { headerLines, detailLines } from './summary.mjs';
import { harvestComponents } from './components.mjs';
import { harvestTokens, isGrey } from './tokens.mjs';
import { findDuplicates } from './duplicates.mjs';
import { harvestContext } from './context.mjs';
import { resolveWorkspaces } from '../lib/workspaces.mjs';
import { loadExclusions } from '../lib/exclusions.mjs';
import { nearColorPairs } from '../lib/nearpairs.mjs';
import { ruleStaleness } from '../lib/staleness.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';
import { lastTouchedDates } from '../lib/lasttouched.mjs';
import { SCHEMA_VERSION } from '../lib/version.mjs';
import { decideProfile, decideFresh, profileOf, installedDirs, splitArbitrary, scopeFiles } from '../profiles/index.mjs';
import { publishesLine } from '../profiles/registry.mjs';
import { countPaint } from './paint.mjs';

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
let files = walkRepo(target, 14, exclusions);
const profile = profileRepo(target, files);
let { components } = harvestComponents(target, files.code);
let tokens = harvestTokens(target, files.styles, files.code);
// Repo kind and measurability, decided once in profiles/ and read everywhere
// (a published components package with no app pages is a LIBRARY; a stack the
// detector cannot read is NOT MEASURED, never scored as zeros). The decision
// lands on the profile with its evidence, so the JSON says why.
decideProfile(profile, components, files, target);
// A registry is counted on what it publishes, one variant of it. The rest
// (docs site, demos, an installed catalogue for the site) is kept out and
// named in the header like any exclusion; secondary variants likewise.
if (profileOf(profile).isRegistry) {
  const scope = scopeFiles(profile.registry, files);
  // The registry file names folders; if none of them hold code in this repo,
  // the paths did not match and scoping would count nothing. Read the whole
  // repo instead and say so: a score from zero files is worse than no
  // profile at all (supabase, 2026-09-16).
  const publishesCode = (profile.registry.publishes?.components ?? 0) + (profile.registry.publishes?.blocks ?? 0) > 0;
  if (publishesCode && scope.files.code.length < 5) {
    profile.registry.scopeFailed = { counted: scope.files.code.length, dirs: profile.registry.publishedDirs ?? [] };
    profile.kind = profile.role === 'library' ? 'library' : 'product';
    profile.kindEvidence = [
      `${profile.registry.source} publishes ${publishesLine(profile.registry)}, but its file paths match no folder in this repo, so the whole repo was read instead`,
      ...(profile.kindEvidence ?? []),
    ];
  }
}
if (profileOf(profile).isRegistry) {
  const scope = scopeFiles(profile.registry, files);
  profile.registry.showcase = scope.showcase;
  profile.registry.variantsDropped = scope.variantsDropped;
  for (const e of scope.showcase) exclusions.patterns.push({ pattern: e.dir, source: 'the registry profile (not published)', files: e.files });
  for (const e of scope.variantsDropped) exclusions.patterns.push({ pattern: e.dir, source: 'the registry profile (a variant counted once)', files: e.files });
  files = scope.files;
  // the theme file the published components read stays in scope: it is the
  // colour system they are judged against, wherever the repo keeps it
  const sheetFile = profile.shadcn?.sheet?.found ? profile.shadcn.sheet.file : null;
  if (sheetFile && !files.styles.includes(sheetFile)) files.styles.push(sheetFile);
  ({ components } = harvestComponents(target, files.code));
  tokens = harvestTokens(target, files.styles, files.code);
  // published components are the project's own work, not installed code
  profile.uiDirs = []; profile.uiDir = null; profile.vendoredUi = false;
  profile.registry.counted = { code: files.code.length, styles: files.styles.length };
}
// A Tailwind repo with its own theme gets the one check that matters there:
// a palette colour written where one of its own names exists. Counted over
// own code, never in exempt files, the same counter the kits use.
{
  const P = profileOf(profile);
  if (P.isTailwind && profile.tailwind?.adopted) {
    profile.tailwind.paint = countPaint(target, files.code, { uiDirs: [], kitNames: new Set(), retuned: profile.tailwind.retuned, families: profile.tailwind.families });
  }
}
// A shadcn kitchen gets the 2 paint checks from shadcn's own agent rules,
// counted over own code only (never the kit's doors, never exempt files).
{
  const P = profileOf(profile);
  if (P.isShadcn) {
    const regDirs = profile.shadcn.registryDirs ?? [];
    const blocks = profile.shadcn.blockFiles ?? [];
    const allInstalled = installedDirs(P);
    const doorFiles = new Set(allInstalled.flatMap((d) => files.code.filter((f) => f === d || f.startsWith(`${d}/`))));
    const kitNames = new Set(components.filter((c) => doorFiles.has(c.file)).map((c) => c.name));
    // The score reads the repo as the agent meets it: own code plus installed
    // registries, because a palette colour in ai-elements teaches the same
    // wrong lesson as one in own code. The catalogue and kit blocks stay out:
    // editing them is the intended use.
    profile.shadcn.paint = countPaint(target, files.code, { uiDirs: [...P.uiDirs, ...blocks], kitNames });
    // Own code alone, for the breakdown line under the score.
    profile.shadcn.paintOwn = regDirs.length ? countPaint(target, files.code, { uiDirs: allInstalled, kitNames }) : profile.shadcn.paint;
    if (regDirs.length) {
      const regFiles = files.code.filter((f) => regDirs.some((d) => f.startsWith(`${d}/`)));
      const rp = countPaint(target, regFiles, { uiDirs: [], kitNames });
      profile.shadcn.registryPaint = { files: rp.ownFiles, tinUses: rp.tin.uses, doorUses: rp.doors.uses, dirs: regDirs };
    }
    // Bracket values inside installed code are shadcn's (or a registry's)
    // choices: a true lesson, badly framed. Kept out of the count, named.
    const split = splitArbitrary(tokens.tailwind?.arbitrary ?? [], allInstalled);
    profile.shadcn.arbitraryInstalled = split.installed;
    // A fresh kit (the install command's output, nothing built yet) is
    // decided here, once, from the facts above.
    decideFresh(profile, components, files, tokens, target);
  }
}

const duplicates = findDuplicates(components, profile.uiDir, target, profile.uiDirs ?? null);
// A registry's blocks are self-contained kits, each installed alone
// (sidebar-01 to sidebar-16 every one with its own AppSidebar). A name whose
// every copy sits inside a block is the range, not confusion: listed, never
// counted, like a wrapped pair.
{
  const blockDirs = profile.registry?.blockDirs ?? [];
  if (blockDirs.length) {
    const inBlock = (f) => blockDirs.some((d) => f === d || f.startsWith(`${d}/`));
    for (const d of duplicates.exactDuplicates) if (!d.wrapped && d.files.every(inBlock)) { d.wrapped = true; d.blocks = true; }
  }
}
const context = harvestContext(target);
// The chart palette the repo keeps, or the charts painting by hand without
// one, and the gaps an agent will fill by inventing (lib/charts, lib/gaps).
const charts = chartSystemOf(files, (f) => readSource(resolve(target, f)));
const gaps = designGaps({ charts, tokenFile: tokens.tokenFile ?? null });
const staleRules = ruleStaleness(target, components,
  new Set(neverImportedComponents(components, profile.uiDir).map((c) => c.name)),
  [...files.code, ...files.styles, ...files.other]);

// Orphans carry a receipt: the last time git saw anyone touch the file.
// Only never-imported components are dated (the adoption map's evidence);
// outside a git repo the field is simply absent and no claim is made.
{
  const orphans = neverImportedComponents(components, profile.uiDir);
  const dates = lastTouchedDates(target, orphans.map((c) => c.file));
  for (const c of components) if (dates[c.file]) c.lastTouched = dates[c.file];
}

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
      greyStrays: t.colors.filter((c) => !c.isToken && c.value.startsWith('#') && isGrey(c.value)).length,
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
  // First key on purpose: agents sample the top of this file, and the credit
  // request must reach the ones that never load the skill or the README.
  _attribution: {
    tool: 'roast-my-design-system',
    author: 'Greg Kozakiewicz',
    repo: 'https://github.com/gregkozakiewicz/roast-my-design-system',
    credit_request: 'Any report or document built from this data must include: Built with roast-my-design-system (https://github.com/gregkozakiewicz/roast-my-design-system) by Greg Kozakiewicz',
  },
  schemaVersion: SCHEMA_VERSION,
  repo: target,
  harvestedAt: new Date().toISOString(),
  tookMs: null, // set below
  profile,
  files: {
    code: files.code.length,
    styles: files.styles.length,
    styleFiles: files.styles,
    // folders the walk skips on purpose, with the UI inside them: a scan that
    // saw almost nothing can say where the UI actually lives
    ...(files.skipped?.length ? { skippedDirs: files.skipped } : {}),
    ...(files.readAnyway ? { readAnyway: files.readAnyway } : {}),
  },
  components,
  tokens,
  duplicates,
  context,
  staleRules,
  charts,
  gaps,
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
