/**
 * One token name, two different colours, in two packages of the same repo.
 *
 * Not the same thing as a theme variant: `--primary` restated in `.dark` is
 * the system working, and the palette count already treats it that way. This
 * is `--cal-bg-emphasis` meaning one colour in apps/web and another in
 * packages/config, so whichever an agent reads first becomes the brand.
 *
 * Rare on purpose. Across 19 repos and 9,229 definitions it fires twice.
 * Three guards, each learned from a false positive in the probe (2026-09-11):
 *  - compare parsed colours, never strings: #111 and #111111 are one colour
 *  - only DECLARED workspaces count: shadcn ships templates/ that are not the
 *    system, and they alone accounted for 9 of the 11 false positives
 *  - variants inside one package are dark mode, not disagreement
 */
import { resolveWorkspaces } from '../lib/workspaces.mjs';

/**
 * Which directories the repo itself calls part of the system, as an exact
 * match on a package directory. Returns null when the repo declares no
 * workspaces, which the caller reads as "single package, nothing to compare".
 * resolveWorkspaces already reads both conventions (package.json workspaces
 * and pnpm-workspace.yaml) and expands the globs against real folders, which
 * is what keeps shadcn's bundled templates/ out: it is not declared anywhere.
 */
export function workspaceMatcher(root) {
  const dirs = new Set(resolveWorkspaces(root).map((w) => w.dir));
  if (!dirs.size) return null;
  return (dir) => dirs.has(dir);
}

const pairKey = (a, b) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

/**
 * Which package pairs share a vocabulary. Needs a real overlap to judge on
 * (5 names) and agreement on most of it (70%). Below that, silence.
 */
function alignedPairs(byName) {
  const shared = new Map();   // pair -> [agreements, comparisons]
  for (const per of byName.values()) {
    const es = [...per.entries()];
    for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
      const k = pairKey(es[i][0], es[j][0]);
      const t = shared.get(k) ?? [0, 0];
      t[1] += 1;
      if (es[i][1].canon === es[j][1].canon) t[0] += 1;
      shared.set(k, t);
    }
  }
  const out = new Set();
  for (const [k, [agree, total]] of shared) if (total >= 5 && agree / total >= 0.7) out.add(k);
  return out;
}

/**
 * @param defs [{ name, pkg, canon, value }] — one entry per package per name,
 *   already the package's own base value (not its theme variants).
 * @param isWorkspace  from workspaceMatcher, or null for a single package.
 * @returns [{ name, groups: [{ pkgs, values }] }] sorted by spread, worst first.
 */
export function tokenCollisions(defs, isWorkspace) {
  if (!isWorkspace) return [];
  const byName = new Map();
  for (const d of defs) {
    if (!d.canon || !isWorkspace(d.pkg)) continue;
    if (!byName.has(d.name)) byName.set(d.name, new Map());
    byName.get(d.name).set(d.pkg, d);
  }
  // Two packages that agree on almost nothing are two products with two
  // themes, not one token pulled in two directions. supabase carries a full
  // shadcn palette in apps/learn and another in apps/ui-library; without this
  // the check accused it 30 times, and every one of them was by design.
  // A pair only gets to disagree once it has shown it mostly agrees.
  const aligned = alignedPairs(byName);
  const out = [];
  for (const [name, per] of byName) {
    if (per.size < 2) continue;
    const pkgs = [...per.keys()];
    if (!pkgs.some((a, i) => pkgs.slice(i + 1).some((b) => aligned.has(pairKey(a, b))))) continue;
    const groups = new Map();
    for (const d of per.values()) {
      if (!groups.has(d.canon)) groups.set(d.canon, { pkgs: [], value: d.value });
      groups.get(d.canon).pkgs.push(d.pkg);
    }
    if (groups.size < 2) continue;
    out.push({
      name,
      groups: [...groups.values()]
        .map((g) => ({ pkgs: g.pkgs.sort(), value: g.value }))
        .sort((a, b) => b.pkgs.length - a.pkgs.length || a.value.localeCompare(b.value)),
    });
  }
  return out.sort((a, b) => b.groups.length - a.groups.length || a.name.localeCompare(b.name));
}
