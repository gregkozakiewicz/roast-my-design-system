/**
 * shadcn/lint (github.com/shadcn-ui/lint), read as the team's declared
 * policy. Six rules, each `"error" | "warn" | "off"` or `[level, options]`
 * with `allow`, `deny`, `contracts` and `message`. Read from their docs and
 * source (docs/rules.md, packages/lint/src/rules/contracts.ts) at
 * @shadcn/lint 0.1.0, 2026-09-15. Re-check when they release.
 *
 * Two doors: `.oxlintrc.json` is data and is read in full; `eslint.config.*`
 * is code and is read conservatively (the rule names and their allow/deny
 * arrays, by pattern). Anything the reader is not sure of is reported as
 * present and not read. Nothing here ever moves the score: what a linter
 * allows is a team decision, and the agent still reads the class.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SHADCN_LINT_VERSION_READ = '0.1.0';
export const RULES = ['no-restyle', 'no-raw-colors', 'no-arbitrary-values', 'no-inline-styles', 'no-unknown-classes', 'require-static-classes'];
/** Their rule → the roaster's tile it speaks to. Two rules have no tile. */
export const RULE_TILE = { 'no-raw-colors': 'paintTin', 'no-restyle': 'doorOverrides', 'no-arbitrary-values': 'arbitrary', 'no-inline-styles': 'inlineStyles' };
/** Category words an entry may name (docs/rules.md, Categories). Named in the report, never applied per class. */
export const CATEGORY_WORDS = new Set(['layout', 'color', 'typography', 'spacing', 'shape', 'effects', 'motion']);

/** Their glob: `*` matches any run of non-space characters (contracts.ts globToRegExp). */
export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^\\s]+');
  return new RegExp(`^${escaped}$`);
}

/** A matcher for an allow or deny list: categories named, classes tested exact or by glob. */
export function entryMatcher(entries) {
  const list = Array.isArray(entries) ? entries.filter((e) => typeof e === 'string') : [];
  const categories = list.filter((e) => CATEGORY_WORDS.has(e));
  const patterns = list.filter((e) => !CATEGORY_WORDS.has(e)).map((e) => (e.includes('*') ? globToRegExp(e) : null) ?? e);
  return {
    categories,
    classes: list.filter((e) => !CATEGORY_WORDS.has(e)),
    test: (cls) => patterns.some((p) => (p instanceof RegExp ? p.test(cls) : p === cls)),
  };
}

function ruleFromValue(v) {
  if (typeof v === 'string') return { level: v, allow: null, deny: null, contracts: [] };
  if (Array.isArray(v) && typeof v[0] === 'string') {
    const o = v[1] && typeof v[1] === 'object' ? v[1] : {};
    return {
      level: v[0],
      allow: Array.isArray(o.allow) ? o.allow.filter((e) => typeof e === 'string') : null,
      deny: Array.isArray(o.deny) ? o.deny.filter((e) => typeof e === 'string') : null,
      contracts: Array.isArray(o.contracts) ? o.contracts.filter((c) => c && typeof c.pattern === 'string').map((c) => ({ pattern: c.pattern, allow: Array.isArray(c.allow) ? c.allow : null, deny: Array.isArray(c.deny) ? c.deny : null })) : [],
    };
  }
  return null;
}

