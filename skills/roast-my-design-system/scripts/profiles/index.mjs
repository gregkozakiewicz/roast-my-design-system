import { readFileSync } from 'node:fs';
import { join } from 'node:path';
/**
 * Profiles — what kind of repo is this, decided once and read everywhere.
 *
 * The scanner used to answer "is this a library?", "is this a vendored
 * catalogue?", "can I measure components here?" in three separate places:
 * the profiler in harvest/walk.mjs, a block inside harvest/index.mjs, and
 * every consumer re-deriving flags from the raw profile. The MCP path never
 * ran the harvest block at all, so it had no role. Each new kind of repo
 * would have meant one more "unless" clause in each counter, and that is how
 * a scanner stops meaning one thing.
 *
 * The shape now: one file per kind under profiles/, each answering the same
 * questions in the same order. `decideProfile` picks the first kind that
 * recognises the repo (product is the fallback and always matches), records
 * how sure it is and why, and writes the decision onto the harvest profile.
 * `profileOf` is the one accessor consumers read. No counter, report or rules
 * builder asks the raw flags any more.
 *
 * Step 2 of the shadcn-profile plan: this move changes no number. Every
 * fixture's expected output is byte-identical before and after.
 */
import shadcn from './shadcn.mjs';
import library from './library.mjs';
import product from './product.mjs';

// Specific kinds first; product is the fallback and must stay last. The kind
// says how to READ the repo (shadcn: a kit over a sheet); the role says what
// usage MEANS (library: composition, not adoption). A shadcn library keeps
// both: kind shadcn, role library.
export const PROFILES = [shadcn, library, product];

/**
 * Decide the repo's kind from the profiler's facts and what the scan found.
 * Mutates `profile` (the harvest.profile object) so the JSON on disk carries
 * the decision: `role` (the field consumers and summary.json already read),
 * `componentDetection` (measurability), and the new `kind`, `kindConfidence`
 * and `kindEvidence` (the receipt: why this kind, in words).
 */
export function decideProfile(profile, components, files, root = null) {
  const reusable = components.filter((c) => !c.isPage);
  const counts = {
    reusable: reusable.length,
    pages: components.length - reusable.length,
    codeFiles: files.code.length,
  };
  // A handful of pages next to hundreds of components is a demo or test app
  // riding in a library's monorepo (Siemens iX ships two), not a product.
  counts.fewPages = counts.pages <= counts.reusable * 0.05;

  const ctx = { root, files };
  let picked = product, decision = null;
  for (const p of PROFILES) {
    const d = p.recognise(profile, counts, ctx);
    if (d) { picked = p; decision = d; break; }
  }
  // role is usage semantics, decided by the library rule whatever the kind
  profile.role = library.recognise(profile, counts, ctx) ? 'library' : 'product';
  profile.kind = picked.kind;
  profile.kindConfidence = decision.confidence;
  profile.kindEvidence = decision.evidence;

  // Measurability. The gate fires on the situation, never a list of known
  // frameworks: a repo with real code volume where the detector found almost
  // nothing is a repo we could not read, whatever it is written in (the
  // Shoelace lesson: its .define() idiom was invisible and the named-framework
  // gate stayed silent, which would have shipped blind zeros as discipline).
  // Either trigger suffices: a named unreadable stack (Vue/Angular/Svelte
  // markers, however small the repo), or sheer volume the detector saw
  // nothing in (the Shoelace near-miss: unknown idiom, no marker).
  profile.componentDetection = counts.reusable < 3 && (profile.unreadableComponentStack || counts.codeFiles >= 40)
    ? { measured: false, reason: profile.unreadableComponentStack ?? 'a component pattern this scan cannot read' }
    : { measured: true };
  return profile;
}

/**
 * The one accessor. Consumers read these fields and nothing else about the
 * repo's kind. Works on a harvest (h.profile) or a bare profile object, and
 * on harvests written before the profile layer existed (no `kind` field).
 */
export function profileOf(h) {
  const p = h?.profile ?? h ?? {};
  const kind = p.kind ?? p.role ?? 'product';
  const role = p.role ?? (kind === 'library' ? 'library' : 'product');
  return {
    kind,
    role,
    confidence: p.kindConfidence ?? null,
    evidence: p.kindEvidence ?? [],
    isLibrary: role === 'library',
    isShadcn: kind === 'shadcn',
    shadcn: p.shadcn ?? null,
    uiDirs: p.uiDirs ?? (p.uiDir ? [p.uiDir] : []),
    // A vendored shadcn catalogue is stock on a shelf, not abandonment.
    vendoredUi: p.vendoredUi === true,
    uiDir: p.uiDir ?? null,
    componentsMeasured: p.componentDetection?.measured !== false,
    notMeasuredReason: p.componentDetection?.reason ?? 'an unrecognised component pattern',
    designSystem: p.designSystem ?? { kind: 'none' },
  };
}

/**
 * Installed code: folders the team did not write. The catalogue, kit blocks
 * installed into own code, and third-party registries. Under the agent-safety
 * definition (2026-09-13) installed code splits in two: what teaches a wrong
 * lesson stays in the score, attributed (registry palette colours); what
 * teaches a true lesson or none is kept out of the count and named at the top
 * (shadcn's own bracket values, unused stock).
 */
export function installedDirs(P) {
  const sc = P?.shadcn ?? {};
  return [...(P?.uiDirs ?? []), ...(sc.registryDirs ?? []), ...(sc.blockFiles ?? [])];
}
const underAny = (file, dirs) => dirs.some((d) => file === d || file.startsWith(`${d}/`));

/**
 * Split bracket-value entries ({value, count, files:[{file,count}]}) into the
 * team's own uses and installed uses. Own entries keep only own files with
 * counts re-summed; installed is a flat count with its top values.
 */
