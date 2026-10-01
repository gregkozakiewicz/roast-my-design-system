/**
 * What every kit profile shares: the recognise() shape and the registry the
 * report, the rules file and the fix prompts read a kit's own words from.
 * Each kit keeps its detection and its advice in its own file (mui.mjs,
 * mantine.mjs); a kit's idioms differ (MUI styles through sx, Mantine
 * through props and CSS modules), and the advice has to name them.
 */
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { countKitPaint, kitImportRe, kitPaintInSource, SKIP_PATH_RE } from '../lib/kitpaint.mjs';
import { KIT_LIST, importSources, kitOfSource, pkgRoot } from '../lib/kitlist.mjs';

// enough use to call it the kit the product is built on (Mattermost lists
// MUI and imports it in 10 of 5,737 files, 2026-09-17)
const MIN_FILES = 30;

// A second kit is named, never scored: 10 files at least, and 30 or a tenth
// of the first kit's. 13 of 80 kit products have one (2026-10-01); a kit's
// icons do not count (Stirling-PDF's 83 MUI files import only its icons).
const SECOND_MIN_FILES = 10, SECOND_FILES = 30, SECOND_SHARE = 0.1;

const readSafe = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/** kit name -> its definition, for the report, rules and prompts */
export const KITS = {};

// How many files import each registered kit, read once per repo. A repo
// belongs to the kit it imports most: Stirling-PDF imports MUI in 85 files
// and Mantine in 641 (2026-09-17).
const importCache = new Map();
const SHADCN_IMPORT_RE = /from\s+['"][@~./\w-]*components\/ui\/[\w-]+['"]/;
// a catalogue one folder down counts too: nhost imports @/components/ui/v3/button
// in 631 files and MUI in 57, and was read as MUI (2026-10-01). The lowercase
// last segment keeps its own MUI layer (components/ui/v2/Button) out.
const SHADCN_NESTED_RE = /from\s+['"][@~./\w-]*components\/ui\/(?:[\w-]+\/)+[a-z][a-z0-9-]*['"]/;
// counts: files importing each registered kit, and shadcn's catalogue.
// files: for every kit in the shared list, the files importing it, and for
// every registered kit the files importing it directly (for a second kit).
function importCounts(root, codeFiles) {
  const key = `${root}\0${codeFiles.length}`;
  if (importCache.has(key)) return importCache.get(key);
  const counts = Object.fromEntries([...Object.keys(KITS), 'shadcn'].map((k) => [k, 0]));
  const listed = Object.fromEntries(KIT_LIST.map((k) => [k.name, []]));
  const direct = Object.fromEntries(Object.keys(KITS).map((k) => [k, []]));
  for (const f of codeFiles) {
    if (!/\.[jt]sx?$/.test(f)) continue;
    const src = readSafe(join(root, f));
    for (const [k, d] of Object.entries(KITS)) if (d.importRe.test(src)) { counts[k] += 1; direct[k].push(f); }
    // a shadcn catalogue is a kit too: components/ui imports
    if (SHADCN_IMPORT_RE.test(src) || SHADCN_NESTED_RE.test(src)) counts.shadcn += 1;
    for (const name of new Set(importSources(src).map(kitOfSource).filter(Boolean))) listed[name].push(f);
  }
  const out = { counts, files: { listed, direct } };
  importCache.set(key, out);
  return out;
}

// The shallowest folder holding every one of these files and under a tenth
// of the others' (Prometheus keeps Bootstrap in web/ui/react-app and Mantine
// in web/ui/mantine-ui), or null where the two are interleaved. Every file,
// so "33 files in web/ui/react-app" is true as written. Always a folder.
function cleanFolder(mine, other) {
  for (let depth = 1; depth <= 8; depth++) {
    const by = new Map();
    for (const f of mine) {
      const segs = dirname(f).split('/');
      if (segs.length < depth || segs[0] === '.') continue;
      const dir = segs.slice(0, depth).join('/');
      by.set(dir, (by.get(dir) ?? 0) + 1);
    }
    const [dir, n] = [...by.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!dir || n < mine.length) return null;
    const theirs = other.filter((f) => f.startsWith(`${dir}/`)).length;
    if (theirs < other.length * 0.1) return dir;
  }
  return null;
}

// A second, different kit beside the first: named in the advice, never
// scored. Separate tiles for it inflated scores by 2 to 11 points, because
// the counter cannot read how those kits style (2026-10-01).
function secondKit(root, def, paint, imports, email) {
  const firstDirect = imports.files.direct[def.name] ?? [];
  const firstUse = imports.counts[def.name] ?? 0;
  const usable = (f) => !SKIP_PATH_RE.test(f);
  const found = KIT_LIST.filter((k) => k.name !== def.name)
    .map((k) => ({ name: k.name, list: (imports.files.listed[k.name] ?? []).filter(usable) }))
    .filter((c) => c.list.length >= SECOND_MIN_FILES && (c.list.length >= SECOND_FILES || c.list.length >= SECOND_SHARE * firstUse))
    .sort((a, b) => b.list.length - a.list.length || a.name.localeCompare(b.name));
  if (!found.length) return null;
  const [s, ...rest] = found;
  const firstRe = kitImportRe(def, paint.layers);
  const pkgs = new Map();
  const mixed = [], without = [];
  const mixedPaint = { colours: 0, px: 0 };
  for (const f of s.list) {
    let src;
    try { if (statSync(join(root, f)).size > 1e6) continue; src = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    for (const p of importSources(src)) if (kitOfSource(p) === s.name) pkgs.set(pkgRoot(p), (pkgs.get(pkgRoot(p)) ?? 0) + 1);
    if (!firstRe.test(src)) { without.push(f); continue; }
    mixed.push(f);
    const hits = kitPaintInSource(src, def, { file: f, layers: paint.layers, email });
    if (hits && !hits.exempt) { mixedPaint.colours += hits.colours.length; mixedPaint.px += hits.px.length; }
  }
  const firstFiles = firstDirect.filter(usable);
  return {
    second: {
      name: s.name,
      pkg: [...pkgs.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null,
      registered: !!KITS[s.name],
      files: mixed.length + without.length,
      withoutFirst: without.length,
      mixed: mixed.length,
      dir: cleanFolder(s.list, firstFiles),
      firstDir: cleanFolder(firstFiles, s.list),
      // of the colours and pixel sizes counted on the first kit, how many sit
      // in files that use both, where some may be on the second kit's components
      mixedPaint: { colours: Math.min(mixedPaint.colours, paint.colour.uses), px: Math.min(mixedPaint.px, paint.px.uses) },
    },
    ...(rest.length ? { alsoSeen: rest.map((c) => ({ name: c.name, files: c.list.length })) } : {}),
  };
}

export function kitProfile(def) {
  KITS[def.name] = def;
  const depRe = new RegExp(`"(?:${def.packages.map((p) => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})"`);
  return {
    kind: def.kind,
    recognise(profile, counts, ctx) {
      if (!ctx?.root || !ctx?.files) return null;
      // a cheap gate before reading every file: the dependency is somewhere
      const listed = def.packages.includes(profile.designSystem?.pkg)
        || (ctx.files.other ?? []).some((f) => f.endsWith('package.json') && depRe.test(readSafe(join(ctx.root, f))));
      if (!listed) return null;
      const imports = importCounts(ctx.root, ctx.files.code);
      const kitUse = imports.counts;
      if (Object.entries(kitUse).some(([k, n]) => k !== def.name && n > kitUse[def.name])) return null;
      const paint = countKitPaint(ctx.root, ctx.files.code, def, { email: ctx.files.email ?? null });
      if (paint.kitFiles < MIN_FILES) return null;
      const two = secondKit(ctx.root, def, paint, imports, ctx.files.email ?? null);
      profile.designSystem = { kind: 'kit', name: def.name, pkg: def.packages[0], confidence: 'high' };
      profile.kit = { name: def.name, ...paint, ...(two ?? {}) };
      const sk = two?.second;
      return {
        confidence: paint.themeFiles.length ? 'high' : 'medium',
        evidence: [
          `${def.name} imported in ${paint.kitFiles} files`,
          paint.themeFiles.length ? `theme defined in ${paint.themeFiles[0]}${paint.themeFiles.length > 1 ? ` and ${paint.themeFiles.length - 1} more` : ''}` : `no ${def.advice.themeCall} found: the default ${def.name} theme`,
          `the theme is referenced ${paint.refs} times from components`,
          ...(paint.layers.length ? [`the team's own layer over ${def.name} (${paint.layers.join(', ')}) counted as ${def.name}`] : []),
          ...(sk ? [`${sk.name} imported in ${sk.files} files${sk.withoutFirst ? `, ${sk.withoutFirst} of them without ${def.name}` : ''}: named, not scored`] : []),
        ],
      };
    },
  };
}