function readOxlint(path) {
  let j;
  try { j = JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
  const plugins = Array.isArray(j?.jsPlugins) ? j.jsPlugins : [];
  const ruleKeys = Object.keys(j?.rules ?? {}).filter((k) => k.startsWith('shadcn/'));
  if (!plugins.includes('@shadcn/lint') && !ruleKeys.length) return null;
  const rules = {};
  let readFully = true;
  for (const k of ruleKeys) {
    const r = ruleFromValue(j.rules[k]);
    if (r) rules[k.slice('shadcn/'.length)] = r; else readFully = false;
  }
  const overrides = (Array.isArray(j.overrides) ? j.overrides : []).filter((o) => Object.keys(o?.rules ?? {}).some((k) => k.startsWith('shadcn/'))).length;
  return { kind: 'oxlint', rules, overrides, settings: j.settings?.shadcn ?? null, readFully };
}

// A flat ESLint config is code. The rule names and the array literals next
// to them are readable by pattern; a computed value is not, and says so.
function readEslint(path) {
  let text;
  try { text = readFileSync(path, 'utf8'); } catch { return null; }
  if (!/@shadcn\/lint/.test(text)) return null;
  const rules = {};
  let readFully = true;
  const strings = (blob) => [...blob.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);
  for (const m of text.matchAll(/["']shadcn\/([\w-]+)["']\s*:\s*/g)) {
    const name = m[1];
    let i = m.index + m[0].length;
    const rest = text.slice(i);
    const lvl = rest.match(/^["'](error|warn|off)["']/);
    if (lvl) { rules[name] = { level: lvl[1], allow: null, deny: null, contracts: [] }; continue; }
    const arr = rest.match(/^\[\s*["'](error|warn|off)["']\s*(,|\])/);
    if (!arr) { rules[name] = { level: null, allow: null, deny: null, contracts: [], unread: true }; readFully = false; continue; }
    // the options object: balanced braces after the level
    let j = arr[0].length, depth = 0, start = -1, end = -1;
    for (; j < rest.length; j++) {
      const ch = rest[j];
      if (ch === '{') { if (depth === 0) start = j; depth++; }
      else if (ch === '}') { depth--; if (depth === 0) { end = j; break; } }
      else if (depth === 0 && ch === ']') break;
    }
    const blob = start >= 0 && end > start ? rest.slice(start, end + 1) : '';
    const list = (key) => { const mm = blob.match(new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*)\\]`)); return mm ? strings(mm[1]) : null; };
    const contracts = [...blob.matchAll(/pattern\s*:\s*["']([^"']+)["']/g)].map((c) => ({ pattern: c[1], allow: null, deny: null }));
    rules[name] = { level: arr[1], allow: list('allow'), deny: list('deny'), contracts };
    if (blob && /\b(allow|deny)\s*:\s*(?![\[\s])/.test(blob)) readFully = false; // a variable, not a literal list
  }
  return { kind: 'eslint', rules, overrides: 0, settings: null, readFully };
}

/**
 * The first shadcn/lint config found, root first, then the folders given
 * (workspace roots that carry a components.json). Null when there is none.
 */
export function readShadcnLint(root, dirs = []) {
  const seen = new Set();
  for (const d of [root, ...dirs.map((x) => join(root, x))]) {
    if (seen.has(d)) continue;
    seen.add(d);
    const ox = join(d, '.oxlintrc.json');
    if (existsSync(ox)) { const r = readOxlint(ox); if (r) return { file: relative(root, ox) || '.oxlintrc.json', ...r }; }
    for (const n of ['eslint.config.mjs', 'eslint.config.js', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts']) {
      const p = join(d, n);
      if (existsSync(p)) { const r = readEslint(p); if (r) return { file: relative(root, p), ...r }; }
    }
  }
  return null;
}

/** Rules switched on (level error or warn), in their documented order. */
export const rulesOn = (lint) => RULES.filter((r) => lint?.rules?.[r] && lint.rules[r].level !== 'off');

/** One line per rule, the way the report and the rules file say it. */
export function describeRule(name, r) {
  const bits = [];
  if (r.level === 'warn') bits.push('as a warning');
  if (r.allow?.length) bits.push(`allows ${r.allow.map((e) => (CATEGORY_WORDS.has(e) ? e : `\`${e}\``)).join(', ')}`);
  if (r.deny?.length) bits.push(`denies ${r.deny.map((e) => `\`${e}\``).join(', ')}`);
  if (r.contracts?.length) bits.push(`${r.contracts.length} component contract${r.contracts.length === 1 ? '' : 's'}`);
  if (r.unread) bits.push('options not read');
  return `${name}${bits.length ? ` (${bits.join('; ')})` : ''}`;
}
