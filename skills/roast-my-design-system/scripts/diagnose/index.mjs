#!/usr/bin/env node
/**
 * Diagnose — step 2 of the Proffer pipeline. Renders a harvest.json into a
 * single self-contained HTML report: the visceral, shareable "here's your
 * mess" page with real file paths. No dependencies, no server — one file.
 *
 *   node src/diagnose/index.mjs harvest.json [--out diagnosis.html]
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

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (x) => x.toLocaleString('en-US');

// EFFECTIVE luminance as rendered on this page: 8-digit hex carries alpha, and
// a 50%-transparent black shows as mid-grey on our dark background — sorting
// by raw RGB put those "all over the place" in the strip.
const PAGE_BG_LUM = 0.2126 * 0x0d + 0.7152 * 0x0f + 0.0722 * 0x12;
function hexLuminance(hex) {
  if (!/^#[0-9a-f]{6}/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return a * lum + (1 - a) * PAGE_BG_LUM;
}
const isGreyHex = (v) => {
  if (!/^#[0-9a-f]{6}/.test(v)) return false;
  const r = parseInt(v.slice(1, 3), 16), g = parseInt(v.slice(3, 5), 16), b = parseInt(v.slice(5, 7), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) <= 10;
};

// ---------- derived numbers ----------
const colors = h.tokens.colors ?? [];
const greys = colors.filter((c) => isGreyHex(c.value)).sort((a, b) => hexLuminance(a.value) - hexLuminance(b.value));
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
const ideal = (metric) => bench?.ideal2026?.[metric]?.value ?? null;
const median = (metric) => bench?.stats?.[metric]?.median ?? null;

// Clickable file paths — vscode:// opens the file straight in the editor.
const fileLink = (f) => `<a class="path" href="vscode://file/${encodeURI(`${h.repo}/${f}`)}">${esc(f)}</a>`;
const fontSizeTotal = (h.tokens.fontSizes ?? []).length + (h.tokens.tailwind?.textSizes ?? []).length;
const radiiTotal = (h.tokens.radii ?? []).length + (h.tokens.tailwind?.radii ?? []).length;
const shadows = h.tokens.shadows ?? [];
const offenders = h.tokens.offenders ?? [];

// Verdict severity: what a real design system would need vs what we found.
const findings = [];
if (typefaces.length > 3) findings.push(`${typefaces.length} typefaces, brands use 2`);
else if (typefaces.length && fontFamilies.length > 6) findings.push(`${typefaces.length} typeface${typefaces.length > 1 ? 's' : ''} declared ${fontFamilies.length} different ways`);
if (colors.length > 24) findings.push(`${n(colors.length)} distinct colours, a design system needs ~20`);
if (greys.length > 6) findings.push(`${greys.length} shades of grey doing the job of 5`);
if (spacingTotal > 12) findings.push(`${spacingTotal} spacing values where a scale has 8`);
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

// ---------- section renderers ----------
function swatchWall(list, title, note) {
  if (!list.length) return '';
  const max = Math.max(...list.map((c) => c.count));
  const sw = list.map((c) => {
    const scale = c.count / max;
    const size = scale > 0.5 ? 'sw-l' : scale > 0.15 ? 'sw-m' : 'sw-s';
    const src = c.files?.[0] ? ` in ${c.files[0].file}` : '';
    return `<div class="sw ${size}" style="background:${esc(c.value)}" title="${esc(c.value)} ×${c.count}${esc(src)}"></div>`;
  }).join('');
  return `<div class="subsection"><h3>${esc(title)} <span class="dim">${note}</span></h3><div class="swall">${sw}</div></div>`;
}

function greyStrip() {
  if (greys.length < 4) return '';
  const cells = greys.map((c) =>
    `<div class="grey-cell" style="background:${esc(c.value)}" title="${esc(c.value)} ×${c.count}"></div>`).join('');
  return `<div class="subsection"><h3>Your greys, side by side <span class="dim">sorted dark → light. How many can you tell apart?</span></h3>
  <div class="grey-strip">${cells}</div></div>`;
}

function spacingBars() {
  const merged = [...spacing.map((s) => ({ label: s.value, count: s.count })),
                  ...twSpacing.map((s) => ({ label: `·${s.value}`, count: s.count }))]
    .sort((a, b) => b.count - a.count).slice(0, 18);
  if (!merged.length) return '';
  const max = merged[0].count;
  const rows = merged.map((s) => `
    <div class="bar-row"><span class="bar-label">${esc(s.label)}</span>
    <div class="bar" style="width:${Math.max(2, Math.round((s.count / max) * 100))}%"></div>
    <span class="bar-count">${n(s.count)}</span></div>`).join('');
  return `<section><h2>${n(spacingTotal)} spacing values <span class="dim">a scale needs ~8 (Tailwind steps marked ·)</span></h2>${rows}</section>`;
}

function duplicatesSection() {
  if (!exactDupes.length && !families.length) return '';
  const dupeCards = exactDupes.slice(0, 8).map((d) => `
    <div class="card">
      <div class="card-title">&lt;${esc(d.name)}&gt; <span class="badge">×${d.files.length} implementations</span></div>
      ${d.files.slice(0, 6).map((f) => `<div>${fileLink(f)}</div>`).join('')}
      ${d.files.length > 6 ? `<div class="path dim">…and ${d.files.length - 6} more</div>` : ''}
    </div>`).join('');
  const famCards = families.slice(0, 6).map((f) => `
    <div class="card">
      <div class="card-title">${esc(f.root)} family <span class="badge">${f.members.length} variants</span></div>
      ${f.members.slice(0, 6).map((m) => `<div class="path">&lt;${esc(m.name)}&gt; <span class="dim">${esc(m.file)}${m.usageCount ? ` · used ${m.usageCount}×` : ''}</span></div>`).join('')}
      ${f.members.length > 6 ? `<div class="path dim">…and ${f.members.length - 6} more</div>` : ''}
    </div>`).join('');
  return `<section><h2>Components implemented more than once</h2>
    <p class="note small">Every duplicate is a place where your agent has to guess which one is canonical, and it picks wrong half the time. Paths open in VS Code.</p>
    <div class="cards full">${dupeCards}${famCards}</div></section>`;
}

function typographySection() {
  if (!fontFamilies.length && !fontSizeTotal && !radiiTotal) return '';
  const mini = [
    typefaces.length ? tile(typefaces.length, 'typefaces', 'typefaces', 'brands use 2') : null,
    fontSizeTotal ? tile(fontSizeTotal, 'font sizes', 'fontSizes', 'a type scale has 6–8') : null,
    radiiTotal ? tile(radiiTotal, 'border radii', 'radii', 'a system has 3–4') : null,
    shadows.length ? tile(shadows.length, 'shadow styles', 'shadows', '2–3 elevations') : null,
  ].filter(Boolean);
  const fams = fontFamilies.slice(0, 8).map((f) =>
    `<div class="card slim"><div class="path">${esc(f.value.slice(0, 70))}</div><span class="badge${f.count > 2 ? '' : ' ok'}">×${f.count}</span></div>`).join('');
  return `<section><h2>Typography &amp; shape</h2>
    <div class="stats">${mini.map((s) => `<div class="stat st-${s.health}">
      ${ICONS[s.health]}
      <div class="num">${s.num}</div><div class="lab">${s.label}</div>
      <div class="target">${s.ideal}</div>
      ${s.avg ? `<div class="avg">${s.avg}</div>` : ''}</div>`).join('')}</div>
    ${fontFamilies.length > 1 ? `<h3>${typefaces.length} typeface${typefaces.length === 1 ? '' : 's'}, declared ${fontFamilies.length} different ways <span class="dim">every distinct declaration is a chance for the next one to be wrong</span></h3><div class="cards">${fams}</div>` : ''}
  </section>`;
}

function offendersSection() {
  if (offenders.length < 3) return '';
  const max = offenders[0].total;
  const rows = offenders.slice(0, 5).map((o, i) => `
    <div class="off-item">
      <div class="off-head">
        <span class="off-rank">${i + 1}</span>
        ${fileLink(o.file)}
        <span class="off-stats">${o.strayColors ? `${o.strayColors} stray colours` : ''}${o.strayColors && o.inlineBlocks ? ' · ' : ''}${o.inlineBlocks ? `${o.inlineBlocks} inline` : ''}</span>
      </div>
      <div class="off-track"><div class="off-bar" style="width:${Math.max(4, Math.round((o.total / max) * 100))}%"></div></div>
    </div>`).join('');
  return `<section><h2>Where it hurts most <span class="dim">the 5 files carrying the most off-system styling</span></h2>${rows}</section>`;
}

function inlineSection() {
  if (inline.count < 5) return '';
  return `<section><h2>${n(inline.count)} inline style blocks <span class="dim">styling no system can see</span></h2>
    <div class="cards">${inline.files.slice(0, 6).map((f) => `<div class="card slim">${fileLink(f.file)}<span class="badge">×${f.count}</span></div>`).join('')}</div></section>`;
}

function componentsSection() {
  const top = reusable.filter((c) => c.usageCount > 0).slice(0, 10);
  if (!top.length) return '';
  const rows = top.map((c) => `
    <tr><td class="mono">&lt;${esc(c.name)}&gt;</td><td>${c.usageCount}×</td>
    <td class="path">${esc(c.file)}</td>
    <td class="dim">${c.propsHint?.named?.length ? esc(c.propsHint.named.slice(0, 5).join(', ')) : '—'}</td></tr>`).join('');
  return `<section><h2>What you actually use <span class="dim">top components by adoption. The real system, buried in here</span></h2>
    <table><thead><tr><th>component</th><th>used</th><th>defined in</th><th>props</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function agentSection() {
  const have = agentFiles.map((c) => `<div class="card slim"><div class="path">${esc(c.file)}</div><span class="badge ok">${esc(c.tool ?? c.kind)}</span></div>`).join('');
  const msg = agentFiles.length
    ? `<p class="note">Your agent reads ${agentFiles.map((c) => `<span class="mono">${esc(c.file)}</span>`).join(', ')}. But none of it points at a single source of truth for components and tokens, because there isn't one yet. The numbers below are what your agent actually works from.</p>`
    : `<p class="note">No <span class="mono">CLAUDE.md</span>, no <span class="mono">AGENTS.md</span>, no <span class="mono">.cursorrules</span>. Every time your AI builds UI here, it guesses, from everything below. This is why its output looks almost-but-not-quite right.</p>`;
  return `<section class="agent"><h2>What your AI agent sees today</h2>${msg}<div class="cards">${have}</div></section>`;
}

// ---------- page ----------
const stack = [
  h.profile.framework !== 'unknown' ? h.profile.framework : null,
  h.profile.typescript ? 'TypeScript' : null,
  ...(h.profile.stylingDeps ?? []),
  ds.kind === 'shadcn' ? 'shadcn/ui' : ds.kind === 'library' ? ds.name : null,
  h.profile.monorepo ? 'monorepo' : null,
].filter(Boolean);

// Each tile is a mini scorecard: your number, the Ideal Design System target,
// and the scanned-fleet average (the low bar; being better than it isn't the
// goal). Health drives the animated icon and colours:
//   good  = within 5%–100% of ideal        → green checkmark (draws in)
//   warn  = up to 20% over ideal           → yellow alert circle (pulses)
//   bad   = >20% over ideal, or basically absent (<5% of ideal, which smells
//           like "no design system at all") → red cross (shakes)
// Zero-ideal metrics (duplicates, inline styles): 0 is good; a small tolerance
// is warn; beyond that bad.
const ZERO_IDEAL = new Set(['exactDuplicates', 'inlineStyles']);
const WARN_TOLERANCE = { exactDuplicates: 2, inlineStyles: 10 };
function healthOf(metric, value) {
  const iv = ideal(metric);
  if (iv === null) return 'info';
  if (ZERO_IDEAL.has(metric)) {
    if (value === 0) return 'good';
    return value <= WARN_TOLERANCE[metric] ? 'warn' : 'bad';
  }
  if (value < Math.max(1, iv * 0.05)) return 'bad';
  if (value <= iv) return 'good';
  if (value <= iv * 1.2) return 'warn';
  return 'bad';
}
const ICONS = {
  good: '<svg class="ic ic-good" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg class="ic ic-warn" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16.01"/></svg>',
  bad: '<svg class="ic ic-bad" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  info: '',
};
function tile(value, label, metric, fallbackTarget) {
  const health = healthOf(metric, value);
  const iv = ideal(metric), mv = median(metric), pct = percentile(metric, value);
  const arrow = health === 'good' ? '▼ ' : '▲ ';
  return {
    num: n(value), label, health,
    ideal: iv !== null ? `${arrow}Ideal Design System: ${ZERO_IDEAL.has(metric) ? iv : `~${iv}`}` : fallbackTarget,
    avg: mv ? `Avg Design System: ${n(mv)}${pct !== null && pct >= 60 && health !== 'good' ? ` · more than ${pct}% of them` : ''}` : null,
  };
}
const bigStats = [
  tile(colors.length, 'distinct colours', 'colors', 'a system needs ~20'),
  tile(greys.length, 'shades of grey', 'greys', '5–7 is a scale'),
  tile(spacingTotal, 'spacing values', 'spacing', 'a scale has ~8'),
  tile(exactDupes.length, 'duplicated components', 'exactDuplicates', 'should be 0'),
  tile(inline.count, 'inline style blocks', 'inlineStyles', 'invisible to any system'),
  { num: String(reusable.length), label: 'components defined', health: 'info', ideal: 'the raw material', avg: median('components') ? `Avg Design System: ${n(median('components'))}` : null },
];

// A repo with essentially no colour/spacing signal most likely has no design
// system in it at all; say that up front instead of quietly scoring zeros.
const noSystemLikely = colors.length === 0 || (colors.length < 3 && spacingTotal === 0);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design-system diagnosis: ${esc(repoName)}</title>
<style>
  :root { --bg:#0d0f12; --panel:#14171c; --line:#242a32; --text:#e8ebef; --dim:#8b939e;
          --accent:#f5722e; --bad:#ff5d5d; --warn:#eab308; --ok:#4ade80; --mono:ui-monospace,'SF Mono',Menlo,monospace; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font:16px/1.55 ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif; }
  .wrap { max-width:880px; margin:0 auto; padding:56px 28px 80px; }
  header .kicker { color:var(--accent); font:600 13px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; }
  h1 { font-size:34px; line-height:1.15; margin:14px 0 6px; letter-spacing:-.02em; }
  .stack { color:var(--dim); font:13px var(--mono); margin-bottom:26px; }
  .summary-label { color:var(--dim); font:600 13px/1 var(--mono); letter-spacing:.14em; text-transform:uppercase; margin:26px 0 10px; }
  .verdict { font-size:19px; line-height:1.5; color:var(--text); border-left:3px solid var(--accent);
             padding:4px 0 4px 18px; margin:0 0 40px; }
  .nods { display:flex; gap:12px; align-items:flex-start; background:rgba(234,179,8,.08); border:1px solid rgba(234,179,8,.35);
          border-radius:10px; padding:14px 16px; margin:26px 0 6px; font-size:15px; }
  .nods .ic { position:static; flex-shrink:0; width:22px; height:22px; }
  .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:52px; }
  @media (max-width:760px) { .stats { grid-template-columns:repeat(2,1fr); } }
  .stat { position:relative; background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 14px 12px; border-top:3px solid var(--line); }
  .stat.st-bad { border-top-color:var(--bad); }
  .stat.st-warn { border-top-color:var(--warn); }
  .stat.st-good { border-top-color:var(--ok); }
  .stat .num { font-size:30px; font-weight:700; letter-spacing:-.02em; }
  .stat .lab { color:var(--text); font-size:12.5px; margin-top:2px; }
  .stat .target { font-size:11.5px; margin-top:6px; color:var(--dim); }
  .stat.st-bad .target { color:var(--bad); }
  .stat.st-warn .target { color:var(--warn); }
  .stat.st-good .target { color:var(--ok); }
  .stat .avg { font-size:11px; margin-top:3px; color:var(--dim); border-top:1px solid var(--line); padding-top:5px; }
  .ic { position:absolute; top:12px; right:12px; width:22px; height:22px; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
  .ic-good { stroke:var(--ok); stroke-dasharray:26; stroke-dashoffset:26; animation:ic-draw .55s ease .35s forwards; }
  .ic-warn { stroke:var(--warn); animation:ic-pulse 1.9s ease-in-out infinite; }
  .ic-bad { stroke:var(--bad); animation:ic-shake .5s ease .35s 2; }
  @keyframes ic-draw { to { stroke-dashoffset:0; } }
  @keyframes ic-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.5; transform:scale(.9); } }
  @keyframes ic-shake { 0%,100% { transform:translateX(0); } 20% { transform:translateX(-3px); } 40% { transform:translateX(3px); } 60% { transform:translateX(-2px); } 80% { transform:translateX(2px); } }
  section { margin-bottom:52px; }
  h2 { font-size:21px; letter-spacing:-.01em; margin-bottom:14px; }
  h3 { font-size:15px; margin:18px 0 10px; }
  .dim { color:var(--dim); font-weight:400; font-size:.82em; }
  .note { color:var(--dim); font-size:14.5px; margin-bottom:14px; }
  .cards.full { grid-template-columns:1fr; }
  .note.small { font-size:12.5px; }
  a.path { color:var(--dim); text-decoration:none; border-bottom:1px dotted var(--line); }
  a.path:hover { color:var(--text); border-bottom-color:var(--accent); }
  .subsection { margin-bottom:8px; }
  .swall { display:flex; flex-wrap:wrap; gap:5px; }
  .sw { border-radius:5px; border:1px solid rgba(255,255,255,.09); }
  .sw-l { width:52px; height:52px; } .sw-m { width:32px; height:32px; } .sw-s { width:18px; height:18px; }
  .grey-strip { display:flex; height:56px; border-radius:8px; overflow:hidden; border:1px solid var(--line); }
  .grey-cell { flex:1; }
  .bar-row { display:flex; align-items:center; gap:10px; margin-bottom:5px; }
  .bar-label { font:12.5px var(--mono); color:var(--dim); width:74px; text-align:right; flex-shrink:0; }
  .bar { height:16px; background:linear-gradient(90deg,var(--accent),#f5a02e); border-radius:3px; min-width:3px; }
  .bar-count { font:12px var(--mono); color:var(--dim); }
  .off-item { margin-bottom:16px; }
  .off-head { display:flex; align-items:baseline; gap:12px; }
  .off-rank { font:700 15px var(--mono); color:var(--accent); min-width:1.2em; text-align:right; }
  .off-head a.path { font-size:13.5px; }
  .off-stats { margin-left:auto; font:12px var(--mono); color:var(--dim); flex-shrink:0; padding-left:12px; }
  .off-track { margin:7px 0 0 calc(1.2em + 12px); }
  .off-bar { height:10px; border-radius:3px; background:linear-gradient(90deg,var(--bad),#ff8a5d); }
  .cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:10px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .card.slim { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; }
  .card-title { font:600 15px var(--mono); margin-bottom:8px; }
  .badge { background:rgba(255,93,93,.12); color:var(--bad); font:600 11.5px var(--mono);
           padding:2px 8px; border-radius:99px; margin-left:6px; }
  .badge.ok { background:rgba(74,222,128,.12); color:var(--ok); }
  .path { font:12.5px var(--mono); color:var(--dim); padding:1.5px 0; overflow-wrap:anywhere; }
  .mono { font-family:var(--mono); font-size:.92em; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; color:var(--dim); font:600 11.5px var(--mono); text-transform:uppercase;
       letter-spacing:.08em; padding:6px 10px 6px 0; border-bottom:1px solid var(--line); }
  td { padding:7px 10px 7px 0; border-bottom:1px solid var(--line); vertical-align:top; }
  footer { border-top:1px solid var(--line); padding-top:26px; color:var(--dim); font-size:14px; }
  footer .brand { color:var(--accent); font-weight:700; text-decoration:none; }
  footer .brand:hover { text-decoration:underline; }
</style></head><body><div class="wrap">
<header>
  <div class="kicker">Design-system diagnosis</div>
  <h1>${esc(repoName)}</h1>
  <div class="stack">${stack.map(esc).join(' · ')} · scanned ${esc((h.harvestedAt ?? '').slice(0, 10))}, ${n(h.files.code)} code files in ${h.tookMs}ms</div>
  ${noSystemLikely ? `<div class="nods">${ICONS.warn}<span>There is most likely <b>no design system in this repo</b>: almost no colour or spacing values were found. Styling may live outside this codebase (CDN stylesheets, a parent repo, or generated output).</span></div>` : ''}
  <div class="summary-label">Summary</div>
  <div class="verdict">${esc(verdict)}</div>
</header>

${agentSection()}

<div class="stats">${bigStats.map((s) => `<div class="stat st-${s.health}">
  ${ICONS[s.health]}
  <div class="num">${s.num}</div><div class="lab">${s.label}</div>
  <div class="target">${s.ideal}</div>
  ${s.avg ? `<div class="avg">${s.avg}</div>` : ''}</div>`).join('')}</div>

${colors.length ? (() => {
  const tokens = colors.filter((c) => c.isToken).length;
  const strays = colors.length - tokens;
  return `<section><h2>${n(colors.length)} colours in one product <span class="dim">sized by how often each is used</span></h2>
<p class="note">A healthy product palette is <b>~12–24 colours</b>: one brand hue with a few tints, one accent, 5–7 greys, and status colours.
${tokens ? `Only <b>${n(tokens)}</b> of these are deliberately defined as CSS variables (tokens). The other <b>${n(strays)}</b> are hardcoded strays no system knows about.`
         : `None of these are defined as CSS variables. Every single one is a hardcoded value.`}</p>
${greyStrip()}
${swatchWall(nonGreys, 'The palette', `${nonGreys.length} non-grey values`)}
</section>`;
})() : ''}

${spacingBars()}
${typographySection()}
${offendersSection()}
${duplicatesSection()}
${inlineSection()}
${componentsSection()}

<footer>
  Generated by <a class="brand" href="https://github.com/pencilrebel/roast-my-design-system">roast-my-design-system</a>, a free skill for Claude Code and Codex.
  Non-destructive scan · nothing was modified · every path above is real.
</footer>
</div></body></html>`;

writeFileSync(outPath, html);
console.log(`✓ Diagnosis for ${repoName}`);
console.log(`  verdict: ${verdict}`);
console.log(`  → ${outPath}`);
