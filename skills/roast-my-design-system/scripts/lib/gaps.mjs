/**
 * Where agents will invent. The September 2026 runs (164 sessions, 10 real
 * products) showed agents copying what a repo already has and inventing only
 * where the design system has no answer: a theme, a chart. A gap is a place
 * where the next piece of UI, human or agent, has nothing to reuse, so the
 * report names it before the invention happens. Every gap carries the files
 * that prove it and the one move that closes it.
 *
 * A gap is admitted only after a fleet probe says it discriminates: it must
 * be common enough to matter and absent often enough to be a finding.
 * Chart palettes (probe of 126 repos, 2026-09-25): charts in three quarters,
 * a palette in a quarter, 44 repos painting series by hand with no palette.
 *
 * Probed the same day and left out, so the next session does not re-run it:
 *   - tokens without a dark value: 32 of the 49 dark-mode repos, median 29%
 *     of tokens, but a token not restated in .dark is usually a deliberate
 *     mode-invariant colour, so the innocent explanation wins;
 *   - no radius, shadow or font-size scale: only 7 repos style without
 *     Tailwind or a kit, and none of them lacks a scale, so it never fires;
 *   - no status colours (success, warning, danger): missing in two thirds
 *     of repos, and the agent runs showed no drift on a new status.
 */
import { chartTier } from './charts.mjs';

const list = (xs, max = 3) => `${xs.slice(0, max).join(', ')}${xs.length > max ? ` and ${xs.length - max} more` : ''}`;

/**
 * @param charts   from chartSystemOf (lib/charts.mjs)
 * @param tokenFile where the repo keeps its colour tokens, or null
 * @returns [{ id, title, detail, fix, files, weight }] most pressing first
 */
export function designGaps({ charts = null, tokenFile = null } = {}) {
  const gaps = [];
  if (charts && chartTier(charts) === 2 && charts.precedents.length) {
    const p = charts.precedents;
    const colours = p.reduce((s, x) => s + x.count, 0);
    const shadcn = charts.palette?.shadcnDefault ? charts.palette : null;
    gaps.push({
      id: 'chart-palette',
      title: shadcn ? 'The chart palette exists and no chart reads it' : 'Charts have no palette',
      detail: `${p.length} chart file${p.length === 1 ? '' : 's'} paint${p.length === 1 ? 's' : ''} ${colours} series colours by hand (${list(p.map((x) => `${x.file} (${x.count})`))})${shadcn ? `, while ${shadcn.file} already defines --chart-1 to --chart-5` : ', and no token names a chart colour'}. The next chart will invent colours ${colours + 1} to ${colours + 6}, because that is what every chart here did.`,
      fix: shadcn
        ? `Point ${p.length === 1 ? 'that chart' : 'the existing charts'} at var(--chart-1) to var(--chart-5), then the next chart has a palette to read.`
        : `Name the series once (--chart-1, --chart-2 … in ${tokenFile ?? 'the theme'}) and point ${p.length === 1 ? 'that chart' : 'the existing charts'} at them. From then on a chart that writes a colour by hand is a finding the checks catch.`,
      files: p.slice(0, 5).map((x) => x.file),
      weight: Math.min(60, 20 + colours),
    });
  }
  return gaps.sort((a, b) => b.weight - a.weight);
}
