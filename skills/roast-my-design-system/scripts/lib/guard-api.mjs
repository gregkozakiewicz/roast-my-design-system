/**
 * guard-api — the one official doorway into the engine for OTHER packages.
 *
 * guard-my-design-system imports this file (through the roast npm package's
 * "./engine" export). Everything else in the engine stays private and free to
 * refactor; what is exported here is a public promise — rename or reshape it
 * only with a deliberate version bump and a changelog line.
 *
 * Kept deliberately narrow: learn what the repo's system is, scan a piece of
 * text for styling, and say which on-system value a stray most resembles.
 */
import { extname } from 'node:path';
import { walkRepo } from '../harvest/walk.mjs';
import { harvestTokens, extractStyling, normalizeHex, isGrey } from '../harvest/tokens.mjs';
import { loadExclusions } from './exclusions.mjs';
import { hexRgb } from './nearpairs.mjs';
import { typefaceOf, GENERIC_FONTS } from './typefaces.mjs';

export { extractStyling, normalizeHex, isGrey, hexRgb, typefaceOf, GENERIC_FONTS };

// Same classification walkRepo uses, exposed so a caller looking at one file
// (a diff hunk) treats it the way the full scan would.
const CODE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs']);
const STYLE_EXTS = new Set(['.css', '.scss', '.sass', '.less']);
export const isCodeFile = (p) => CODE_EXTS.has(extname(p));
export const isStyleFile = (p) => STYLE_EXTS.has(extname(p));

/**
 * Scan the whole repo once and return what its design system IS — the
 * reference a guard judges new lines against. Respects .roastignore.
 *
 * Returns {
 *   tokenFile,        // the file defining the most --vars, or null
 *   colors,           // [{ value, count, isToken, files }] every colour seen
 *   tokens,           // shorthand: just the token colour values
 *   spacing,          // [{ value, count, files }] every length seen
 *   fontFamilies,     // [{ value, count, files }] every family declared
 *   tailwind,         // { colors, spacing, radii, textSizes, arbitrary }
 *   files,            // { styles: n, code: n } — how much was read
 * }
 */
export function learnSystem(repoRoot, { exclude = [] } = {}) {
  const exclusions = loadExclusions(repoRoot, exclude);
  const files = walkRepo(repoRoot, 14, exclusions);
  const t = harvestTokens(repoRoot, files.styles, files.code);
  return {
    tokenFile: t.tokenFile,
    colors: t.colors,
    tokens: t.colors.filter((c) => c.isToken).map((c) => c.value),
    spacing: t.spacing,
    fontFamilies: t.fontFamilies,
    tailwind: t.tailwind,
    files: { styles: files.styles.length, code: files.code.length },
  };
}

/**
 * The token a stray colour most resembles. Distance is the largest channel
 * difference (the same yardstick nearColorPairs uses), so "8" here means what
 * "near-identical" means everywhere else in the engine. Hex-parseable values
 * only; returns { value, distance } or null.
 */
export function nearestColor(value, tokenValues) {
  const target = hexRgb(normalizeHex(value));
  if (!target) return null;
  let best = null;
  for (const t of tokenValues) {
    const rgb = hexRgb(t);
    if (!rgb || rgb.a !== target.a) continue;
    const d = Math.max(Math.abs(rgb.r - target.r), Math.abs(rgb.g - target.g), Math.abs(rgb.b - target.b));
    if (d === 0) continue; // identical to a token: not a stray at all
    if (!best || d < best.distance) best = { value: t, distance: d };
  }
  return best;
}

/**
 * The on-scale length a stray spacing value most resembles. Same-unit
 * comparison only (12px is not "near" 0.75rem here; unit conversion is a
 * judgement the guard should not fake). Returns { value, distance } or null.
 */
export function nearestLength(value, scaleValues) {
  const parse = (v) => {
    const m = /^(-?\d*\.?\d+)(px|rem|em|%|vh|vw|pt)$/.exec(String(v).trim());
    return m ? { n: parseFloat(m[1]), unit: m[2] } : null;
  };
  const target = parse(value);
  if (!target) return null;
  let best = null;
  for (const s of scaleValues) {
    const p = parse(s);
    if (!p || p.unit !== target.unit) continue;
    const d = Math.abs(p.n - target.n);
    if (d === 0) continue;
    if (!best || d < best.distance) best = { value: s, distance: d };
  }
  return best;
}
