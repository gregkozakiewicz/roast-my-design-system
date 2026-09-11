/**
 * Score — the arithmetic behind the number in the hero, on its own so it can
 * be imported (a guard, a CI step, any tool comparing two scans) without
 * rendering a page. The report imports this; nothing here knows about HTML.
 *
 * One harvest.json in, one plain object out:
 *   { schemaVersion, benchmark, metrics, tiles, score }
 *
 * The rules of the game, in one place:
 *   - Each metric is judged against the Ideal Design System target and the
 *     scanned-fleet median. good = at or under the ideal; warn = over the
 *     ideal but no worse than the median (or 1.5x the ideal when the median
 *     is missing or sits under the ideal); bad = worse than that.
 *   - Zero-ideal metrics (duplicates, inline styles, twins, !important,
 *     orphans): 0 is good, a small tolerance is warn, beyond it bad.
 *   - The score is the scored tiles averaged: good 100, warn 55, bad 10.
 *   - Token-led repos are judged on their strays, not their totals, because
 *     a palette held as tokens is the architecture the ideal asks for.
 *   - A metric the detector could not measure ('na') and a metric that is
 *     shown but deliberately unscored ('info') take no part in the average.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGrey } from '../lib/color.mjs';
import { nearColorPairs } from '../lib/nearpairs.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';
import { SCHEMA_VERSION } from '../lib/version.mjs';

export { SCHEMA_VERSION };

// The benchmark (Ideal Design System norms + scanned-repo stats) ships next
// to the code so everything works offline; degrade gracefully when absent.
const BENCH_PATH = join(dirname(fileURLToPath(import.meta.url)), '../benchmark/benchmark.json');
export function loadBenchmark() {
  return existsSync(BENCH_PATH) ? JSON.parse(readFileSync(BENCH_PATH, 'utf8')) : null;
}

/** The yardstick readers for one benchmark object (null-safe). */
export function benchHelpers(bench) {
  // where does this value sit among the scanned fleet? ("more colours than 90%")
  const percentile = (metric, value) => {
    const vals = bench?.stats?.[metric]?.values;
    if (!vals?.length) return null;
    return Math.round((vals.filter((v) => v < value).length / vals.length) * 100);
  };
  // the flattering twin: what share of the fleet is messier than you
  const cleanerPct = (metric, value) => {
    const vals = bench?.stats?.[metric]?.values;
    if (!vals?.length) return null;
    return Math.round((vals.filter((v) => v > value).length / vals.length) * 100);
  };
  const ideal = (metric) => bench?.ideal2026?.[metric]?.value ?? null;
  const median = (metric) => bench?.stats?.[metric]?.median ?? null;
  // A zero median reads as broken data ("Avg: 0 typefaces") when it means
  // "the median repo declares none". Fall back to the fleet mean there; it
  // stays an honest "Avg" and only zeroes out if literally every repo does.
  const displayAvg = (metric) => {
    const mv = median(metric);
    if (mv === null) return null;
    if (mv !== 0) return mv;
    const vals = bench?.stats?.[metric]?.values ?? [];
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return mean >= 0.5 ? Math.round(mean) : null;
  };
  const refMedian = (metric) => bench?.referenceSystems?.stats?.[metric]?.median ?? null;
  return { percentile, cleanerPct, ideal, median, displayAvg, refMedian };
}

export const ZERO_IDEAL = new Set(['exactDuplicates', 'inlineStyles', 'nearPairs', 'important', 'neverImported']);
export const WARN_TOLERANCE = { exactDuplicates: 2, inlineStyles: 10, nearPairs: 2, important: 5, neverImported: 2 };
export const SCORE_OF = { good: 100, warn: 55, bad: 10 };

/** healthOf(metric, value) for one benchmark: 'good' | 'warn' | 'bad' | 'info'. */
export function makeHealthOf(b) {
  return (metric, value) => {
    const iv = b.ideal(metric);
    if (iv === null) return 'info';
    if (ZERO_IDEAL.has(metric)) {
      if (value === 0) return 'good';
      return value <= WARN_TOLERANCE[metric] ? 'warn' : 'bad';
    }
    if (value <= iv) return 'good';
    const mv = b.median(metric);
    const warnCap = mv && mv > iv ? mv : iv * 1.5;
    if (value <= warnCap) return 'warn';
    return 'bad';
  };
}

/** The tiles, in report order: metric key, the label the report prints. */
export const TILES = [
  ['colors', 'distinct colours'],
  ['greys', 'shades of grey'],
  ['spacing', 'off-scale spacing values'],
  ['exactDuplicates', 'duplicated components'],
  ['inlineStyles', 'inline style blocks'],
  ['nearPairs', 'near-identical colour pairs'],
  ['important', '!important declarations'],
  ['neverImported', 'components never imported'],
  ['arbitrary', 'arbitrary bracket values'],
];

