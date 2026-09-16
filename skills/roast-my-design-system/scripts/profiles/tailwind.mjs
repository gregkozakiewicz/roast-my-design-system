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

const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
// Tailwind's own palette names: a theme that restates them adds no vocabulary
const PALETTE_NAME_RE = new RegExp(`^(?:${PALETTE})(?:-(?:50|[1-9]00|950))?$`);
// what counts as a theme worth judging
const MIN_NAMES = 6;
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
    const own = [...names.keys()].filter((n) => !PALETTE_NAME_RE.test(n));
    if (!best || own.length > best.own.length) best = { file: f, names, own };
  }
  return best;
}

/** How often the repo writes its own names as classes (bg-surface, text-brand). */
function countUses(root, codeFiles, own) {
  if (!own.length) return { uses: 0, files: 0 };
  const re = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:bg|text|border|ring|outline|from|to|via|fill|stroke|divide|decoration|placeholder|caret|accent|shadow)-(?:${own.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\w-])`, 'g');
  let uses = 0, files = 0;
  for (const f of codeFiles) {
    if (!/\.(tsx|jsx|ts|js|mjs|vue|svelte|astro|html)$/.test(f)) continue;
    const n = (read(join(root, f)).match(re) ?? []).length;
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

    const theme = readTheme(root, files.styles);
    if (!theme || theme.own.length < MIN_NAMES) return null;
    const { uses, files: usedIn } = countUses(root, files.code, theme.own);
    // A theme nothing in the repo uses is not this repo's system: it is a
    // package's default theme sitting in the tree (tailwindlabs/tailwindcss
    // ships Tailwind's own, 2026-09-16). Under 20 uses is "defined, not
    // adopted yet" and still worth reporting; zero is not a claim at all.
    if (uses === 0) return null;

    const evidence = [
      `${theme.own.length} colour variables of its own in ${theme.file}${theme.names.size > theme.own.length ? ` (${theme.names.size - theme.own.length} restate Tailwind's palette and are not counted as vocabulary)` : ''}`,
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
      uses,
      usedIn,
      // a theme nobody uses is not the system yet: shown with receipts, not scored
      adopted: uses >= MIN_USES,
    };
    return { confidence: uses >= MIN_USES ? 'high' : 'medium', evidence };
  },
};
