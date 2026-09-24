/**
 * Twin tokens: a new colour token whose value is a near-identical copy of a
 * token the system already has (--color-overdue-soft: #fff4e5 next to
 * --color-warning-soft: #fdf5e6). Found on the Ledgerly demo (2026-09-24): an
 * agent asked to "match the spec exactly" minted six such tokens, the strays
 * in an old component then equalled a token and stopped counting, and the
 * score read the drift as progress. The live checks judge a stylesheet with
 * this file; the report counts the same pairs through lib/nearpairs.mjs.
 *
 * Near means every channel within 8, as everywhere else in the engine, and,
 * because both sides are deliberate tokens, closer than the eye can tell
 * (TWIN_OKLAB). A shared dark value counts too, because two tokens that agree in
 * the dark are one colour even when their light values drifted a little further
 * apart (up to DARK_TWIN_STEPS).
 *
 * Only named roles take part. A ramp stop (gray-100, blue-500) sits close to
 * its neighbours by design, a restated palette (slate-50 beside gray-50) is
 * Tailwind's, and the rows shadcn's theming docs define share values on
 * purpose (card and popover are both white). Two names in one family
 * (brand, brand-strong) are a designed pair, not twins.
 */
import { canonical, oklab } from './color.mjs';
import { KNOWN_ROWS } from '../profiles/shadcn-data.mjs';

export const TWIN_STEPS = 8;
// Two tokens are deliberate, so a pair of them must also be closer than the
// eye can tell (OKLab distance 0.01; a just-noticeable difference is about
// 0.02). The channel rule alone paired Ledgerly's pale red and pale amber
// surfaces (6 steps, 0.019) and its canvas with its muted surface (4 steps,
// 0.012), each a designed neighbour; the six tokens the agent minted sat at
// 0.003 to 0.009.
export const TWIN_OKLAB = 0.01;
// A shared dark value makes two tokens one colour when their light values are
// close enough that roast_find_token would already say "use the token" (24
// steps). Past that, two roles that meet in the dark are a design decision.
export const DARK_TWIN_STEPS = 24;

const bare = (name) => name.replace(/^--/, '').replace(/^(?:colou?rs?|clr)-/, '');
/** A token named for a role (warning-soft), not a ramp stop or a kit row. */
export function isRoleName(name) {
  const b = bare(name);
  return !KNOWN_ROWS.has(b) && !/(^|-)\d+$/.test(b);
}
/** The first word of the role: overdue-soft and overdue-title are one family. */
export const familyOf = (name) => bare(name).split('-')[0];

const rgbOf = (canon) => {
  if (!canon) return null;
  const [r, g, b, a] = canon.split(',').map(Number);
  return { r, g, b, a };
};
const okOf = (canon) => {
  const c = rgbOf(canon);
  return c ? oklab(`rgb(${c.r} ${c.g} ${c.b})`) : null;
};
/** Straight-line OKLab distance between two canonical colours, or null. */
export function okDistance(x, y) {
  const a = okOf(x), b = okOf(y);
  return a && b ? Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b) : null;
}
/** Two token colours close enough to be one colour under two names. */
export function tokenTwinColours(x, y) {
  const d = channelSteps(x, y);
  return d !== null && d <= TWIN_STEPS && (okDistance(x, y) ?? 1) <= TWIN_OKLAB;
}

/** Largest channel difference, or null when the alphas differ. */
export function channelSteps(x, y) {
  const a = rgbOf(x), b = rgbOf(y);
  if (!a || !b || a.a !== b.a) return null;
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

const DARK_RE = /dark/i;

/**
 * Every colour custom property a stylesheet defines, by name: the base value
 * (the first statement outside a dark block) and the dark value (the first
 * statement inside one: .dark, [data-theme="dark"], a prefers-color-scheme
 * query). Values are kept as written and as a canonical colour; a name whose
 * value is not a literal colour (an alias to var(--x)) is left out.
 * @returns Map<name, { value, canon, index, darkValue?, darkCanon? }>
 */
export function tokenDefsOf(raw) {
  // comments blanked, offsets kept: a retired token in a comment is not a token
  const text = String(raw ?? '').replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  // the blocks, each with the selector that opened it
  const blocks = [], stack = [];
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      stack.push({ start: i, selector: text.slice(from, i).trim().split('\n').pop().trim() });
      from = i + 1;
    } else if (ch === '}') {
      const b = stack.pop();
      if (b) blocks.push({ ...b, end: i });
      from = i + 1;
    } else if (ch === ';') from = i + 1;
  }
  const inDark = (i) => blocks.some((b) => b.start < i && i < b.end && DARK_RE.test(b.selector));
  const defs = new Map();
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g)) {
    const [, name, rawValue] = m;
    const value = rawValue.trim();
    const canon = canonical(value);
    if (!canon) continue;
    const e = defs.get(name) ?? {};
    if (inDark(m.index)) {
      if (!e.darkValue) Object.assign(e, { darkValue: value, darkCanon: canon });
    } else if (!e.value) Object.assign(e, { value, canon, index: m.index });
    defs.set(name, e);
  }
  // a name stated only inside a dark block has no base to compare
  for (const [name, e] of defs) if (!e.canon) defs.delete(name);
  return defs;
}

