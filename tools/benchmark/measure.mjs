/**
 * One measurer for every benchmark builder: a repo (or a scoped folder of
 * one) is read by the scan's own harvest, and its numbers are the numbers
 * the report compares, taken from the same functions the score uses.
 *
 * Until 10.0.0 each builder recomputed the metrics by hand from the raw
 * harvest calls, and drifted from the scan: the builders did not skip email
 * templates, counted greys another way and read nothing of the kit or
 * palette checks (found 2026-10-01). The yardstick must count like the ruler
 * it is held against, so this file does not count at all: it runs
 * harvest/index.mjs and asks diagnose/score.mjs.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { coreMetrics } from '../../skills/roast-my-design-system/scripts/diagnose/score.mjs';
import { profileOf } from '../../skills/roast-my-design-system/scripts/profiles/index.mjs';
import { distinctTypefaces } from '../../skills/roast-my-design-system/scripts/lib/typefaces.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HARVEST = resolve(HERE, '../../skills/roast-my-design-system/scripts/harvest/index.mjs');

/**
 * Run the scan's harvest on `root` and return { h, P, metrics }: the harvest,
 * its profile view, and the benchmark row's metrics. The general metrics are
 * coreMetrics as the score reads them; the typography and shape counts are
 * the report's own formulas; `components` is the reusable count.
 */
export function measure(root) {
  const tmp = mkdtempSync(join(tmpdir(), 'roast-bench-'));
  const out = join(tmp, 'harvest.json');
  try {
    const r = spawnSync(process.execPath, [HARVEST, root, '--out', out], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'harvest failed').trim().split('\n').pop());
    const h = JSON.parse(readFileSync(out, 'utf8'));
    const P = profileOf(h);
    const m = coreMetrics(h);
    const t = h.tokens ?? {};
    const metrics = {
      colors: m.colors,
      greys: m.greys,
      spacing: m.spacing,
      typefaces: distinctTypefaces(t.fontFamilies ?? []).length,
      fontSizes: (t.fontSizes ?? []).length + (t.tailwind?.textSizes ?? []).length,
      radii: (t.radii ?? []).length + (t.tailwind?.radii ?? []).length,
      shadows: (t.shadows ?? []).length,
      exactDuplicates: m.exactDuplicates,
      inlineStyles: m.inlineStyles,
      arbitrary: m.arbitrary,
      nearPairs: m.nearPairs,
      important: m.important,
      neverImported: m.neverImported,
      components: (h.components ?? []).filter((c) => !c.isPage).length,
      // the tiles only some kinds measure; a builder keeps the ones its kind has
      paintTin: m.paintTin,
      doorOverrides: m.doorOverrides,
      kitColour: m.kitColour,
      kitPx: m.kitPx,
    };
    return { h, P, metrics };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** The clone folder for org/repo under `clonesDir`: repo, repo lowercased, or org-repo. */
export function cloneDir(clonesDir, full, present) {
  const name = full.split('/')[1];
  return [name, name.toLowerCase(), full.replace('/', '-')].find((d) => present.has(d)) ?? null;
}
