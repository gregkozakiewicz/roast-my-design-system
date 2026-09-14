/**
 * Registry: a project that publishes components or themes for other repos
 * to install with the shadcn CLI (shadcn's own source, magicui, kibo-ui,
 * tweakcn). Read as an ordinary shadcn install, the scanner counts its
 * product range as sprawl (shadcn's source: 132 duplicates, one per base
 * library; 29 typefaces from a font picker) and files what it publishes
 * under "installed, not yours". Both wrong: what a registry publishes ships
 * into every repo that installs it.
 *
 * Release (a), 2026-09-13: recognition and the header line only. Every count
 * still reads the shadcn profile, so no score moves. Release (b) brings the
 * counting rules (variants once, published code as own code, the theme
 * check, the demo zone out). Brief: DOCs/proffer-2-notes/docs/registry-profile-brief-2026-09-13.md
 *
 * Recognised by either:
 *   1. a registry.json whose items carry registry:* types (the source file,
 *      never the built copies under public/ nor test fixtures or templates)
 *   2. a route that builds the registry from a packages folder
 *      (app/r/registry.json/route.ts, kibo-ui)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { SHADCN_ROWS } from './shadcn-data.mjs';

const readJSON = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

// registry item types → the words the report uses
const KINDS = [
  ['components', /^registry:(ui|component)$/],
  ['blocks', /^registry:block$/],
  ['styles', /^registry:(style|theme)$/],
  ['demos', /^registry:example$/],
  ['other', /^registry:(lib|hook|file|page|internal)$/],
];

function tally(items) {
  const out = { components: 0, blocks: 0, styles: 0, demos: 0, other: 0 };
  for (const it of items) {
    const t = String(it?.type ?? '');
    const k = KINDS.find(([, re]) => re.test(t));
    if (k) out[k[0]] += 1;
  }
  return out;
}

/** Sibling folders holding the same published component names: the variants of one range. */
function variantDirs(items, root) {
  const byName = new Map();
  for (const it of items) {
    if (!/^registry:(ui|component)$/.test(String(it?.type ?? ''))) continue;
    for (const f of it.files ?? []) {
      const p = typeof f === 'string' ? f : f?.path;
      if (!p) continue;
      const dir = dirname(p);
      if (!byName.has(it.name)) byName.set(it.name, new Set());
      byName.get(it.name).add(dir);
    }
  }
  const dirs = new Map();
  for (const set of byName.values()) if (set.size > 1) for (const d of set) dirs.set(d, (dirs.get(d) ?? 0) + 1);
  return [...dirs.entries()].filter(([, n]) => n >= 5).map(([d]) => d).sort();
}

/**
 * The facts a registry publishes, or null when the repo publishes nothing.
 * @returns {{ source: string, builtFrom: string|null, items: number, publishes, variants: string[] } | null}
 */
// The main walk skips docs/, public/ and test folders on purpose (they are
// not the product's design language). A registry's paperwork lives exactly
// there (kibo's route under apps/docs, tweakcn's built JSON under public), so
// recognition takes its own small look: depth-limited, noise skipped.
const LOOK_SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage', '.turbo', 'test', 'tests', '__tests__', 'fixtures', 'templates']);
function lookFor(root, maxDepth = 6) {
  const found = { registries: [], routes: [] };
  const walk = (dir, rel, depth) => {
    if (depth > maxDepth) return;
    let es; try { es = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of es) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (LOOK_SKIP.has(e.name) || (e.name.startsWith('.') && e.name !== '.')) continue;
        if (e.name === 'registry.json') {
          const route = ['route.ts', 'route.js', 'route.tsx', 'route.mjs'].find((n) => existsSync(join(dir, e.name, n)));
          if (route && basename(dir) === 'r') found.routes.push(`${r}/${route}`);
          continue;
        }
        walk(join(dir, e.name), r, depth + 1);
      } else if (e.name === 'registry.json') found.registries.push(r);
    }
  };
  walk(root, '', 0);
  return found;
}

