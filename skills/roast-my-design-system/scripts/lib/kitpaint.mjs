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
import { importSources, kitOfSource } from './kitlist.mjs';

export const SKIP_PATH_RE = /(^|\/)(__tests__|__mocks__|e2e|cypress|stories|storybook|\.storybook|fixtures?|examples?|demos?|tests?|mocks?)\/|\.(test|spec|stories)\.[jt]sx?$|\.d\.ts$/;
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

// Blank a match in place so every index still points at the source text:
// the MCP needs a line number, the count does not.
const blank = (s, re) => s.replace(re, (m) => ' '.repeat(m.length));
const blankPalettes = (code) => code.replace(ARRAY_RE, (a) => ((a.match(QUOTED_COLOUR_RE) ?? []).length >= 8 ? ' '.repeat(a.length) : a));

// An import of the team's own layer over the kit (@linode/ui, metabase/ui).
// One builder for the report's count and the live checks: until 9.6.1 the
// live checks built their own copy in a template string with a single
// backslash, which JavaScript drops, so it looked for "froms" and never
// matched. The live checks and the guard judged 750 of Linode's 1,487 kit
// files and 344 of Metabase's 2,679 (2026-10-01).
const layerImportSource = (layers) => `from\\s+['"](?:[^'"]*\\/)?(?:${layers.map(escapeRe).join('|')})(?:['"]|\\/)`;

