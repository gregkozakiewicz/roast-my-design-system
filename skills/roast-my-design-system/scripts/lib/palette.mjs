/**
 * Palette classes where the theme names its colours: one rule, read by the
 * report's live checks (validate, review, --check, the edit hook, the
 * end-of-turn review) and by the guard through the doorway.
 *
 * Until 9.4.0 the rule lived twice. The live checks switched it on for a
 * Tailwind theme and for any shadcn repo; the guard switched it on only for
 * a shadcn repo whose configured sheet held five of shadcn's rows under
 * :root. Probed on the fleet (2026-10-01): the guard was silent on 11 of 48
 * shadcn repos where the live checks spoke (formbricks writes its theme
 * straight into @theme, documenso names no sheet path, Nango and Ghost keep
 * a v4 theme of their own and no shadcn rows), and the live checks flagged
 * 1,394 palette classes in rybbit's last 300 changes where the report says
 * the palette is the theme (utility-class mode). A rule kept in two places
 * drifts; this is the one place.
 *
 * decidePalette answers once, from the profile, which vocabulary a palette
 * class is judged against (profiles/index.mjs stores it as profile.palette):
 *   1. a Tailwind theme in use: its own names, with the theme's families
 *      (a palette grey is only drift where the theme has a grey) and its
 *      retuned names (a palette name given the repo's own colour is the
 *      theme, not drift)
 *   2. a shadcn install in CSS-variable mode whose theme contract holds,
 *      five or more of shadcn's ten rows in any of its stylesheets: shadcn's
 *      names
 *   3. a shadcn install with no contract but a v4 theme of its own: that
 *      theme's names, as in 1
 *   4. utility-class mode (the palette is the theme, as the report says), or
 *      nothing to point at: off
 * paletteFindings words the hits, the same words on every door: the class,
 * the theme file, the theme colour nearest by value that suits the utility,
 * and what to add when none fits.
 */
import { PALETTE_CLASS_RE, GREY_HUE_RE, DARK_WB_RE, DEMO_PATH_RE, blankComments } from '../harvest/paint.mjs';
import { TAILWIND_DEFAULTS } from '../profiles/tailwind-defaults.mjs';
import { oklab } from './color.mjs';
import { doorFile } from '../profiles/installed.mjs';

// shadcn's names, one per role the utilities want; the sheet always has
// greys and colours, so no family check
const SHADCN_NAMES = ['primary', 'foreground', 'muted-foreground', 'background', 'border'];
// rows of shadcn's contract that make the sheet the vocabulary
export const CONTRACT_MIN = 5;
const CSS_FILE_RE = /\.(css|scss|sass|less|styl)$/i;

const fromTheme = (t, doors) => ({
  source: 'tailwind', file: t.file, names: t.names, values: t.values ?? {}, retuned: t.retuned ?? [],
  families: t.families ?? null, adopted: t.adopted !== false, doors,
});

/**
 * The vocabulary a palette class is judged against, or null when the rule
 * is off. `readTheme()` reads the repo's own v4 theme on demand (case 3),
 * the same reader the Tailwind profile uses.
 * @returns {{ source, file, names, values, retuned, families, adopted?, doors } | null}
 */
export function decidePalette(profile, P, readTheme = null) {
  if (P.isTailwind && profile.tailwind) return fromTheme(profile.tailwind, []);
  if (!P.isShadcn || !profile.shadcn) return null;
  const sc = profile.shadcn;
  // utility-class mode: the palette is the theme, and the report scores it so
  if (P.designSystem?.cssVariables === false) return null;
  // shadcn's own components and kit blocks are the kit's doors: editing them
  // is the intended use, and the report's tile leaves them out. A component
  // of the team's own kept in the catalogue folder is not a door (9.5.0).
  const doors = { uiDirs: [...(P.uiDirs ?? [])], shadcn: { blockFiles: [...(sc.blockFiles ?? [])] } };
  const rows = Math.max(sc.sheet?.shadcnPresent ?? 0, sc.contract?.rows ?? 0);
  if (rows >= CONTRACT_MIN) {
    return {
      source: 'shadcn', file: sc.sheet?.found ? sc.sheet.file : sc.contract?.file ?? null,
      names: SHADCN_NAMES, values: {}, retuned: [], families: null, doors,
    };
  }
  const own = typeof readTheme === 'function' ? readTheme() : null;
  return own ? fromTheme(own, doors) : null;
}

