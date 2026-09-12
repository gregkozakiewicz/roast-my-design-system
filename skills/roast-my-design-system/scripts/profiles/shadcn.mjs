/**
 * shadcn — a kitchen built from the shadcn kit.
 *
 * The team ordered a catalogue of components they are meant to edit, over a
 * sheet of named finishes they are meant to change. The kit is recognised by
 * its own marker file (components.json, at the root or in any workspace) and
 * by the catalogue's door names; the kit's flavour is read the way shadcn's
 * own `preset resolve` reads it; the sheet is read by row name. Everything
 * this profile decides lands on `profile.shadcn` with its evidence.
 *
 * What it changes, and only this:
 *   - the catalogue folder(s) are found through the config's alias, not only
 *     at the three usual paths; installed blocks in own code are kit doors too
 *   - the sheet is the CSS file the config names, never a file chosen by
 *     counting colour literals
 *   - 2 checks from shadcn's own agent rules become tiles: paint from a tin,
 *     and kit doors repainted from outside (harvest/paint.mjs)
 *   - the sheet check is receipts: rows present for daylight and evening,
 *     custom rows, the gap multiplier
 *
 * What it does NOT do: compare doors to upstream drawings (editing is the
 * intended use, and the drawings for the create-era fronts are generated,
 * not stored), or add any "unless shadcn" clause to a counter.
 *
 * Kitchen words used in comments: kit, front (style), hinge system (base),
 * door (component file), sheet (theme CSS), row (one --name: value).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { CATALOGUE, BLOCK_COMPONENTS, REGISTRY_DIRS, KNOWN_ROWS, TWEAKCN_ROWS, LIGHT_ONLY_ROWS, FACTORY_SPACING,
  FRONTS, LEGACY_FRONTS, BASES, BASE_COLORS, ICON_LIBRARIES, RADIUS_MAP, THEMES, SHADCN_ROWS } from './shadcn-data.mjs';

const readJSON = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
const stripExt = (f) => f.replace(/\.[cm]?[jt]sx?$/, '');

/**
 * Every folder in the walk holding 8+ catalogue door names AND the marks of
 * shadcn-generated code in at least 3 of them: a headless base import
 * (radix-ui, @radix-ui/react-*, @base-ui/react, react-aria-components), a
 * `data-slot` attribute, or the cva + cn pair. Names alone are not enough:
 * button, card, input and label are what anyone calls their components, and
 * a hand-written library must never be handed the shadcn card.
 */