/**
 * The numbers every judgement rests on, read once from a harvest. Plain
 * integers and flags; the same formulas the per-package pass uses.
 */
export function coreMetrics(h) {
  const colors = h.tokens?.colors ?? [];
  const greys = colors.filter((c) => isGrey(c.value));
  const colorTokens = colors.filter((c) => c.isToken).length;
  const colorStrays = colors.length - colorTokens;
  const spacing = h.tokens?.spacing ?? [];
  const twSpacing = h.tokens?.tailwind?.spacing ?? [];
  const hardDupes = (h.duplicates?.exactDuplicates ?? []).filter((d) => !d.wrapped);
  return {
    colors: colors.length,
    colorTokens,
    colorStrays,
    // Token-led repos hold most colours as deliberate CSS-variable tokens;
    // judging them on the total punishes the architecture the ideal asks for.
    tokenLed: colorTokens >= colorStrays && colorTokens > 0,
    greys: greys.length,
    greyStrays: greys.filter((c) => !c.isToken).length,
    // Off-scale spacing only: CSS-declared values plus bracket utilities.
    // Many steps of the sanctioned Tailwind scale is health, not sprawl.
    spacing: spacing.length + twSpacing.filter((v) => v.value.startsWith('[')).length,
    // A wrapped pair (one file imports the name from the other) is
    // composition, not competition: listed with a badge, never counted.
    exactDuplicates: hardDupes.length,
    inlineStyles: h.tokens?.inlineStyles?.count ?? 0,
    nearPairs: nearColorPairs(colors).length,
    important: h.tokens?.important?.count ?? 0,
    neverImported: neverImportedComponents(h.components, h.profile?.uiDir).length,
    arbitrary: (h.tokens?.tailwind?.arbitrary ?? []).reduce((sum, a) => sum + a.count, 0),
    // Measurability and role, decided by the harvest: an unreadable stack
    // takes no score credit; a library's orphans are shown, not judged; a
    // vendored shadcn catalogue is stock on a shelf, not abandonment.
    componentsMeasured: h.profile?.componentDetection?.measured !== false,
    isLibrary: h.profile?.role === 'library',
    vendoredUi: h.profile?.vendoredUi === true,
  };
}

/**
 * Judge the nine tiles from a metric set. Each tile carries the value shown,
 * the value judged (strays for token-led colour tiles), and its health.
 */
export function tileHealths(m, healthOf) {
  const shown = {
    colors: m.colors, greys: m.greys, spacing: m.spacing, exactDuplicates: m.exactDuplicates,
    inlineStyles: m.inlineStyles, nearPairs: m.nearPairs, important: m.important,
    neverImported: m.neverImported, arbitrary: m.arbitrary,
  };
  const judged = { ...shown, colors: m.tokenLed ? m.colorStrays : m.colors, greys: m.tokenLed ? m.greyStrays : m.greys };
  return TILES.map(([metric, label]) => {
    let health = healthOf(metric, judged[metric]);
    let value = shown[metric], healthValue = judged[metric];
    if (!m.componentsMeasured && (metric === 'exactDuplicates' || metric === 'neverImported')) {
      health = 'na'; value = null; healthValue = null;
    } else if (metric === 'neverImported' && (m.isLibrary || (m.vendoredUi && m.neverImported > 0))) {
      health = 'info';
    }
    return { metric, label, value, healthValue, health };
  });
}

/** The scored tiles averaged (good 100 / warn 55 / bad 10); null when none. */
export function scoreOfTiles(tiles) {
  const scored = tiles.filter((t) => t.health in SCORE_OF);
  return scored.length ? Math.round(scored.reduce((sum, t) => sum + SCORE_OF[t.health], 0) / scored.length) : null;
}

/** A package's score and its worst finding from its harvested metrics. */
export function scorePackage(m, healthOf, b) {
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
  const over = (r) => { const iv = b.ideal(r.metric); return iv ? r.value / Math.max(iv, 1) : r.value; };
  const worst = scored.filter((r) => r.health === 'bad').sort((a, b2) => over(b2) - over(a))[0]
    ?? scored.filter((r) => r.health === 'warn').sort((a, b2) => over(b2) - over(a))[0];
  return { score, worst };
}

/** The whole judgement of one harvest, as data. */
export function scoreHarvest(h, bench = loadBenchmark()) {
  const b = benchHelpers(bench);
  const healthOf = makeHealthOf(b);
  const metrics = coreMetrics(h);
  const tiles = tileHealths(metrics, healthOf);
  return {
    schemaVersion: SCHEMA_VERSION,
    // A rebuilt ruler moves every score with no change in the repo, so a
    // history must know which ruler each scan was measured with.
    benchmark: bench ? { builtAt: bench.builtAt, repoCount: bench.repoCount, referenceSystems: bench.referenceSystems?.count ?? 0 } : null,
    metrics,
    tiles,
    score: scoreOfTiles(tiles),
  };
}
