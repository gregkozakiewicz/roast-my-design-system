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
// a file whose job is to hold the palette: the theme, not paint on it. A folder
// counts too (Checkmate keeps three status-page themes in themes/, Qdrant its
// colour scales in theme/colors/, 2026-09-17).
const THEME_NAME_RE = /(^|\/)[\w.-]*(theme|palette|colou?rs?|tokens?)[\w.-]*(\/|\.[jt]sx?$)/i;
// a literal after a theme read is a fallback, not paint:
// theme.palette.common.white || '#ffffff' (OpenCTI, 2026-09-17)
// a literal compared with the theme is a check, not paint:
// theme.BACKGROUND_SECONDARY === "#f2f3f5" (JSON Crack, 2026-09-17)
const COMPARE_RE = /(?:[=!]==?\s*(['"`])[^'"`]*\1|(['"`])[^'"`]*\2\s*[=!]==?)/g;
// SVG paint is the drawing (Quenti's landing flare), and a colour handed to
// setAttribute is page metadata (Vemetric's theme-color meta), 2026-09-17
const ARTWORK_ATTR_RE = /\b(?:fill|stroke|stopColor|floodColor|lightingColor)=\{?\s*(?:[^{}'"`]*\?\s*)?(['"`])[^'"`]*\1(?:\s*:\s*(['"`])[^'"`]*\2)?/g;
const SET_ATTRIBUTE_RE = /\.setAttribute\([^)]*\)/g;
const FALLBACK_RE = /\b(?:theme|vars)\.palette(?:\.|\[)[\w.[\]]+\s*(?:\|\||\?\?)\s*(['"`])[^'"`]*\1/g;
// a file that drives a chart or a map renderer: its colours are the picture
// (OpenCTI's maplibre style, Checkmate's recharts series, 2026-09-17)
const RENDERER_IMPORT_RE = /from\s+['"](?:xterm|@xterm\/[\w-]+|uplot|uplot-react|@codemirror\/[\w-]+|@uiw\/codemirror-[\w-]+|monaco-editor|@monaco-editor\/[\w-]+|maplibre-gl|mapbox-gl|leaflet|react-leaflet|ol|deck\.gl|@deck\.gl\/[\w-]+|recharts|chart\.js|react-chartjs-2|echarts|echarts-for-react|d3|d3-[\w-]+|@nivo\/[\w-]+|victory|apexcharts|react-apexcharts|highcharts|highcharts-react-official|plotly\.js[\w-]*|react-plotly\.js|@visx\/[\w-]+|three|@react-three\/[\w-]+|pixi\.js|@antv\/[\w-]+|@mui\/x-charts)['"\/]/;
// quoted colour literals only: a hex in a comment or an id is not paint
const COLOUR_RE = /(['"`])(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\([^)'"`]*\))\1/g;
// spacing written in pixels, and nothing else. Type size and line height
// belong to typography variants, radius to the theme's shape; the spacing
// advice turned lineHeight "16px" into lineHeight: 2, a multiplier (Ente,
// 2026-09-17). Widths and heights are layout, often deliberate.
const PX_KEYS = 'p|m|px|py|pt|pb|pl|pr|mx|my|mt|mb|ml|mr|gap|rowGap|columnGap|padding|margin|paddingTop|paddingBottom|paddingLeft|paddingRight|paddingX|paddingY|paddingBlock|paddingInline|marginTop|marginBottom|marginLeft|marginRight|marginX|marginY|marginBlock|marginInline';
const PX_RE = new RegExp(`\\b(${PX_KEYS})\\s*[:=]\\s*\\{?\\s*(['"\`])(\\d+(?:\\.\\d+)?px)\\2`, 'g');

// An array of 8 or more colours is a palette handed to something (a chart's
// series, a colour picker's swatches), data rather than paint (Prometheus,
// JSON Crack, 2026-09-17).
const ARRAY_RE = /\[[^[\]]*\]/g;
const QUOTED_COLOUR_RE = /(['"`])(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?)\([^)'"`]*\))\1/g;
const dropPalettes = (code) => code.replace(ARRAY_RE, (a) => ((a.match(QUOTED_COLOUR_RE) ?? []).length >= 8 ? ' ' : a));

/**
 * A team's own layer over the kit: a folder or package that re-exports it
 * (Metabase's metabase/ui, 2,469 files; Linode's @linode/ui, 1,347 files).
 * Files that import the layer are kit files too. Returns the import
 * specifiers that reach the layer, or [] when there is none.
 */
function kitLayers(root, codeFiles, reexportRe) {
  const roots = new Map();
  for (const f of codeFiles) {
    if (!/\.[jt]sx?$/.test(f) || !/(^|\/)(ui|design-system|ds|kit)\//.test(f)) continue;
    let src; try { src = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    if (!reexportRe.test(src)) continue;
    const parts = f.split('/');
    const i = parts.lastIndexOf(parts.filter((p) => /^(ui|design-system|ds|kit)$/.test(p)).pop());
    const dir = parts.slice(0, i + 1).join('/');
    roots.set(dir, (roots.get(dir) ?? 0) + 1);
  }
  const specs = new Set();
  for (const [dir, n] of roots) {
    if (n < 3) continue;
    const segs = dir.split('/');
    // the folder path as an alias sees it (metabase/ui), and the package name
    // when the folder is a workspace package (@linode/ui)
    if (segs.length >= 2 && !['src', 'packages', 'apps', 'libs'].includes(segs.at(-2))) specs.add(segs.slice(-2).join('/'));
    try { const name = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')).name; if (name) specs.add(name); } catch { /* not a package */ }
  }
  return [...specs];
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

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
// The theme's spacing unit: createTheme({ spacing: 2 }) sets 2px steps
// (Checkmate); a function or a responsive config (Onyxia's spacingConfig)
// means a step is not a fixed number of pixels.
const SPACING_NUM_RE = /(?:^|[{,\n])\s*spacing\s*:\s*(\d+(?:\.\d+)?)\s*(?=[,}\n])/g;
const SPACING_CUSTOM_RE = /\bspacing(?:Config)?\s*:\s*(?:\([^)]*\)\s*=>|\w+\s*=>|function\b|\[|\w+\()/;

export function countKitPaint(root, codeFiles, { importRe: kitImportRe, themeRe, refRe, themeImportRe = kitImportRe, pxPropRes = [], pxMin = 0, reexportRe = null, spacingCustomRe = null }) {
  const layers = reexportRe ? kitLayers(root, codeFiles, reexportRe) : [];
  const importRe = layers.length
    ? new RegExp(`${kitImportRe.source}|from\\s+['"](?:[^'"]*\\/)?(?:${layers.map(escapeRe).join('|')})(?:['"]|\\/)`)
    : kitImportRe;
  const themeFiles = [];
  const themeValues = new Set();
  const spacingUnits = new Set();
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
    // a theme call counts only where the kit is imported: CodeMirror has a
    // createTheme too (Onyxia, 2026-09-17); a Storybook preview is not the theme
    const isTheme = themeRe.test(code) && themeImportRe.test(code) && !/(^|\/)\.storybook\//.test(f);
    const colours = [...dropPalettes(code.replace(FALLBACK_RE, ' ').replace(COMPARE_RE, ' ').replace(ARTWORK_ATTR_RE, ' ').replace(SET_ATTRIBUTE_RE, ' ')).matchAll(COLOUR_RE)].map((m) => m[2].toLowerCase().replace(/\s+/g, ''));
    if (isTheme) {
      themeFiles.push({ f, n: colours.length });
      themeColours += colours.length;
      for (const c of colours) themeValues.add(c);
    }
    if (isTheme || THEME_NAME_RE.test(f)) {
      if (SPACING_CUSTOM_RE.test(code) || (spacingCustomRe && isTheme && spacingCustomRe.test(code))) spacingUnits.add('custom');
      // a numeric unit counts from the theme call itself, where component
      // defaults (a Stack's spacing: 2) are rare enough to take the first
      else if (isTheme) { const m = SPACING_NUM_RE.exec(code); SPACING_NUM_RE.lastIndex = 0; if (m) spacingUnits.add(m[1]); }
    }
    if (!importRe.test(code)) continue;
    kitFiles += 1;
    refs += (code.match(refRe) ?? []).length;
    if (isTheme || THEME_NAME_RE.test(f)) { if (!isTheme) for (const c of colours) themeValues.add(c); continue; }
    const why = exemptReason(f, src)
      ?? (colourTable(code, colours.length) ? 'the file is a colour table, data rather than styling' : null)
      ?? (colours.length && RENDERER_IMPORT_RE.test(code) ? 'the file drives a chart or a map, so its colours are the picture' : null);
    if (why) { if (colours.length) exempt.push({ file: f, reason: why }); continue; }
    if (colours.length) bump(colour, f, colours);
    // a kit whose numbers are pixels (Mantine's p={10}, rem(10)) adds its own patterns
    const pxHits = [
      ...[...code.matchAll(PX_RE)].map((m) => `${m[1]}: ${m[3]}`),
      ...pxPropRes.flatMap((re) => [...code.matchAll(re)].map((m) => `${m[1]}: ${m[2]}px`)),
    ].filter((v) => !/: (0|1)px$/.test(v) && parseFloat(v.split(': ')[1]) >= pxMin);
    if (pxHits.length) bump(px, f, pxHits);
  }

  const per100 = (n) => (kitFiles ? Math.round((n / kitFiles) * 100) : 0);
  const finish = (b) => ({
    uses: b.uses, files: b.files, per100: per100(b.uses),
    top: b.top.sort((a, c) => c.count - a.count).slice(0, 10),
    samples: [...b.samples.entries()].sort((a, c) => c[1] - a[1]).slice(0, 12).map(([value, count]) => ({ value, count })),
  });
  // the theme a reader should open first: a theme-named path, then the most colours
  const ranked = themeFiles.sort((a, b) => (THEME_NAME_RE.test(b.f) - THEME_NAME_RE.test(a.f)) || b.n - a.n).map((t) => t.f);
  const colourOut = finish(colour);
  // a written colour the theme already holds: the move can say where it lives
  for (const s of colourOut.samples) if (themeValues.has(s.value)) s.inTheme = true;
  return {
    kitFiles,
    // the team's own layer over the kit, counted as the kit
    layers,
    themeFiles: ranked.slice(0, 10),
    // the spacing step as the theme sets it: a number of pixels, 'custom'
    // (a function or a responsive config), or null for the kit default
    spacingUnit: spacingUnits.has('custom') || spacingUnits.size > 1 ? 'custom' : spacingUnits.size ? [...spacingUnits][0] : null,
    themeColours,
    refs,
    refsPer100: per100(refs),
    colour: colourOut,
    px: finish(px),
    exempt: exempt.slice(0, 20),
  };
}