/**
 * The existing token a token is a twin of, or null. `pool` is
 * [{ name, canon, value, darkCanon?, darkValue?, file? }].
 */
export function twinOf(name, def, pool) {
  if (!isRoleName(name)) return null;
  const fam = familyOf(name);
  let best = null;
  for (const e of pool) {
    if (e.name === name || !isRoleName(e.name) || familyOf(e.name) === fam) continue;
    const d = channelSteps(def.canon, e.canon);
    const near = tokenTwinColours(def.canon, e.canon);
    const darkSame = !!def.darkCanon && def.darkCanon === e.darkCanon;
    if (!near && !(darkSame && d !== null && d <= DARK_TWIN_STEPS)) continue;
    // the closest light value wins; a shared dark value breaks a tie
    const rank = (near ? 0 : 1000) + (d ?? 999) - (darkSame ? 0.5 : 0);
    if (!best || rank < best.rank) best = { ...e, d, near, darkSame, rank };
  }
  return best;
}

// the utility a role name suits, for the class the fix names
const utilFor = (name) => (/border|edge|line|ring|divider|outline/.test(name) ? 'border'
  : /text|title|ink|fg|foreground|label/.test(name) ? 'text' : 'bg');

/**
 * Worded findings for the tokens a stylesheet ADDS that twin an existing one.
 * @param text     the stylesheet as it stands now
 * @param before   the same file before the change (the last commit), null for
 *                 a new file, undefined when unknown: every token in it is
 *                 then judged, against the rest of the repo and each other
 * @param others   tokens other files define: [{ name, canon, value, darkCanon?, darkValue?, file }]
 * @param tailwind true when --color-* names are Tailwind theme classes
 * @returns [{ rule: 'twin-token', index, name, twin, message, fix }]
 */
export function tokenTwinFindings(text, { before, others = [], tailwind = false } = {}) {
  const now = tokenDefsOf(text);
  if (!now.size) return [];
  const prev = before === undefined ? null : tokenDefsOf(before ?? '');
  const isNew = (name) => !prev || !prev.has(name);
  // what already exists: other files, and this file's own tokens that were
  // there before the change (at today's values)
  const pool = [...others.filter((o) => !now.has(o.name))];
  for (const [name, e] of now) if (!isNew(name)) pool.push({ name, ...e });
  const out = [];
  for (const [name, def] of [...now].sort((a, b) => a[1].index - b[1].index)) {
    if (!isNew(name)) continue;
    const twin = twinOf(name, def, pool);
    // judged in file order: a later new token may twin an earlier new one
    pool.push({ name, ...def, added: true });
    if (!twin) continue;
    const cls = tailwind && /^--colou?r-/.test(twin.name) ? `${utilFor(bare(name))}-${bare(twin.name)}` : null;
    const where = twin.file ? ` in ${twin.file}` : '';
    // "existing" only when it is: without a before, nothing in this file is known to be old
    const whose = twin.added ? (prev ? 'the new' : 'the token') : prev || twin.file ? 'the existing' : 'the token';
    const lead = twin.near
      ? `${name} (${def.value}) is a twin of ${whose} ${twin.name} (${twin.value})${where}: ${twin.d === 0 ? 'the same colour' : `${twin.d} channel step${twin.d === 1 ? '' : 's'} apart`}${twin.darkSame ? `, and the same dark value (${def.darkValue})` : ''}.`
      : `${name} has the same dark value as ${whose} ${twin.name}${where} (${def.darkValue}), and its light value is only ${twin.d} channel steps away (${def.value} against ${twin.value}).`;
    out.push({
      rule: 'twin-token', index: def.index, name, twin: twin.name,
      message: `${lead} Two names for one colour: the next agent cannot tell which is right.`,
      fix: `Use ${twin.name}${cls ? ` (as a class: ${cls})` : ''} and remove ${name}. Do not add a token that duplicates an existing one.`,
    });
  }
  return out;
}