export function splitArbitrary(entries, dirs) {
  if (!dirs.length) return { own: entries, installed: { uses: 0, values: [] } };
  const own = [];
  const installedValues = new Map();
  let installedUses = 0;
  for (const e of entries) {
    const ownFiles = (e.files ?? []).filter((f) => !underAny(f.file, dirs));
    const instFiles = (e.files ?? []).filter((f) => underAny(f.file, dirs));
    const instCount = instFiles.reduce((s, f) => s + f.count, 0);
    if (instCount) { installedUses += instCount; installedValues.set(e.value, (installedValues.get(e.value) ?? 0) + instCount); }
    // the file list under an entry is capped, so own is the remainder of the
    // entry's total, never a sum of the files that happened to be listed
    const ownCount = e.count - instCount;
    if (ownCount > 0) own.push({ ...e, count: ownCount, files: ownFiles });
  }
  own.sort((a, b) => b.count - a.count);
  const values = [...installedValues.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  return { own, installed: { uses: installedUses, values } };
}

/**
 * A fresh kit: the shadcn install command's output with nothing built on it
 * yet (Greg, 2026-09-12). Four absence checks and one presence check, all
 * from facts already harvested; all five must hold. Decided once here, so the
 * report, the rules file and the summary read one flag. When it holds the
 * copy says "the score is the kit's, not yours" instead of narrating the
 * catalogue's internal wiring as the team's habits.
 *
 * "Untouched" means untouched by these measures: a door edited by hand is
 * invisible here, so the wording says "theme file untouched", never
 * "components untouched".
 */
// what the install command writes around the catalogue, by file stem
const SCAFFOLD_STEMS = new Set([
  'layout', 'page', 'loading', 'error', 'not-found', 'template', 'globals',
  'utils', 'use-mobile', 'theme-provider', 'providers', 'main', 'app', 'index',
  'root', '__root', 'routes', 'router', 'vite-env.d', 'next-env.d', 'env.d',
  'middleware', 'proxy', 'instrumentation',
]);
export function decideFresh(profile, components, files, tokens, root = null) {
  const P = profileOf(profile);
  if (!P.isShadcn || !profile.shadcn) return;
  const sc = profile.shadcn;
  const dirs = installedDirs(P);
  const own = (files.code ?? []).filter((f) => /\.[jt]sx?$/.test(f) && !underAny(f, dirs));
  // build config at the root (next.config, vite.config, tailwind.config) is scaffold too
  const stem = (f) => f.split('/').pop().replace(/\.[jt]sx?$/, '').replace(/^[\w-]+\.config$/, 'app');
  const ownComponents = (components ?? []).filter((c) => !c.isPage && !underAny(c.file, dirs));
  const ownArbitrary = splitArbitrary(tokens?.tailwind?.arbitrary ?? [], dirs).own.reduce((s, a) => s + a.count, 0);
  const ownInline = (tokens?.inlineStyles?.files ?? []).filter((f) => !underAny(f.file ?? f, dirs)).length;
  // the demo page the install command writes shows one Button; a page that
  // composes several doors is a screen someone built
  const ownPages = (components ?? []).filter((c) => c.isPage && !underAny(c.file, dirs)).map((c) => c.file);
  const doorImports = (f) => {
    if (!root) return 0;
    let src = '';
    try { src = readFileSync(join(root, f), 'utf8'); } catch { return 0; }
    return (src.match(/from\s+["'][^"']*\/ui\/[\w-]+["']/g) ?? []).length;
  };
  const checks = {
    // 1. nothing of the team's own: every non-page component lives in a scaffold file
    noOwnComponents: ownComponents.every((c) => SCAFFOLD_STEMS.has(stem(c.file))),
    // 2. own code carries no colour, bracket or inline style
    ownCodeClean: (sc.paintOwn?.tin?.uses ?? 0) === 0 && (sc.paintOwn?.doors?.uses ?? 0) === 0 && ownArbitrary === 0 && ownInline === 0,
    // 3. the theme file is stock: every shadcn row, no custom row, --spacing untouched
    sheetStock: sc.sheet?.found === true && (sc.sheet.custom ?? []).length === 0 && (sc.sheet.shadcnMissing ?? []).length === 0 && !sc.sheet.spacingChanged,
    // 4. nothing installed beside the catalogue: no registries, no kit blocks
    catalogueOnly: (sc.registryDirs ?? []).length === 0 && (sc.blockFiles ?? []).length === 0,
    // 5. the reverse check: own code IS the scaffold, by name and by size
    scaffold: own.length > 0 && own.length <= 10 && own.every((f) => SCAFFOLD_STEMS.has(stem(f)))
      && ownPages.length <= 1 && ownPages.every((f) => doorImports(f) <= 1),
  };
  sc.fresh = {
    fresh: Object.values(checks).every(Boolean),
    checks,
    ownFiles: own,
    catalogueCount: (sc.installs ?? []).reduce((s, i) => s + (i.catalogueNames ?? 0), 0),
  };
}

/** Off-scale spacing entries the team wrote (installed folders kept out on a kit). */
export function ownSpacing(h) {
  const P = profileOf(h);
  const css = h.tokens?.spacing ?? [];
  const tw = (h.tokens?.tailwind?.spacing ?? []).filter((v) => v.value.startsWith('['));
  if (!P.isShadcn) return { css, tw, installed: { uses: 0, values: [] } };
  const dirs = installedDirs(P);
  const a = splitArbitrary(css, dirs), b = splitArbitrary(tw, dirs);
  return { css: a.own, tw: b.own, installed: { uses: a.installed.uses + b.installed.uses, values: [...a.installed.values, ...b.installed.values].sort((x, y) => y.count - x.count) } };
}