// Another kit's components in the same file: Linode renders Akamai CDS table
// cells beside MUI, SigNoz renders SigNoz UI callouts beside Ant Design. A
// colour or a pixel size on one of those is not on the first kit, and the
// first kit's fix does not apply: sx does nothing on an Akamai CDS cell
// (2026-10-01). The element is found by reading back to the JSX tag still
// open at the value, or the component handed to styled(); anything else
// (plain HTML, the team's own components, a style object outside JSX) stays
// with the first kit, as before.
// one statement at a time: a side-effect import (import './x.css') never
// runs on into the next statement's names
const IMPORT_RE = /\bimport\s+(?:type\s+)?([^'";]*?)\s+from\s+['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\b(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g;
/** local name -> import source, for every name a file imports or requires */
function importMap(code) {
  const m = new Map();
  const names = (list, from) => {
    for (const part of list.split(',')) {
      const p = part.trim().replace(/^type\s+/, '');
      if (!p) continue;
      const [a, b] = p.split(/\s+as\s+|\s*:\s*/);
      m.set((b ?? a).trim(), from);
    }
  };
  for (const [, what, from] of code.matchAll(IMPORT_RE)) {
    const d = what.match(/^([A-Za-z_$][\w$]*)/); if (d && d[1] !== 'type') m.set(d[1], from);
    const ns = what.match(/\*\s+as\s+([\w$]+)/); if (ns) m.set(ns[1], from);
    const br = what.match(/\{([\s\S]*)\}/); if (br) names(br[1], from);
  }
  for (const [, what, from] of code.matchAll(REQUIRE_RE)) {
    if (what.startsWith('{')) names(what.slice(1, -1), from); else m.set(what, from);
  }
  return m;
}
// the index just past a quoted string or template that opens at i
function pastString(code, i) {
  const q = code[i];
  for (let j = i + 1; j < code.length; j++) {
    if (code[j] === '\\') { j++; continue; }
    if (code[j] === q) return j + 1;
  }
  return code.length;
}
// the index just past the balanced group that opens at i: ( ) or < >
function pastGroup(code, i, open, close, limit = code.length) {
  let d = 0;
  for (let j = i; j < limit; j++) {
    const ch = code[j];
    if (ch === '"' || ch === "'" || ch === '`') { j = pastString(code, j) - 1; continue; }
    if (ch === open) d++;
    else if (ch === close && --d === 0) return j + 1;
  }
  return -1;
}
/**
 * Is the JSX tag that opens at i still open at index? 'open' when the value
 * sits in its attributes, 'closed' when a > ends it first, 'body' when the
 * value sits inside a function written in one of its props (a render prop
 * building a style for another element): then nothing is said about it.
 * Quoted text and a tag's type arguments (<Select<Option>) are skipped.
 */
function tagState(code, i, name, index) {
  let j = i + 1 + name.length;
  if (code[j] === '<') { const past = pastGroup(code, j, '<', '>', index); if (past < 0) return 'closed'; j = past; }
  const stack = [];
  for (; j < index; j++) {
    const ch = code[j];
    if (ch === '"' || ch === "'" || ch === '`') { j = pastString(code, j) - 1; continue; }
    if (ch === '{') stack.push(stack.length && /(?:=>|\))\s*$/.test(code.slice(Math.max(i, j - 40), j)) ? 'body' : 'expr');
    else if (ch === '}') stack.pop();
    else if (ch === '>' && !stack.length && code[j - 1] !== '=') return 'closed';
  }
  return stack.includes('body') ? 'body' : 'open';
}
const STYLED_RE = /\bstyled(?:\(\s*(['"]?)([A-Za-z][\w.]*)\1|\.(\w+))/g;
/** the element a value sits on: the JSX tag still open at index, or the component handed to styled() */
function elementAt(code, index) {
  let i = index;
  while (i > 0 && index - i < 4000) {
    i = code.lastIndexOf('<', i - 1);
    if (i < 0) break;
    const m = /^<([A-Za-z][\w.]*)/.exec(code.slice(i, i + 80));
    if (!m) continue;
    const state = tagState(code, i, m[1], index);
    if (state === 'open') return m[1];
    if (state === 'body') return null;
  }
  // styled(Component)(...) or styled(Component)`...`: only when the value sits
  // inside the styles handed to that call, never after it, and never for
  // styled('div') or styled.div
  const from = Math.max(0, index - 600);
  const last = [...code.slice(from, index).matchAll(STYLED_RE)].pop();
  if (!last || last[1] || last[3] || !/^[A-Z]/.test(last[2])) return null;
  const call = code.indexOf('(', from + last.index);
  let j = pastGroup(code, call, '(', ')');
  if (j < 0) return null;
  while (/\s/.test(code[j] ?? '')) j++;
  if (code[j] === '<') { j = pastGroup(code, j, '<', '>'); if (j < 0) return null; }
  const end = code[j] === '(' ? pastGroup(code, j, '(', ')') : code[j] === '`' ? pastString(code, j) : -1;
  return end > index && j < index ? last[2] : null;
}
/** the other kit that owns the element at index, as { name, from }, or null */
function otherKitAt(code, index, imports, def, ownRe) {
  const tag = elementAt(code, index);
  if (!tag || /^[a-z]/.test(tag)) return null;
  const from = imports.get(tag.split('.')[0]);
  if (!from) return null;
  const name = kitOfSource(from);
  if (!name || name === def.name || ownRe.test(`from '${from}'`)) return null;
  return { name, from };
}

/** The import test a kit's files pass, the team's own layer included. */
export function kitImportRe(def, layers = []) {
  return layers.length ? new RegExp(`${def.importRe.source}|${layerImportSource(layers)}`) : def.importRe;
}

/**
 * One file's kit paint, with positions: the colours and pixel sizes written
 * onto the kit's components, judged by the same rules as the count above.
 * The MCP validate and review read this so the server and the report never
 * disagree about a line. Returns null when the file is not a kit file or is
 * the theme itself; { exempt } when the file is not judged, and why.
 */
export function kitPaintInSource(src, def, { file = null, layers = [], email = null } = {}) {
  const importRe = kitImportRe(def, layers);
  const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length)).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, pre) => pre + ' '.repeat(m.length - pre.length));
  if (!importRe.test(code)) return null;
  if (file && SKIP_PATH_RE.test(file)) return null;
  const isTheme = def.themeRe.test(code) && (def.themeImportRe ?? def.importRe).test(code);
  if (isTheme || (file && THEME_NAME_RE.test(file))) return null;
  const cleaned = blankPalettes(blank(blank(blank(blank(code, FALLBACK_RE), COMPARE_RE), ARTWORK_ATTR_RE), SET_ATTRIBUTE_RE));
  const colours = [...cleaned.matchAll(COLOUR_RE)]
    .map((m) => ({ value: m[2].toLowerCase().replace(/\s+/g, ''), index: m.index }))
    .filter((c) => !/,\s*0(?:\.0+)?\)$/.test(c.value) && c.value !== 'transparent');
  const why = exemptReason(file, src, { email })
    ?? (colourTable(code, colours.length) ? 'the file is a colour table, data rather than styling' : null)
    ?? (colours.length && RENDERER_IMPORT_RE.test(code) ? 'the file drives a chart or a map, so its colours are the picture' : null);
  if (why) return { exempt: why, colours: [], px: [] };
  const pxMin = def.pxMin ?? 0;
  const px = [
    ...[...code.matchAll(PX_RE)].map((m) => ({ value: `${m[1]}: ${m[3]}`, index: m.index })),
    ...(def.pxPropRes ?? []).flatMap((re) => [...code.matchAll(re)].map((m) => ({ value: `${m[1]}: ${m[2]}px`, index: m.index }))),
  ].filter((h) => !/: (0|1)px$/.test(h.value) && parseFloat(h.value.split(': ')[1]) >= pxMin);
  // a file that also imports another kit: name the kit an element comes from
  if (importSources(code).some((f) => { const n = kitOfSource(f); return n && n !== def.name; })) {
    const imports = importMap(code);
    for (const h of [...colours, ...px]) { const o = otherKitAt(code, h.index, imports, def, importRe); if (o) h.otherKit = o; }
  }
  return { exempt: null, colours, px };
}

export function countKitPaint(root, codeFiles, { importRe: kitImportRe, themeRe, refRe, themeImportRe = kitImportRe, pxPropRes = [], pxMin = 0, reexportRe = null, spacingCustomRe = null }, { email = null } = {}) {
  const layers = reexportRe ? kitLayers(root, codeFiles, reexportRe) : [];
  const importRe = layers.length ? new RegExp(`${kitImportRe.source}|${layerImportSource(layers)}`) : kitImportRe;
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
    const why = exemptReason(f, src, { email })
      ?? (colourTable(code, colours.length) ? 'the file is a colour table, data rather than styling' : null)
      ?? (colours.length && RENDERER_IMPORT_RE.test(code) ? 'the file drives a chart or a map, so its colours are the picture' : null);
    if (why) { if (colours.length) exempt.push({ file: f, reason: why }); continue; }
    // a fully transparent colour is not paint (react-design-editor's
    // rgba(255,255,255,0), 2026-09-17)
    const painted = colours.filter((c) => !/,\s*0(?:\.0+)?\)$/.test(c) && c !== 'transparent');
    if (painted.length) bump(colour, f, painted);
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
  // the theme a reader should open first: not a component's own theme or a
  // provider (Open-Assistant's Theme/components/Badge.ts and Metabase's
  // ThemeProvider.tsx both outranked the root theme, 2026-09-18), then a
  // theme-named path, then the most colours
  const componentLevel = (f) => /(^|\/)(components?|providers?)\//i.test(f);
  const ranked = themeFiles.sort((a, b) => (componentLevel(a.f) - componentLevel(b.f))
    || (THEME_NAME_RE.test(b.f) - THEME_NAME_RE.test(a.f)) || b.n - a.n).map((t) => t.f);
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
    // the theme's own colour values, for a checker to snap a written colour to
    themeValues: [...themeValues],
    refs,
    refsPer100: per100(refs),
    colour: colourOut,
    px: finish(px),
    exempt: exempt.slice(0, 20),
  };
}

