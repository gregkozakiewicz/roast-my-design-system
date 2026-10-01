import { readFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
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
import tailwind, { readTailwindTheme } from './tailwind.mjs';
import { decidePalette } from '../lib/palette.mjs';
import { installedFile } from './installed.mjs';
import mui from './mui.mjs';
import mantine from './mantine.mjs';
import chakra from './chakra.mjs';
import antd from './antd.mjs';
import { readRegistry, publishesLine, variantsFromDirs, scopeFiles } from './registry.mjs';
import { readShadcnLint } from './shadcn-lint.mjs';
export { scopeFiles };
import library from './library.mjs';
import product from './product.mjs';

// Specific kinds first; product is the fallback and must stay last. The kind
// says how to READ the repo (shadcn: a kit over a sheet); the role says what
// usage MEANS (library: composition, not adoption). A shadcn library keeps
// both: kind shadcn, role library.
// Order matters: a shadcn repo IS a Tailwind repo, so the kit is recognised
// first; tailwind is the fallback for a Tailwind repo with its own theme and
// no kit. Library before product, product always last.
// A component kit installed from npm (mui) is read after shadcn, so a shadcn
// repo keeps its reading, and before tailwind: a kit product is judged on
// the kit's theme, not on a Tailwind theme it may also carry.
// Kits installed from npm are asked before shadcn: each only claims a repo
// where it is imported more than any other kit, shadcn's components/ui
// included (Agenta: Ant Design in 502 files, shadcn in 101, 2026-09-17).
export const PROFILES = [mui, mantine, chakra, antd, shadcn, tailwind, library, product];

/**
 * Decide the repo's kind from the profiler's facts and what the scan found.
 * Mutates `profile` (the harvest.profile object) so the JSON on disk carries
 * the decision: `role` (the field consumers and summary.json already read),
 * `componentDetection` (measurability), and the new `kind`, `kindConfidence`
 * and `kindEvidence` (the receipt: why this kind, in words).
 */
// A repo with this many app pages outside what it publishes is a product
// that also publishes, not a registry (fleet 2026-09-16: every registry sits
// under 30, supabase at 312).
const PRODUCT_PAGES = 60;

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
  // Which vocabulary a palette class is judged against, decided once here
  // and read by the live checks and the guard (lib/palette.mjs): a Tailwind
  // theme, shadcn's sheet when its contract holds, the repo's own theme
  // under a shadcn kit with no rows, or nothing. The report's tile keeps
  // its own gates (harvest/index.mjs) and no score reads this.
  profile.palette = decidePalette(profile, profileOf(profile), () => readTailwindTheme({ ...profile }, ctx)?.facts ?? null);
  // shadcn in utility-class mode (components.json: cssVariables false) paints
  // with Tailwind classes by design. A theme of the repo's own beside it
  // (rybbit retunes the whole neutral scale) is what the rules file points
  // the agent at. Kept as facts: no score and no check reads it (9.5.0).
  if (profile.shadcn && profile.designSystem?.cssVariables === false) {
    profile.shadcn.ownTheme = readTailwindTheme({ ...profile }, ctx)?.facts ?? null;
  }
  // A shadcn repo that PUBLISHES a registry is a registry: the fourth kind.
  // Every count still reads the shadcn facts (release (a): zero score change);
  // the kind, the receipt and the header line say what it is.
  // shadcn/lint, when the team runs it: their declared policy, read and
  // reported, never scored (see profiles/shadcn-lint.mjs)
  if (root && profile.shadcn) {
    const wsDirs = (profile.shadcn.installs ?? []).map((i) => i.config).filter(Boolean).map((f) => dirname(f)).filter((d) => d && d !== '.');
    profile.shadcn.lint = readShadcnLint(root, wsDirs);
  }
  if (root) {
    const reg = readRegistry(root, files);
    if (reg) {
      if (!reg.variants.length) reg.variants = variantsFromDirs(reg, profile.uiDirs, files);
      delete reg.itemNames;
      // Publishing has to be what the repo is FOR. A product that also ships
      // a small registry (supabase: 312 app pages beside 31 published
      // components) would otherwise be scored on the side offering and the
      // product never read at all. The fleet splits cleanly: every real
      // registry has under 30 pages outside what it publishes, supabase 312.
      const published = reg.publishedDirs ?? [];
      const outside = (components ?? []).filter((c) => c.isPage && !published.some((d) => c.file === d || c.file.startsWith(`${d}/`))).length;
      if (outside >= PRODUCT_PAGES) {
        profile.publishesRegistry = { source: reg.source, publishes: reg.publishes, dirs: published, pagesOutside: outside };
        return profile;
      }
      profile.kind = 'registry';
      // consumers of what it publishes live in other repos: library semantics
      profile.role = 'library';
      profile.registry = reg;
      profile.kindEvidence = [
        reg.builtFrom ? `registry built from ${reg.items} packages by ${reg.source}` : `${reg.source} publishes ${publishesLine(reg)}`,
        ...(reg.variants.length ? [`the same components kept in ${reg.variants.length} variants (${reg.variants.map((d) => basename(d)).join(', ')})`] : []),
        ...(reg.themes?.total ? [`${reg.themes.total} published theme${reg.themes.total === 1 ? '' : 's'} checked, ${reg.themes.incomplete} incomplete`] : []),
        ...decision.evidence,
      ];
    }
  }

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
    // a registry is read with the shadcn facts, plus what it publishes
    isShadcn: kind === 'shadcn' || kind === 'registry',
    // a Tailwind repo with its own theme and no kit
    isTailwind: kind === 'tailwind',
    tailwind: p.tailwind ?? null,
    // the vocabulary the palette rule judges against, or null when it is off
    palette: p.palette ?? null,
    // a product built on a component kit installed from npm (mui)
    isKit: !!p.kit,
    kit: p.kit ?? null,
    isRegistry: kind === 'registry',
    registry: p.registry ?? null,
    // a product that also publishes a registry: named, not read as one
    publishesRegistry: p.publishesRegistry ?? null,
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
// Which files in those folders are installed, file by file (9.5.0): a
// component of the team's own kept in the catalogue folder is the team's.
// The rule lives in profiles/installed.mjs.
export { isShadcnFile, doorFile, installedFile, installedFrom } from './installed.mjs';

/**
 * The installed-code test for one reading, as a function of a file path.
 * `none` is set when the repo has no installed folders at all, so a caller
 * can skip the split.
 */
export function installedOf(P) {
  const fn = (file) => installedFile(P, file);
  fn.none = installedDirs(P).length === 0;
  return fn;
}

/**
 * Split bracket-value entries ({value, count, files:[{file,count}]}) into the
 * team's own uses and installed uses. Own entries keep only own files with
 * counts re-summed; installed is a flat count with its top values.
 * `installed` is installedOf(P), or (older callers) a list of folders.
 */
export function splitArbitrary(entries, installed) {
  const isInstalled = typeof installed === 'function' ? installed : (file) => underAny(file, installed);
  if (typeof installed === 'function' ? installed.none : !installed.length) return { own: entries, installed: { uses: 0, values: [] } };
  const own = [];
  const installedValues = new Map();
  let installedUses = 0;
  for (const e of entries) {
    // the whole per-file tally when the harvest kept one (every), else the
    // capped list: a use in a file that fell off the list of five was counted
    // as the team's own, so ai-chatbot's installed badge put one of shadcn's
    // [3px] values in the headline (2026-09-30)
    const all = e.every ?? e.files ?? [];
    const ownFiles = all.filter((f) => !isInstalled(f.file)).sort((a, b) => b.count - a.count).slice(0, 5);
    const instCount = all.filter((f) => isInstalled(f.file)).reduce((s, f) => s + f.count, 0);
    if (instCount) { installedUses += instCount; installedValues.set(e.value, (installedValues.get(e.value) ?? 0) + instCount); }
    // own is the remainder of the entry's total, never a sum of the files
    // that happened to be listed
    const ownCount = e.count - instCount;
    if (ownCount > 0) { const { every, ...rest } = e; own.push({ ...rest, count: ownCount, files: ownFiles }); }
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
  const installed = installedOf(P);
  const own = (files.code ?? []).filter((f) => /\.[jt]sx?$/.test(f) && !installed(f));
  // build config at the root (next.config, vite.config, tailwind.config) is scaffold too
  const stem = (f) => f.split('/').pop().replace(/\.[jt]sx?$/, '').replace(/^[\w-]+\.config$/, 'app');
  const ownComponents = (components ?? []).filter((c) => !c.isPage && !installed(c.file));
  const ownArbitrary = splitArbitrary(tokens?.tailwind?.arbitrary ?? [], installed).own.reduce((s, a) => s + a.count, 0);
  const ownInline = (tokens?.inlineStyles?.files ?? []).filter((f) => !installed(f.file ?? f)).length;
  // the demo page the install command writes shows one Button; a page that
  // composes several doors is a screen someone built
  const ownPages = (components ?? []).filter((c) => c.isPage && !installed(c.file)).map((c) => c.file);
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
  const installed = installedOf(P);
  const a = splitArbitrary(css, installed), b = splitArbitrary(tw, installed);
  return { css: a.own, tw: b.own, installed: { uses: a.installed.uses + b.installed.uses, values: [...a.installed.values, ...b.installed.values].sort((x, y) => y.count - x.count) } };
}
