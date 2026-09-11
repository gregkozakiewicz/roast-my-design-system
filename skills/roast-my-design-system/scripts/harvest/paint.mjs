/**
 * Paint — the two shadcn checks shadcn's own agent rules name
 * (skills/shadcn/rules/styling.md in shadcn-ui/ui):
 *
 *  1. Paint from a tin. A Tailwind palette colour in own code where a sheet
 *     row exists: `text-gray-500`, `bg-blue-100`, `text-emerald-600` on a
 *     status, and the manual evening override `dark:bg-gray-950`. 1 sin, 3
 *     spellings. The rule: "Semantic colors. Never `bg-blue-500`."
 *  2. Doors repainted from outside. A colour or typography class passed into
 *     a kit component through className (`<Card className="bg-blue-100
 *     font-bold">`) where a variant or a sheet row was the intended route.
 *     The rule: "className for layout only."
 *
 * Both are counted over OWN code only: never inside the catalogue (those are
 * kit doors, edited on purpose), never in exempt files (email, print,
 * artwork, render-to-image), never under demo folders. Counts are reported
 * per 100 own-code files so a 40-file starter and a 4,000-file product sit on
 * one ruler. Receipts name the files and the exact classes.
 */
import { join } from 'node:path';
import { readSource } from './walk.mjs';
import { exemptReason } from '../lib/exempt.mjs';
import { PALETTE } from '../profiles/shadcn-data.mjs';

// A palette utility with any variant prefix (hover:, md:, dark:, group-hover:)
// and any opacity suffix. Word boundary at the front stops `text-primary` and
// `bg-sidebar` from matching; the shade stops `border-gray` (no shade) which
// is not a Tailwind class.
const TIN_RE = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:bg|text|border|ring|outline|from|to|via|fill|stroke|divide|decoration|placeholder|caret|accent|shadow)-(?:${PALETTE})-(?:50|[1-9]00|950)(?:/\\d+)?(?![\\w-])`, 'g');
// Evening overrides painted by hand with white or black (the palette shades
// are already caught above with their dark: prefix).
const DARK_WB_RE = /(?<![\w-])dark:(?:bg|text|border)-(?:white|black)(?:\/\d+)?(?![\w-])/g;
// Colour or typography passed into a kit door: palette colour, black/white,
// weight, size.
const DOOR_CLASS_RE = new RegExp(`(?<![\\w-])(?:[\\w-]+:)*(?:(?:bg|text|border)-(?:${PALETTE}|white|black)(?:-(?:50|[1-9]00|950))?(?:/\\d+)?|font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)|text-(?:xs|sm|base|lg|xl|[2-9]xl))(?![\\w-])`, 'g');

const DEMO_PATH_RE = /(^|\/)(stories|storybook|__stories__|examples?|demos?|templates?|playground|fixtures?|__tests__|__mocks__|e2e|cypress)\//i;

/**
 * @param root repo root
 * @param codeFiles relative code paths from the walk
 * @param opts { uiDirs: string[], kitNames: Set<string> } — catalogue folders
 *   and the component names defined in them
 */
export function countPaint(root, codeFiles, { uiDirs = [], kitNames = new Set() } = {}) {
  const inCatalogue = (f) => uiDirs.some((d) => f === d || f.startsWith(`${d}/`));
  const names = [...kitNames].filter((n) => /^[A-Z][A-Za-z0-9]*$/.test(n));
  const doorOpen = names.length
    ? new RegExp(`<(${names.join('|')})\\b[^>]*?className=(?:"([^"]*)"|\\{cn\\(\\s*["'\`]([^"'\`]*)["'\`])`, 'g')
    : null;

  let ownFiles = 0;
  const tin = { uses: 0, files: 0, top: [], samples: new Map() };
  const doors = { uses: 0, files: 0, top: [], samples: new Map() };
  const bump = (bucket, file, count, sample) => {
    bucket.uses += count; bucket.files += 1;
    bucket.top.push({ file, count });
    if (sample) bucket.samples.set(sample, (bucket.samples.get(sample) ?? 0) + count);
  };

  for (const f of codeFiles) {
    if (!/\.(tsx|jsx)$/.test(f) || inCatalogue(f) || DEMO_PATH_RE.test(f)) continue;
    const src = readSource(join(root, f));
    if (src === null || exemptReason(f, src)) continue;
    ownFiles += 1;

    const tinHits = [...src.matchAll(TIN_RE)].map((m) => m[0]);
    const wbHits = [...src.matchAll(DARK_WB_RE)].map((m) => m[0]);
    const all = [...tinHits, ...wbHits];
    if (all.length) {
      const counts = new Map();
      for (const c of all) counts.set(c, (counts.get(c) ?? 0) + 1);
      const most = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      bump(tin, f, all.length, null);
      for (const [c, k] of counts) tin.samples.set(c, (tin.samples.get(c) ?? 0) + k);
      tin.top.at(-1).sample = most;
    }

    if (doorOpen) {
      let hits = 0; const seen = new Map();
      for (const m of src.matchAll(doorOpen)) {
        const cls = m[2] ?? m[3] ?? '';
        const bad = cls.match(DOOR_CLASS_RE);
        if (!bad) continue;
        hits += 1;
        const key = `<${m[1]} className="${bad.slice(0, 3).join(' ')}">`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      if (hits) {
        bump(doors, f, hits, null);
        for (const [k, v] of seen) doors.samples.set(k, (doors.samples.get(k) ?? 0) + v);
        doors.top.at(-1).sample = [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0];
      }
    }
  }

  const finish = (b) => ({
    uses: b.uses,
    files: b.files,
    per100: ownFiles ? Math.round((b.uses / ownFiles) * 100) : 0,
    top: b.top.sort((a, b2) => b2.count - a.count).slice(0, 8),
    samples: [...b.samples.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count })),
  });
  return { ownFiles, tin: finish(tin), doors: finish(doors) };
}
