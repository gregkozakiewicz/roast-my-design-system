/**
 * Tailwind — a repo with its own named theme and no component kit on top.
 * Every shadcn repo is a Tailwind repo; this profile is the other half: the
 * team wrote their own vocabulary (`--color-surface`, `--color-brand`) in a
 * Tailwind v4 `@theme` block and use it as classes. Until now those repos
 * got no theme check at all, because the check lived in the shadcn profile.
 *
 * Phase 1 reads v4 only (Greg, 2026-09-16). A v4 theme is named variables in
 * a CSS file, the same shape the shadcn sheet reader handles. A v3 theme is
 * colours inside a JavaScript config that can import, spread and compute, so
 * reading it means running code or guessing; that is its own release.
 *
 * Fleet probe 2026-09-16 (61 clones): 40 use Tailwind, 34 have their own
 * named theme, 10 of those have no shadcn. The check discriminates on them:
 * trigger.dev 679 palette classes against 4,512 uses of its own names,
 * documenso 442 against 2,369.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETTE } from './shadcn-data.mjs';
import { TAILWIND_DEFAULTS } from './tailwind-defaults.mjs';
import { canonical, parseColor } from '../lib/color.mjs';

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
// Tailwind's own palette names (plus the black, white and keyword colours it also
// ships): a theme that restates them adds no vocabulary
const PALETTE_NAME_RE = new RegExp(`^(?:(?:${PALETTE})(?:-(?:50|[1-9]00|950))?|black|white|transparent|current|inherit)$`);
// A restated palette name counts as the repo's own when its value was changed on
// purpose: Hugging Face Chat redefines all eleven greys, Plausible points yellow
// at amber (2026-09-16). A copy of Tailwind's own value adds nothing.
const near = (a, b) => a.split(',').every((x, i) => Math.abs(Number(x) - Number(b.split(',')[i])) <= 2);
function retuned(name, value) {
  const v = value.replace(/\s+/g, ' ').trim().toLowerCase();
  const d = TAILWIND_DEFAULTS[name];
  if (d === undefined || v === d.toLowerCase()) return false;
  if (v === `var(--color-${name})` || v === 'initial') return false;
  const cv = canonical(v), cd = canonical(d);
  return !(cv && cd && near(cv, cd));
}

// what counts as a theme worth judging
// three, not six: a small brand palette used everywhere is still a system
// (hey.xyz: four brand shades; ConvertX: four colours, 2026-09-16)
const MIN_NAMES = 3;
const MIN_USES = 20;

/** Colour variables declared in @theme blocks: name → value, first wins. */
function readTheme(root, styleFiles) {
  let best = null;
  for (const f of styleFiles ?? []) {
    const css = read(join(root, f));
    if (!/@theme/.test(css)) continue;
    const names = new Map();
    for (const m of css.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g)) {
      for (const d of m[1].matchAll(/--color-([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
        if (!names.has(d[1])) names.set(d[1], d[2].trim());
      }
    }
    if (!names.size) continue;
    const tuned = [...names].filter(([n, v]) => PALETTE_NAME_RE.test(n) && retuned(n, v)).map(([n]) => n);
    const own = [...names.keys()].filter((n) => !PALETTE_NAME_RE.test(n) || tuned.includes(n));
    if (!best || own.length > best.own.length) best = { file: f, names, own, tuned };
  }
  return best;
}

// Which kinds of colour the theme names: greys, real colours, or both. A palette
// grey is only drift when the theme has a grey of its own to use instead
// (hey.xyz names four brand pinks and no grey, 2026-09-16).
const GREY_NAME_RE = /gr[ae]y|neutral|slate|zinc|stone|surface|background|foreground|(^|-)(bg|fg|text|border|line|divider|muted|ink|base|canvas|charcoal|contrast)(-|\d|$)/;
function themeFamilies(root, styleFiles, names) {
  const defs = new Map();
  for (const f of styleFiles ?? []) {
    for (const d of read(join(root, f)).matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) if (!defs.has(d[1])) defs.set(d[1], d[2].trim());
  }
  const resolve = (v, depth = 0) => {
    const m = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
    if (!m) return v;
    if (depth > 4) return null;
    const pal = /^--color-(.+)$/.exec(m[1]);
    const next = defs.get(m[1]) ?? (pal ? TAILWIND_DEFAULTS[pal[1]] : undefined) ?? m[2];
    return next === undefined ? null : resolve(next.trim(), depth + 1);
  };
  const out = { grey: false, colour: false };
  for (const [n, v] of names) {
    const c = parseColor(resolve(v) ?? '');
    const grey = c ? Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) <= 12 : GREY_NAME_RE.test(n);
    out[grey ? 'grey' : 'colour'] = true;
  }
  return out;
}

/** How often the repo writes its own names as classes (bg-surface, text-brand),
 *  in markup or in a stylesheet's @apply line (nodejs.org styles through CSS
 *  modules: 521 uses in @apply, almost none in its components, 2026-09-16). */
function countUses(root, codeFiles, styleFiles, own) {
  if (!own.length) return { uses: 0, files: 0 };
  const re = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:bg|text|border|ring|outline|from|to|via|fill|stroke|divide|decoration|placeholder|caret|accent|shadow)-(?:${own.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
  let uses = 0, files = 0;
  for (const f of codeFiles) {
    if (!/\.(tsx|jsx|ts|js|mjs|vue|svelte|astro|html)$/.test(f)) continue;
    const n = (read(join(root, f)).match(re) ?? []).length;
    if (n) { uses += n; files += 1; }
  }
  for (const f of styleFiles ?? []) {
    const applies = read(join(root, f)).match(/@apply[^;}]*/g) ?? [];
    const n = applies.reduce((sum, a) => sum + (a.match(re) ?? []).length, 0);
    if (n) { uses += n; files += 1; }
  }
  return { uses, files };
}

export default {
  kind: 'tailwind',

  /**
   * @param profile the profiler's facts (mutated: designSystem, tailwind)
   * @param counts reusable/pages/codeFiles
   * @param ctx { root, files }
   */
  recognise(profile, counts, ctx) {
    if (!ctx?.root || !ctx?.files) return null;
    const { root, files } = ctx;
    const twRaw = profile.stylingDeps?.includes('Tailwind CSS') || /tailwind/i.test((profile.stylingDeps ?? []).join(' '))
      ? profile.tailwindVersion ?? null : null;
    // the dependency is the only claim that the repo is a Tailwind repo
    if (!(profile.stylingDeps ?? []).some((d) => /tailwind/i.test(d))) return null;

    // Svelte and Vue files are not read yet, so their class uses cannot be
    // counted: Hugging Face Chat writes its greys 1,591 times in .svelte and
    // would be told its theme is "not adopted yet" (2026-09-16). Stand aside.
    const blind = (files.other ?? []).filter((f) => /\.(svelte|vue)$/.test(f)).length;
    const seen = (files.code ?? []).filter((f) => /\.(tsx|jsx)$/.test(f)).length;
    if (blind > seen) return null;

    const theme = readTheme(root, files.styles);
    if (!theme || theme.own.length < MIN_NAMES) return null;
    const { uses, files: usedIn } = countUses(root, files.code, files.styles, theme.own);
    // A theme nothing in the repo uses is not this repo's system: it is a
    // package's default theme sitting in the tree (tailwindlabs/tailwindcss
    // ships Tailwind's own, 2026-09-16). Under 20 uses is "defined, not
    // adopted yet" and still worth reporting; zero is not a claim at all.
    if (uses === 0) return null;

    const evidence = [
      `${theme.own.length} colour variables of its own in ${theme.file}${theme.names.size > theme.own.length ? ` (${theme.names.size - theme.own.length} restate Tailwind's palette unchanged and are not counted as vocabulary)` : ''}${theme.tuned.length ? `, ${theme.tuned.length} of them Tailwind names given new colours` : ''}`,
      uses >= MIN_USES
        ? `used as classes ${uses} times across ${usedIn} files`
        : `used as classes ${uses} times: defined, but not adopted yet`,
      twRaw ? `Tailwind ${twRaw}` : 'Tailwind v4 theme block',
    ];
    profile.designSystem = { kind: 'tailwind', name: 'a Tailwind theme', confidence: 'high', cssVariables: true };
    profile.tailwind = {
      file: theme.file,
      names: theme.own,
      restated: theme.names.size - theme.own.length,
      // Tailwind names given the repo's own colours: on-theme, never drift
      retuned: theme.tuned,
      // which palette classes have a theme colour to stand in for them
      families: themeFamilies(root, files.styles, theme.own.map((x) => [x, theme.names.get(x)])),
      uses,
      usedIn,
      // a theme nobody uses is not the system yet: shown with receipts, not scored
      adopted: uses >= MIN_USES,
    };
    return { confidence: uses >= MIN_USES ? 'high' : 'medium', evidence };
  },
};
