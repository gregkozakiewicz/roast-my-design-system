/**
 * Chart colours. A chart needs several colours that differ from each other,
 * and most design systems never name them. Probe over the 126 benchmark
 * repos (2026-09-25): charts in three quarters of them, a named chart palette
 * in a quarter, and the biggest group (43) is charts painting their series
 * by hand with no palette to point at. The report leaves chart colours out
 * (a picture, not paint); the live checks counted every one, so the same
 * file got two verdicts depending on the door. One rule now, three tiers:
 *
 *   1. The repo keeps a chart palette: its own names, or shadcn's default
 *      --chart-1..5 when a chart actually reads them. A colour written by
 *      hand in a chart is drift, and the finding names the palette.
 *   2. No palette, but a chart already paints by hand. The new chart follows
 *      a precedent rather than breaking a rule: one warning per file that
 *      names the precedent and asks for the palette, once.
 *   3. No palette, no chart: the first chart. One warning, so the colours
 *      get a name before the second chart copies them.
 *
 * shadcn's --chart-1..5 arrive with the install whether or not any chart
 * uses them (6 of the 126 repos), so they count as a palette only when a
 * chart reads them; otherwise the repo is tier 2 with the fix ready-made.
 */
import { basename } from 'node:path';
import { parseColor } from './color.mjs';