export function readRegistry(root, files) {
  const look = lookFor(root);
  // 1. a registry.json with typed items: the source file first (the biggest
  // wins), else the built copy under public/ (tweakcn generates its registry
  // from a TypeScript file and only the built JSON exists)
  let best = null;
  const consider = (f) => {
    const j = readJSON(join(root, f));
    const items = Array.isArray(j?.items) ? j.items : null;
    if (!items || !items.some((it) => /^registry:/.test(String(it?.type ?? '')))) return;
    if (!best || items.length > best.items.length) best = { source: f, items };
  };
  const candidates = look.registries;
  for (const f of candidates.filter((f) => !/(^|\/)public\//.test(f))) consider(f);
  if (!best) for (const f of candidates.filter((f) => /(^|\/)public\//.test(f))) consider(f);
  if (best) {
    const publishes = tally(best.items);
    const itemNames = best.items.filter((it) => /^registry:(ui|component)$/.test(String(it?.type ?? ''))).map((it) => it.name).filter(Boolean);
    // item file paths are relative to the registry file's folder
    const base = dirname(best.source);
    const rel = (p) => (base === '.' ? p : `${base}/${p}`);
    const dirsOf = (re) => [...new Set(best.items.filter((it) => re.test(String(it?.type ?? '')))
      .flatMap((it) => (it.files ?? []).map((f) => (typeof f === 'string' ? f : f?.path)).filter(Boolean).map((p) => rel(dirname(p)))))].sort();
    return {
      source: best.source, builtFrom: null, items: best.items.length, publishes, variants: variantDirs(best.items, root), itemNames,
      publishedDirs: dirsOf(/^registry:(ui|component|block|lib|hook|style|theme|file|page|internal)$/),
      demoDirs: dirsOf(/^registry:example$/),
      blockDirs: dirsOf(/^registry:block$/),
      themes: themeCheck(best.items),
    };
  }
  // 2. a route that builds the registry from packages/* (kibo-ui)
  const route = look.routes[0] ?? null;
  if (route) {
    const src = readFileSync(join(root, route), 'utf8');
    if (/packages/.test(src)) {
      // the packages folder nearest the route's app, walking up
      let dir = dirname(route);
      let pkgs = null;
      while (dir && dir !== '.') {
        const cand = join(root, dir, 'packages');
        if (existsSync(cand)) { pkgs = cand; break; }
        dir = dirname(dir);
      }
      if (!pkgs && existsSync(join(root, 'packages'))) pkgs = join(root, 'packages');
      if (pkgs) {
        const names = readdirSync(pkgs, { withFileTypes: true }).filter((e) => e.isDirectory() && existsSync(join(pkgs, e.name, 'index.tsx'))).map((e) => e.name);
        const pkgRel = relative(root, pkgs).replace(/\\/g, '/');
        return { source: route, builtFrom: 'packages', items: names.length, publishes: { components: names.length, blocks: 0, styles: 0, demos: 0, other: 0 }, variants: [], itemNames: names,
          publishedDirs: names.map((nm) => `${pkgRel}/${nm}`), demoDirs: [], blockDirs: [], themes: { total: 0, incomplete: 0, worst: [] } };
      }
    }
  }
  return null;
}

/**
 * Variants found on disk: catalogue folders (the shadcn profile's uiDirs)
 * that each hold most of the published component names. shadcn's own
 * registry.json lists one file per component (new-york-v4), while the same
 * components sit again under bases/aria, bases/base and bases/radix.
 */
export function variantsFromDirs(reg, _uiDirs, files) {
  const names = new Set();
  // names come from the registry items when it is a file, else from packages
  if (reg.itemNames) for (const nm of reg.itemNames) names.add(nm);
  if (names.size < 5) return [];
  const stem = (f) => { const b = basename(f).replace(/\.[cm]?[jt]sx?$/, ''); return b === 'index' ? basename(dirname(f)) : b; };
  // every folder holding most of the published names, catalogue or not
  const byDir = new Map();
  for (const f of files.code ?? []) {
    if (!/\.[jt]sx$/.test(f)) continue;
    const d = dirname(f);
    if (!byDir.has(d)) byDir.set(d, new Set());
    byDir.get(d).add(stem(f));
  }
  const hits = [];
  for (const [d, have] of byDir) {
    const shared = [...names].filter((nm) => have.has(nm)).length;
    if (shared >= Math.max(5, Math.ceil(names.size * 0.5))) hits.push(d);
  }
  return hits.length > 1 ? hits.sort() : [];
}

/**
 * Published themes, checked: every shadcn colour variable present for light
 * and for dark. --radius is not per mode and is left out. A theme with a
 * missing row ships that gap into every repo that installs it.
 */
const THEME_ROWS = SHADCN_ROWS.filter((r) => r !== 'radius');
function themeCheck(items) {
  const worst = [];
  let total = 0, incomplete = 0;
  for (const it of items) {
    if (!/^registry:(style|theme)$/.test(String(it?.type ?? ''))) continue;
    const cv = it.cssVars ?? {};
    if (!cv.light && !cv.dark) continue;
    total += 1;
    const has = (mode) => new Set(Object.keys(cv[mode] ?? {}).map((k) => k.replace(/^--/, '')));
    const light = has('light'), dark = has('dark');
    const missingLight = THEME_ROWS.filter((r) => !light.has(r));
    const missingDark = THEME_ROWS.filter((r) => !dark.has(r));
    if (missingLight.length || missingDark.length) {
      incomplete += 1;
      if (worst.length < 6) worst.push({ name: it.name, missingLight, missingDark });
    }
  }
  return { total, incomplete, worst };
}

/**
 * What is counted on a registry: the code it publishes, one variant of it.
 * Everything else (the docs site, demos, examples, an installed catalogue
 * for the site) is kept out and named, with file counts per folder.
 */
export function scopeFiles(reg, files) {
  const under = (f, dirs) => dirs.some((d) => f === d || f.startsWith(`${d}/`));
  const published = reg.publishedDirs ?? [];
  const secondary = (reg.variants ?? []).filter((d) => !under(d, published) && !published.some((p) => p === d || p.startsWith(`${d}/`)));
  const top = (f) => { const seg = f.split('/'); return (seg[0] === 'apps' || seg[0] === 'packages') && seg.length > 2 ? seg.slice(0, 2).join('/') : seg.length > 1 ? seg[0] : '(root)'; };
  const out = { code: [], styles: [], other: files.other ?? [] };
  const showcase = new Map(), variants = new Map();
  for (const kind of ['code', 'styles']) {
    for (const f of files[kind] ?? []) {
      if (under(f, secondary)) { const d = secondary.find((v) => f.startsWith(`${v}/`)); variants.set(d, (variants.get(d) ?? 0) + 1); continue; }
      if (under(f, published)) { out[kind].push(f); continue; }
      showcase.set(top(f), (showcase.get(top(f)) ?? 0) + 1);
    }
  }
  const list = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([dir, n]) => ({ dir, files: n }));
  return { files: out, showcase: list(showcase), variantsDropped: list(variants) };
}

/** The header sentence: what it publishes, in words. */
export function publishesLine(r) {
  const parts = [];
  const n = (k, word) => { const v = r.publishes[k]; if (v) parts.push(`${v} ${word}${v === 1 ? '' : 's'}`); };
  n('components', 'component'); n('blocks', 'block'); n('styles', 'style'); n('demos', 'demo');
  return parts.length ? parts.join(', ').replace(/, ([^,]*)$/, ' and $1') : `${r.items} items`;
}