/**
 * The palette classes in a piece of text that the vocabulary answers, each
 * with the fix in the engine's words. Empty when the rule is off, on a
 * stylesheet, in a demo folder or inside a kit door. `index` is the class's
 * position in `text`; comments are blanked, not cut, so it holds.
 * @returns [{ rule: 'palette-class', severity: 'violation', index, value, themeFile, example, message, fix }]
 */
export function paletteFindings(text, palette, { file = null, css = null } = {}) {
  if (!palette || !text) return [];
  if (css ?? (file ? CSS_FILE_RE.test(file) : false)) return [];
  if (file && (DEMO_PATH_RE.test(file) || doorFile(palette.doors, file))) return [];
  const themeFile = palette.file ?? 'the theme sheet';
  // the example name follows the utility: a text- class wants an ink or
  // foreground name, a bg- class a surface or background name
  const names = palette.names ?? [];
  const pick = (re) => names.find((n) => re.test(n)) ?? names[0] ?? 'brand';
  const values = palette.values ?? {};
  // a class named in a comment paints nothing; blanked, not cut, so the
  // indexes still point at their line
  const out = [];
  for (const m of driftClasses(blankComments(text), palette)) {
    const cls = m[0];
    const util = cls.replace(/^((?:[\w-]+:)*[a-z]+)-.*$/, '$1');
    const shade = cls.replace(/^(?:[\w-]+:)*[a-z]+-/, '').replace(/\/\d+$/, '');
    const role = utilRole(util);
    // the theme colour nearest by value among the names that suit the
    // utility; the pick by name alone only when none is close
    const example = nearestThemeName(shade, role, values)
      ?? (role === 'text' ? pick(/ink|text|fg|foreground/) : role === 'surface' ? pick(/surface|bg|background|canvas/) : pick(/border|edge|line|ring/));
    const word = hueWord(shade, names);
    out.push({
      rule: 'palette-class', severity: 'violation', index: m.index, value: cls, themeFile, example: `${util}-${example}`,
      message: `Palette class ${cls} where the theme names its colours (${themeFile}).`,
      fix: `Use a theme token as the class (${util}-${example}). ${names.includes(word)
        ? `If no token fits, add ${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word} shade to the theme once and use it by name.`
        : `If no token fits, add one to the theme once, for example ${word}, and use ${util}-${word}.`}`,
    });
  }
  return out;
}

/**
 * The palette classes in already comment-blanked code that the rule calls
 * drift, as regex matches in text order: the one filter paletteFindings words
 * and the report's colour-use bar (harvest/coloruse.mjs) reads, so the bar
 * calls a class a stray exactly where the live checks do. A palette name the
 * theme gave its own colour is the theme, and a palette grey is only drift
 * where the theme has a grey (families). The caller leaves out stylesheets,
 * demo folders and kit doors, as paletteFindings does. `paletteHits`, when
 * given, is PALETTE_CLASS_RE's own matches over `code`.
 * @returns RegExpMatchArray[]
 */
export function driftClasses(code, palette, paletteHits = null) {
  if (!palette || !code) return [];
  const retuned = new Set(palette.retuned ?? []);
  const fam = palette.families ?? null;
  const hasFamily = (cls) => !fam || (GREY_HUE_RE.test(cls) ? fam.grey : fam.colour);
  // a caller that already ran PALETTE_CLASS_RE over `code` hands its matches in
  const hits = paletteHits ? [...paletteHits] : [...code.matchAll(PALETTE_CLASS_RE)];
  // the evening override painted by hand (dark:bg-black) is the same sin on a
  // shadcn sheet, which always has a dark row of its own
  if (palette.source === 'shadcn') hits.push(...code.matchAll(DARK_WB_RE));
  return hits.sort((a, b) => a.index - b.index).filter((m) => {
    const shade = m[0].replace(/^(?:[\w-]+:)*[a-z]+-/, '').replace(/\/\d+$/, '');
    return !retuned.has(shade) && hasFamily(m[0]);
  });
}

/**
 * The theme class that stands in for a palette class, or null: the theme's
 * own word for the hue when it has one (text-red-500 on a theme naming
 * destructive is text-destructive), else the suitable theme colour nearest
 * by value. For the rules file's example (9.5.0).
 */
