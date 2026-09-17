/**
 * What every kit profile shares: the recognise() shape and the registry the
 * report, the rules file and the fix prompts read a kit's own words from.
 * Each kit keeps its detection and its advice in its own file (mui.mjs,
 * mantine.mjs); a kit's idioms differ (MUI styles through sx, Mantine
 * through props and CSS modules), and the advice has to name them.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { countKitPaint } from '../lib/kitpaint.mjs';

// enough use to call it the kit the product is built on (Mattermost lists
// MUI and imports it in 10 of 5,737 files, 2026-09-17)
const MIN_FILES = 30;

const readSafe = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/** kit name -> its definition, for the report, rules and prompts */
export const KITS = {};

// How many files import each registered kit, read once per repo. A repo
// belongs to the kit it imports most: Stirling-PDF imports MUI in 85 files
// and Mantine in 641 (2026-09-17).
const importCache = new Map();
function importCounts(root, codeFiles) {
  const key = `${root}\0${codeFiles.length}`;
  if (importCache.has(key)) return importCache.get(key);
  const counts = Object.fromEntries(Object.keys(KITS).map((k) => [k, 0]));
  for (const f of codeFiles) {
    if (!/\.[jt]sx?$/.test(f)) continue;
    const src = readSafe(join(root, f));
    for (const [k, d] of Object.entries(KITS)) if (d.importRe.test(src)) counts[k] += 1;
  }
  importCache.set(key, counts);
  return counts;
}

export function kitProfile(def) {
  KITS[def.name] = def;
  const depRe = new RegExp(`"(?:${def.packages.map((p) => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})"`);
  return {
    kind: def.kind,
    recognise(profile, counts, ctx) {
      if (!ctx?.root || !ctx?.files) return null;
      // a cheap gate before reading every file: the dependency is somewhere
      const listed = def.packages.includes(profile.designSystem?.pkg)
        || (ctx.files.other ?? []).some((f) => f.endsWith('package.json') && depRe.test(readSafe(join(ctx.root, f))));
      if (!listed) return null;
      const kitUse = importCounts(ctx.root, ctx.files.code);
      if (Object.entries(kitUse).some(([k, n]) => k !== def.name && n > kitUse[def.name])) return null;
      const paint = countKitPaint(ctx.root, ctx.files.code, def);
      if (paint.kitFiles < MIN_FILES) return null;
      profile.designSystem = { kind: 'kit', name: def.name, pkg: def.packages[0], confidence: 'high' };
      profile.kit = { name: def.name, ...paint };
      return {
        confidence: paint.themeFiles.length ? 'high' : 'medium',
        evidence: [
          `${def.name} imported in ${paint.kitFiles} files`,
          paint.themeFiles.length ? `theme defined in ${paint.themeFiles[0]}${paint.themeFiles.length > 1 ? ` and ${paint.themeFiles.length - 1} more` : ''}` : `no ${def.advice.themeCall} found: the default ${def.name} theme`,
          `the theme is referenced ${paint.refs} times from components`,
        ],
      };
    },
  };
}