const aKit = (name) => (/^(?:[AEIOU]|MUI)/.test(name) ? `an ${name}` : `a ${name}`);
const plain = (html) => String(html ?? '').replace(/<\/?code>/g, '').replace(/&quot;/g, '"');

/**
 * One file's kit findings, worded: what the MCP validate and review say about
 * a line, and what guard-my-design-system says about the same line. One
 * function, so the three never disagree. `kit` is the profile's kit with its
 * definition attached ({ name, def, themeFiles, themeValues, spacingUnit,
 * layers }). Returns null when the file is not a kit file or is the theme;
 * { exempt } when the file is not judged, and why; otherwise
 * { exempt: null, findings: [{ rule, index, value, label, note, message, fix }] }:
 * label is the finding in a few words ("colour written onto an MUI
 * component"), note what the theme says about it or null, message the two
 * as one sentence for the live checks. A value on another kit's component
 * also carries severity 'warning' and otherKit (that kit's name).
 */
export function kitPaintFindings(src, kit, { file = null, email = null } = {}) {
  if (!kit?.def) return null;
  const paint = kitPaintInSource(src, kit.def, { file, layers: kit.layers ?? [], email });
  if (!paint) return null;
  if (paint.exempt) return { exempt: paint.exempt, findings: [] };
  const adv = kit.def.advice, themeFile = kit.themeFiles?.[0] ?? null;
  const themeSet = new Set(kit.themeValues ?? []);
  const findings = [];
  const colourLabel = `colour written onto ${aKit(kit.name)} component`;
  // on another kit's component: say whose it is and give the neutral rule, as
  // a warning, since the first kit's advice does not reach it
  const other = (h, rule) => {
    const o = h.otherKit;
    return { rule, severity: 'warning', otherKit: o.name, index: h.index, value: h.value,
      label: rule === 'kit-colour' ? `colour written onto ${aKit(o.name)} component` : `pixel size on ${aKit(o.name)} component`,
      note: `it comes from ${o.from}, not ${kit.name}`,
      message: `${rule === 'kit-colour' ? `Colour ${h.value} written onto` : `Pixel size ${h.value} on`} ${aKit(o.name)} component (${o.from}), in a file that also uses ${kit.name}.`,
      fix: `Style it the way the repo styles its other ${o.name} components. Never put one kit's styling on the other's components.` };
  };
  for (const c of paint.colours) {
    if (c.otherKit) { findings.push(other(c, 'kit-colour')); continue; }
    findings.push(themeSet.has(c.value)
      ? { rule: 'kit-colour', index: c.index, value: c.value, label: colourLabel,
          note: `the theme already holds it${themeFile ? ` (${themeFile})` : ''}`,
          message: `Colour ${c.value} written onto ${aKit(kit.name)} component. The theme already holds it${themeFile ? ` (${themeFile})` : ''}.`,
          fix: plain(adv.colourHow) }
      : { rule: 'kit-colour', index: c.index, value: c.value, label: colourLabel,
          note: 'the theme has no such colour',
          message: `Colour ${c.value} written onto ${aKit(kit.name)} component, and the theme has no such colour.`,
          fix: `Add it to the theme once${themeFile ? ` (${themeFile})` : ` with ${adv.themeCall}`}, then read it there. ${plain(adv.colourHow)}` });
  }
  for (const h of paint.px) {
    if (h.otherKit) { findings.push(other(h, 'kit-px')); continue; }
    const raw = h.value.split(': ')[1];
    findings.push({ rule: 'kit-px', index: h.index, value: h.value, label: `pixel size on ${aKit(kit.name)} component`, note: null,
      message: `Pixel size ${h.value} on ${aKit(kit.name)} component.`,
      fix: adv.step ? adv.step(kit, parseFloat(raw)) : plain(adv.spacingHow?.(kit)) });
  }
  return { exempt: null, findings };
}