export function themeClassFor(cls, names = [], values = {}) {
  const util = cls.replace(/^((?:[\w-]+:)*[a-z]+)-.*$/, '$1').replace(/^(?:[\w-]+:)*/, '');
  const shade = cls.replace(/^(?:[\w-]+:)*[a-z]+-/, '').replace(/\/\d+$/, '');
  const word = hueWord(shade, names);
  if (names.includes(word)) return `${util}-${word}`;
  const near = nearestThemeName(shade, utilRole(util), values);
  return near ? `${util}-${near}` : null;
}

// ---------- the theme colour a palette class stands in for ----------
// Which theme names suit a utility, read from the name: a text class wants an
// ink, a bg class a surface, a border class an edge. A name that says none of
// these (brand, warning, positive) is an accent and suits every utility.
const TEXT_NAME_RE = /ink|text|fg|foreground/;
const SURFACE_NAME_RE = /surface|(^|-)bg(-|$)|background|canvas|soft|tint|wash/;
const EDGE_NAME_RE = /border|edge|line|ring|divider|outline/;
function utilRole(util) {
  if (/(^|:)(?:text|placeholder|caret|decoration|fill|stroke)$/.test(util)) return 'text';
  if (/(^|:)bg$/.test(util)) return 'surface';
  if (/(^|:)(?:border|ring|outline|divide)$/.test(util)) return 'edge';
  return 'any';
}
function suits(name, role) {
  const text = TEXT_NAME_RE.test(name), surface = SURFACE_NAME_RE.test(name), edge = EDGE_NAME_RE.test(name);
  if (role === 'any' || (!text && !surface && !edge)) return true;
  return role === 'text' ? text && !surface && !edge : role === 'surface' ? surface : edge;
}
// Distance in OKLab with the two colour axes doubled, so a pale amber lands on
// the pale warning surface rather than on the near-white canvas beside it.
const hueDistance = (x, y) => Math.hypot(x.L - y.L, 2 * (x.a - y.a), 2 * (x.b - y.b));
// Past this, the nearest theme colour is a different colour, not a stand-in
// (bg-blue-600 against a theme of greys), and the pick by name answers.
const CLOSE = 0.2;
// A grey class stands in for a grey only. Tailwind's greys sit at a chroma
// of 0.01 to 0.045 (slate is the most tinted); a brand teal at the same
// lightness sits at 0.095 and was within CLOSE of slate-500, so formbricks'
// text-slate-500 was sent to text-brandnew (2026-10-01).
const GREY_CHROMA = 0.06;
/** The suitable theme name nearest to a palette shade's Tailwind value, or null. */
function nearestThemeName(shade, role, values) {
  const from = oklab(TAILWIND_DEFAULTS[shade] ?? '');
  if (!from) return null;
  const grey = GREY_HUE_RE.test(`-${shade}`);
  let best = null;
  for (const [name, value] of Object.entries(values)) {
    if (!suits(name, role)) continue;
    const to = oklab(value);
    if (!to) continue;
    if (grey && Math.hypot(to.a, to.b) > GREY_CHROMA) continue;
    const d = hueDistance(from, to);
    if (!best || d < best.d) best = { name, d };
  }
  return best && best.d <= CLOSE ? best.name : null;
}
// The word for a new token follows the hue, in the theme's own vocabulary when
// it has one (Ledgerly says positive and negative, not success and danger).
const HUE_WORDS = [
  [/^(?:red|rose)-/, ['negative', 'danger', 'error', 'destructive']],
  [/^(?:orange|amber|yellow)-/, ['warning', 'caution']],
  [/^(?:green|emerald|lime)-/, ['positive', 'success']],
  [/^(?:blue|sky|cyan)-/, ['info']],
];
function hueWord(shade, names) {
  const words = HUE_WORDS.find(([re]) => re.test(shade))?.[1];
  if (!words) return GREY_HUE_RE.test(`-${shade}`) ? 'muted' : 'accent';
  return words.find((w) => names.some((n) => n === w || n.startsWith(`${w}-`)))
    ?? { negative: 'danger', warning: 'warning', positive: 'success', info: 'info' }[words[0]];
}