const SHADCN_CODE_RE = /from ['"](?:radix-ui|@radix-ui\/react-[\w-]+|@base-ui\/react(?:\/[\w-]+)?|react-aria-components)['"]|data-slot=|cva\(/;
function catalogueSweep(root, files) {
  const byDir = new Map();
  for (const f of files.code) {
    if (!/\.[jt]sx$/.test(f)) continue;
    const d = dirname(f);
    if (!CATALOGUE.has(stripExt(basename(f)))) continue;
    const e = byDir.get(d) ?? { names: 0, marked: 0 };
    e.names += 1;
    if (e.marked < 3 && SHADCN_CODE_RE.test(read(join(root, f)))) e.marked += 1;
    byDir.set(d, e);
  }
  return [...byDir.entries()].filter(([, e]) => e.names >= 8 && e.marked >= 3).map(([dir, e]) => ({ dir, catalogueNames: e.names }));
}

/** Resolve an alias like "@/components/ui" or "@acme/ui/components" to a folder under wsRoot, if it exists. */
function resolveAlias(root, wsRoot, alias) {
  if (!alias) return null;
  const rel = (p) => p.replace(/\\/g, '/').replace(/^\.\//, '');
  // tsconfig paths in the workspace, then the root
  for (const dir of [wsRoot, root]) {
    const ts = readJSON(join(dir, 'tsconfig.json'));
    const paths = ts?.compilerOptions?.paths ?? {};
    const baseUrl = ts?.compilerOptions?.baseUrl ?? '.';
    for (const [key, targets] of Object.entries(paths)) {
      const stem = key.replace(/\/?\*$/, '');
      if (alias !== stem && !alias.startsWith(`${stem}/`)) continue;
      const tail = alias.slice(stem.length).replace(/^\//, '');
      for (const t of targets) {
        const cand = join(dir, baseUrl, rel(t).replace(/\/?\*$/, ''), tail);
        if (existsSync(cand)) return cand;
      }
    }
  }
  // package.json#imports ("#components/*": "./src/components/*.tsx")
  const pkg = readJSON(join(wsRoot, 'package.json'));
  for (const [key, target] of Object.entries(pkg?.imports ?? {})) {
    const stem = key.replace(/\/?\*$/, '');
    if (typeof target !== 'string' || (alias !== stem && !alias.startsWith(`${stem}/`))) continue;
    const tail = alias.slice(stem.length).replace(/^\//, '');
    const cand = join(wsRoot, rel(target).replace(/\/?\*(\.\w+)?$/, ''), tail);
    if (existsSync(cand)) return cand;
  }
  // the common shapes when no alias map resolves
  const tail = alias.replace(/^[@~#]\/?/, '').replace(/^[^/]+\/ui\//, '');
  for (const cand of [join(wsRoot, 'src', tail), join(wsRoot, tail), join(wsRoot, 'app', tail)]) {
    if (existsSync(cand)) return cand;
  }
  return null;
}

/**
 * The theme contract is the real signature of a shadcn install: the named
 * variables (background, foreground, primary, muted, border, ring...) defined
 * in a stylesheet. Door names and Radix imports are not enough. dubinc/dub
 * has 12 catalogue-named files on Radix and cva, no components.json and 0 of
 * these variables: its own token system, a shadcn ancestry, not a shadcn
 * install. It was read as one from 7.2.0 to 7.3.2 (2026-09-13).
 */
const CONTRACT_ROWS = ['background', 'foreground', 'primary', 'muted', 'border', 'ring', 'accent', 'card', 'popover', 'destructive'];
function themeContract(root, files) {
  const seen = new Set();
  for (const f of (files.styles ?? []).slice(0, 60)) {
    const css = read(join(root, f));
    for (const r of CONTRACT_ROWS) if (!seen.has(r) && new RegExp(`--${r}\\s*:`).test(css)) seen.add(r);
    if (seen.size === CONTRACT_ROWS.length) break;
  }
  return seen.size;
}

/** Rows declared under a selector in a CSS text: name -> value. */
function rowsUnder(css, selector) {
  const out = new Map();
  const re = new RegExp(`(^|[\\s,}])${selector}\\s*\\{([^}]*)\\}`, 'g');
  for (const m of css.matchAll(re)) {
    for (const d of m[2].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) out.set(d[1], d[2].trim());
  }
  return out;
}

const norm = (v) => (v ?? '').replace(/\s+/g, ' ').trim();

/** Read the sheet: the CSS file the config names. */
function readSheet(root, wsRoot, cssPath) {
  if (!cssPath) return null;
  const file = [join(wsRoot, cssPath), join(wsRoot, 'src', cssPath)].find((p) => existsSync(p));
  if (!file) return { file: cssPath, found: false };
  const css = read(file);
  const light = rowsUnder(css, ':root'), dark = rowsUnder(css, '\\.dark');
  const themeInline = rowsUnder(css, '@theme\\s+inline');
  const rows = [...light.keys()];
  const known = rows.filter((r) => KNOWN_ROWS.has(r));
  const custom = rows.filter((r) => !KNOWN_ROWS.has(r));
  const missingDark = rows.filter((r) => KNOWN_ROWS.has(r) && !LIGHT_ONLY_ROWS.has(r) && !dark.has(r));
  const customMissingDark = custom.filter((r) => !dark.has(r) && !/^(font|shadow|tracking|spacing|radius|ease|breakpoint)/.test(r));
  const shadcnPresent = SHADCN_ROWS.filter((r) => light.has(r)).length;
  const tweakcnPresent = TWEAKCN_ROWS.filter((r) => light.has(r) && !/^font-(sans|mono)$/.test(r)).length;
  const hslEra = /--background:\s*\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%/.test(css);
  const spacing = light.get('spacing') ?? null;
  const themeVars = new Set(themeInline.keys());
  // a custom colour row must be registered for Tailwind 4 to see it
  const customUnregistered = themeVars.size
    ? custom.filter((r) => !/^(font|shadow|tracking|spacing|radius|ease|breakpoint|typeset)/.test(r) && !themeVars.has(`color-${r}`))
    : [];
  return {
    file: file.slice(root.length + 1), found: true, hslEra,
    lightRows: rows.length, darkRows: dark.size, shadcnPresent, shadcnMissing: SHADCN_ROWS.filter((r) => !light.has(r)),
    known: known.length, custom, missingDark, customMissingDark, customUnregistered, tweakcnPresent,
    spacing, spacingChanged: spacing !== null && norm(spacing) !== FACTORY_SPACING,
    radius: light.get('radius') ?? null,
    primary: norm(light.get('primary')), chart2: norm(light.get('chart-2')), fontSans: light.get('font-sans') ?? null,
  };
}

/** The kit's flavour, the way `shadcn preset resolve` reads it. */
function readKit(cfg, sheet, deps) {
  const style = cfg.style ?? null;
  let base = null, front = null;
  if (style) {
    const m = style.match(/^(base|radix|aria)-(.+)$/);
    if (m) { base = m[1]; front = m[2]; }
    else { front = style; base = LEGACY_FRONTS.includes(style) ? 'radix' : null; }
  }
  const fellBack = [];
  const theme = THEMES.find((t) => t.primary === sheet?.primary)?.name ?? null;
  const chartColor = THEMES.find((t) => t.chart2 === sheet?.chart2)?.name ?? null;
  if (!theme) fellBack.push('theme');
  if (!chartColor) fellBack.push('chartColor');
  const radius = sheet?.radius ? (RADIUS_MAP[norm(sheet.radius)] ?? `custom (${norm(sheet.radius)})`) : null;
  if (!radius) fellBack.push('radius');
  const twRaw = deps?.tailwindcss ?? null;
  const twClean = twRaw ? String(twRaw).replace(/^[\^~>=<\s]*/, '') : '';
  const tailwind = /^\d/.test(twClean) ? twClean.split('.')[0] : null;
  return {
    style, front: front && (FRONTS.includes(front) || LEGACY_FRONTS.includes(front)) ? front : front,
    frontKnown: front ? FRONTS.includes(front) || LEGACY_FRONTS.includes(front) : false,
    base, baseKnown: base ? BASES.includes(base) : false,
    baseColor: cfg.tailwind?.baseColor ?? null, baseColorKnown: BASE_COLORS.includes(cfg.tailwind?.baseColor),
    cssVariables: cfg.tailwind?.cssVariables !== false,
    iconLibrary: cfg.iconLibrary ?? null, iconLibraryKnown: ICON_LIBRARIES.includes(cfg.iconLibrary),
    rtl: cfg.rtl === true, menuAccent: cfg.menuAccent ?? null, menuColor: cfg.menuColor ?? null,
    theme, chartColor, radius, tailwind, fellBack,
  };
}

export default {
  kind: 'shadcn',

  /**
   * @param profile the profiler's facts (mutated: uiDir, uiDirs, vendoredUi, designSystem, shadcn)
   * @param counts reusable/pages/codeFiles
   * @param ctx { root, files } the walk
   */
  recognise(profile, counts, ctx) {
    if (!ctx?.root || !ctx?.files) return null;
    const { root, files } = ctx;
    const evidence = [];

    // 1. marker files, root or any workspace
    const configs = (files.other ?? []).filter((f) => basename(f) === 'components.json')
      .map((f) => ({ file: f, cfg: readJSON(join(root, f)) }))
      .filter((c) => c.cfg && (c.cfg.aliases || c.cfg.style !== undefined || c.cfg.tailwind));

    // 2. catalogues: through each config's alias, then a sweep for door names
    const installs = [];
    for (const { file, cfg } of configs) {
      const wsRoot = join(root, dirname(file));
      const uiAlias = cfg.aliases?.ui ?? (cfg.aliases?.components ? `${cfg.aliases.components}/ui` : '@/components/ui');
      let uiAbs = resolveAlias(root, wsRoot, uiAlias);
      let catalogueNames = 0;
      if (uiAbs) {
        const rel = uiAbs.slice(root.length + 1).replace(/\\/g, '/');
        catalogueNames = files.code.filter((f) => f.startsWith(`${rel}/`) && CATALOGUE.has(stripExt(basename(f)))).length;
        uiAbs = rel;
      }
      const pkg = readJSON(join(wsRoot, 'package.json')) ?? readJSON(join(root, 'package.json')) ?? {};
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const sheet = readSheet(root, wsRoot, cfg.tailwind?.css);
      installs.push({ config: file, uiDir: uiAbs, catalogueNames, kit: readKit(cfg, sheet, deps), sheet });
    }
    const swept = catalogueSweep(root, files);
    for (const s of swept) {
      if (!installs.some((i) => i.uiDir === s.dir)) installs.push({ config: null, uiDir: s.dir, catalogueNames: s.catalogueNames, kit: null, sheet: null });
      else { const i = installs.find((x) => x.uiDir === s.dir); i.catalogueNames = Math.max(i.catalogueNames, s.catalogueNames); }
    }

    // 3. the decision. With components.json: the CLI's own marker plus a
    // catalogue folder. Without it: a catalogue by name AND the theme contract
    // in a stylesheet (5 or more of shadcn's named variables); names and
    // Radix alone describe half the React world.
    const contract = themeContract(root, files);
    const withConfigAndDir = installs.filter((i) => i.config && i.uiDir);
    const byName = installs.filter((i) => i.catalogueNames >= 8);
    if (!withConfigAndDir.length && !(byName.length && contract >= 5)) return null;

    installs.sort((a, b) => b.catalogueNames - a.catalogueNames || (b.config ? 1 : 0) - (a.config ? 1 : 0));
    const primary = installs[0];
    // the kit is read from a config; when the biggest catalogue has none
    // (a shared package found by sweep), the nearest configured install speaks
    const configured = installs.find((i) => i.kit) ?? null;
    const kit = primary.kit ?? configured?.kit ?? null;
    const sheet = primary.sheet ?? configured?.sheet ?? null;
    const confidence = primary.config && primary.catalogueNames >= 8 ? 'high'
      : primary.catalogueNames >= 8 || (primary.config && primary.uiDir) ? 'medium' : 'low';

    for (const i of installs) {
      if (i.config) evidence.push(`components.json in ${dirname(i.config) === '.' ? 'the root' : dirname(i.config)}${i.uiDir ? `, ${i.catalogueNames} catalogue component${i.catalogueNames === 1 ? '' : 's'} in ${i.uiDir}` : ', no catalogue folder found through its alias'}`);
      else evidence.push(`${i.catalogueNames} catalogue components in ${i.uiDir}, no components.json`);
    }
    evidence.push(contract ? `${contract} of shadcn's ${CONTRACT_ROWS.length} theme variables defined` : 'no shadcn theme variables found in any stylesheet');
    if (kit?.style) evidence.push(`style ${kit.style}${kit.baseColor ? `, base colour ${kit.baseColor}` : ''}${kit.tailwind ? `, Tailwind ${kit.tailwind}` : ''}`);

    // 4. write the facts every consumer reads
    profile.uiDirs = installs.map((i) => i.uiDir).filter(Boolean);
    profile.uiDir = primary.uiDir ?? profile.uiDir ?? null;
    profile.vendoredUi = true;
    const cssVars = kit ? kit.cssVariables : true;
    profile.designSystem = { kind: 'shadcn', name: 'shadcn/ui', confidence: 'high', cssVariables: cssVars };
    // kit doors installed as blocks into own code
    const blockFiles = files.code.filter((f) => /\.[jt]sx$/.test(f) && !profile.uiDirs.some((d) => f.startsWith(`${d}/`)) && BLOCK_COMPONENTS.has(stripExt(basename(f))));
    // third-party registries installed beside the catalogue: a folder named
    // as the CLI creates it, or as a `registries` key in components.json
    // names it. Installed code, judged like the catalogue.
    const registryNames = new Set(REGISTRY_DIRS);
    for (const { cfg } of configs) for (const k of Object.keys(cfg.registries ?? {})) registryNames.add(k.replace(/^@/, '').toLowerCase());
    const registryDirs = [...new Set(files.code
      .filter((f) => /\.[jt]sx$/.test(f) && !/(^|\/)(node_modules|public|docs?|content|posts?)\//.test(f))
      .map((f) => dirname(f))
      .filter((d) => registryNames.has(basename(d).toLowerCase()) && !profile.uiDirs.some((u) => d === u || d.startsWith(`${u}/`))))]
      .filter((d) => files.code.filter((f) => f.startsWith(`${d}/`) && /\.[jt]sx$/.test(f)).length >= 2);
    if (registryDirs.length) evidence.push(`${registryDirs.length} installed registr${registryDirs.length === 1 ? 'y' : 'ies'} beside it: ${registryDirs.map((d) => basename(d)).join(', ')}`);
    profile.shadcn = {
      installs: installs.map((i) => ({ config: i.config, uiDir: i.uiDir, catalogueNames: i.catalogueNames })),
      kit,
      sheet,
      blockFiles,
      registryDirs,
    };
    return { confidence, evidence };
  },

  // Question 6 and 9 live in benchmark.json: the curated ideals for the 2
  // shadcn tiles sit in ideal2026, and the shadcn slice (built by
  // tools/benchmark/build-slice.mjs from every fleet repo read as shadcn)
  // gives the fleet lines. Nothing here owns a number.
};
