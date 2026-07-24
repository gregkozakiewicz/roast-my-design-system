#!/usr/bin/env node
/**
 * Diagnose — step 2 of the Proffer pipeline. Renders a harvest.json into a
 * single self-contained HTML report: the visceral, shareable "here's your
 * mess" page with real file paths. No dependencies, no server — one file.
 *
 *   node src/diagnose/index.mjs harvest.json [--out diagnosis.html] [--theme dark|light]
 *   (--theme sets the initial mode; the page itself has a light/dark toggle)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distinctTypefaces } from '../lib/typefaces.mjs';

// The benchmark (Ideal-2026 norms + scanned-repo stats) ships next to the
// code so the page works offline; degrade gracefully when absent.
const BENCH_PATH = join(dirname(fileURLToPath(import.meta.url)), '../benchmark/benchmark.json');
const bench = existsSync(BENCH_PATH) ? JSON.parse(readFileSync(BENCH_PATH, 'utf8')) : null;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const inPath = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!inPath) { console.error('Usage: node src/diagnose/index.mjs <harvest.json> [--out diagnosis.html]'); process.exit(1); }
const outPath = resolve(arg('out', 'diagnosis.html'));

const h = JSON.parse(readFileSync(inPath, 'utf8'));

// Shown in the report footer; keep in step with plugin.json when releasing.
const VERSION = '2.0.5';

// Two shipped skins, same layout: 'dark' (navy glass, mint accent) and
// 'light' (lilac wash, white glass, violet accent). --theme picks one.
const THEMES = {
  dark: {
    pageBgHex: [0x02, 0x06, 0x17],
    css: `--bg:#020617; --card:rgba(15,23,42,.6); --card-solid:#0f172a; --deep:#1e293b;
    --line:rgba(51,65,85,.7); --line-soft:rgba(51,65,85,.4);
    --text:#f1f5f9; --dim:#94a3b8; --dim2:#64748b;
    --accent:#2dd4bf; --ok:#2dd4bf; --coral:#f97066; --amber:#fbbf24;
    --accent-glow:rgba(45,212,191,.6); --blob:rgba(45,212,191,.1); --blob2:rgba(45,212,191,.05);
    --hover-ring:rgba(45,212,191,.3); --bad-ring:rgba(249,112,102,.4);
    --bar-grad:linear-gradient(90deg,#2dd4bf,#14b8a6);
    --hero-grad:linear-gradient(140deg,#0f172a 0%,#0f172a 100%);
    --glass-inset:rgba(255,255,255,.05); --glass-shadow:0 20px 40px -20px rgba(0,0,0,.4), 0 2px 8px -2px rgba(0,0,0,.2);
    --cell-ring:rgba(255,255,255,.05); --hover-row:rgba(30,41,59,.3); --hover-cell:rgba(30,41,59,.2);
    --chip-bg:rgba(2,6,23,.5); --nods-bg:rgba(251,191,36,.08); --nods-line:rgba(251,191,36,.35);
    --ok-soft:rgba(45,212,191,.1); --coral-soft:rgba(249,112,102,.15); --amber-soft:rgba(251,191,36,.15);
    --page-grad:linear-gradient(180deg, rgba(241,245,249,.045) 0%, transparent 420px),
      radial-gradient(1200px 600px at 10% -10%, rgba(45,212,191,.08) 0%, transparent 60%),
      radial-gradient(900px 500px at 100% 10%, rgba(56,189,248,.06) 0%, transparent 55%),
      radial-gradient(700px 400px at 50% 100%, rgba(45,212,191,.05) 0%, transparent 60%);
    --sans:'Manrope',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
    --disp:'Sora','Manrope',ui-sans-serif,system-ui,sans-serif;
    --mono:'JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace;`,
  },
  light: {
    pageBgHex: [0xee, 0xec, 0xfb],
    css: `--bg:#eeecfb; --card:rgba(255,255,255,.6); --card-solid:#ffffff; --deep:#e2ddf5;
    --line:rgba(255,255,255,.8); --line-soft:rgba(15,15,26,.08);
    --text:#0f0f1a; --dim:#6b6b85; --dim2:#9494ad;
    --accent:#6d5bff; --ok:#1fa564; --coral:#e5533d; --amber:#d97706;
    --accent-glow:rgba(109,91,255,.5); --blob:rgba(109,91,255,.12); --blob2:rgba(109,91,255,.06);
    --hover-ring:rgba(109,91,255,.35); --bad-ring:rgba(229,83,61,.4);
    --bar-grad:linear-gradient(90deg,#6d5bff,#4b2fd9);
    --hero-grad:linear-gradient(140deg,#6d5bff 0%,#4b2fd9 60%,#2a1a80 100%);
    --glass-inset:rgba(255,255,255,.9); --glass-shadow:0 20px 40px -20px rgba(75,47,217,.15), 0 2px 8px -2px rgba(15,15,26,.06);
    --cell-ring:rgba(15,15,26,.06); --hover-row:rgba(255,255,255,.55); --hover-cell:rgba(255,255,255,.45);
    --chip-bg:rgba(255,255,255,.7); --nods-bg:rgba(251,191,36,.14); --nods-line:rgba(217,119,6,.4);
    --ok-soft:rgba(74,222,128,.18); --coral-soft:rgba(249,112,102,.16); --amber-soft:rgba(251,191,36,.2);
    --page-grad:linear-gradient(180deg, rgba(255,255,255,.55) 0%, transparent 420px),
      radial-gradient(1200px 600px at 10% -10%, #d8d1f7 0%, transparent 60%),
      radial-gradient(900px 500px at 100% 10%, #e8e3fb 0%, transparent 55%),
      radial-gradient(700px 400px at 50% 100%, #ddd5f5 0%, transparent 60%);
    --sans:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
    --disp:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
    --mono:'JetBrains Mono',ui-monospace,'SF Mono',Menlo,monospace;`,
  },
};
const themeName = arg('theme', 'dark');
const T = THEMES[themeName];
if (!T) { console.error(`Unknown theme "${themeName}" (dark | light)`); process.exit(1); }

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (x) => x.toLocaleString('en-US');

// EFFECTIVE luminance as rendered: 8-digit hex carries alpha, and a
// 50%-transparent black shows as mid-grey composited over the page
// background — sorting by raw RGB put those "all over the place" in the
// strip. Both themes ship in one file, so the ramp is emitted once per
// compositing base and toggled with the theme.
const bgLumOf = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function hexLuminance(hex, bgLum) {
  if (!/^#[0-9a-f]{6}/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return a * lum + (1 - a) * bgLum;
}
const isGreyHex = (v) => {
  if (!/^#[0-9a-f]{6}/.test(v)) return false;
  const r = parseInt(v.slice(1, 3), 16), g = parseInt(v.slice(3, 5), 16), b = parseInt(v.slice(5, 7), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 10;
};

// ---------- derived numbers ----------
const colors = h.tokens.colors ?? [];
const greysSorted = (bgLum) => colors.filter((c) => isGreyHex(c.value))
  .sort((a, b) => hexLuminance(a.value, bgLum) - hexLuminance(b.value, bgLum));
const greys = greysSorted(bgLumOf(THEMES.dark.pageBgHex));
const greysLight = greysSorted(bgLumOf(THEMES.light.pageBgHex));
const nonGreys = colors.filter((c) => !isGreyHex(c.value));
const spacing = h.tokens.spacing ?? [];
const twSpacing = h.tokens.tailwind?.spacing ?? [];
const spacingTotal = new Set([...spacing.map((s) => s.value), ...twSpacing.map((s) => `tw:${s.value}`)]).size;
const exactDupes = h.duplicates.exactDuplicates ?? [];
const families = h.duplicates.families ?? [];
const inline = h.tokens.inlineStyles ?? { count: 0, files: [] };
const comps = h.components ?? [];
const reusable = comps.filter((c) => !c.isPage);
const agentFiles = (h.context ?? []).filter((c) => c.kind === 'agent-rules');
const repoName = h.profile?.name ?? basename(h.repo);
const ds = h.profile?.designSystem ?? { kind: 'none' };

const fontFamilies = h.tokens.fontFamilies ?? [];
const typefaces = distinctTypefaces(fontFamilies);

// Benchmark helpers: for a metric value, where does this repo sit among the
// scanned fleet? ("more colours than 90% of scanned repos")
function percentile(metric, value) {
  const vals = bench?.stats?.[metric]?.values;
  if (!vals?.length) return null;
  const below = vals.filter((v) => v < value).length;
  return Math.round((below / vals.length) * 100);
}
// The flattering twin: what share of the scanned fleet is messier than you.
function cleanerPct(metric, value) {
  const vals = bench?.stats?.[metric]?.values;
  if (!vals?.length) return null;
  const above = vals.filter((v) => v > value).length;
  return Math.round((above / vals.length) * 100);
}
const ideal = (metric) => bench?.ideal2026?.[metric]?.value ?? null;
const median = (metric) => bench?.stats?.[metric]?.median ?? null;
const refMedian = (metric) => bench?.referenceSystems?.stats?.[metric]?.median ?? null;

// Clickable file paths — vscode:// opens the file straight in the editor.
const fileLink = (f) => `<a class="path" href="vscode://file/${encodeURI(`${h.repo}/${f}`)}">${esc(f)}</a>`;
const fontSizeTotal = (h.tokens.fontSizes ?? []).length + (h.tokens.tailwind?.textSizes ?? []).length;
const radiiTotal = (h.tokens.radii ?? []).length + (h.tokens.tailwind?.radii ?? []).length;
const shadows = h.tokens.shadows ?? [];
const offenders = h.tokens.offenders ?? [];

// Verdict severity: what a real design system would need vs what we found.
const findings = [];
if (typefaces.length > 3) findings.push(`${typefaces.length} typefaces, brands use 2 or 3`);
else if (typefaces.length && fontFamilies.length > 6) findings.push(`${typefaces.length} typeface${typefaces.length > 1 ? 's' : ''} declared ${fontFamilies.length} different ways`);
if (colors.length > 24) findings.push(`${n(colors.length)} distinct colours, a design system needs ~24`);
if (greys.length > 13) findings.push(`${greys.length} shades of grey doing the job of 13`);
if (spacingTotal > 35) findings.push(`${spacingTotal} spacing values where a scale has 35`);
if (exactDupes.length > 0) findings.push(`${exactDupes.length} component${exactDupes.length > 1 ? 's' : ''} implemented more than once`);
if (inline.count > 20) findings.push(`${n(inline.count)} inline style blocks bypassing every system`);
if (agentFiles.length === 0) findings.push(`no agent rules, so your AI is guessing`);

let verdict = findings.length === 0
  ? 'This repo is in good shape. The gap is documentation: your agent still can\'t see the system.'
  : findings.slice(0, 3).join('. ') + '.';
if (bench && findings.length) {
  const core = [['colors', colors.length], ['greys', greys.length], ['spacing', spacingTotal],
    ['typefaces', typefaces.length], ['exactDuplicates', exactDupes.length], ['inlineStyles', inline.count]];
  const worse = core.filter(([m, v]) => median(m) !== null && v > median(m)).length;
  if (worse >= 3) verdict += ` Messier than the median of ${bench.repoCount} scanned repos on ${worse} of ${core.length} core metrics. And the median repo is already a mess.`;
}

// ---------- health scoring ----------
// Each tile is a mini scorecard: your number vs the Ideal Design System
// target, the scanned-fleet average (the low bar) and the reputable-systems
// median. Health drives the animated icon and colours:
//   good  = at or under the ideal          → green checkmark (draws in)
//   warn  = over the ideal but better than the 27-repo median: "over the
//           target, better than the average repo" → amber circle (pulses)
//   bad   = worse than the median (and the median is already a mess), or
//           basically absent (<5% of ideal)  → coral cross (shakes)
// The absence rule is skipped for colours and greys: a low count there is
// discipline, not a missing design system (a site with 0 pure greys is fine).
// Where the median is missing or sits at/below ideal, warn caps at 1.5x ideal.
// Zero-ideal metrics (duplicates, inline styles): 0 is good; a small tolerance
// is warn; beyond that bad.
const ZERO_IDEAL = new Set(['exactDuplicates', 'inlineStyles']);
const WARN_TOLERANCE = { exactDuplicates: 2, inlineStyles: 10 };
const NO_ABSENCE_RULE = new Set(['colors', 'greys']);
function healthOf(metric, value) {
  const iv = ideal(metric);
  if (iv === null) return 'info';
  if (ZERO_IDEAL.has(metric)) {
    if (value === 0) return 'good';
    return value <= WARN_TOLERANCE[metric] ? 'warn' : 'bad';
  }
  if (!NO_ABSENCE_RULE.has(metric) && value < Math.max(1, iv * 0.05)) return 'bad';
  if (value <= iv) return 'good';
  const mv = median(metric);
  const warnCap = mv && mv > iv ? mv : iv * 1.5;
  if (value <= warnCap) return 'warn';
  return 'bad';
}
const ICONS = {
  good: '<svg class="ic ic-good" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg class="ic ic-warn" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16.01"/></svg>',
  bad: '<svg class="ic ic-bad" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '',
};

// Comparison rows inside a tile: your number vs each yardstick.
// ▼ mint = you sit at or under the reference, ▲ coral = you're over it.
function row(label, valText, refVal, value) {
  if (refVal === null || refVal === undefined) return { label, val: valText, dir: '' };
  if (value === refVal) return { label, val: valText, dir: 'eq' };
  return { label, val: valText, dir: value < refVal ? 'down' : 'up' };
}
function tile(value, label, metric, fallbackTarget) {
  const health = healthOf(metric, value);
  const iv = ideal(metric), mv = median(metric), rm = refMedian(metric);
  const pct = percentile(metric, value);
  const rows = [];
  if (iv !== null) rows.push(row('Ideal Design System', ZERO_IDEAL.has(metric) ? String(iv) : `~${n(iv)}`, iv, value));
  else rows.push({ label: fallbackTarget, val: '', dir: '' });
  const clean = cleanerPct(metric, value);
  const avgNote = pct !== null && pct >= 60 && health !== 'good' ? ` · messier than ${pct}%`
    : clean !== null && clean >= 60 ? ` · cleaner than ${clean}%` : '';
  if (mv !== null) rows.push(row('Avg Design System', `${n(mv)}${avgNote}`, mv, value));
  if (rm !== null && (rm > 0 || ZERO_IDEAL.has(metric))) rows.push(row('Reputable systems', n(rm), rm, value));
  return { num: n(value), label, health, rows };
}
const bigStats = [
  tile(colors.length, 'distinct colours', 'colors', 'a system needs ~24'),
  tile(greys.length, 'shades of grey', 'greys', 'a scale has up to 13'),
  tile(spacingTotal, 'spacing values', 'spacing', 'a scale has ~35'),
  tile(exactDupes.length, 'duplicated components', 'exactDuplicates', 'should be 0'),
  tile(inline.count, 'inline style blocks', 'inlineStyles', 'invisible to any system'),
  { num: String(reusable.length), label: 'components defined', health: 'info',
    rows: [ { label: 'the raw material', val: '', dir: '' },
      ...(median('components') ? [{ label: 'Avg Design System', val: n(median('components')), dir: '' }] : []),
      ...(refMedian('components') ? [{ label: 'Reputable systems', val: n(refMedian('components')), dir: '' }] : []) ] },
];

// Health score for the hero: the scored tiles averaged (good 100 / warn 55 / bad 10).
const SCORE_OF = { good: 100, warn: 55, bad: 10 };
const scoredTiles = bigStats.filter((s) => s.health in SCORE_OF);
const healthScore = scoredTiles.length
  ? Math.round(scoredTiles.reduce((sum, s) => sum + SCORE_OF[s.health], 0) / scoredTiles.length)
  : null;

// A repo with essentially no colour/spacing signal most likely has no design
// system in it at all; say that up front instead of quietly scoring zeros.
const noSystemLikely = colors.length === 0 || (colors.length < 3 && spacingTotal === 0);

// ---------- section renderers ----------
const DIR = {
  down: '<span class="dir d-down">▼</span>',
  up: '<span class="dir d-up">▲</span>',
  eq: '<span class="dir d-eq">–</span>',
  '': '',
};
const statTile = (s) => `<div class="stat glass st-${s.health}">
  ${ICONS[s.health]}
  <div class="num">${s.num}</div><div class="lab">${s.label}</div>
  <div class="rows">${s.rows.map((r) => `<div class="row"><span class="rlab">${esc(r.label)}</span><span class="rval">${esc(r.val)} ${DIR[r.dir]}</span></div>`).join('')}</div>
</div>`;

const eyebrow = (text) => `<div class="eyebrow">${text}</div>`;
const sectionHead = (title, subtitle) => `<div class="sec-head"><h2>${title}</h2>${subtitle ? `<p class="sub">${subtitle}</p>` : ''}</div>`;

function paletteSection() {
  if (!colors.length) return '';
  const tokens = colors.filter((c) => c.isToken).length;
  const strays = colors.length - tokens;
  const tokenPct = Math.round((tokens / colors.length) * 100);

  // Usage-weighted colour bar: every colour, width proportional to use.
  // Beyond 60 segments the bar turns to noise; fold the tail into one cell.
  const sorted = [...colors].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, 60);
  const rest = sorted.slice(60);
  const cells = shown.map((c) => {
    const src = c.files?.[0] ? ` in ${c.files[0].file}` : '';
    return `<div class="uc${c.isToken ? '' : ' stray'}" style="background:${esc(c.value)};flex-grow:${Math.max(c.count, 1)}" title="${esc(c.value)} ×${c.count}${esc(src)}">${c.isToken ? '' : '<i></i>'}</div>`;
  }).join('');
  const restCell = rest.length ? `<div class="uc uc-rest" style="flex-grow:${Math.max(rest.reduce((s, c) => s + c.count, 0), 1)}" title="${rest.length} more colours">+${rest.length}</div>` : '';

  const rampFor = (list) => `
    <div class="grey-strip">${list.map((c) => `<div class="grey-cell" style="background:${esc(c.value)}" title="${esc(c.value)} ×${c.count}"></div>`).join('')}</div>
    ${list.length <= 8 ? `<div class="ramp-labels">${list.map((c) => `<span>${esc(c.value)}</span>`).join('')}</div>` : ''}`;
  const ramp = greys.length >= 4 ? `
    <div class="ramp-head">${eyebrow('Grey ramp · sorted dark → light · how many can you tell apart?')}</div>
    <div class="only-dark">${rampFor(greys)}</div>
    <div class="only-light">${rampFor(greysLight)}</div>` : '';

  return `<section class="palette-grid">
  <div class="glass pal-hero grad">
    <div class="blob b1"></div>
    ${eyebrow('Palette')}
    <div class="pal-num"><span class="huge">${n(colors.length)}</span><span class="huge-unit">colours</span></div>
    <p class="sub">A healthy product palette is <b>up to ~24 colours</b>: one brand hue with a few tints, one accent, up to 13 greys, and status colours.</p>
    <div class="split-track"><div class="split"><span class="sp-tok" style="width:${tokenPct}%"></span><span class="sp-stray" style="width:${100 - tokenPct}%"></span></div></div>
    <div class="split-legend"><span>${n(tokens)} tokens</span><span>${n(strays)} strays</span></div>
    ${tokens ? '' : `<p class="sub warn-text">None of these are defined as CSS variables. Every single one is a hardcoded value.</p>`}
  </div>
  <div class="glass pal-usage">
    <div class="pal-usage-head">
      <div>${eyebrow('Colour usage')}<div class="h3d">Sized by how often each is used</div></div>
      <div class="legend"><span><i class="lg lg-tok"></i> token</span><span><i class="lg lg-stray"></i> stray</span></div>
    </div>
    <div class="usage-bar">${cells}${restCell}</div>
    ${ramp}
  </div>
</section>`;
}

function spacingBars() {
  const hasTw = twSpacing.length > 0;
  const merged = [...spacing.map((s) => ({ label: s.value, count: s.count, off: hasTw })),
                  ...twSpacing.map((s) => ({ label: `·${s.value}`, count: s.count, off: false }))]
    .sort((a, b) => b.count - a.count).slice(0, 18);
  if (!merged.length) return '';
  const max = merged[0].count;
  const rows = merged.map((s) => `
    <div class="bar-row"><span class="bar-label${s.off ? ' off' : ''}">${esc(s.label)}</span>
    <div class="bar-track"><div class="bar${s.off ? ' bar-off' : ''}" style="width:${Math.max(2, Math.round((s.count / max) * 100))}%"></div></div>
    <span class="bar-count">${n(s.count)}</span></div>`).join('');
  return `<section class="glass pad">
    ${sectionHead(`${n(spacingTotal)} spacing values`, `a scale needs ~35 · Tailwind steps marked ·${hasTw ? ' · raw px values off the scale in coral' : ''}`)}
    <div class="bars">${rows}</div></section>`;
}

function duplicatesSection() {
  if (!exactDupes.length && !families.length) return '';
  const dupeCards = exactDupes.slice(0, 8).map((d) => `
    <div class="fam">
      ${eyebrow(`&lt;${esc(d.name)}&gt; · ${d.files.length} implementations`)}
      <div class="fam-rows">
      ${d.files.slice(0, 6).map((f) => `<div class="mini-card">${fileLink(f)}</div>`).join('')}
      ${d.files.length > 6 ? `<div class="mini-card dim">…and ${d.files.length - 6} more</div>` : ''}
      </div>
    </div>`).join('');
  const famCards = families.slice(0, 6).map((f) => `
    <div class="fam">
      ${eyebrow(`${esc(f.root)} family · ${f.members.length} variants`)}
      <div class="fam-rows">
      ${f.members.slice(0, 6).map((m) => `<div class="mini-card"><div class="mc-main"><div class="mc-name">&lt;${esc(m.name)}&gt;</div><div class="mc-path">${esc(m.file)}</div></div>${m.usageCount ? `<span class="pill pill-mint">used ${m.usageCount}×</span>` : ''}</div>`).join('')}
      ${f.members.length > 6 ? `<div class="mini-card dim">…and ${f.members.length - 6} more</div>` : ''}
      </div>
    </div>`).join('');
  return `<div class="glass pad half">
    ${sectionHead('Duplicated components', 'every duplicate is a place where your agent has to guess which one is canonical, and it picks wrong half the time. Paths open in VS Code')}
    <div class="fams">${dupeCards}${famCards}</div></div>`;
}

function typographySection() {
  if (!fontFamilies.length && !fontSizeTotal && !radiiTotal) return '';
  const mini = [
    typefaces.length ? tile(typefaces.length, 'typefaces', 'typefaces', 'brands use 2 or 3') : null,
    fontSizeTotal ? tile(fontSizeTotal, 'font sizes', 'fontSizes', 'a type scale has 6–8') : null,
    radiiTotal ? tile(radiiTotal, 'border radii', 'radii', 'a system has up to 10') : null,
    shadows.length ? tile(shadows.length, 'shadow styles', 'shadows', '2–3 elevations') : null,
  ].filter(Boolean);
  const fams = fontFamilies.slice(0, 8).map((f) =>
    `<div class="mini-card"><span class="mc-path">${esc(f.value.slice(0, 70))}</span><span class="pill${f.count > 2 ? ' pill-coral' : ' pill-mint'}">×${f.count}</span></div>`).join('');
  return `<section>
    ${sectionHead('Typography &amp; shape', '')}
    <div class="stats minis">${mini.map((s) => statTile(s)).join('')}</div>
    ${fontFamilies.length > 1 ? `<div class="glass pad" style="margin-top:16px">${sectionHead(`${typefaces.length} typeface${typefaces.length === 1 ? '' : 's'}, declared ${fontFamilies.length} different ways`, 'every distinct declaration is a chance for the next one to be wrong')}<div class="fam-rows">${fams}</div></div>` : ''}
  </section>`;
}

function offendersSection() {
  if (offenders.length < 3) return '';
  const rows = offenders.slice(0, 5).map((o, i) => `
    <div class="ledger-row">
      <span class="ledger-idx">${String(i + 1).padStart(2, '0')}</span>
      ${fileLink(o.file)}
      <span class="ledger-pills">
        ${o.strayColors ? `<span class="pill pill-amber">${o.strayColors} stray colour${o.strayColors === 1 ? '' : 's'}</span>` : ''}
        ${o.inlineBlocks ? `<span class="pill pill-coral">${o.inlineBlocks} inline</span>` : ''}
      </span>
    </div>`).join('');
  return `<section class="glass pad">
    ${sectionHead('Where it hurts most', 'the 5 files carrying the most off-system styling')}
    <div class="ledger">${rows}</div></section>`;
}

function inlineSection() {
  if (inline.count < 5) return '';
  const max = Math.max(...inline.files.slice(0, 6).map((f) => f.count), 1);
  return `<div class="glass pad half">
    ${sectionHead(`${n(inline.count)} inline style blocks`, 'styling no system can see')}
    <div class="fam-rows">${inline.files.slice(0, 6).map((f) => `
      <div class="mini-card col">
        <div class="mc-row">${fileLink(f.file)}<span class="mc-count">×${f.count}</span></div>
        <div class="mc-track"><div class="mc-bar" style="width:${Math.round((f.count / max) * 100)}%"></div></div>
      </div>`).join('')}</div></div>`;
}

function componentsSection() {
  const top = reusable.filter((c) => c.usageCount > 0).slice(0, 10);
  if (!top.length) return '';
  const rows = top.map((c) => `
    <tr><td class="mono strong">&lt;${esc(c.name)}&gt;</td>
    <td><span class="pill pill-mint">${c.usageCount}×</span></td>
    <td class="path">${esc(c.file)}</td>
    <td>${c.propsHint?.named?.length ? c.propsHint.named.slice(0, 5).map((p) => `<span class="chip chip-xs">${esc(p)}</span>`).join(' ') : '<span class="dim">—</span>'}</td></tr>`).join('');
  return `<section class="glass pad">
    ${sectionHead('What you actually use', 'top components by adoption · the real system, buried in here')}
    <div class="tbl-wrap"><table><thead><tr><th>component</th><th>used</th><th>defined in</th><th>props</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function agentSection() {
  const have = agentFiles.map((c) => `<span class="chip chip-agent">${esc(c.file)} · ${esc(c.tool ?? c.kind)}</span>`).join('');
  const msg = agentFiles.length
    ? `<p class="sub">Your agent reads ${agentFiles.map((c) => `<span class="mono">${esc(c.file)}</span>`).join(', ')}. But none of it points at a single source of truth for components and tokens, because there isn't one yet. The numbers below are what your agent actually works from.</p>`
    : `<p class="sub">No <span class="mono">CLAUDE.md</span>, no <span class="mono">AGENTS.md</span>, no <span class="mono">.cursorrules</span>. Every time your AI builds UI here, it guesses, from everything below. This is why its output looks almost-but-not-quite right.</p>`;
  return `<section class="glass pad agent">
    ${sectionHead('What your AI agent sees today', '')}
    ${msg}${have ? `<div class="chips">${have}</div>` : ''}</section>`;
}

// ---------- page ----------
const stack = [
  h.profile.framework !== 'unknown' ? h.profile.framework : null,
  h.profile.typescript ? 'TypeScript' : null,
  ...(h.profile.stylingDeps ?? []),
  ds.kind === 'shadcn' ? 'shadcn/ui' : ds.kind === 'library' ? ds.name : null,
  h.profile.monorepo ? 'monorepo' : null,
].filter(Boolean);

const html = `<!doctype html>
<html lang="en" data-theme="${themeName}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design-system diagnosis: ${esc(repoName)}</title>
<meta name="author" content="Greg Kozakiewicz · gregkozakiewicz.com">
<link rel="icon" type="image/png" sizes="32x32" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAAAAAAAAQCEeRdzAAACPklEQVR4nOVWTYh5URR/PlJYEKV8LKwkZalsmI2dZmMnK8pKmaZ87JSanexEkayUhSxsZyfJNBQ7UYqVhSShfM+v/6mXmtU81+p/Frfze+/d3++ce88993Hcf2cikehZ1GazWafTPUVDLBZjLBQKnU6HMTVvcrl8Op3ebrdsNgsokUiYUVP4Pp/v9s96vd79cwZGK95sNkkgGAwC2u12lhrY3u12C/b1ei2TyV5eXjabjV6vZ6BBa51MJin8arUKWKlU4H99fSkUCo5JUQ2HQxJwuVzIYLVawcdIVSs8CQoNpMQ+Go0Aw+EwwXw+D+h2u4Vr0LRSqUSMqVQKsN1uE3Q4HEql8ng8BgIBTnDhqlSqxWIBuvP5bDAYLBbL5XIBHAwGeBuJRODvdjun0/nnPOjraDRK8TYaDcBMJkMwFosBfn9/E0wkEn9OgjYgnU6fTidQwAGcTCbw9/u9VqvFUYB/vV5RskajkRNcTiaTKR6PI9j5fE7xlstlPM/lcgTr9ToneJ/5oOB4PB70O8Tb7/f9fv9sNqPkXl9fhQsQ9f1ktVqNvUVCxA6ZRxsf5pMAxnsuVBSOwvv7+6Phk0PsBNn0OOLC9haLReqdvBL/wUNKNPnt7Q0LjeVutVqhUEij0TwU9W8BVA4JUEUul8tarcZGhpbIarWiSeA0HQ4Hkvn4+GB56VMvov6DA+z1eplR89btdsE+Ho9tNhv3jOv+8/MTFz06M3ypVMqMnTfcwPhn4djG/tue+Mf4RGom9gMt6lAx16huIwAAAABJRU5ErkJggg==">
<link rel="icon" type="image/png" sizes="192x192" href="data:image/png;base64,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">
<link rel="apple-touch-icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAAACXBIWXMAAAAAAAAAAQCEeRdzAAAQAElEQVR4nO1de2yN9///dDOxISipS4WZ1GUps2xqWZkwFrHJVqSmS2rENTUsY6STyS4WYTK3bDOpITbEgrhMbCXrlglDGI1rXFMt0VajLqHnrL/X73nleX8/nuf0tK6nPX2//nhyejz99Djv1/O+fd7v98cYhUKhUCgUCoVCoVAoFAqFQqFQKBQKhUKhUCgUCoVCoVAoahpiYmLq1KmD65NPPlm3bl1cn3rqqfr160f6cymqBxo2bNi/f/82bdrwR1Aksp9HUV3wzDPPxMbG/vXXXytWrGjQoIG8DxUSwU+lqBZ44oknBg4cmJ+fX15ePnHiRL4JywJDE9kPpogYwAm+AAnWrVt39epVkOPs2bMjR47Em/BC5AZFrQPEzxcdO3Y8deoUmFFYWIjr0aNHe/bsyRtUedRSQDFA9vXq1fvggw/y8vJAi1u3bl27du327dt//PHHCy+8YBylovyojYDUwY+4uLhdu3YFAgGQIxgMlpSUlJWV4fXq1asbN24c6c+oiBwQj3Tq1Km0tBRs+O+//0COGzduwPm4c+fOlStX5syZ8/TTTxuHRpH+pIrHBTEWDRs2nDt3LlVF0EXAAd4BUd577z0EurbrGtEPrnj0gIyZ5mrTps3p06f/cyDk4GtcwY+CgoIePXogrOUvavwS/YA1oZjffvtt8TY8wPu44p/279+PcAY308QoohxMfTZp0uTnn3/2qA0PP5j82LBhQ9u2bY2TGYv0Z1c8SsCmUMZJSUlwRakh7KtNDkS29EjgmnArDsSCClH7EoVg+ArUqVMnIyMDUg/4YPMDN4Af169fLyoqyszM5J6tbthGJ0RtJCQkwFjQ26iIGSRHSUkJwlq8OHXq1DvvvGPULY0+MHyFXOvVq4cfhw0bdvv2bbABViOM5kA0S+2C64ULF0aMGGGcXVxJvSuiAUxRUKhwRZcuXQp5w17cunUrDDmoPG7evInrpk2bGLZ4sh2aYq/xYIRCtdG3b98TJ04wzUX9URE5SAvELHj/888/N3cXeUhNkBqaGg/W/+HF+PHjQYs7d+5AbVRkVhDfMpSFzwF+nDx5sn///sYiBwnB3bsI/qcUDwe0KS1btly7di3VBvgRPloBReiNZmVlwRgZy6aQJVL2oRSpwajjAC+GDBly9uxZehJ+teEPZWF3cFt6errxmQ/ww+9wKEtqHqQ4dOHChWDAbQdlDsKQg3YnJyfnxRdfNG75j4hfEqZ0ZYzWB9VQ0HmEjPfu3Ss2pVJyXLt2DdcZM2ZwY0VUhTAAYW2jRo1ADr6jnmkNxuTJk7ldQptSFc1RUFDw2muvGXe7LsaCcbbupk6d+txzzxlHf2jBek0FLMvGjRvBjDsOQpLD3lgpdwBXtHnz5sbdlRVmQGfgx/nz52OF2bNnG4c9jRs3VrNS84CHvnv37qdPn6ZNKbPgIUfASZsyVAFGjx5N38KTFQUVwLbs7GwseOnSpUmTJplQka2myKo1RDZffvmlVARWFKfA3MhOLF6fOnWKWVGYDI8/Aa6kpKRcvHgRv4X7c3Nz33rrLflzuNljYnS7vzqC0oLC//3337lREpIZJAdCGHACRoc25fvvv4e/aSoQ7apVq3AzIxrcDFcXysncnTmVXJlRd7VaQVQ6nvIBAwYw14krZO/ZjPUAFMGdUDPMioYMUNu0aQNflQqGGREAQW/r1q2NlY3la5okdVerEdg4bxzp/vjjj3i+YTK40RpSeVAB4AplgBf//PNPs2bNjFUgaDsQGRkZ3HlhGl4c2EWLFvEGj4+iaqMaQVQ60KpVqwsXLkDqbDsQn8NDEZKDegXXTz/9lAbCbrrnmk2aNNm6dSsVBq7Xr19nQTJYUlxcPGHCBN5sB7fkijqn1QIQBp94SGjUqFFUBndchI9WcOf58+dfeuklbp2IREUZJCcnwxWlb8sFsT4owhd5eXlpaWniZ9g6Q8lRLSD9By1atNixYwc1P5wJDzNsctAhpQ7YsmULn3sRLUe7GKfbJTMzkwvedEA3FgYL77BGBDFzjx49jGXaFNUF9gPaq1evy5cv02qEhE0OeiRFRUXjx483FezIP/fcc/v27aPCoPKgzgg4W/ziz27btg26x/iUhyLyoFBjY2PhOoiHUUVyICjt1KmTP51FK9OvXz9aH+oYuh2iOcAMaA76qsuXL4+LizM+51QRMTCmoDzat29/+PBhiq1S0FeFdCXisPnB0BRGKisrK+g2xkkiVQC2ccuXPPvhhx9ghtjQoBSJPEgO+AcQxpAhQzhVoSrkoDk4e/bssGHDjLUHS6PQqFEjvNO1a9fc3Fx/B6X9DlejC1xYWMjMOleL8FdTmyG7YnzK4+Pj8ZQzdWHvtVZEDooTMWrTpk2Nk96QBWU/dvTo0SHbJ/3kYL6EIbGxCkoUkQHlh2eU1TcIOLnTBiGFIQc9D3qUsAXTpk0zjiyfeeYZPu5ghjRe//LLLyxb9zPDJodk0vbv3w+P2KjbUR3AuBHixHP/ySefML3t74YNWP2P3HBh6LFz585u3boZq7jLOHKlKho0aFBJSUnAiWBlBb6w/wTJAQJhwQULFoBYalCqBSTDnZiY+Ntvv7GxIKQhsJ/7oFPXg9tYmcHNNoFkSGfNmsWqUr/6sRekFcObZ86ceffdd42Wqlcf8KFPTU0tKChgEiIMM4JO4osOR35+Pl1Rpr8YuMK4UG3ASP39998h93U9C7LMDHfCBiFcMi4ttLYj8mDP47fffkvngLvqYcghccratWs5aoF+Br2E+vXr01TBF2HKK2Q5iIcctCmZmZlS3iH8iOyXU6tBBQ6b8ueffzKShDMBN7MigxJw0pq0KR9++KHxbZ9KEn3ZsmXcx+ceTRhy8IZz58717t3buPNuSQ5NlUYStCmTJk0CLSB7eo4V6X/bshw+fPj11183VljBp5y7dykpKcePH6dN4WZbeHIAUF1S2yE2BXrIoz9k5yWmAjze7y96wf53wO5powkIY1aoV3788ceWLVsaa7A1nvLGjRszPwFHlX5ryIL1kJqD7ovxORzwdjt06DB58uQBAwYYx9ulW6PkeLSg2ujTp8+///5rFxKHYUbQqcYARo4cKWGwCIZxSrt27Xbt2sV8SaXMCDo+xz///NO1a1fjui+yIPVQenp6cXFxVlYWPjAzuUY1x6MGLfrixYu5b86etvBqI+gEsbApXbp0Ma7aEJAu4A0rAv3zGvz84G4cvFcSy7YpMW5DA90XGD7oD+MoD3uapZLjkQCSiI+PpytKtSFiExF6uMLoY+HChZxXTInagsE7nAFUkUGxF6S3AaeV07EZA3vYlpCQAMXGnCx84XHjxvFOaBFcn7Cg5HiYwFc5YsSIEydOBNwkJiUXJvKk1Pv162cc39MmB9d85ZVXTp48yUxrpWqDHivI1KpVK0m6e3RARkYGOIGbL1++jPsvXrzIsiCQQw6MAkv8rZeKBwK+ULiisCZ0I4LWHphflgGnHBBXaJrY2Fhjpd5FJLh+9dVXeXl5TJZURA5pgsKCcCbef/99mdfANWVB/Lh582ZaKGgOLFtSUrJ//34aNeM2vDDLosrjYeL555/n+QeMU4QEYWpFcR01apTdlmKLBLZmz549MgMoGGpHN+hUI4sSgpphJs245LCp1rNnT7uhAcsWFRXBDG3ZsoVxLzjBX2HYpRn3B4XsXMyYMYPNKSKqgFUA5tEczHBDMJ07dzaO1RevUOax9O/fnyc4ybZtSHLQ8+Vqq1ev5taMPddFOiS++OILFokFnGpTqjd6Kl9++SX5AfvSsGFDqhCtAnlQ8Llv0KDBwYMHy93zDyrSGfjRLhlfvny5tMJSlpAHZMOVlyxZwsx6GG80YNUXwpl4++23SQWRK65MlkD2hw4dYlpWCMoVqEugw2hTOAdXbcoDgdso/AahsbmjEXCd0JAS5YPOrVpcU1NTuZQIUvRH8+bNc3JyKtpMsdkmumrfvn3Mtcg68EnJDLyDv8VPyL0ektheCs7p0KFD6zpQnfEQQBnUr1//66+/DrhuREidYfODmnz37t0tWrSwVxP9AXWSlpZGIxVebUhjbWFh4Zw5c+RTUbRYhzELfN41a9ZQYXAf2GZGmdNwRXqx4ZYZEcUDgbJs167d8ePH5SmvSG3Yzzowb948LiLPaIybxMTjzhx8Rb2Tfn7k5uYmJydz98SeIscEaGJiIvugQnq1AadmgO7Ir7/+mpCQYPSchgeEtDinpKTQ/6+UGQF3g/7ChQtvvPGGZ8EYN2XerVs3PMr0DyoFhbp+/XrjsCrm7n01EAVvjh07VloZbINi5+W4OQzA12FSTosL7x98tqCBly1bZnug4V0ECmnz5s3ggWe2guQ0p0+fXl7xJA8bVBuXLl364IMPjE+ctA6tWrXauXOnMCPkOR5CXAAW6rPPPpOknOJ+wLggKSkJGptPeaWag7KEM4G41/iaV0mOtm3b/vnnn4G73YLwagPuS5cuXfxeJLnSr18/cU3sJhf/Rg9jZiq2jz76SAOW+4TsffAp50SeKpIDsqff51mQaw4ePJjtr5Uyo8xpYcKC3333nbm7LNm43IXygHPD4tPwzCBYZoD7V61a5V9TUSXQ6evateuOHTtYQlEVV5R2fenSpcY3TUWal2bPns2saKXkIDPOnDnz3nvvGUuQjFbEFeVeoCRtw0M0x5gxYx7zVxptSE1NpT4I39YWdE/WwfX06dMDBw40ViaUoE3p0aPH/v37w++0BZyYWXoef/rpJ0Sq9RzwU2FlhC10iaQPKnxliUwIYi7k999/RwhmdJjYPYGxIl9DJAsWLAif3g64G2+8rdw5HEO2P4x1FAsVycSJE+kchCcH22FoKWbOnGkc7xgWRD4b1UZcXNyKFSvK3dYYD189INuoOebPn89F9GCoewCeJMiAaUc4eizt9Gcb/fwocwf3TJkyxViFxDFWrXlCQgJ72lh1bAsy5JrlznSoPn36GGu8uixrnCm2HLVOe+FZwWYG6chU2JEjRziOTE/FvjcwOKRoP/7446CVHghDDqC4uBjiAZn69u1rrOZVVtZw2SFDhuTn5+PxDdntYq/G3XlcFy9e7BFhjFsriiu77kpLS4NuYrQizcFdX9qplStXcril5sHuDdAcfEBhGtauXYvHl+0C4cmB24qKivDVf/vttywklkoLqg1K9KuvvqJrEnCqzEOSI+i2uuDvIiRmT5t/PBzead++PdOsuM1PDg8/2EJB2sG0Gde91VD2HoAvi6U048ePLygo4NPG4aHhNQeEfenSJeh54/ve+ZTDprCDUlYL6TmSNGTktm3b2rRpY0LNNzaOK8pBdWF2AW0UFhYyzOYhDawiUHLcD0aNGoWwAvqAHpw97yuk5uD3zqJwY40HNa6JycjIgE0JuvUZIeUnoC1jVtSEmiSJxVetWiVUC/mp7AU5XoyFHbQpMor/cX2j0QJGngg7P/300+zs7CtXrjACpHPqFwO0C3T7zp07u/lVZQAAC9VJREFUQSnYI4kPbeWBKKbcamjwyM+zIAiUl5fHlnxPQEG1kZycLCFxmP1h26zgHSiPwYMHG1dtKDnuE+Io4AV8zEWLFkH8jGmDoaolmLDC+/v27fviiy8QYrDgiq7owIEDDx8+XG6dtuGXny1U/JXly5fLmBf7g3FBsJamJ0wCxl6cnw2xEtMb7FdQcjwEUJG0bt06LS1tw4YN8C24u0auMGNBvUIfpcyZZvzrr7/CcWFx7+zZsyFL3l8WqiA56G7scXQYlkK0yfmTnnNY8E58fDxP/YE+q6LPQe5OmjSJpee0Kdpb+0Cwt6b4ncbGxnbv3n3KlCl//PEHv3EGMiyYkH1zPqkwDXv27MnKymI2IqQUPeTgm8eOHeMZPDF3g++kpKScO3eu/O5Tf8KTAz/iV3r27Cn/ESXHw0GMNe2JgG5H9DFkyJD58+ezgjzoDoSkMPBMizqRTEnQ3ffyizDgbrNx5gfcRvFnRXOILGFxeGf4HR9hBo3gN998Q9eYmVYlx0OD+B+eLzQuLi4pKWnkyJGIHRDaCAlgVmTKiuzbBdwmlKCvPpkvZEw2o01zdyGxcYgCh5cdEh6bUhE5yFGsOWjQIPJM1IaS42FCTIwUbwrg6A0fPvzrr7+GuWFxaLl7MigEwzEvAWcHhK22wbvrypikIjkOHTqEhxuKynZF5U8jvi1zj/MRVRTSWklRI+6BeoOqk43ikOeSKu4f/q+STyHUiV2v+/LLL3/44YerV6+GzyjZVRKF84c5ulS2UgVkBsLmCRMmgBkIVfyVWo0bN96+fbs4whVpjqB78A//EN6ZNWsWQ2K7SU758Whhu6schsEf8dAPGDBg3rx52dnZ9EbFdZVgmK/Z4SI35ObmSvciIVtuWP/1118/c+YMN2zZJxeooLFKbqCO4Y4PZx17evMf7xdWm+D/ftlLInkwBMDDhg1buXLl6dOnxUsNWCcisFhEyHH+/Plp06YlJiZiEbECXA3MgwKg9ZG6wJBmRXwd2p1du3axX9fTQq3keHxgeQQF+ZQLETBYMnHixJ07dxYWFjLWoLdI6dI/kEOZ4LUgAE5NTY2Pj49xB2/A0Bw4cEB+y3+Ch19zcCmYOfLVM3RKETH4H03IBk5Djx494LcePXqUDzenA4IWzJHQmaBiwPXw4cMIQfEr+F1oILFHoiH8QQrJwfEyWOTEiRPSW6WcqHaIcYczyTtQJ+3bt4diWLZsGWdkMzTl+YFXr161e6C5z7J7926ojUo3h4U0ksOFBtL+lOoOhjacOidvNmnSBK4inIytW7dKAIwX+fn5ly9fZqEGUyPl1l5/pRCPBO4tC1oV1R3QH3RE+KPoEkQQHTt2HD58+OLFiw8dOiT+KQfFILhlSEx3JHh3E2xFmoM+6W+//abNBzUSEJuMtybgkfTq1WvcuHGbN2+GubF3aqAMWEImTqgcNuhniWTe4NwYbU6p0aDFsftc2rZtO2jQIIg2JycHmoP8gMhZNsBIJ8xJlEycyGRcPSQwGsDiUI7Q4I+dOnUaPXr0mjVrjh8/Lk6JP7vqIQeLvvBbWEeriKMNMDdNmzYVc1C/fv2kpKSZM2dCkZw/f764uLjMHeriJwcrQoqKing8sYYqUQgKFR4JU6V4wS63oUOHLly48OjRo3AppAzMJgdtSnZ2tvTranqjdgHmZsyYMfBbqUVu3LgBd5UJNCZGeQalnqZQSwF/Ii4uDuphxowZu3fvlnwrNMfZs2dTUlKMW4CimqMWgeNE5UcEwB06dHjnnXeWLl3K/s2NGzfGx8cba9p65D6s4jHCLovnRHP5JwTAycnJmZmZr732mnGHQkXsgyoeP0TerDOyW/g90PRGLYXHUghFqEukVEANiuJ/U0CYRtMSUcX/YJNDmmCVHNUC1UQMMT5E+hNFIzyFOcZJKvCJZCGxfTaWp11RZRO1kOPymjdvnpaWNnbsWKmxa9iwoaS0Y9yDP/V4vVoE6gOKfPr06aWlpXv37l28ePEbb7wh25u4B0SRBAPjSSVH9IODK0iOCRMmlDv90MXFxceOHduwYcPMmTN5ZBohlV0ey6KdhtEJqgGSY9iwYXl5eVevXpVCips3b+7atWvRokWjRo3q2LGj/Yt0RyR9SWgaKgohM8WPHDlS7ozjuXbtmpSDlzsD/DZt2jR58mTcw3EoAj3nJsrBJ7579+48K9puOsVrDg4kSy5cuJCVlfXuu+9269bNLtVUnRG1oGifffbZn376qdydFmfX7rLhjMM9yZJ9+/bBI+nTp0/r1q3FV9XK3igE3cnY2Fi4F+XuJAWptrLntATcudKcHF1YWLht27aMjAzO5dERwVEIqZ6aNm1auXvKvD0lxz//L+CMIg2403zOnTu3fPny1NRUKg+xMnXr1uXh0PZhooqahBj3sFaeSUBy+I8yCdlQZBeI5+fnHzx4cM6cOb169fLbGs2F1FQwYHnzzTcvXrxIJ6Mq5JB+eXt4HLiVm5u7YsUKUI2H7xE8j15d15oHOR4F0WyZO8qtKppDPNbr169LDwFbkhDaIPxZsGDB4MGDObeasA8PV1tTA0DN0aFDB57UJCf5esjhoYg0klB/cKYbtEhpaak0N7MXbcOGDR9//DHMje20UosoP6o7KKeWLVtmZWUxYAlWGcIhe5YGxztJyoTYu3fv/Pnz09PTeb4f/7Qe2ljdQVE1atRo7ty55VU+Qc0Du+NIICzhxg3V0vbt26dOndq7d+9mzZqp5qjuoIRwnTJlCj2G+yBH8O7TaD2g8uDGHgfvI7rRcRo1APL4QuczLn3o5KAXArXB07WgSxYuXBgXF6eao7pDAoekpKSioqL/7gskB42InYAXzYF/4oSFc+fODR8+HH+xXr16GtzWAFBIiYmJJ06cEBNwTwAVZLoXKWKTAyEM7Ei5c8of25A0J1ZjINtv3Ju9D3JQeYAWPGcj6Aa6sm+HNdetW9e5c2d20/Pv6lmvNQBMdbRo0WL9+vWSEbdRRX4w1cEpPDI8lAUAS5cuZVPr008/HRsbSzrqWa81ACQHolkePUwzcU/8YP0HI5GgOxeQaiMvLy8zM5MZMFoT1rXLto6iWkMmjn/00Uckh2zZV5EiQedsDQ7yKnePrAb27NkzevRo/hXoCQ1Pah7kCU5LS5NDMDw7KZXqD6qN6w7IDLifPIWPfYusPFV+1DBI7JCcnIxoNhBq7mfI3IbHspAipNeWLVt45qNxdBJgD6uP3P9Vcb9ISEiAixAINWu8UnIwiOWcrh9++KF58+bGKemIcc9fkr7nSP8vFVWGLS0ELLAFpAVjDTsBGrAOzJLXtCC0JrRHn3/+Od1PWiv1OmswbHIgyNy0aRP33jybLH5yBNxiMJ6VdOPGjfPnz6emptqdTjobNBpAiiCgmDdvHnNWIclhl/nYg9tgVnJycl599VXjTmmSdjrVHDUeFCF8xsmTJ3OTnYU8/4UqM6Ze4VF+9DbWrFlDZhjHz5DDGY2SIwoghuDNN99kI1PAOZmcJaVBtxiML3iyHwsKS0tLFy1axAYFz/A/o1OFowMSYXbu3LmwsJDkAAlIFDEu1ChSllFQUPDJJ5/Q/bQTGNp9H22gdBGw8OAtZsTlkDabHPzXAwcOjBkzhr/VtGnTGN9kNyVH9IBirlu3LlxLagtOHPfkNhie7Nmzp3fv3saZbB9yNSVHVEHIgWiW2qLMPfFEwHNA165d26FDB+OmPiP9wRWPHjHuuGBEs0x00oJwCj11CdxP/Cs333WyTy2C7KdPnTqVZ63JAdLcMSkpKYGT0bp1a2GDTnqsLZBNkKFDhxYVFTHBxcouvD506FB6ejocT+OOjDJKjtoDe2+WZeJXrlxhj9O2bdvwpvHlLdSs1DrA2UQ0KyHrypUrExMTjaMn/BPilBy1C40aNWI0C1d0yZIlzZo1M84WmgQmQgj1SWsRRMbZ2dnwSWfNmsUZGxWViSs5ahFExtOnTx83bhwTXDJaQyv8FP+vJ2BEWCNudw8oORQKhUKhUCgUCoVCoVAoFAqFQqFQKBQKhUKhUCgUCoVCoQD+D2blJkKll3ZHAAAAAElFTkSuQmCC">
<style>
  :root { ${THEMES.dark.css} }
  html[data-theme="light"] { ${THEMES.light.css} }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { color:var(--text); font:15px/1.6 var(--sans); -webkit-font-smoothing:antialiased; background:var(--bg); }
  /* fixed gradient wash on its own layer: background-attachment:fixed +
     backdrop-filter makes Chromium skip repaints on scroll */
  body::before { content:''; position:fixed; inset:0; z-index:-1; background:var(--page-grad), var(--bg); }
  .wrap { max-width:1120px; margin:0 auto; padding:48px 28px 72px; }

  .glass { background:var(--card); backdrop-filter:blur(24px) saturate(140%); -webkit-backdrop-filter:blur(24px) saturate(140%);
    border:1px solid var(--line); border-radius:16px;
    box-shadow:0 1px 0 var(--glass-inset) inset, var(--glass-shadow); }
  .pad { padding:26px 28px; }

  .eyebrow { font:700 10.5px/1.4 var(--sans); letter-spacing:.16em; text-transform:uppercase; color:var(--dim); }
  .sec-head h2 { font:600 19px/1.3 var(--disp); letter-spacing:-.01em; }
  .sec-head .sub { margin-top:3px; }
  .sub { color:var(--dim); font-size:13.5px; }
  .h3d { font:600 16px/1.3 var(--disp); letter-spacing:-.01em; margin-top:3px; }
  .dim { color:var(--dim2); }
  .mono { font-family:var(--mono); font-size:.9em; }

  /* hero */
  .hero { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; }
  .hero .kicker { display:flex; align-items:center; gap:8px; font:700 10.5px/1 var(--sans);
    letter-spacing:.16em; text-transform:uppercase; color:var(--accent); }
  .kicker .dot { width:6px; height:6px; border-radius:99px; background:var(--accent); box-shadow:0 0 8px var(--accent-glow); }
  h1 { font:700 clamp(28px,4.5vw,38px)/1.15 var(--disp); letter-spacing:-.02em; margin:10px 0 8px; }
  .hero .meta { color:var(--dim); font-size:16px; }
  .hero .meta .mono { color:var(--text); font-size:.95em; font-weight:600; }
  .score { text-align:right; }
  .score .eyebrow { color:var(--accent); }
  .score .val { font:700 44px/1.1 var(--disp); letter-spacing:-.02em; }
  .score .val .slash { color:var(--accent); }
  .score .val .of { font-size:26px; color:var(--dim); font-weight:600; }

  .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
  .chip { border:1px solid var(--line); background:var(--card); border-radius:99px;
    padding:4px 12px; font:500 11.5px/1.5 var(--sans); color:var(--text); }
  .chip-agent { background:var(--text); color:var(--bg); border-color:var(--text); font-weight:600; }
  .chip-xs { display:inline-block; border:1px solid var(--line); background:var(--chip-bg); border-radius:99px;
    padding:1px 8px; font:500 10px/1.6 var(--mono); color:var(--text); }

  .nods { display:flex; gap:12px; align-items:flex-start; background:var(--nods-bg); border:1px solid var(--nods-line);
    border-radius:16px; padding:14px 16px; margin-top:20px; font-size:14px; }
  .nods .ic { position:static; flex-shrink:0; width:22px; height:22px; }

  /* verdict hero card */
  .verdict-card { position:relative; overflow:hidden; margin-top:22px; padding:26px 28px; }
  .blob { position:absolute; border-radius:99em; pointer-events:none; }
  .verdict-card .b1 { right:-64px; top:-64px; width:256px; height:256px; background:var(--blob); filter:blur(48px); }
  .verdict-card .b2 { left:-40px; bottom:-80px; width:224px; height:224px; background:var(--blob2); filter:blur(48px); }
  .verdict { position:relative; font:600 clamp(18px,2.6vw,24px)/1.45 var(--disp); letter-spacing:-.01em; margin-top:10px; }

  section, .agent { margin-top:28px; }

  /* stat tiles */
  .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:28px; }
  .stats.minis { margin-top:14px; }
  @media (max-width:900px) { .stats { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:560px) { .stats { grid-template-columns:1fr; } }
  .stat { position:relative; padding:20px; transition:border-color .2s; }
  .stat:hover { border-color:var(--hover-ring); }
  .stat.st-bad:hover { border-color:var(--bad-ring); }
  .stat.st-bad { border-top:3px solid var(--coral); }
  .stat.st-warn { border-top:3px solid var(--amber); }
  .stat .num { font:700 32px/1.1 var(--disp); letter-spacing:-.02em; font-variant-numeric:tabular-nums; margin-top:2px; }
  .stat .lab { color:var(--dim); font-size:12px; margin-top:3px; }
  .stat .rows { margin-top:14px; border-top:1px solid var(--line-soft); padding-top:10px; display:grid; gap:6px; }
  .stat .row { display:flex; justify-content:space-between; align-items:center; font-size:11px; }
  .stat .rlab { color:var(--dim); }
  .stat .rval { color:var(--text); font-weight:600; font-variant-numeric:tabular-nums; display:flex; align-items:center; gap:5px; }
  .dir { font-size:9px; } .d-down { color:var(--ok); } .d-up { color:var(--coral); } .d-eq { color:var(--dim2); }
  .ic { position:absolute; top:16px; right:16px; width:22px; height:22px; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
  .ic-good { stroke:var(--ok); stroke-dasharray:26; stroke-dashoffset:26; animation:ic-draw .55s ease .35s forwards; }
  .ic-warn { stroke:var(--amber); animation:ic-pulse 1.9s ease-in-out infinite; }
  .ic-bad { stroke:var(--coral); animation:ic-shake .5s ease .35s 2; }
  @keyframes ic-draw { to { stroke-dashoffset:0; } }
  @keyframes ic-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(.9); } }
  @keyframes ic-shake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-3px); } 40% { transform:translateX(3px); } 60% { transform:translateX(-2px); } 80% { transform:translateX(2px); } }

  /* gradient hero cards (light mode only; .grad is inert in dark) */
  html[data-theme="light"] .grad { background:var(--hero-grad); border-color:transparent; color:#fff; }
  html[data-theme="light"] .grad .eyebrow, html[data-theme="light"] .grad .lab, html[data-theme="light"] .grad .rlab, html[data-theme="light"] .grad .sub, html[data-theme="light"] .grad .huge-unit, html[data-theme="light"] .grad .split-legend { color:rgba(255,255,255,.78); }
  html[data-theme="light"] .grad .num, html[data-theme="light"] .grad .rval, html[data-theme="light"] .grad .huge, html[data-theme="light"] .grad .verdict, html[data-theme="light"] .grad .sub b { color:#fff; }
  html[data-theme="light"] .grad .rows { border-top-color:rgba(255,255,255,.25); }
  html[data-theme="light"] .grad .split-track { background:rgba(255,255,255,.22); }
  html[data-theme="light"] .grad .sp-tok { background:#4ade80; }
  html[data-theme="light"] .grad .warn-text { color:#ffc9c0; }
  html[data-theme="light"] .grad .ic-good, html[data-theme="light"] .grad .ic-warn, html[data-theme="light"] .grad .ic-bad { stroke:#fff; }
  html[data-theme="light"] .grad .d-up { color:#ffc9c0; } html[data-theme="light"] .grad .d-down { color:#b8f7d0; }
  /* theme-conditional blocks */
  .only-light { display:none; }
  html[data-theme="light"] .only-light { display:block; }
  html[data-theme="light"] .only-dark { display:none; }
  /* theme toggle */
  .theme-toggle { position:fixed; top:18px; right:18px; z-index:10; width:40px; height:40px; border-radius:99px;
    display:grid; place-items:center; cursor:pointer; color:var(--dim); }
  .theme-toggle:hover { color:var(--text); }
  .theme-toggle svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  .theme-toggle .only-light, html[data-theme="light"] .theme-toggle .only-light { display:none; }
  html[data-theme="light"] .theme-toggle .only-light { display:block; }
  .theme-toggle .only-dark { display:block; }

  /* palette */
  .palette-grid { display:grid; grid-template-columns:1fr 1.6fr; gap:16px; }
  @media (max-width:860px) { .palette-grid { grid-template-columns:1fr; } }
  .pal-hero { position:relative; overflow:hidden; padding:26px 28px; }
  .pal-hero .b1 { right:-40px; top:-40px; width:160px; height:160px; background:var(--blob); filter:blur(32px); }
  .pal-num { display:flex; align-items:baseline; gap:10px; margin:14px 0 10px; }
  .huge { font:700 clamp(44px,6vw,64px)/1 var(--disp); letter-spacing:-.03em; font-variant-numeric:tabular-nums; }
  .huge-unit { color:var(--dim); font-size:14px; }
  .split-track { margin-top:20px; background:var(--deep); border-radius:99px; padding:4px; }
  .split { display:flex; height:8px; border-radius:99px; overflow:hidden; }
  .sp-tok { background:var(--ok); } .sp-stray { background:var(--coral); }
  .split-legend { display:flex; justify-content:space-between; margin-top:8px; font-size:11px; color:var(--dim); }
  .warn-text { color:var(--coral); margin-top:10px; }
  .pal-usage { padding:26px 28px; }
  .pal-usage-head { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
  .legend { display:flex; gap:12px; font:700 9.5px/1 var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--dim); }
  .legend span { display:flex; align-items:center; gap:6px; }
  .lg { width:8px; height:8px; border-radius:2px; display:inline-block; }
  .lg-tok { background:var(--text); } .lg-stray { background:var(--coral); }
  .usage-bar { display:flex; height:96px; gap:2px; margin-top:18px; border-radius:16px; overflow:hidden; }
  .uc { position:relative; min-width:3px; box-shadow:0 0 0 1px var(--cell-ring) inset; }
  .uc:first-child { border-radius:16px 0 0 16px; } .uc:last-child { border-radius:0 16px 16px 0; }
  .uc.stray i { position:absolute; top:4px; right:4px; width:6px; height:6px; border-radius:99px; background:var(--coral); box-shadow:0 0 0 2px var(--card-solid); }
  .uc-rest { background:repeating-linear-gradient(45deg,var(--deep),var(--deep) 4px,var(--card-solid) 4px,var(--card-solid) 8px);
    display:flex; align-items:center; justify-content:center; font:600 10px var(--mono); color:var(--dim); }
  .ramp-head { margin-top:26px; }
  .grey-strip { display:flex; height:44px; border-radius:16px; overflow:hidden; margin-top:10px; box-shadow:0 0 0 1px var(--cell-ring) inset; }
  .grey-cell { flex:1; }
  .ramp-labels { display:flex; justify-content:space-between; margin-top:6px; font:400 10px var(--mono); color:var(--dim2); }

  /* spacing bars */
  .bars { margin-top:18px; display:grid; gap:7px; }
  .bar-row { display:flex; align-items:center; gap:14px; }
  .bar-label { font:12px var(--mono); color:var(--text); width:72px; text-align:right; flex-shrink:0; }
  .bar-label.off { color:var(--coral); }
  .bar-track { position:relative; height:22px; flex:1; background:var(--deep); border-radius:8px; overflow:hidden; }
  .bar { height:100%; border-radius:8px; background:var(--bar-grad); min-width:4px; }
  .bar-off { background:var(--coral); }
  .bar-count { font:11.5px var(--mono); color:var(--dim); width:44px; text-align:right; font-variant-numeric:tabular-nums; }

  /* offenders ledger */
  .ledger { margin-top:14px; }
  .ledger-row { display:flex; align-items:center; gap:16px; padding:12px 8px; border-radius:12px;
    border-bottom:1px solid var(--line-soft); transition:background .15s; }
  .ledger-row:last-child { border-bottom:none; }
  .ledger-row:hover { background:var(--hover-row); }
  .ledger-idx { font:600 11.5px var(--mono); color:var(--dim2); font-variant-numeric:tabular-nums; }
  .ledger-row a.path { font-size:13px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .ledger-pills { margin-left:auto; display:flex; gap:8px; flex-shrink:0; }

  .pill { border-radius:99px; padding:3px 10px; font:500 10.5px/1.5 var(--sans); white-space:nowrap; }
  .pill-mint { background:var(--ok-soft); color:var(--ok); }
  .pill-coral { background:var(--coral-soft); color:var(--coral); }
  .pill-amber { background:var(--amber-soft); color:var(--amber); }

  /* two-up cards, families, mini-cards */
  .two-up { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:28px; }
  @media (max-width:860px) { .two-up { grid-template-columns:1fr; } }
  .half { min-width:0; }
  .fams { display:grid; gap:20px; margin-top:16px; }
  .fam-rows { display:grid; gap:8px; margin-top:10px; }
  .mini-card { display:flex; align-items:center; justify-content:space-between; gap:12px;
    border:1px solid var(--line); background:var(--chip-bg); border-radius:14px; padding:10px 14px; min-width:0; }
  .mini-card.col { display:block; }
  .mini-card.dim { border-style:dashed; }
  .mc-main { min-width:0; }
  .mc-name { font:600 13px var(--mono); }
  .mc-path, .mini-card .path { font:11.5px var(--mono); color:var(--dim); overflow-wrap:anywhere; }
  .mc-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .mc-count { font:600 11.5px var(--mono); color:var(--coral); font-variant-numeric:tabular-nums; flex-shrink:0; }
  .mc-track { height:6px; background:var(--deep); border-radius:99px; overflow:hidden; margin-top:8px; }
  .mc-bar { height:100%; border-radius:99px; background:var(--coral); }

  a.path { color:var(--dim); text-decoration:none; border-bottom:1px dotted var(--line); font:12.5px var(--mono); overflow-wrap:anywhere; }
  a.path:hover { color:var(--text); border-bottom-color:var(--accent); }
  .path { font:12.5px var(--mono); color:var(--dim); }
  .strong { color:var(--text); font-weight:600; }

  /* table */
  .tbl-wrap { overflow-x:auto; margin-top:14px; }
  table { width:100%; border-collapse:collapse; font-size:13.5px; }
  th { text-align:left; color:var(--dim); font:700 10px var(--sans); text-transform:uppercase;
    letter-spacing:.16em; padding:8px 12px 8px 0; border-bottom:1px solid var(--line); }
  td { padding:10px 12px 10px 0; border-bottom:1px solid var(--line-soft); vertical-align:top; }
  tr:hover td { background:var(--hover-cell); }

  footer { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap;
    border-top:1px solid var(--line); margin-top:40px; padding-top:22px; color:var(--dim); font-size:11.5px; }
  .foot-left { display:grid; gap:5px; }
  .foot-sub { color:var(--dim2); }
  footer .brand { color:var(--accent); font-weight:700; text-decoration:none; }
  footer .brand:hover { text-decoration:underline; }
  footer .creds { display:flex; gap:16px; font:700 9.5px/1.6 var(--sans); letter-spacing:.16em; text-transform:uppercase; color:var(--dim2); }
  .author { color:var(--accent); font-weight:700; text-decoration:none; }
  .author:hover { text-decoration:underline; }
</style></head><body>
<button class="theme-toggle glass" aria-label="Switch between light and dark mode" onclick="(function(){var r=document.documentElement,t=r.getAttribute('data-theme')==='light'?'dark':'light';r.setAttribute('data-theme',t);try{localStorage.setItem('roast-theme',t)}catch(e){}})()">
  <svg class="only-dark" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.9" y1="4.9" x2="7" y2="7"/><line x1="17" y1="17" x2="19.1" y2="19.1"/><line x1="4.9" y1="19.1" x2="7" y2="17"/><line x1="17" y1="7" x2="19.1" y2="4.9"/></svg>
  <svg class="only-light" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
</button>
<script>try{var t=localStorage.getItem('roast-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<div class="wrap">

<header>
  <div class="hero">
    <div>
      <div class="kicker"><span class="dot"></span>Scan complete · ${h.tookMs}ms · ${n(h.files.code)} code files</div>
      <h1>Design System Diagnosis</h1>
      <div class="meta"><span class="mono">${esc(repoName)}</span> · scanned ${esc((h.harvestedAt ?? '').slice(0, 10))}</div>
    </div>
    ${healthScore !== null ? `<div class="score">${eyebrow('Health score')}<div class="val">${healthScore}<span class="slash">/</span><span class="of">100</span></div></div>` : ''}
  </div>
  <div class="chips">${stack.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}${agentFiles.map((c) => `<span class="chip chip-agent">${esc(c.file)}</span>`).join('')}</div>
  ${noSystemLikely ? `<div class="nods">${ICONS.warn}<span>There is most likely <b>no design system in this repo</b>: almost no colour or spacing values were found. Styling may live outside this codebase (CDN stylesheets, a parent repo, or generated output).</span></div>` : ''}
  <div class="glass verdict-card">
    <div class="blob b1"></div><div class="blob b2"></div>
    ${eyebrow('Summary')}
    <div class="verdict">${esc(verdict)}</div>
  </div>
</header>

${agentSection()}

<div class="stats">${bigStats.map((s) => statTile(s)).join('')}</div>

<section style="margin-top:16px">${paletteSection()}</section>

${spacingBars()}
${typographySection()}
${offendersSection()}
<div class="two-up">
${duplicatesSection()}
${inlineSection()}
</div>
${componentsSection()}

<footer>
  <div class="foot-left">
    <div>Generated by <a class="brand" href="https://github.com/pencilrebel/roast-my-design-system">roast-my-design-system</a>, a free skill for Claude Code and Codex</div>
    <div class="foot-sub"><span class="ver">ver. ${VERSION}</span> · built and designed by <a class="author" href="https://gregkozakiewicz.com">Greg Kozakiewicz</a></div>
  </div>
  <span class="creds"><span>Non-destructive scan</span><span>Read-only</span><span>Paths are real</span></span>
</footer>
</div></body></html>`;

writeFileSync(outPath, html);
console.log(`✓ Diagnosis for ${repoName}`);
console.log(`  verdict: ${verdict}`);
console.log(`  → ${outPath}`);
