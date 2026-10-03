/**
 * Last-touched dates for component files, from git history. The receipt on
 * the adoption map's orphans: "never imported" is an accusation, "never
 * imported, untouched since 2024-03-14" is a case. Scoped to the files the
 * caller passes (orphans only today) and capped, so a huge repo cannot stall
 * the scan on git calls. Outside a git repo, or without git installed, it
 * returns nothing and the report simply makes no date claims.
 */
import { spawnSync } from 'node:child_process';

export function lastTouchedDates(root, files, cap = 40) {
  const out = {};
  for (const f of files.slice(0, cap)) {
    const r = spawnSync('git', ['log', '-1', '--format=%cs', '--', f],
      { cwd: root, encoding: 'utf8', timeout: 5000 });
    if (r.status === 0) {
      const d = r.stdout.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) out[f] = d;
    }
  }
  return out;
}