// chart libraries only: a map or an editor is a renderer too, but its
// colours are never a series (lib/kitpaint.mjs keeps the wider list)
export const CHART_IMPORT_RE = /from\s+['"](?:recharts|chart\.js|react-chartjs-2|echarts|echarts-for-react|d3|d3-[\w-]+|@nivo\/[\w-]+|victory|apexcharts|react-apexcharts|highcharts|highcharts-react-official|plotly\.js[\w-]*|react-plotly\.js|@visx\/[\w-]+|@antv\/[\w-]+|@mui\/x-charts|@mantine\/charts|@tremor\/react|lightweight-charts|uplot|uplot-react|frappe-charts|@ant-design\/(?:plots|charts)|chartist|billboard\.js|vega|vega-lite|@observablehq\/plot|@carbon\/charts[\w-]*|react-vis)['"\/]/;
// a file named for a chart; "graphql" is not a graph and neither is a "graphic"
const CHART_NAME_RE = /(^|[^a-z])(chart|graph(?!ql|ic)|sparkline|donut|histogram|heatmap)/i;
// an icon, an illustration, a story or a build is not a chart, whatever it
// imports (likec4's icon set, twenty's storybook, a committed Next chunk)
const NOT_CHART_RE = /(^|\/)(icons?|illustrations?|graphics?|__stories__|stories|storybook|\.storybook|static\/chunks|dist|build|out)\/|\.stories\.[jt]sx?$/i;
const CHART_TOKEN_RE = /(--(?:chart|charts|series|graph|graphs|viz|dataviz|data-viz|visuali[sz]ation)[\w-]*)\s*:\s*([^;{}]+)[;}]/gi;
// a key in a theme, tokens or palette file: chartColors, charts: {…}, series: […]
const THEME_FILE_RE = /(^|\/)[\w.-]*(theme|palette|colou?rs?|tokens?|foundations?)[\w.-]*(\/|\.[jt]sx?$)/i;
const CHART_KEY_RE = /\b((?:chart|charts|series|graph|dataviz|dataViz|visuali[sz]ation)(?:Colou?rs|Palette|colou?rs|palette)?)\s*:\s*[{[]/g;
const COLOUR_LITERAL_RE = /(['"`])(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgba?|hsla?|oklch|oklab)\([^)'"`]*\))\1/g;
const SHADCN_DEFAULT_RE = /^--chart-[1-5]$/;

// a token value that is a colour: hex, rgb(), hsl(), oklch(), or shadcn's
// bare "220 70% 50%" triplet. "--chart-help: 'Pick a range'" is not one.
const isColourValue = (v) => {
  const s = v.trim();
  if (parseColor(s)) return true;
  return /^(oklch|oklab|color|lab|lch)\(/.test(s) || /^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(s);
};

/** A chart file: imports a chart library, or is named for one. */
export function isChartFile(file, text) {
  if (file && NOT_CHART_RE.test(file)) return false;
  if (text && CHART_IMPORT_RE.test(text)) return true;
  return !!file && CHART_NAME_RE.test(basename(file));
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// how a chart would read a palette entry: var(--chart-1) or the class chart-1
// for a CSS name, the key itself for a theme key
const refRe = (name) => name.startsWith('--')
  ? new RegExp(`(?:var\\(\\s*${escapeRe(name)}\\b|(?:^|[^\\w-])${escapeRe(name.slice(2))}(?![\\w-]))`)
  : new RegExp(`\\b${escapeRe(name)}\\b`);

/**
 * What the repo already knows about charts, from the same file set the rest
 * of the knowledge reads. `own` says whether a file is the team's own code;
 * installed kit code (a shadcn catalogue, a registry block) is left out of
 * the precedents, and a fresh install therefore has no chart gap.
 * @returns { palette: { names, file, shadcnDefault, referenced } | null,
 *            precedents: [{ file, count, sample }], chartFiles }
 */
export function chartSystemOf(files, read, { own = () => true } = {}) {
  const names = [], where = new Map();
  const noteToken = (name, file) => { if (!where.has(name)) { names.push(name); where.set(name, file); } };
  for (const f of files.styles ?? []) {
    const text = read(f); if (text === null) continue;
    for (const m of text.matchAll(CHART_TOKEN_RE)) if (isColourValue(m[2])) noteToken(m[1], f);
  }
  const chartTexts = [];
  for (const f of files.code ?? []) {
    const text = read(f); if (text === null) continue;
    // a CSS-in-JS theme or a Tailwind @theme inside a .ts file defines
    // custom properties too
    for (const m of text.matchAll(CHART_TOKEN_RE)) if (isColourValue(m[2])) noteToken(m[1], f);
    if (THEME_FILE_RE.test(f)) {
      for (const m of text.matchAll(CHART_KEY_RE)) {
        if (COLOUR_LITERAL_RE.test(text.slice(m.index, m.index + 600))) noteToken(m[1], f);
      }
    }
    // a chart inside installed kit code (shadcn's components/ui/chart.tsx, a
    // registry block) is the kit's, not a precedent the team set
    if (own(f) && isChartFile(f, text)) chartTexts.push({ f, text });
  }
  const palette = names.length ? { names, file: where.get(names[0]), shadcnDefault: names.every((n) => SHADCN_DEFAULT_RE.test(n)), referenced: false } : null;
  const precedents = [];
  for (const { f, text } of chartTexts) {
    if (palette && !palette.referenced && palette.names.some((n) => refRe(n).test(text))) palette.referenced = true;
    const literals = [...new Set([...text.matchAll(COLOUR_LITERAL_RE)].map((m) => m[2].toLowerCase()))];
    if (literals.length >= 2) precedents.push({ file: f, count: literals.length, sample: literals.slice(0, 3) });
  }
  precedents.sort((a, b) => b.count - a.count);
  return { palette, precedents, chartFiles: chartTexts.length };
}

/** 1: a palette to use; 2: a precedent and a gap; 3: the first chart. */
export function chartTier(charts) {
  if (!charts) return 3;
  if (charts.palette && (!charts.palette.shadcnDefault || charts.palette.referenced)) return 1;
  if (charts.precedents.length || charts.palette) return 2;
  return 3;
}

const list = (values, max = 6) => `${values.slice(0, max).join(', ')}${values.length > max ? ` and ${values.length - max} more` : ''}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The findings for the colours a chart file writes by hand.
 * @param colours [{ value, index }] the non-token colour literals in the file
 */
export function chartFindings({ file, colours, charts, tokenFile = null }) {
  if (!colours?.length) return [];
  const tier = chartTier(charts);
  const distinct = [...new Set(colours.map((c) => c.value))];
  const first = colours[0].index;
  if (tier === 1) {
    const { names, file: pf } = charts.palette;
    const example = names[0].startsWith('--') ? `var(${names[0]})` : `${names[0]}[0]`;
    return colours.map((c) => ({
      rule: 'chart-colour', severity: 'violation', index: c.index,
      message: `Chart colour ${c.value} written by hand; this repo keeps a chart palette (${list(names, 5)} in ${pf}).`,
      fix: `Read the series colour from the palette (${example}). A series that needs a colour the palette lacks gets a new entry there, once.`,
    }));
  }
  const where = tokenFile ?? 'the theme';
  // The scan already holds the file being judged, so a brand-new chart is
  // its own precedent. A precedent is another file; with none, and no
  // palette, this is the first chart in the repo (9.0.1).
  const prec = charts.precedents.find((p) => p.file !== file) ?? null;
  const shadcn = charts.palette?.shadcnDefault ? charts.palette : null;
  if (tier === 2 && (prec || shadcn)) {
    return [{
      rule: 'chart-palette', severity: 'warning', index: first,
      message: `This chart paints its ${plural(distinct.length, 'series colour')} by hand (${list(distinct)}); the repo has no chart palette${prec ? `, and ${prec.file} already does the same with ${prec.count}` : ''}.`,
      fix: shadcn
        ? `The theme already defines --chart-1 to --chart-5 in ${shadcn.file} and no chart reads them. Read them here (var(--chart-1))${prec ? ` and point ${prec.file} at them too` : ''}.`
        : `Name these once as chart tokens (--chart-1, --chart-2 … in ${where}) and read them here${prec ? ` and in ${prec.file}` : ''}, so every chart draws from one set.`,
    }];
  }
  return [{
    rule: 'chart-palette', severity: 'warning', index: first,
    message: `First chart in this repo: ${plural(distinct.length, 'series colour')} written by hand (${list(distinct)}) and no chart palette exists yet.`,
    fix: `Name them once as chart tokens (--chart-1, --chart-2 … in ${where}) so the next chart reads the same set instead of copying these.`,
  }];
}
