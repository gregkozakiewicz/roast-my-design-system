/**
 * Kit paint: colours and pixel sizes written straight onto a component kit's
 * components (MUI's sx, a style object, a styled() call) where the kit's
 * theme has a value for the job. The counting is shared so every kit profile
 * gives the same answer about the same kind of line; what a kit's import,
 * theme and theme reference look like is each profile's own.
 *
 * Probe, 80 kit repos (2026-09-17): colours per 100 kit files run from 0 to
 * over 400 inside every kit, so the count separates tidy from messy. The
 * innocent explanation is a colour table (Prometheus keeps chart colours in
 * one file), so a file that is mostly colour data is exempt, like artwork.
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { exemptReason } from './exempt.mjs';

const SKIP_PATH_RE = /(^|\/)(__tests__|__mocks__|e2e|cypress|stories|storybook|\.storybook|fixtures?|examples?|demos?|tests?|mocks?)\/|\.(test|spec|stories)\.[jt]sx?$|\.d\.ts$/;
// a file whose job is to hold the palette: the theme, not paint on it
const THEME_NAME_RE = /(^|\/)[\w.-]*(theme|palette|colou?rs?|tokens?)[\w.-]*\.[jt]sx?$/i;
// quoted colour literals only: a hex in a comment or an id is not paint
const COLOUR_RE = /(['"`])(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\([^)'"`]*\))\1/g;
// spacing, type size and radius written in pixels; widths and heights are
// layout and often deliberate, so they are left alone
const PX_KEYS = 'p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|rowGap|columnGap|padding|margin|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingX|paddingY|marginTop|marginBottom|marginLeft|marginRight|marginX|marginY|fontSize|borderRadius|letterSpacing|lineHeight';
const PX_RE = new RegExp(`\\b(${PX_KEYS})\\s*[:=]\\s*\\{?\\s*(['"\`])(\\d+(?:\\.\\d+)?px)\\2`, 'g');

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

/** A file that is mostly colour data (a chart palette, a colour table). */
export function colourTable(src, literals) {
  if (literals < 12) return false;
  const jsx = (src.match(/<[A-Z][\w.]*[\s/>]/g) ?? []).length;
  return jsx < 3;
}

/**
 * @param root repo root
 * @param codeFiles relative code paths from the walk
 * @param kit { importRe, themeRe, refRe } — what this kit's import, theme
 *   definition and theme reference look like
 */
export function countKitPaint(root, codeFiles, { importRe, themeRe, refRe }) {
  const themeFiles = [];
  let kitFiles = 0, refs = 0, themeColours = 0;
  const colour = { uses: 0, files: 0, top: [], samples: new Map() };
  const px = { uses: 0, files: 0, top: [], samples: new Map() };
  const exempt = [];
  const bump = (bucket, file, hits) => {
    bucket.uses += hits.length; bucket.files += 1;
    const counts = new Map();
    for (const v of hits) { counts.set(v, (counts.get(v) ?? 0) + 1); bucket.samples.set(v, (bucket.samples.get(v) ?? 0) + 1); }
    bucket.top.push({ file, count: hits.length, sample: [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0] });
  };

  for (const f of codeFiles) {
    if (!/\.[jt]sx?$/.test(f) || SKIP_PATH_RE.test(f)) continue;
    let src;
    try { if (statSync(join(root, f)).size > 1e6) continue; src = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    const code = stripComments(src);
    const isTheme = themeRe.test(code);
    const colours = [...code.matchAll(COLOUR_RE)].map((m) => m[2].toLowerCase().replace(/\s+/g, ''));
    if (isTheme) { themeFiles.push(f); themeColours += colours.length; }
    if (!importRe.test(code)) continue;
    kitFiles += 1;
    refs += (code.match(refRe) ?? []).length;
    if (isTheme || THEME_NAME_RE.test(f)) continue;
    const why = exemptReason(f, src) ?? (colourTable(code, colours.length) ? 'the file is a colour table, data rather than styling' : null);
    if (why) { if (colours.length) exempt.push({ file: f, reason: why }); continue; }
    if (colours.length) bump(colour, f, colours);
    const pxHits = [...code.matchAll(PX_RE)].map((m) => `${m[1]}: ${m[3]}`).filter((v) => !/: (0|1)px$/.test(v));
    if (pxHits.length) bump(px, f, pxHits);
  }

  const per100 = (n) => (kitFiles ? Math.round((n / kitFiles) * 100) : 0);
  const finish = (b) => ({
    uses: b.uses, files: b.files, per100: per100(b.uses),
    top: b.top.sort((a, c) => c.count - a.count).slice(0, 10),
    samples: [...b.samples.entries()].sort((a, c) => c[1] - a[1]).slice(0, 12).map(([value, count]) => ({ value, count })),
  });
  return {
    kitFiles,
    themeFiles: themeFiles.slice(0, 10),
    themeColours,
    refs,
    refsPer100: per100(refs),
    colour: finish(colour),
    px: finish(px),
    exempt: exempt.slice(0, 20),
  };
}
