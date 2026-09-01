#!/usr/bin/env node
/**
 * Diagnose — step 2 of the pipeline. Renders a harvest.json into a
 * single self-contained HTML report: the visceral, shareable "here's your
 * mess" page with real file paths. No dependencies, no server — one file.
 *
 *   node src/diagnose/index.mjs harvest.json [--out diagnosis.html] [--theme dark|light]
 *   (--theme sets the initial mode; the page itself has a light/dark toggle)
 *
 *   --notes <file.md> embeds an agent-written analysis ("What the numbers
 *   mean") between the verdict and the punch list, clearly labelled as
 *   written-by-AI so it never reads as part of the measurement. The file is
 *   markdown-lite: paragraphs, **bold**, `code`, and "- " lists. Reruns of
 *   this script (e.g. --by credit) must pass --notes again or the section
 *   is gone — which is why a missing notes file is a hard error, not a skip.
 *
 *   --section "Title" <file.md> (repeatable) appends agent-written chapters
 *   after the notes, same markdown-lite plus "## " sub-headings. It exists so
 *   analysis that outgrows the notes (an interaction audit, an accessibility
 *   pass) still lives inside this report instead of a hand-built page.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distinctTypefaces } from '../lib/typefaces.mjs';
import { rulesMarkdown } from '../rules/build.mjs';
import { nearColorPairs } from '../lib/nearpairs.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';
import { VERSION } from '../lib/version.mjs';
import { feedbackUrl, FEEDBACK_ASK, FEEDBACK_CTA } from '../lib/feedback.mjs';
import { fixPrompt } from '../lib/fixprompt.mjs';

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

// The GK mark (32px favicon, also gregkozakiewicz.com). Reused in the footer
// as a CSS mask filled with currentColor so it works in both themes.
const GK_MASK = 'data:image/png;base64,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'; // alpha version of the mark, for CSS mask
const GK_MARK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAACXBIWXMAAAAAAAAAAQCEeRdzAAACPklEQVR4nOVWTYh5URR/PlJYEKV8LKwkZalsmI2dZmMnK8pKmaZ87JSanexEkayUhSxsZyfJNBQ7UYqVhSShfM+v/6mXmtU81+p/Frfze+/d3++ce88993Hcf2cikehZ1GazWafTPUVDLBZjLBQKnU6HMTVvcrl8Op3ebrdsNgsokUiYUVP4Pp/v9s96vd79cwZGK95sNkkgGAwC2u12lhrY3u12C/b1ei2TyV5eXjabjV6vZ6BBa51MJin8arUKWKlU4H99fSkUCo5JUQ2HQxJwuVzIYLVawcdIVSs8CQoNpMQ+Go0Aw+EwwXw+D+h2u4Vr0LRSqUSMqVQKsN1uE3Q4HEql8ng8BgIBTnDhqlSqxWIBuvP5bDAYLBbL5XIBHAwGeBuJRODvdjun0/nnPOjraDRK8TYaDcBMJkMwFosBfn9/E0wkEn9OgjYgnU6fTidQwAGcTCbw9/u9VqvFUYB/vV5RskajkRNcTiaTKR6PI9j5fE7xlstlPM/lcgTr9ToneJ/5oOB4PB70O8Tb7/f9fv9sNqPkXl9fhQsQ9f1ktVqNvUVCxA6ZRxsf5pMAxnsuVBSOwvv7+6Phk0PsBNn0OOLC9haLReqdvBL/wUNKNPnt7Q0LjeVutVqhUEij0TwU9W8BVA4JUEUul8tarcZGhpbIarWiSeA0HQ4Hkvn4+GB56VMvov6DA+z1eplR89btdsE+Ho9tNhv3jOv+8/MTFz06M3ypVMqMnTfcwPhn4djG/tue+Mf4RGom9gMt6lAx16huIwAAAABJRU5ErkJggg==';

// Report identity. The scan id is a stable digest of this scan's shape, salted
// with the report namespace, so the same repo scanned twice reads the same and
// two different repos never collide. Shown in the footer for support and for
// telling two reports apart at a glance.
const ID_NS = 'rmds.gregkozakiewicz.2026';
function digest(str) {
  // FNV-1a, two rounds with different offsets — no dependencies, stable output
  const round = (seed) => {
    let hv = seed;
    for (let i = 0; i < str.length; i++) {
      hv ^= str.charCodeAt(i);
      hv = Math.imul(hv, 0x01000193) >>> 0;
    }
    return hv.toString(16).padStart(8, '0');
  };
  return (round(0x811c9dc5) + round(0x2fa1c3d7)).slice(0, 12);
}
// Namespace tag carried in the document head: schema owner, version, build day.
const NS_TAG = `${ID_NS.split('.')[1]}/${VERSION}`;
// Namespace marker woven into the title as zero-width characters: present in
// every rendered report, invisible on screen, untouched by copy-paste.
const nsMark = [...ID_NS.split('.')[1]]
  .map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0'))
  .join('')
  .replace(/0/g, '\u200b')
  .replace(/1/g, '\u200c');


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
// Requester credit ("commissioned by"): their name up top next to the scan
// date; the generated-by authorship stays in the footer, never confused.
const commissionedBy = arg('by', null);
// Agent-written analysis to embed (see the header comment). Read eagerly so
// a bad path fails the run instead of silently shipping a report without it.
const notesPath = arg('notes', null);
let notesText = null;
if (notesPath) {
  try { notesText = readFileSync(resolve(notesPath), 'utf8').trim() || null; }
  catch { console.error(`--notes: cannot read ${notesPath}`); process.exit(1); }
}

// --section "Title" file.md, repeatable; unreadable files are hard errors for
// the same reason as --notes.
const extraSections = [];
for (let i = 3; i < process.argv.length; i++) {
  if (process.argv[i] !== '--section') continue;
  const title = process.argv[i + 1], file = process.argv[i + 2];
  if (!title || !file || title.startsWith('--') || file.startsWith('--')) {
    console.error('--section needs a title and a file: --section "Interaction audit" audit.md'); process.exit(1);
  }
  let text;
  try { text = readFileSync(resolve(file), 'utf8').trim(); }
  catch { console.error(`--section: cannot read ${file}`); process.exit(1); }
  if (text) extraSections.push({ title, text });
  i += 2;
}
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
// Off-scale spacing only: CSS-declared values plus arbitrary brackets. Using
// many steps of the sanctioned Tailwind scale is health, not sprawl.
const spacingTotal = spacing.length + twSpacing.filter((v) => v.value.startsWith('[')).length;
const exactDupes = h.duplicates.exactDuplicates ?? [];
// A wrapped pair (one file imports the name from the other) is composition,
// not competition — listed with a badge, but not counted as a duplicate.
const hardDupes = exactDupes.filter((d) => !d.wrapped);
const iconCollisions = h.duplicates.iconCollisions ?? [];
const families = h.duplicates.families ?? [];
const inline = h.tokens.inlineStyles ?? { count: 0, files: [] };
const comps = h.components ?? [];
const reusable = comps.filter((c) => !c.isPage);
const agentFiles = (h.context ?? []).filter((c) => c.kind === 'agent-rules');
const repoName = h.profile?.name ?? basename(h.repo);
const ds = h.profile?.designSystem ?? { kind: 'none' };
const scanId = digest([ID_NS, repoName, h.files?.code ?? 0, (h.harvestedAt ?? '').slice(0, 10), colors.length].join('|'));

const fontFamilies = h.tokens.fontFamilies ?? [];
const typefaces = distinctTypefaces(fontFamilies);

// Token-led repos (shadcn/Tailwind semantic setups) hold most of their colours
// as deliberate CSS-variable tokens; judging them on the total punishes the
// exact architecture the ideal recommends. Health rides on the strays instead.
const colorTokens = colors.filter((c) => c.isToken).length;
const colorStrays = colors.length - colorTokens;
const tokenLed = colorTokens >= colorStrays && colorTokens > 0;
const greyStrays = greys.filter((c) => !c.isToken).length;

// Arbitrary bracket values (p-[13px], text-[10px]) — scale erosion, counted.
const arbitrary = h.tokens.tailwind?.arbitrary ?? [];
const arbitraryCount = arbitrary.reduce((sum, a) => sum + a.count, 0);

// !important declarations: the cascade admitting defeat.
const important = h.tokens.important ?? { count: 0, files: [] };

const nearPairs = nearColorPairs(colors);

const neverImported = neverImportedComponents(h.components, h.profile?.uiDir);

// Measurability and role, decided by the harvest (telekom/scale, 2026-09-01):
// when the component detector could not read this repo's stack, the component
// metrics say so and take no score credit; when the repo is a published
// library, usage means composition (how the system uses itself), never
// adoption, and every accusation about orphans is softened to match.
const componentsMeasured = h.profile?.componentDetection?.measured !== false;
const notMeasuredReason = h.profile?.componentDetection?.reason ?? 'an unrecognised component pattern';
const isLibrary = h.profile?.role === 'library';

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
// A zero median reads as broken data ("Avg: 0 typefaces"), when it really
// means "the median repo declares none". Fall back to the fleet mean there;
// it stays an honest "Avg" and only zeroes out if literally every repo does.
function displayAvg(metric) {
  const mv = median(metric);
  if (mv === null) return null;
  if (mv !== 0) return mv;
  const vals = bench?.stats?.[metric]?.values ?? [];
  const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  return mean >= 0.5 ? Math.round(mean) : null;
}
const refMedian = (metric) => bench?.referenceSystems?.stats?.[metric]?.median ?? null;

// Clickable file paths — vscode:// opens the file straight in the editor.
const fileLink = (f) => `<a class="path" href="vscode://file/${encodeURI(`${h.repo}/${f}`)}">${esc(f)}</a>`;
const fontSizeTotal = (h.tokens.fontSizes ?? []).length + (h.tokens.tailwind?.textSizes ?? []).length;
const radiiTotal = (h.tokens.radii ?? []).length + (h.tokens.tailwind?.radii ?? []).length;
const shadows = h.tokens.shadows ?? [];
const offenders = h.tokens.offenders ?? [];

// Verdict severity: a finding earns a summary slot only when it is
// meaningfully over the bar (a repo one grey over the ideal is not a
// headline), and the three slots go to the worst offences, not the first
// three metrics in file order.
const candidates = [];
const effColors = tokenLed ? colorStrays : colors.length;
const effGreys = tokenLed ? greyStrays : greys.length;
if (typefaces.length > 3) candidates.push({ ratio: typefaces.length / 3, text: `${typefaces.length} typefaces, brands use 2 or 3` });
else if (typefaces.length && fontFamilies.length > 6) candidates.push({ ratio: fontFamilies.length / 6, text: `${typefaces.length} typeface${typefaces.length > 1 ? 's' : ''} declared ${fontFamilies.length} different ways` });
if (effColors > 24 * 1.25) candidates.push({ ratio: effColors / 24, text: tokenLed
  ? `${n(colorStrays)} hardcoded colours outside the token set, your agent will happily copy them at random`
  : `${n(colors.length)} distinct colours for your agent to pick from, a design system needs ~24` });
if (effGreys > 13 * 1.25) candidates.push({ ratio: effGreys / 13, text: tokenLed
  ? `${greyStrays} hardcoded greys outside the token set`
  : `${greys.length} shades of grey doing the job of 13` });
if (spacingTotal > 15) candidates.push({ ratio: spacingTotal / 12, text: `${spacingTotal} off-scale spacing values where a dozen would do` });
if (nearPairs.length >= 3) candidates.push({ ratio: 1 + nearPairs.length / 6, text: `${nearPairs.length} colour pairs are nearly identical (${nearPairs[0].a.value} next to ${nearPairs[0].b.value}), copy-paste, not decisions` });
if (important.count >= 10) candidates.push({ ratio: 1 + important.count / 30, text: `${n(important.count)} !important declarations, the cascade admitting defeat` });
if (componentsMeasured && iconCollisions.length >= 5) candidates.push({ ratio: 1 + iconCollisions.length / 8, text: `two icon sets collide on ${iconCollisions.length} names` });
if (componentsMeasured && hardDupes.length > 0) candidates.push({ ratio: 1 + hardDupes.length / 5, text: `${hardDupes.length} component${hardDupes.length > 1 ? 's' : ''} implemented more than once, so an agent asked for a Button has several random options` });
if (inline.count > 20) candidates.push({ ratio: inline.count / 20, text: `${n(inline.count)} inline style blocks bypassing every system, and teaching your agent to do the same` });
if (arbitraryCount >= 20) candidates.push({ ratio: arbitraryCount / 30, text: `${n(arbitraryCount)} arbitrary values like ${arbitrary[0].value} punched through the Tailwind scale, each one a precedent your agent will follow` });
if (agentFiles.length === 0) candidates.push({ ratio: 1.3, text: `no agent rules, so your AI is guessing` });
if ((h.staleRules ?? []).length >= 2) candidates.push({ ratio: 1.2 + h.staleRules.length / 10, text: `${h.staleRules.length} references in your agent rules point at things this scan can no longer find` });
const findings = candidates.sort((a, b) => b.ratio - a.ratio).map((c) => c.text);

let verdict = findings.length === 0
  ? (agentFiles.length > 0
    ? 'This repo is in good shape, and your agent has rules to read. Keep them in step with the code.'
    : 'This repo is in good shape. The gap is documentation: your agent still can\'t see the system.')
  : findings.slice(0, 3).join('. ') + '.';
if (bench && findings.length) {
  const core = [['colors', tokenLed ? colorStrays : colors.length], ['greys', tokenLed ? greyStrays : greys.length],
    ['spacing', spacingTotal], ['typefaces', typefaces.length], ['exactDuplicates', hardDupes.length], ['inlineStyles', inline.count]];
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
//   bad   = worse than the median (and the median is already a mess)
//           → coral cross (shakes)
// Where the median is missing or sits at/below ideal, warn caps at 1.5x ideal.
// Zero-ideal metrics (duplicates, inline styles): 0 is good; a small tolerance
// is warn; beyond that bad.
// There used to be an absence rule here (basically nothing found = bad, on
// the theory that an empty count means no design system). The noSystemLikely
// guard now owns that judgement at report level, and for a repo with a real
// system a zero is discipline, not absence — all spacing on tokens scored red.
const ZERO_IDEAL = new Set(['exactDuplicates', 'inlineStyles', 'nearPairs', 'important', 'neverImported']);
const WARN_TOLERANCE = { exactDuplicates: 2, inlineStyles: 10, nearPairs: 2, important: 5, neverImported: 2 };
function healthOf(metric, value) {
  const iv = ideal(metric);
  if (iv === null) return 'info';
  if (ZERO_IDEAL.has(metric)) {
    if (value === 0) return 'good';
    return value <= WARN_TOLERANCE[metric] ? 'warn' : 'bad';
  }
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
  na: '<svg class="ic ic-na" viewBox="0 0 24 24"><line x1="7" y1="12" x2="17" y2="12"/></svg>',
};

// Feather "activity", the pulse line, points reversed so it traces left to
// right. Sits before the footer's feedback link
// and inherits its colour through currentColor, so it follows the theme.
const PULSE_ICON = '<svg class="pulse" viewBox="0 0 24 24" aria-hidden="true"><polyline points="2 12 6 12 9 3 15 21 18 12 22 12"/></svg>';

// Comparison rows inside a tile: your number vs each yardstick.
// ▼ mint = you sit at or under the reference, ▲ coral = you're over it.
function row(label, valText, refVal, value) {
  if (refVal === null || refVal === undefined) return { label, val: valText, dir: '' };
  if (value === refVal) return { label, val: valText, dir: 'eq' };
  return { label, val: valText, dir: value < refVal ? 'down' : 'up' };
}
function tile(value, label, metric, fallbackTarget, healthValue = value) {
  const health = healthOf(metric, healthValue);
  const iv = ideal(metric), mv = median(metric), rm = refMedian(metric);
  const pct = percentile(metric, value);
  const rows = [];
  if (iv !== null) rows.push(row('Ideal Design System', ZERO_IDEAL.has(metric) ? String(iv) : `~${n(iv)}`, iv, value));
  else rows.push({ label: fallbackTarget, val: '', dir: '' });
  const clean = cleanerPct(metric, value);
  const avgNote = pct !== null && pct >= 60 && health !== 'good' ? ` · messier than ${pct}%`
    : clean !== null && clean >= 60 ? ` · cleaner than ${clean}%` : '';
  const av = displayAvg(metric);
  if (av !== null) rows.push(row('Avg Design System', `${n(av)}${avgNote}`, av, value));
  if (rm !== null && (rm > 0 || ZERO_IDEAL.has(metric) || metric === 'arbitrary')) rows.push(row('Reputable systems', n(rm), rm, value));
  return { num: n(value), label, health, rows, metric, healthValue };
}
const bigStats = [
  tile(colors.length, 'distinct colours', 'colors', 'a system needs ~24', tokenLed ? colorStrays : colors.length),
  tile(greys.length, 'shades of grey', 'greys', 'a scale has up to 13', tokenLed ? greyStrays : greys.length),
  tile(spacingTotal, 'off-scale spacing values', 'spacing', 'a dozen deliberate exceptions'),
  tile(hardDupes.length, 'duplicated components', 'exactDuplicates', 'should be 0'),
  tile(inline.count, 'inline style blocks', 'inlineStyles', 'invisible to any system'),
  tile(nearPairs.length, 'near-identical colour pairs', 'nearPairs', 'copy-paste, not decisions'),
  tile(important.count, '!important declarations', 'important', 'the cascade admitting defeat'),
  tile(neverImported.length, 'components never imported', 'neverImported', 'the system nobody found'),
  tile(arbitraryCount, 'arbitrary bracket values', 'arbitrary', 'a handful of deliberate exceptions'),
];

// Component metrics the detector could not measure render as such and drop
// out of the score ('na' is not a scored health); a library's never-imported
// count stays visible but unscored, with the reason on the tile.
if (!componentsMeasured) {
  for (const m of ['exactDuplicates', 'neverImported']) {
    const i = bigStats.findIndex((st) => st.metric === m);
    bigStats[i] = { num: '—', label: bigStats[i].label, health: 'na', metric: m, healthValue: null,
      rows: [{ label: `not measured: ${notMeasuredReason}`, val: '', dir: '' }] };
  }
} else if (isLibrary) {
  const t = bigStats.find((st) => st.metric === 'neverImported');
  t.health = 'info';
  t.rows.push({ label: 'library: internal use only, downstream consumers invisible', val: '', dir: '' });
}

// Health score for the hero: the scored tiles averaged (good 100 / warn 55 / bad 10).
const SCORE_OF = { good: 100, warn: 55, bad: 10 };
const scoredTiles = bigStats.filter((s) => s.health in SCORE_OF);
const healthScore = scoredTiles.length
  ? Math.round(scoredTiles.reduce((sum, s) => sum + SCORE_OF[s.health], 0) / scoredTiles.length)
  : null;

// ---------- what a fix is worth ----------
// The score is the average of the scored tiles, so moving one tile across a
// band is worth an exact number of points: red to green 10, red to amber 5,
// amber to green 5 (on nine tiles). Deltas are only claimed when a move
// actually crosses a band — a cleanup that lands inside the same band is real
// work worth zero points, and saying otherwise would be a lie.
const TILE_COUNT = scoredTiles.length || 1;
const scoreOfHealth = (hh) => SCORE_OF[hh] ?? 0;
function bandPoints(metric, from, to) {
  const a = healthOf(metric, from), b = healthOf(metric, to);
  if (!(a in SCORE_OF) || !(b in SCORE_OF)) return 0;
  return Math.round((scoreOfHealth(b) - scoreOfHealth(a)) / TILE_COUNT);
}
// The nearest number that moves this metric up a band, and what it pays.
function nextBand(metric, value) {
  const iv = ideal(metric);
  if (iv === null) return null;
  const cur = healthOf(metric, value);
  if (cur === 'good') return null;
  if (cur === 'warn') {
    const target = ZERO_IDEAL.has(metric) ? 0 : iv;
    return { target, gain: bandPoints(metric, value, target) };
  }
  const warnTarget = ZERO_IDEAL.has(metric) ? WARN_TOLERANCE[metric] : Math.min(median(metric) ?? iv * 1.5, iv * 1.5);
  return { target: Math.round(warnTarget), gain: bandPoints(metric, value, Math.round(warnTarget)) };
}
// The score this repo would have with a set of metrics at new values.
function projectedScore(applied) {
  const scored = bigStats.filter((st) => st.health in SCORE_OF);
  if (!scored.length) return healthScore;
  return Math.round(scored.reduce((sum, st) => {
    const v = applied.has(st.metric) ? applied.get(st.metric) : st.healthValue;
    return sum + scoreOfHealth(healthOf(st.metric, v));
  }, 0) / scored.length);
}

// A repo with essentially no colour/spacing signal most likely has no design
// system in it at all; say that up front instead of quietly scoring zeros.
const noSystemLikely = colors.length === 0 || (colors.length < 3 && spacingTotal === 0);

// ---------- section renderers ----------
const DIR = {
  down: '<span class="dir d-down">▼</span>',
  up: '<span class="dir d-up">▲</span>',
  eq: '<span class="dir d-eq">=</span>',
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
    ${nearPairs.length ? `
    <div class="receipts">${eyebrow(`${nearPairs.length} nearly identical pair${nearPairs.length === 1 ? '' : 's'} · copy-paste, not decisions`)}
    <div class="chips-row">${nearPairs.slice(0, 8).map((pr) => `<span class="vchip" title="every channel within ${pr.d} of its twin"><i class="ndot" style="background:${esc(pr.a.value)}"></i>${esc(pr.a.value)} ×${pr.a.count} <b class="nsim">≈</b> <i class="ndot" style="background:${esc(pr.b.value)}"></i>${esc(pr.b.value)} ×${pr.b.count}</span>`).join('')}${nearPairs.length > 8 ? `<span class="vchip dim">+${nearPairs.length - 8} more</span>` : ''}</div></div>` : ''}
  </div>
</section>`;
}

// Agent traps: findings that do not just sit there but multiply, because an
// agent reads the repo as instruction. Copy only, no new measurement, and a
// trap renders only when its mechanism is real for this repo, so the marker
// stays scarce enough to mean something.
function trapBox(text) {
  return `<div class="trap">${ICONS.warn}<span><b>Agent trap.</b> ${text}</span></div>`;
}
function dupesTrap() {
  if (!componentsMeasured) return '';
  const hard = exactDupes.filter((d) => !d.wrapped);
  if (hard.length < 2) return '';
  const top = hard[0];
  return trapBox(`&lt;${esc(top.name)}&gt; alone has ${top.files.length} implementations. An agent asked for one cannot tell which is canonical, so it picks at random or writes another, and every wrong pick becomes the example the next agent copies. This is the finding that multiplies itself.`);
}
function spacingTrap() {
  const candidates = [...spacing, ...(arbitrary ?? [])].filter((s) => s.count >= 15)
    .sort((a, b) => b.count - a.count);
  if (candidates.length) {
    const t = candidates[0];
    return trapBox(`${esc(t.value)} appears ${t.count} times. An agent looking for how this repo does spacing reads repetition as intent, so it will write occurrence ${t.count + 1}. The most copied pattern here is the one you least want copied.`);
  }
  if (twSpacing.length > 0 && spacing.length >= 10) {
    return trapBox(`Two spacing dialects coexist here: Tailwind steps and ${spacing.length} raw CSS values. A human knows which is legacy. An agent sees two valid options and matches whichever file it opened last, so every edit is a coin toss between systems.`);
  }
  return '';
}
function coloursTrap() {
  if (nearPairs.length < 6) return '';
  return trapBox(`This palette holds ${nearPairs.length} pairs of colours a screen can barely tell apart. An agent asked for the brand grey cannot see the difference either, so it copies whichever twin is nearest, and when unsure it invents a third between them. Twins breed triplets.`);
}
function inlineTrap() {
  if (inline.count < 50) return '';
  return trapBox(`${n(inline.count)} inline styles live where the system should. An agent learns a codebase by example, and every inline style is an example that says the system is optional. Each exception it copies becomes the precedent for the next one.`);
}
function importantTrap() {
  if (important.count < 20) return '';
  return trapBox(`${n(important.count)} !important declarations, and each one is a shouting match a previous developer decided to win by force. An agent whose style will not apply does what the repo taught it and shouts louder. The volume in this codebase only goes up.`);
}
function orphansTrap() {
  if (!componentsMeasured || isLibrary) return '';
  if (neverImported.length < 10) return '';
  return trapBox(`${neverImported.length} components are never imported anywhere. An agent searching for a Button finds the abandoned ones alongside the canonical one with nothing to tell them apart, so yesterday's dead end becomes today's example.`);
}
// At most three traps per report, in severity order: scarcity is what makes
// the marker readable as a warning rather than wallpaper.
function trapsBlock() {
  return [dupesTrap(), spacingTrap(), coloursTrap(), inlineTrap(), importantTrap(), orphansTrap()]
    .filter(Boolean).slice(0, 3).join('');
}

function spacingBars() {
  const hasTw = twSpacing.length > 0;
  const merged = [...spacing.map((s) => ({ label: s.value, count: s.count, off: hasTw })),
                  ...twSpacing.map((s) => ({ label: `·${s.value}`, count: s.count, off: s.value.startsWith('[') }))]
    .sort((a, b) => b.count - a.count).slice(0, 18);
  if (!merged.length) return '';
  const max = merged[0].count;
  const rows = merged.map((s) => `
    <div class="bar-row"><span class="bar-label${s.off ? ' off' : ''}">${esc(s.label)}</span>
    <div class="bar-track"><div class="bar${s.off ? ' bar-off' : ''}" style="width:${Math.max(2, Math.round((s.count / max) * 100))}%"></div></div>
    <span class="bar-count">${n(s.count)}</span></div>`).join('');
  const arb = arbitraryCount ? `
    <div class="receipts">${eyebrow(`${n(arbitraryCount)} arbitrary values punched through the scale, one bracket at a time`)}
    <div class="chips-row">${arbitrary.slice(0, 10).map((a) => `<span class="vchip bad" title="${esc(a.files?.[0]?.file ?? '')}">${esc(a.value)} ×${a.count}</span>`).join('')}${arbitrary.length > 10 ? `<span class="vchip dim">+${arbitrary.length - 10} more</span>` : ''}</div></div>` : '';
  return `<section class="glass pad">
    ${sectionHead(`${n(spacingTotal)} off-scale spacing values`, `a disciplined repo keeps these around a dozen · on-scale Tailwind steps (·) shown for context · off-scale in coral`)}
    <div class="bars">${rows}</div>${arb}</section>`;
}

function duplicatesSection() {
  if (!exactDupes.length && !families.length && !iconCollisions.length) return '';
  const iconCard = iconCollisions.length ? `
    <div class="fam">
      ${eyebrow(`two icon sets collide on ${iconCollisions.length} names · one problem, not ${iconCollisions.length}`)}
      <div class="chips-row">${iconCollisions.slice(0, 16).map((d) => `<span class="vchip">&lt;${esc(d.name)}&gt;</span>`).join('')}${iconCollisions.length > 16 ? `<span class="vchip dim">+${iconCollisions.length - 16} more</span>` : ''}</div>
      <p class="sub" style="margin-top:8px">${esc(iconCollisions[0].files[0])} vs ${esc(iconCollisions[0].files[1])}</p>
    </div>` : '';
  const dupeCards = exactDupes.slice(0, 8).map((d) => `
    <div class="fam">
      ${eyebrow(`&lt;${esc(d.name)}&gt; · ${d.wrapped ? 'defined twice, one wraps the other' : `${d.files.length} implementations`}`)}
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
    ${sectionHead('Duplicated components', 'an agent asking which one is canonical gets several plausible answers. Paths open in VS Code')}
    <div class="fams">${iconCard}${dupeCards}${famCards}</div></div>`;
}

// Scanned values get injected into style attributes below (a radius, a shadow,
// a font size from someone else's repo). Allow only a conservative CSS charset
// so a malformed or hostile value cannot break out of the attribute.
const cssSafe = (v) => (typeof v === 'string' && /^[-#0-9a-z%.,()\s\/]+$/i.test(v) && !/[;{}<>"']/.test(v) ? v.trim() : null);
// px equivalent of a length, for sorting and for rendering type at real size.
function toPx(v) {
  const m = /^(-?\d*\.?\d+)\s*(px|rem|em|pt)?$/i.exec(String(v).trim());
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = (m[2] ?? 'px').toLowerCase();
  if (!Number.isFinite(num) || num <= 0) return null;
  return unit === 'px' ? num : unit === 'pt' ? num * 1.333 : num * 16;
}

function typographySection() {
  if (!fontFamilies.length && !fontSizeTotal && !radiiTotal) return '';
  const mini = [
    typefaces.length ? tile(typefaces.length, 'typefaces', 'typefaces', 'brands use 2 or 3') : null,
    fontSizeTotal ? tile(fontSizeTotal, 'font sizes', 'fontSizes', 'a type scale has 6 to 8') : null,
    radiiTotal ? tile(radiiTotal, 'border radii', 'radii', 'a system has up to 10') : null,
    shadows.length ? tile(shadows.length, 'shadow styles', 'shadows', '2 to 3 elevations') : null,
  ].filter(Boolean);
  const sizeChips = [...(h.tokens.fontSizes ?? []).map((v) => ({ label: v.value, count: v.count })),
    ...(h.tokens.tailwind?.textSizes ?? []).map((v) => ({ label: `·${v.value}`, count: v.count }))]
    .sort((a, b) => b.count - a.count).slice(0, 14);
  const radiiChips = [...(h.tokens.radii ?? []).map((v) => ({ label: v.value, count: v.count })),
    ...(h.tokens.tailwind?.radii ?? []).map((v) => ({ label: `·${v.value}`, count: v.count }))]
    .sort((a, b) => b.count - a.count).slice(0, 14);
  const receipts = (title, chips) => chips.length < 2 ? '' :
    `<div class="receipts">${eyebrow(title)}<div class="chips-row">${chips.map((c) => `<span class="vchip">${esc(String(c.label))} ×${c.count}</span>`).join('')}</div></div>`;

  // ---------- specimens: the values rendered, not counted ----------
  // Counting says "47 font sizes". Rendering them says it better: the eye
  // finds the near-duplicates on its own, the way the grey ramp works.
  const typeSpecimens = (() => {
    const rows = (h.tokens.fontSizes ?? [])
      .map((f) => ({ label: f.value, count: f.count, px: toPx(f.value) }))
      .filter((f) => f.px && f.px >= 6 && f.px <= 200)
      .sort((a, b) => b.px - a.px);
    if (rows.length < 4) return '';
    const shown = rows.slice(0, 16);
    const capped = shown.some((r) => r.px > 52);
    return `<div class="spec">${eyebrow(`the type scale, at its real sizes${capped ? ' · the largest are capped to fit' : ''} · how many of these are the same decision?`)}
      <div class="spec-rows">${shown.map((r) => `
        <div class="spec-type">
          <span class="spec-val">${esc(r.label)} ×${r.count}</span>
          <span class="spec-sample" style="font-size:${Math.min(r.px, 52)}px">Almost but not quite</span>
        </div>`).join('')}</div>
      ${rows.length > 16 ? `<div class="spec-more">and ${rows.length - 16} more</div>` : ''}</div>`;
  })();

  const radiiSpecimens = (() => {
    const cells = (h.tokens.radii ?? [])
      .map((r) => ({ label: r.value, count: r.count, css: cssSafe(r.value) }))
      .filter((r) => r.css && !/^0$|^0px$/.test(r.css) && !/var\(|calc\(/i.test(r.css))
      .slice(0, 14);
    if (cells.length < 3) return '';
    return `<div class="spec">${eyebrow(`the corners, drawn · ${n(radiiTotal)} radii in one interface`)}
      <div class="spec-grid">${cells.map((r) => `
        <div class="spec-cell"><div class="spec-box" style="border-radius:${r.css}"></div>
        <span class="spec-cap">${esc(r.label)} ×${r.count}</span></div>`).join('')}</div></div>`;
  })();

  const shadowSpecimens = (() => {
    const cells = (h.tokens.shadows ?? [])
      .map((sh) => ({ label: sh.value, count: sh.count, css: cssSafe(sh.value) }))
      .filter((sh) => sh.css && !/^(none|initial|inherit|unset|revert)$/i.test(sh.css) && !/var\(/i.test(sh.css))
      .slice(0, 10);
    if (cells.length < 2) return '';
    const short = (v) => (v.length > 20 ? `${v.slice(0, 19)}…` : v);
    return `<div class="spec">${eyebrow(`the elevations, cast${cells.length < shadows.length ? `, ${cells.length} of ${n(shadows.length)}` : ` · ${n(shadows.length)} shadow styles`} · on the light surface they were drawn for`)}
      <div class="spec-grid spec-shadows">${cells.map((sh) => `
        <div class="spec-cell"><div class="spec-card" style="box-shadow:${sh.css}"></div>
        <span class="spec-cap" title="${esc(sh.label)}">${esc(short(sh.label))} ×${sh.count}</span></div>`).join('')}</div></div>`;
  })();
  const fams = fontFamilies.slice(0, 8).map((f) =>
    `<div class="mini-card"><span class="mc-path">${esc(f.value.slice(0, 70))}</span><span class="pill${f.count > 2 ? ' pill-coral' : ' pill-mint'}">×${f.count}</span></div>`).join('');
  return `<section>
    ${sectionHead('Typography &amp; shape', '')}
    <div class="stats minis">${mini.map((s) => statTile(s)).join('')}</div>
    ${typeSpecimens || receipts('the font sizes, by use', sizeChips)}
    ${radiiSpecimens || receipts('the radii, by use', radiiChips)}
    ${shadowSpecimens}
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
  if (inline.count < 5 && important.count < 5) return '';
  const max = Math.max(...inline.files.slice(0, 6).map((f) => f.count), 1);
  const importantRow = important.count ? `
    <div class="receipts">${eyebrow(`${n(important.count)} !important declaration${important.count === 1 ? '' : 's'} · the cascade admitting defeat`)}
    <div class="chips-row">${important.files.map((f) => `<span class="vchip bad" title="${esc(f.file)}">${esc(basename(f.file))} ×${f.count}</span>`).join('')}</div></div>` : '';
  const blocks = inline.count >= 5 ? `<div class="fam-rows">${inline.files.slice(0, 6).map((f) => `
      <div class="mini-card col">
        <div class="mc-row">${fileLink(f.file)}<span class="mc-count">×${f.count}</span></div>
        <div class="mc-track"><div class="mc-bar" style="width:${Math.round((f.count / max) * 100)}%"></div></div>
      </div>`).join('')}</div>` : '';
  return `<div class="glass pad half">
    ${sectionHead(inline.count >= 5 ? `${n(inline.count)} inline style blocks` : `${n(important.count)} !important declarations`, 'styling no system can see')}
    ${blocks}${importantRow}</div>`;
}

// The adoption map: the real system drawn to scale as a treemap. Every
// adopted component (usage >= 2, top 24) is a tile whose AREA is its import
// count, and the tiles sit flush so scale is read by eye, not by legend.
// Squarified layout (Bruls et al.), deterministic: same scan, same picture.
// The once-used get a line of text, never a tile: a tile would flatter them.
function adoptionMap(tiled) {
  // A treemap of four tiles says nothing the table does not; the map earns
  // its place only when there is a system worth drawing.
  if (tiled.length < 8) return '';
  const W = 1040, H = Math.min(460, 150 + tiled.length * 12);
  const total = tiled.reduce((s, c) => s + c.usageCount, 0);
  const areas = tiled.map((c) => (c.usageCount / total) * W * H);
  const rects = [];
  let rx = 0, ry = 0, rw = W, rh = H, i = 0;
  while (i < areas.length) {
    const side = Math.min(rw, rh);
    const worst = (row) => {
      const s = row.reduce((a, b) => a + b, 0);
      return Math.max(...row.map((r) => Math.max((r * side * side) / (s * s), (s * s) / (r * side * side))));
    };
    let row = [areas[i]];
    while (i + row.length < areas.length) {
      const next = [...row, areas[i + row.length]];
      if (worst(next) > worst(row)) break;
      row = next;
    }
    const s = row.reduce((a, b) => a + b, 0);
    const t = s / side;   // row thickness
    let off = 0;
    for (let k = 0; k < row.length; k++) {
      const len = row[k] / t;
      rects.push(rw <= rh
        ? { x: rx + off, y: ry, w: len, h: t, c: tiled[i + k] }
        : { x: rx, y: ry + off, w: t, h: len, c: tiled[i + k] });
      off += len;
    }
    if (rw <= rh) { ry += t; rh -= t; } else { rx += t; rw -= t; }
    i += row.length;
  }
  const tiles = rects.map(({ x, y, w, h, c }) => {
    const fitsName = w > c.name.length * 7.5 + 10 && h > 34;
    const fitsCount = w > 34 && h > (fitsName ? 52 : 22);
    const cx = x + w / 2, cy = y + h / 2;
    return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="atile">
      <title>&lt;${esc(c.name)}&gt; · used ${c.usageCount}× · ${esc(c.file)}</title></rect>
    ${fitsName ? `<text x="${cx.toFixed(1)}" y="${(fitsCount ? cy - 4 : cy + 4).toFixed(1)}" class="adot-n">${esc(c.name)}</text>` : ''}
    ${fitsCount ? `<text x="${cx.toFixed(1)}" y="${(fitsName ? cy + 14 : cy + 4).toFixed(1)}" class="adot-c">${c.usageCount}×</text>` : ''}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="amap" role="img" aria-label="Component adoption map: tile area is import count">${tiles}</svg>`;
}

// Orphans grouped by the year git last saw anyone touch them, oldest first:
// the obituary column. "Untouched since 2023" needs no decoding, and a heavy
// year reads as what it is, the fossil of one abandoned effort. Orphans
// without a date (no git) fall back to one plain row, exactly as before.
function orphanRows() {
  const shown = neverImported.slice(0, 16);
  const chip = (c) => `<span class="vchip" title="${esc(c.file)}${c.lastTouched ? ` · untouched since ${esc(c.lastTouched)}` : ''}">&lt;${esc(c.name)}&gt;</span>`;
  const more = neverImported.length > 16 ? `<span class="vchip dim">+${neverImported.length - 16} more</span>` : '';
  const dated = shown.filter((c) => c.lastTouched);
  if (dated.length < 2) return `<div class="chips-row">${shown.slice(0, 8).map(chip).join('')}${neverImported.length > 8 ? `<span class="vchip dim">+${neverImported.length - 8} more</span>` : ''}</div>`;
  const byYear = new Map();
  for (const c of shown) {
    const k = c.lastTouched ? c.lastTouched.slice(0, 4) : 'no git date';
    (byYear.get(k) ?? byYear.set(k, []).get(k)).push(c);
  }
  const keys = [...byYear.keys()].sort((a, b) => (a === 'no git date' ? 1 : b === 'no git date' ? -1 : a < b ? -1 : 1));
  return keys.map((k, idx) => `
    <div class="orow"><span class="oyear">${k === 'no git date' ? k : `untouched since ${k}`}</span>
    <div class="chips-row">${byYear.get(k).map(chip).join('')}${idx === keys.length - 1 ? more : ''}</div></div>`).join('');
}

function componentsSection() {
  // The wing the inspector could not enter gets named, never skipped: a
  // missing section claims "nothing worth mapping", which is a different
  // claim from "I could not see them".
  if (!componentsMeasured) {
    return `<section class="glass pad">
    ${sectionHead('The component ledger', 'not measured in this repo')}
    <p class="sub">Components here are built as ${esc(notMeasuredReason)}, a pattern this scan cannot read yet. Nothing on this page makes claims about component count, duplication, usage or adoption, and the score takes no credit for those tiles. Everything measured from stylesheets stands unaffected: colours, spacing, typography, !important.</p></section>`;
  }
  const adopted = reusable.filter((c) => c.usageCount > 0);
  const top = adopted.slice(0, 10);
  if (!top.length && neverImported.length < 2) return '';
  const tiled = adopted.filter((c) => c.usageCount >= 2).slice(0, 24);
  const onceUsed = adopted.filter((c) => c.usageCount === 1);
  const mapped = adoptionMap(tiled);
  const overflow = adopted.filter((c) => c.usageCount >= 2).length - tiled.length;
  const rows = top.map((c) => `
    <tr><td class="mono strong">&lt;${esc(c.name)}&gt;</td>
    <td><span class="pill pill-mint">${c.usageCount}×</span></td>
    <td class="path">${esc(c.file)}</td>
    <td>${c.propsHint?.named?.length ? c.propsHint.named.slice(0, 5).map((p) => `<span class="chip chip-xs">${esc(p)}</span>`).join(' ') : '<span class="dim">none</span>'}</td></tr>`).join('');
  return `<section class="glass pad">
    ${sectionHead(isLibrary ? 'The composition map' : 'The adoption map', `${n(reusable.length)} components defined · tile area is ${isLibrary ? 'internal use: how the system builds from itself, downstream consumers invisible from here' : 'import count'} · the real system, drawn to scale`)}
    ${mapped}
    ${overflow > 0 ? `<p class="sub">${overflow} more adopted component${overflow === 1 ? '' : 's'} below the top 24, not drawn.</p>` : ''}
    ${onceUsed.length ? `<p class="sub">${n(onceUsed.length)} component${onceUsed.length === 1 ? ' is' : 's are'} imported exactly once: ${onceUsed.slice(0, 6).map((c) => `&lt;${esc(c.name)}&gt;`).join(', ')}${onceUsed.length > 6 ? ` and ${onceUsed.length - 6} more` : ''}. Quiet corners, not yet a system.</p>` : ''}
    ${top.length ? `<div class="tbl-wrap"><table><thead><tr><th>component</th><th>used</th><th>defined in</th><th>props</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    ${neverImported.length >= 2 ? `
    <div class="receipts">${eyebrow(isLibrary ? `${n(neverImported.length)} components unused internally · showroom stock to review, not dead weight: consumers in other repos are invisible from here` : `${n(neverImported.length)} components defined but never imported · they sit in the system as wrong answers waiting to be picked`)}
    ${orphanRows()}
    <p class="sub" style="margin-top:8px">Routers, dynamic imports and barrel files can hide real usage, so treat this as a shortlist to check, not a demolition order.</p>` : ''}</section>`;
}

// "Where to start" — at most three moves, every one derived from this repo's
// own numbers with a receipt. Deliberately shallow: a starting push, not a
// remediation plan.
// The present. The report ends the diagnosis arc with a gift: the agent
// rules file generated from this same scan, wrapped behind one click.
// Embedded so the report stays a single self-contained shareable file.
function giftSection() {
  const { text: rulesText, ruleCount } = rulesMarkdown(h);
  return `<section class="glass pad gift-sec">
    ${sectionHead('You sat through the roast', 'so you get a present.')}
    <div class="gift-stage">
      <button class="gift" id="gift" aria-label="Unwrap your generated agent rules file">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="10" y="26" width="44" height="30" rx="4"/>
          <rect x="6" y="17" width="52" height="9" rx="3"/>
          <path class="ribbon" d="M32 26 v30"/>
          <path class="ribbon" d="M32 17 c-9 1 -13 -8 -7 -11 c5 -2 8 4 7 11 c-1 -7 2 -13 7 -11 c6 3 2 12 -7 11z"/>
        </svg>
        <span class="gift-hint">unwrap</span>
      </button>
      <div class="gift-pop" id="gift-pop" aria-hidden="true"></div>
      <div class="gift-reveal" id="gift-reveal" hidden>
        <div class="gift-head"><span class="mono strong">design-system-rules.md</span>
          <span class="gift-count">${ruleCount} rules generated from this scan, every one with a receipt</span></div>
        <pre class="gift-md" id="gift-md">${esc(rulesText)}</pre>
        <div class="gift-actions">
          <button class="gbtn" id="gift-copy">Copy the rules</button>
          <button class="gbtn ghost" id="gift-dl">Download the file</button>
        </div>
        <div class="gift-sub">Paste into CLAUDE.md, .cursor/rules or AGENTS.md. From then on your AI agent follows your system instead of guessing at it.</div>
      </div>
    </div>
  </section>`;
}

// ---------- agent-written analysis (--notes) ----------
// Markdown-lite renderer: escape everything first, then allow exactly
// **bold**, `code` and "- " bullet lists. No raw HTML ever passes through,
// so a hostile notes file cannot inject into the report.
function notesInline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<span class="mono">$1</span>');
}
function mdBlock(block) {
  const lines = block.trim().split('\n');
  if (lines.every((l) => /^[-*] /.test(l.trim()))) {
    return `<ul>${lines.map((l) => `<li>${notesInline(l.trim().slice(2))}</li>`).join('')}</ul>`;
  }
  return `<p>${notesInline(block.trim())}</p>`;
}
function notesBody(md) {
  return md.split(/\n\s*\n/).map(mdBlock).join('');
}
// Sections additionally allow "## " sub-headings on a block's first line.
function sectionBody(md) {
  return md.split(/\n\s*\n/).map((block) => {
    let b = block.trim(), head = '';
    if (b.startsWith('## ')) {
      const nl = b.indexOf('\n');
      head = `<h3>${notesInline((nl === -1 ? b : b.slice(0, nl)).slice(3).trim())}</h3>`;
      b = nl === -1 ? '' : b.slice(nl + 1).trim();
    }
    return head + (b ? mdBlock(b) : '');
  }).join('');
}
function notesSection() {
  if (!notesText) return '';
  return `<section class="glass pad notes-sec">
    <div class="sec-head">
      ${eyebrow(`Written by ${esc(arg('notes-author', 'Claude'))} from this scan · ${esc((h.harvestedAt ?? '').slice(0, 10))} · not part of the measurement`)}
      <h2>What the numbers mean</h2>
    </div>
    <div class="notes-body">${notesBody(notesText)}</div>
</section>`;
}
function extraSectionsHtml() {
  return extraSections.map(({ title, text }) => `<section class="glass pad notes-sec">
    <div class="sec-head">
      ${eyebrow(`Written by ${esc(arg('notes-author', 'Claude'))} from this scan · ${esc((h.harvestedAt ?? '').slice(0, 10))} · not part of the measurement`)}
      <h2>${esc(title)}</h2>
    </div>
    <div class="notes-body">${sectionBody(text)}</div>
</section>`).join('\n\n');
}

// Filled by whereToStartSection when the template renders (which happens
// before the summary is written): the same moves and prompts the report's
// buttons hold, published in --summary so the MCP server's roast-fix prompt
// hands out byte-identical text. One composer, two doors.
let startMoves = [];

function whereToStartSection() {
  const c = [];
  if (agentFiles.length === 0) c.push({ score: 60, metric: null, title: 'Write the agent rules file',
    sub: `No CLAUDE.md, no AGENTS.md. One page naming the canonical components and the tokens file stops your agent guessing on every UI change. Cheapest fix on this list.` });
  if (componentsMeasured && hardDupes.length > 0) {
    // Pick the pair with the strongest copy-paste evidence: sibling files in
    // app code (same basename, neither in a shared package) are true
    // duplicates; a library-vs-app pair may be an intentional override, and
    // "delete one" is dangerous advice there.
    const inLibrary = (f) => /(^|\/)packages\//.test(f) || /(^|\/)components\/ui\//.test(f);
    const strength = (d) => {
      const bases = d.files.map((f) => f.split('/').pop());
      let sc = 0;
      if (new Set(bases).size === 1) sc += 2;
      if (!d.files.some(inLibrary)) sc += 3;
      return sc;
    };
    const d = [...hardDupes].sort((a, b) => strength(b) - strength(a))[0];
    c.push({ score: 25 + hardDupes.length * 4, metric: 'exactDuplicates', after: hardDupes.length - 1,
      title: `Crown the canonical &lt;${esc(d.name)}&gt;`,
      sub: `${hardDupes.length} component name${hardDupes.length > 1 ? 's have' : ' has'} competing implementations. Start with &lt;${esc(d.name)}&gt;: ${esc(d.files[0])} vs ${esc(d.files[1] ?? '')}. Decide which one is canonical, re-export it from one home, and rename or fold in the other.` });
  }
  if (componentsMeasured && iconCollisions.length >= 5) c.push({ score: 20 + iconCollisions.length * 3, metric: null, title: 'Merge the two icon sets',
    sub: `${iconCollisions.length} icon names exist in both sets, so every import is a coin flip. Pick one home and rename or delete the rest. Receipt: ${esc(iconCollisions[0].files[0])} vs ${esc(iconCollisions[0].files[1])}.` });
  const strayOffender = offenders.find((o) => o.strayColors > 0);
  if (colorStrays > 12) {
    // When the top stray file lives beside the token definitions, say so:
    // otherwise "your variables file is the top offender" reads like a bug.
    const tf = h.tokens.tokenFile;
    const besideTokens = strayOffender && tf && (strayOffender.file === tf
      || strayOffender.file.split('/').slice(0, -1).join('/') === tf.split('/').slice(0, -1).join('/')
      || /variables|tokens|theme/i.test(strayOffender.file));
    c.push({ score: colorStrays, metric: 'colors', after: 0, title: `Tokenise the ${n(colorStrays)} stray colours`,
      sub: `They are hardcoded where no token names them${strayOffender ? (besideTokens
        ? `, including ${strayOffender.strayColors} in ${esc(strayOffender.file)}, sitting right next to the token definitions. Those are the cheapest wins on this page`
        : `; ${esc(strayOffender.file)} alone carries ${strayOffender.strayColors}`) : ''}. Every one is a value your agent will happily copy.` });
  }
  if (inline.count > 10) { const worst = inline.files[0];
    c.push({ score: inline.count / 2, metric: 'inlineStyles', after: 0,
      title: `Fold ${n(inline.count)} inline style blocks back into the system`,
      sub: `These are static values written as style attributes${worst ? `; start with ${esc(worst.file)} (${worst.count} blocks)` : ''}. Dynamic positioning was already excluded, so all of these could be classes or tokens today.` }); }
  if (arbitraryCount >= 20) {
    // Repeated brackets read as decisions; singletons are worth a pass. Small
    // px values are often deliberate optical nudges — the advice must not
    // steamroll craft.
    const repeats = arbitrary.filter((a) => a.count >= 5);
    const nudges = arbitrary.filter((a) => /^\[-?[0-3](?:\.\d+)?px\]$/.test(a.value)).length;
    const singles = arbitrary.filter((a) => a.count === 1).length;
    const top = arbitrary[0];
    const tokenFile = h.tokens.tokenFile;
    // naming the repeats removes their counts; the one-offs are left alone on purpose
    const afterNaming = arbitraryCount - repeats.reduce((sum, a) => sum + a.count, 0);
    c.push({ score: arbitraryCount / 3, metric: 'arbitrary', after: afterNaming,
      title: `Give your repeated bracket values names`,
      sub: repeats.length
        ? `${esc(top.value)} appears ${top.count} times, which reads as a decision, not drift. If it is one, name it${tokenFile ? ` in ${esc(tokenFile)}` : ' in the scale'} so the next component (and your agent) can reach for it${repeats.length > 1 ? `; ${repeats.length - 1} more repeated value${repeats.length > 2 ? 's' : ''} deserve the same look` : ''}. The ${singles} values used once are worth a pass: keep the deliberate ones (optical nudges${nudges ? ` like the ${nudges} under 4px` : ''}, one-off layout widths) and round the accidents to a neighbouring step.`
        : `${n(arbitraryCount)} bracket values sit outside the scale, almost all used once. Keep the deliberate ones (optical nudges, one-off widths) and round the rest to a neighbouring step.` });
  }
  if (spacingTotal > 12 && arbitraryCount < 20) {
    // "Round to the scale" is only advice when a scale exists. Without one,
    // the first move is to define it, next to the tokens the repo already has.
    const hasScale = twSpacing.length >= 5;
    const tf = h.tokens.tokenFile;
    c.push({ score: spacingTotal / 2, metric: 'spacing', title: hasScale
      ? `Fold ${n(spacingTotal)} off-scale spacing values back to the scale`
      : `Define a spacing scale, then fold ${n(spacingTotal)} values into it`,
      sub: hasScale
        ? `${n(spacingTotal)} values sit outside the scale you already use. Keep the deliberate exceptions and round the accidents to a neighbouring step.`
        : `${n(spacingTotal)} distinct spacing values and no named scale to hold them. Define ~8 steps${tf ? ` in ${esc(tf)}, next to the tokens you already keep there` : ''}, then migrate values as you touch each file. No mass rounding.` });
  }
  if (nearPairs.length >= 3) {
    const p0 = nearPairs[0];
    c.push({ score: 30 + nearPairs.length * 2, metric: 'nearPairs', after: 0,
      title: `Collapse the ${n(nearPairs.length)} near-identical colours`,
      sub: `${esc(p0.a.value)} and ${esc(p0.b.value)} are the same colour to any eye${p0.a.count + p0.b.count > 3 ? `, and they are used ${n(p0.a.count + p0.b.count)} times between them` : ''}. Nobody chose to have both. Pick the one that is already a token, point the other at it, and the pair stops multiplying.` });
  }
  if (important.count >= 10) {
    const worst = important.files[0];
    c.push({ score: 20 + important.count, metric: 'important', after: 0,
      title: `Unwind the ${n(important.count)} !important declarations`,
      sub: `Each one is a selector losing an argument with another selector${worst ? `; ${esc(basename(worst.file))} alone carries ${worst.count}` : ''}. Fix the specificity at the source and they stop being necessary.` });
  }
  if (componentsMeasured && !isLibrary && neverImported.length >= 3) {
    c.push({ score: 15 + neverImported.length, metric: 'neverImported', after: 0,
      title: `Decide about the ${n(neverImported.length)} components nobody imports`,
      sub: `${neverImported.slice(0, 3).map((x) => `&lt;${esc(x.name)}&gt;`).join(', ')}${neverImported.length > 3 ? ' and others' : ''} sit in the system with no callers. Adopt them or delete them: either answer is better than a system with rooms nobody enters.` });
  }

  // What each move is actually worth, then rank by payoff for real.
  for (const item of c) {
    item.delta = 0; item.target = null;
    if (!item.metric) continue;
    const now = bigStats.find((st) => st.metric === item.metric)?.healthValue;
    if (now === undefined) continue;
    if (item.after !== undefined) {
      const gain = bandPoints(item.metric, now, item.after);
      if (gain > 0) { item.delta = gain; continue; }
    }
    const nb = nextBand(item.metric, now);
    if (nb && nb.gain > 0) item.target = nb;
  }
  const top3 = c.sort((a, b) => (b.delta - a.delta) || (b.score - a.score)).slice(0, 3);
  if (!top3.length) return '';
  // The headline is the score with every move applied together, not the sum of
  // the parts: two moves on the same tile must not be counted twice.
  const applied = new Map();
  for (const item of top3) if (item.metric && item.after !== undefined && item.delta > 0) applied.set(item.metric, item.after);
  const after = projectedScore(applied);
  const words = ['One tweak', 'Two tweaks', 'Three tweaks'][top3.length - 1];
  const head = healthScore !== null && after > healthScore
    ? `${words} · <b class="proj">${healthScore} &rarr; ${after}</b>`
    : `${words} to increase your score.`;
  const chip = (item) => item.delta > 0
    ? `<span class="delta">+${item.delta}</span>`
    : item.target
      ? `<span class="delta delta-target">${item.target.target === 0 ? 'clear them all' : `under ${n(item.target.target)}`} · +${item.target.gain}</span>`
      : '';
  // The copy button beside each move hands the finding to whatever agent the
  // reader pastes it into: one move per prompt, so progress stays visible and
  // finishable. Prompt text is composed from the same title/sub the row shows
  // (entities unescaped back to plain text), held in a hidden div the button
  // reads at click time, so a forwarded report keeps working offline.
  const unesc = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&rarr;/g, '->').replace(/&amp;/g, '&');
  const promptFor = (item) => fixPrompt({
    title: unesc(item.title),
    sub: unesc(item.sub),
    deltaText: item.delta > 0 ? `about +${item.delta} points` : (item.target ? `about +${item.target.gain} points once ${item.target.target === 0 ? 'they are all cleared' : `the count is under ${n(item.target.target)}`}` : ''),
    repoName: h.repo ? String(h.repo).split('/').pop() : '',
  });
  startMoves = top3.map((item) => ({
    title: unesc(item.title), sub: unesc(item.sub),
    delta: item.delta || 0, prompt: promptFor(item),
  }));
  return `<section class="glass pad">
    ${sectionHead('Where to start', head)}
    <div class="ledger">${top3.map((item, i) => `
      <div class="ledger-row start-row">
        <span class="ledger-idx">${String(i + 1).padStart(2, '0')}</span>
        <div class="start-body"><div class="start-head"><div class="start-title">${item.title}</div>${chip(item)}</div><div class="sub">${item.sub}</div>
        <div class="start-actions"><button type="button" class="fixbtn" data-fix="${i}">Copy the fix prompt</button><span class="fixhint">paste it into your agent · <button type="button" class="fixview" data-fix="${i}">view it first</button></span></div>
        <div class="fixprompt" hidden id="fixprompt-${i}">${esc(promptFor(item))}</div></div>
      </div>`).join('')}</div></section>`;
}

// ---------- package by package ----------
// One number for a monorepo hides which package is the problem. Each package
// is judged on the same nine tiles, with usage counted repo-wide, so a shared
// component another package imports is adopted rather than dead.
const PKG_LABELS = {
  colors: 'stray colours', greys: 'greys', spacing: 'off-scale spacing values',
  exactDuplicates: 'duplicated components', inlineStyles: 'inline style blocks',
  nearPairs: 'near-identical colour pairs', important: '!important declarations',
  neverImported: 'components nobody imports', arbitrary: 'arbitrary bracket values',
};
function scorePackage(m) {
  const tokenLed = m.colorTokens >= m.colorStrays && m.colorTokens > 0;
  const vals = {
    colors: tokenLed ? m.colorStrays : m.colors,
    greys: tokenLed ? m.greyStrays : m.greys,
    spacing: m.spacing,
    exactDuplicates: m.exactDuplicates,
    inlineStyles: m.inlineStyles,
    nearPairs: m.nearPairs,
    important: m.important,
    neverImported: m.neverImported,
    arbitrary: m.arbitrary,
  };
  const rows = Object.entries(vals).map(([metric, v]) => ({ metric, value: v, health: healthOf(metric, v) }));
  const scored = rows.filter((r) => r.health in SCORE_OF);
  if (!scored.length) return null;
  const score = Math.round(scored.reduce((sum, r) => sum + SCORE_OF[r.health], 0) / scored.length);
  // the worst finding: furthest past its ideal among the failing tiles
  const over = (r) => { const iv = ideal(r.metric); return iv ? r.value / Math.max(iv, 1) : r.value; };
  const worst = scored.filter((r) => r.health === 'bad').sort((a, b) => over(b) - over(a))[0]
    ?? scored.filter((r) => r.health === 'warn').sort((a, b) => over(b) - over(a))[0];
  return { score, worst };
}
function packagesSection() {
  const pkgs = (h.packages ?? []).filter((p) => p.scored && p.metrics);
  const rated = pkgs.map((p) => ({ ...p, ...scorePackage(p.metrics) })).filter((p) => p.score !== undefined && p.score !== null);
  // packages with real components but almost no raw styling: everything lives
  // in tokens or props, so there is nothing to measure. Named, never judged.
  // Icon sets and email packages stay hidden for the same reasons the scanner
  // excludes them elsewhere; sandboxes and demo scaffolding are not the system.
  const quiet = (h.packages ?? []).filter((p) => !p.scored && (p.uiComponents ?? 0) >= 5
    && !/(^|[\/-])(icons?|emails?|sandbox(es)?|demos?|examples?|templates?|fixtures?|e2e|tests?)([\/-]|$)/.test(p.dir));
  if (rated.length + quiet.length < 1) return '';
  rated.sort((a, b) => a.score - b.score);
  quiet.sort((a, b) => (b.codeFiles ?? 0) - (a.codeFiles ?? 0));
  const band = (sc) => (sc >= 85 ? 'good' : sc >= 55 ? 'warn' : 'bad');
  const skipped = (h.packages ?? []).length - rated.length - quiet.length;
  const shown = [...rated, ...quiet].slice(0, 10);
  const rows = shown.map((p) => p.score !== undefined ? `
    <tr><td class="mono strong">${esc(p.dir)}</td>
    <td><span class="pkg-score pkg-${band(p.score)}">${p.score}</span></td>
    <td>${p.worst ? `${n(p.worst.value)} ${esc(PKG_LABELS[p.worst.metric] ?? p.worst.metric)}` : '<span class="dim">nothing over the line</span>'}</td>
    <td class="dim">${n(p.codeFiles)} files</td></tr>` : `
    <tr><td class="mono strong">${esc(p.dir)}</td>
    <td><span class="pkg-quiet">too little raw styling to judge</span></td>
    <td><span class="dim">${n(p.uiComponents)} components, nothing raw to measure</span></td>
    <td class="dim">${n(p.codeFiles)} files</td></tr>`).join('');
  const overflow = rated.length + quiet.length - shown.length;
  return `<section class="glass pad">
    ${sectionHead('Package by package', `${rated.length} package${rated.length === 1 ? '' : 's'} with enough UI to judge · the repo score above is the whole thing blended${skipped > 0 ? `, and ${skipped} package${skipped === 1 ? ' was' : 's were'} too small or too backend to score` : ''}`)}
    <div class="tbl-wrap"><table><thead><tr><th>package</th><th>score</th><th>worst finding</th><th>size</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${overflow > 0 ? `<div class="spec-more">and ${overflow} more</div>` : ''}
    ${healthScore !== null && rated.length && Math.min(...rated.map((p) => p.score)) > healthScore
      ? `<p class="sub" style="margin-top:12px">A repo scores below its own packages by arithmetic, not by accident: distinct values add up across packages, so the whole always carries more than any part. Read the package scores for where each team stands, and the repo score for what your agent sees when it looks at everything at once.</p>` : ''}</section>`;
}

function agentSection() {
  const have = agentFiles.map((c) => `<span class="chip chip-agent">${esc(c.file)} · ${esc(c.tool ?? c.kind)}</span>`).join('');
  const msg = agentFiles.length
    ? `<p class="sub">Your agent reads ${agentFiles.map((c) => `<span class="mono">${esc(c.file)}</span>`).join(', ')}. But none of it points at a single source of truth for components and tokens, because there isn't one yet. The numbers below are what your agent actually works from.</p>`
    : `<p class="sub">No <span class="mono">CLAUDE.md</span>, no <span class="mono">AGENTS.md</span>, no <span class="mono">.cursorrules</span>. Every time your AI builds UI here, it guesses, from everything below. This is why its output looks almost-but-not-quite right.</p>`;
  const stale = h.staleRules ?? [];
  const staleRows = stale.map((s) => `
    <div class="ledger-row">
      <span class="mono strong">${esc(s.ref)}</span>
      <span class="dim">${s.problem === 'missing' ? 'named in' : 'named canonical in'} ${esc(s.file)}, ${s.problem === 'missing' ? 'but the path no longer exists' : 'but nothing imports it this scan'}</span>
    </div>`).join('');
  const staleBlock = stale.length ? `
    <div class="stale">
      ${eyebrow(`${stale.length} rule reference${stale.length === 1 ? '' : 's'} gone stale · a rule your agent obeys is worse than no rule when the repo has moved on`)}
      <div class="ledger">${staleRows}</div>
      <p class="sub" style="margin-top:10px">Rules rot quietly: nobody edits them when a component is renamed or a file moves. Regenerate them from a fresh scan, or fix the lines by hand.</p>
    </div>` : '';
  return `<section class="glass pad agent">
    ${sectionHead('What your AI agent sees today', '')}
    ${msg}${have ? `<div class="chips">${have}</div>` : ''}${staleBlock}</section>`;
}

// ---------- page ----------
// One chip owns the design-system slot, and bigger titles are earned, not
// assumed (Greg's rule, 2026-09-01): a recognised library by name; a token
// NAMESPACE upgrades to "custom design system (--brand-*)" because
// components-plus-tokens is the system definition this tool preaches; a
// library with tokens but no namespace gets the plain title; a tokenless
// library stays "component library"; a product repo we cannot read gets the
// quiet unrecognised chip, because not knowing IS a finding here.
const ns = h.tokens.namespaces ?? null;
const dsChip =
  ds.kind === 'shadcn' ? 'shadcn/ui'
  : ds.kind === 'library' ? ds.name
  : ns ? `custom design system (--${ns.primary}-*${ns.partner ? ` + --${ns.partner}-*` : ''})`
  // A tokenFile alone is a technicality (Lion's is one drawer style file);
  // the plain title needs a token LAYER: ten defined colour tokens.
  : isLibrary && h.tokens.tokenFile && (h.tokens.colors ?? []).filter((c) => c.isToken).length >= 10 ? 'custom design system'
  : isLibrary ? 'component library'
  : ds.name === 'CSS tokens' ? 'CSS tokens'
  : null;
const stack = [
  h.profile.framework !== 'unknown' ? h.profile.framework : null,
  h.profile.typescript ? 'TypeScript' : null,
  ...(h.profile.stylingDeps ?? []),
  dsChip,
  h.profile.monorepo ? 'monorepo' : null,
].filter(Boolean);
const dsUnrecognised = !dsChip && !noSystemLikely;
const legacyChip = ns?.others?.length ? `also present: ${ns.others.map((l) => `--${l}-*`).join(', ')}` : null;

// User exclusions are printed in the header, never hidden: a scoped scan must
// say it is scoped, or the score could be quietly gamed. Grouped by source
// (.roastignore vs --exclude), with the total number of files kept out.
function exclusionsLine() {
  const patterns = h.exclusions?.patterns ?? [];
  if (!patterns.length) return '';
  const sources = [...new Set(patterns.map((p) => p.source))];
  const parts = sources.map((src) => {
    const own = patterns.filter((p) => p.source === src);
    const list = own.map((p) => `<span class="mono">${esc(p.pattern)}/</span>`).join(', ');
    return `${own.length} ${own.length === 1 ? 'folder' : 'folders'} excluded by ${esc(src)} (${list})`;
  });
  const total = h.exclusions.filesExcluded ?? 0;
  return `<div class="excl">${parts.join(' · ')} · ${n(total)} files kept out of this scan</div>`;
}

const html = `<!doctype html>
<html lang="en" data-theme="${themeName}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design-system diagnosis:${nsMark} ${esc(repoName)}</title>
<meta name="author" content="Greg Kozakiewicz · gregkozakiewicz.com">
<link rel="icon" type="image/png" sizes="32x32" href="${GK_MARK}">
<link rel="icon" type="image/png" sizes="192x192" href="data:image/png;base64,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">
<link rel="apple-touch-icon" href="data:image/png;base64,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">
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
  /* agent-written analysis (--notes): same glass, but an accent spine and a
     written-by label keep prose visibly apart from measurement */
  .notes-sec { border-left:3px solid var(--accent); }
  .notes-sec .sec-head .eyebrow { margin-bottom:6px; }
  .notes-body { display:flex; flex-direction:column; gap:14px; margin-top:10px;
    font-size:15px; line-height:1.65; color:var(--text); }
  .notes-body ul { margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px; }
  .notes-body .mono { font-family:var(--mono); font-size:.92em; }
  .notes-body h3 { font:600 16px/1.3 var(--disp); letter-spacing:-.01em; margin-top:8px; }
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
  .score.muted .val { opacity:.35; }
  .score.muted .note { font-size:12px; color:var(--dim); margin-top:2px; }
  .score .val .slash { color:var(--accent); }
  .score .val .of { font-size:26px; color:var(--dim); font-weight:600; }

  .chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
  .chip { border:1px solid var(--line); background:var(--card); border-radius:99px;
    padding:4px 12px; font:500 11.5px/1.5 var(--sans); color:var(--text); }
  .chip-agent { background:var(--text); color:var(--bg); border-color:var(--text); font-weight:600; }
  .excl { margin-top:10px; font:500 12px/1.6 var(--sans); color:var(--dim); }
  .excl .mono { font-size:11.5px; color:var(--text); }
  .stale { margin-top:18px; }
  .chip-xs { display:inline-block; border:1px solid var(--line); background:var(--chip-bg); border-radius:99px;
    padding:1px 8px; font:500 10px/1.6 var(--mono); color:var(--text); }

  .nods { display:flex; gap:12px; align-items:flex-start; background:var(--nods-bg); border:1px solid var(--nods-line);
    border-radius:16px; padding:14px 16px; margin-top:20px; font-size:14px; }
  .nods .ic { position:static; flex-shrink:0; width:22px; height:22px; }
  .trap { display:flex; gap:11px; align-items:flex-start; background:var(--coral-soft); border:1px solid var(--bad-ring);
    border-radius:14px; padding:12px 14px; margin-top:16px; font-size:13px; line-height:1.6; color:var(--dim); }
  .trap b { color:var(--coral); font-weight:700; letter-spacing:.02em; }
  .trap .ic { position:static; flex-shrink:0; width:18px; height:18px; margin-top:2px; }

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

  .start-row { align-items:flex-start; }
  .start-body { min-width:0; }
  .start-title { font:600 15px/1.4 var(--disp); }
  .start-row .sub { margin-top:2px; overflow-wrap:anywhere; }
  .start-actions { display:flex; align-items:center; gap:10px; margin-top:10px; }
  .fixbtn { font:700 11.5px/1 var(--sans); padding:8px 13px; border-radius:8px; border:1px solid var(--accent);
    background:transparent; color:var(--accent); cursor:pointer; }
  .fixbtn:hover { background:var(--ok-soft); }
  .fixbtn.did { background:var(--accent); color:var(--card-solid); }
  .fixhint { color:var(--dim2); font-size:11.5px; }
  .fixview { font:inherit; color:var(--dim); background:none; border:none; padding:0; cursor:pointer;
    text-decoration:underline; text-underline-offset:3px; }
  .fixview:hover { color:var(--accent); }
  .fixprompt.shown { display:block; white-space:pre-wrap; font:12px/1.6 var(--mono); color:var(--dim);
    border:1px solid var(--line); border-radius:10px; padding:12px 14px; margin-top:10px;
    user-select:all; -webkit-user-select:all; }
  @media print { .start-actions { display:none; } }

  .pill { border-radius:99px; padding:3px 10px; font:500 10.5px/1.5 var(--sans); white-space:nowrap; }
  .pill-mint { background:var(--ok-soft); color:var(--ok); }
  .pill-coral { background:var(--coral-soft); color:var(--coral); }
  .pill-amber { background:var(--amber-soft); color:var(--amber); }

  /* value receipts */
  .receipts { margin-top:18px; }
  .chips-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
  .vchip { font:11.5px var(--mono); color:var(--text); border:1px solid var(--line); background:var(--chip-bg);
    border-radius:99px; padding:2px 10px; }
  .vchip.bad { color:var(--coral); border-color:var(--coral-soft); background:var(--coral-soft); }
  .vchip.dim { color:var(--dim2); }
  .chip-dim { opacity:.6; font-style:italic; }
  .st-na .num { color:var(--dim2); }
  .ic-na { stroke:var(--dim2); }
  .amap { width:100%; height:auto; display:block; margin:10px 0 4px; }
  .atile { fill:var(--ok-soft); stroke:var(--bg, #0f172a); stroke-width:2; }
  .orow { display:flex; align-items:baseline; gap:12px; margin-top:8px; }
  .orow .oyear { flex:0 0 150px; font:600 10.5px var(--mono); color:var(--coral);
    letter-spacing:.08em; text-transform:uppercase; text-align:right; }
  .orow .chips-row { margin-top:0; }
  .atile:hover { fill:var(--hover-ring); }
  .adot-n { fill:var(--text); font:600 12.5px var(--mono); text-anchor:middle; }
  .adot-n.s { font-size:10.5px; fill:var(--dim); }
  .adot-c { fill:var(--dim); font:500 10.5px var(--mono); text-anchor:middle; }

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
  .foot-sub .feedback { color:var(--accent); font-weight:700; text-decoration:none; }
  .foot-sub .feedback:hover { text-decoration:underline; }
  .foot-sub .pulse { width:14px; height:14px; vertical-align:-3px; margin-right:5px; fill:none;
    stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  /* The line traces itself and sweeps out, like a heart monitor. 46 is the
     polyline's own length, so the dash covers it exactly. */
  .foot-sub .pulse polyline { stroke-dasharray:46; animation:pulse-trace 3.4s cubic-bezier(.5,0,.5,1) infinite; }
  @keyframes pulse-trace { 0% { stroke-dashoffset:46; } 55% { stroke-dashoffset:0; } 100% { stroke-dashoffset:-46; } }
  @media (prefers-reduced-motion: reduce) {
    .foot-sub .pulse polyline { animation:none; stroke-dashoffset:0; }
  }
  .scan-id { font-family:var(--mono); font-size:11px; letter-spacing:.04em; }
  footer .brand { color:var(--accent); font-weight:700; text-decoration:none; }
  footer .brand:hover { text-decoration:underline; }
  footer .creds { display:flex; gap:16px; font:700 9.5px/1.6 var(--sans); letter-spacing:.16em; text-transform:uppercase; color:var(--dim2); }
  .pkg-score { display:inline-block; min-width:38px; text-align:center; font:700 12.5px/1 var(--sans);
    padding:6px 8px; border-radius:8px; }
  .pkg-good { background:var(--ok-soft); color:var(--ok); }
  .pkg-warn { background:var(--amber-soft); color:var(--amber); }
  .pkg-bad { background:var(--coral-soft); color:var(--coral); }
  .pkg-quiet { font:600 11.5px/1.3 var(--sans); color:var(--dim2); letter-spacing:.02em; }
  .spec { margin-top:18px; }
  .spec-rows { display:grid; gap:2px; margin-top:8px; }
  .spec-type { display:flex; align-items:baseline; gap:16px; padding:5px 0; border-bottom:1px solid var(--line-soft); }
  .spec-type:last-child { border-bottom:0; }
  .spec-val { font:600 11px/1.4 var(--mono); color:var(--dim2); min-width:104px; flex-shrink:0; }
  .spec-sample { color:var(--text); line-height:1.15; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    font-family:var(--disp); letter-spacing:-.01em; }
  .spec-more { font:600 10.5px/1 var(--mono); color:var(--dim2); margin-top:10px; }
  .spec-grid { display:flex; flex-wrap:wrap; gap:16px; margin-top:12px; }
  .spec-cell { display:grid; gap:7px; justify-items:center; }
  .spec-box { width:46px; height:46px; background:var(--deep); box-shadow:inset 0 0 0 1px var(--cell-ring); }
  .spec-shadows { background:#f2f2f5; border-radius:14px; padding:20px 18px 14px; gap:22px; }
  .spec-card { width:84px; height:50px; border-radius:10px; background:#ffffff; }
  .spec-shadows .spec-cap { color:#71718a; max-width:104px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .spec-cap { font:500 10.5px/1 var(--mono); color:var(--dim2); }
  .start-head { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .delta { font:700 11px/1 var(--sans); letter-spacing:.04em; padding:5px 9px; border-radius:99px;
    background:var(--ok-soft); color:var(--ok); white-space:nowrap; }
  .delta-target { background:var(--amber-soft); color:var(--amber); font-weight:600; }
  .proj { color:var(--accent); font-weight:700; }
  .ndot { display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:4px; vertical-align:-1px; box-shadow:inset 0 0 0 1px var(--cell-ring); }
  .nsim { color:var(--dim2); font-weight:400; padding:0 2px; }
  .gift-sec { margin-top:16px; }
  .gift-stage { position:relative; display:grid; place-items:center; min-height:120px; }
  .gift-stage.open { min-height:0; }
  .gift[hidden] { display:none; }
  .gift { position:relative; background:none; border:0; cursor:pointer; display:grid; place-items:center; gap:9px; padding:14px; color:var(--dim);
    transition:transform .25s ease, opacity .25s ease, filter .25s ease; }
  .gift svg { width:72px; height:72px; }
  .gift .ribbon { stroke:var(--accent); }
  .gift:hover { transform:translateY(-3px) scale(1.04); color:var(--text); }
  .gift.gone { transform:scale(.5); opacity:0; filter:blur(5px); }
  .gift-hint { font:700 10px/1 var(--sans); letter-spacing:.18em; text-transform:uppercase; }
  .gift::after { content:'your agent rules file, generated from this scan'; position:absolute; top:100%; left:50%;
    transform:translateX(-50%); white-space:nowrap; font:400 11.5px/1 var(--sans); letter-spacing:0; text-transform:none;
    color:var(--dim2); opacity:0; transition:opacity .3s ease .6s; pointer-events:none; }
  .gift:hover::after { opacity:1; }
  .gift.gone::after { opacity:0; transition:none; }
  .gift-pop { position:absolute; inset:0; pointer-events:none; }
  .gift-pop i { position:absolute; left:50%; top:42%; width:7px; height:10px; border-radius:2px; opacity:0;
    animation:gpop .85s cubic-bezier(.16,.8,.32,1) forwards; }
  @keyframes gpop { 0% { opacity:1; transform:translate(0,0) rotate(0); } 100% { opacity:0; transform:translate(var(--dx),var(--dy)) rotate(var(--rot)); } }
  .gift-reveal { width:100%; }
  .gift-reveal.in { animation:greveal .5s ease both; }
  @keyframes greveal { from { opacity:0; transform:translateY(8px) scale(.985); } to { opacity:1; transform:none; } }
  .gift-head { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; margin-bottom:10px; }
  .gift-count { color:var(--dim2); font-size:12.5px; }
  .gift-md { max-height:340px; overflow:auto; background:var(--chip-bg); border:1px solid var(--line-soft); border-radius:12px;
    padding:16px 18px; font:12px/1.7 var(--mono); color:var(--dim); white-space:pre-wrap; }
  .gift-actions { display:flex; gap:10px; margin-top:12px; flex-wrap:wrap; }
  .gbtn { font:700 12.5px/1 var(--sans); padding:11px 16px; border-radius:10px; border:1px solid var(--accent);
    background:var(--accent); color:var(--card-solid); cursor:pointer; }
  .gbtn:hover { filter:brightness(1.08); }
  .gbtn.ghost { background:transparent; color:var(--accent); }
  .gift-sub { color:var(--dim2); font-size:12.5px; margin-top:10px; }
  @media print { .gift, .gift-pop { display:none !important; } .gift-reveal[hidden] { display:block !important; } }
  @media (prefers-reduced-motion: reduce) { .gift, .gift-reveal.in, .gift-pop i { transition:none !important; animation:none !important; } }
  .author { color:var(--accent); font-weight:700; text-decoration:none; }
  .gk-mark { display:inline-block; width:15px; height:15px; margin-right:5px; vertical-align:-3px;
    background:currentColor; -webkit-mask:url(${GK_MASK}) center/contain no-repeat; mask:url(${GK_MASK}) center/contain no-repeat; }
  .author:hover { text-decoration:underline; }
</style>
<!-- rmds-schema: ${NS_TAG} -->
</head><body>
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
      <div class="meta"><span class="mono">${esc(repoName)}</span> · scanned ${esc((h.harvestedAt ?? '').slice(0, 10))}${commissionedBy ? ` · commissioned by ${esc(commissionedBy)}` : ''}</div>
    </div>
    ${healthScore !== null ? `<div class="score${noSystemLikely ? ' muted' : ''}">${eyebrow('Health score')}<div class="val">${healthScore}<span class="slash">/</span><span class="of">100</span></div>${noSystemLikely ? '<div class="note">little here to score · see the note below</div>' : ''}</div>` : ''}
  </div>
  <div class="chips">${stack.map((s) => `<span class="chip">${esc(s)}</span>`).join('')}${dsUnrecognised ? '<span class="chip chip-dim">design system: unrecognised</span>' : ''}${legacyChip ? `<span class="chip chip-dim">${esc(legacyChip)}</span>` : ''}${agentFiles.map((c) => `<span class="chip chip-agent">${esc(c.file)}</span>`).join('')}</div>
  ${exclusionsLine()}
  ${noSystemLikely ? `<div class="nods">${ICONS.warn}<span>There is most likely <b>no design system in this repo</b>: almost no colour or spacing values were found. Styling may live outside this codebase (CDN stylesheets, a parent repo, or generated output).</span></div>` : ''}
  <div class="glass verdict-card">
    <div class="blob b1"></div><div class="blob b2"></div>
    ${eyebrow('Summary')}
    <div class="verdict">${esc(verdict)}</div>
  </div>
</header>

${notesSection()}

${extraSectionsHtml()}

${whereToStartSection()}

${giftSection()}

${trapsBlock()}

<div class="stats">${bigStats.map((s) => statTile(s)).join('')}</div>

${packagesSection()}

${agentSection()}

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
    <div>Generated by <a class="brand" href="https://github.com/gregkozakiewicz/roast-my-design-system">roast-my-design-system</a> <span class="ver">ver. ${VERSION}</span>, free on npm and as a Claude Code + Codex skill</div>
    <div class="foot-sub">Designed and built by <a class="author" href="https://gregkozakiewicz.com/?utm_source=roast-report"><span class="gk-mark"></span>Greg Kozakiewicz</a> · <span class="scan-id" title="scan id">${scanId}</span> · ${FEEDBACK_ASK} <a class="feedback" href="${feedbackUrl(VERSION).replace(/&/g, '&amp;')}">${PULSE_ICON}${FEEDBACK_CTA}</a></div>
  </div>
  <span class="creds"><span>Non-destructive scan</span><span>Read-only</span><span>Paths are real</span></span>
</footer>
<script>
(function(){
  var gift=document.getElementById('gift'); if(!gift) return;
  var reveal=document.getElementById('gift-reveal'), pop=document.getElementById('gift-pop');
  var reduce=window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  gift.addEventListener('click', function(){
    if(!reduce && pop){
      var colors=['var(--accent)','var(--coral)','var(--amber)','var(--text)'];
      for(var i=0;i<26;i++){
        var f=document.createElement('i');
        var a=Math.random()*Math.PI*2, v=46+Math.random()*84;
        f.style.setProperty('--dx',(Math.cos(a)*v)+'px');
        f.style.setProperty('--dy',(Math.sin(a)*v-56)+'px');
        f.style.setProperty('--rot',(Math.random()*540-270)+'deg');
        f.style.background=colors[i%4];
        f.style.animationDelay=(Math.random()*80)+'ms';
        pop.appendChild(f);
      }
      setTimeout(function(){ pop.innerHTML=''; },1000);
    }
    gift.classList.add('gone');
    setTimeout(function(){ gift.hidden=true; gift.parentNode.classList.add('open'); reveal.hidden=false; reveal.classList.add('in'); }, reduce?0:240);
  },{once:true});
  document.querySelectorAll('.fixbtn').forEach(function(btn){
    btn.addEventListener('click', function(){
      var holder=document.getElementById('fixprompt-'+btn.getAttribute('data-fix'));
      if(!holder) return;
      var text=holder.textContent;
      var done=function(){ btn.textContent='Copied'; btn.classList.add('did'); setTimeout(function(){ btn.textContent='Copy the fix prompt'; btn.classList.remove('did'); },1600); };
      // No faked success: if the clipboard is blocked (sandboxed previews,
      // strict browsers), unfold the prompt for manual copying instead.
      var showManual=function(){ holder.hidden=false; holder.classList.add('shown'); btn.textContent='Clipboard blocked, prompt shown below'; setTimeout(function(){ btn.textContent='Copy the fix prompt'; },2600); };
      var attempt=function(){ var okd=false; var ta=document.createElement('textarea'); ta.value=text;
        ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta);
        ta.focus(); ta.select(); try{ okd=document.execCommand('copy'); }catch(e){} ta.remove(); return okd; };
      if(navigator.clipboard && navigator.clipboard.writeText){
        // If the modern API rejects, the environment is blocking clipboards
        // and execCommand's return value cannot be trusted either (sandboxed
        // panes return true while writing nothing): attempt it, then show the
        // prompt anyway so the reader is never stranded.
        navigator.clipboard.writeText(text).then(done, function(){ attempt(); showManual(); });
      }
      else { attempt()?done():showManual(); }
    });
  });
  document.querySelectorAll('.fixview').forEach(function(v){
    v.addEventListener('click', function(){
      var holder=document.getElementById('fixprompt-'+v.getAttribute('data-fix'));
      if(!holder) return;
      var show=holder.hidden;
      holder.hidden=!show; holder.classList.toggle('shown', show);
      v.textContent=show?'hide it':'view it first';
    });
  });
  var copyBtn=document.getElementById('gift-copy');
  function rulesText(){ return document.getElementById('gift-md').textContent; }
  copyBtn.addEventListener('click', function(){
    var done=function(){ copyBtn.textContent='Copied'; setTimeout(function(){ copyBtn.textContent='Copy the rules'; },1600); };
    var fallback=function(){ var ta=document.createElement('textarea'); ta.value=rulesText(); document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); }catch(e){} ta.remove(); };
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(rulesText()).then(done, function(){ fallback(); done(); }); }
    else { fallback(); done(); }
  });
  document.getElementById('gift-dl').addEventListener('click', function(){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([rulesText()],{type:'text/markdown'}));
    a.download='design-system-rules.md';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },400);
  });
})();
</script>
</div></body></html>`;

writeFileSync(outPath, html);

// Machine-readable summary for wrappers (the npx CLI reads this instead of
// parsing the HTML): --summary <path> writes score, verdict and per-tile health.
const summaryPath = arg('summary', null);
if (summaryPath) {
  writeFileSync(resolve(summaryPath), JSON.stringify({
    repo: repoName,
    version: VERSION,
    ...(commissionedBy ? { commissionedBy } : {}),
    ...(notesText ? { notesEmbedded: true } : {}),
    ...(extraSections.length ? { sectionsEmbedded: extraSections.map((s) => s.title) } : {}),
    ...(h.exclusions ? { exclusions: h.exclusions } : {}),
    score: healthScore,
    noSystemLikely,
    verdict,
    role: h.profile?.role ?? 'product',
    componentsMeasured,
    tiles: bigStats.map((s) => ({ label: s.label, value: s.num, health: s.health })),
    ...(startMoves.length ? { moves: startMoves } : {}),
    packages: (h.packages ?? []).filter((p) => p.scored && p.metrics)
      .map((p) => ({ dir: p.dir, name: p.name, ...(scorePackage(p.metrics) ?? {}) }))
      .filter((p) => p.score !== undefined)
      .sort((a, b) => a.score - b.score),
    report: outPath,
  }, null, 2));
}

console.log(`✓ Diagnosis for ${repoName}`);
if (healthScore !== null) console.log(`  score: ${healthScore}/100`);
console.log(`\n  Verdict: ${verdict}`);
console.log(`  Your free report is here → ${outPath}`);
