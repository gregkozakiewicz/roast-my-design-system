/**
 * Workspace resolution. A monorepo declares its packages in one of a few
 * places and always as globs, never as a fixed folder shape — guessing from
 * folder depth misses most of them (cal.com keeps 23 packages that a naive
 * two-level scan reports as zero). Read the declaration instead.
 *
 * Supports: package.json `workspaces` (array or { packages: [] }),
 * pnpm-workspace.yaml, and negation patterns.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const readJSON = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };

/** Expand one glob ('packages/*', 'apps/**', 'tools/x') to existing directories. */
function expand(root, pattern) {
  if (pattern === '.' || pattern === './') return [];
  const parts = pattern.replace(/\/+$/, '').split('/').filter(Boolean);
  let dirs = [''];
  for (const part of parts) {
    const next = [];
    for (const d of dirs) {
      const abs = join(root, d);
      if (part === '*' || part === '**') {
        // '**' matches zero or more segments (chakra declares packages/**/**,
        // which must still match packages/react), so the current dir survives
        if (part === '**' && d) next.push(d);
        let entries;
        try { entries = readdirSync(abs, { withFileTypes: true }); } catch { continue; }
        for (const e of entries) {
          if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
          const rel = d ? `${d}/${e.name}` : e.name;
          next.push(rel);
          // '**' also matches deeper levels
          if (part === '**') dirs.push(rel);
        }
      } else {
        const rel = d ? `${d}/${part}` : part;
        if (existsSync(join(root, rel))) next.push(rel);
      }
    }
    dirs = next;
  }
  return [...new Set(dirs)].filter((d) => { try { return statSync(join(root, d)).isDirectory(); } catch { return false; } });
}

/**
 * Resolve a repo's workspace packages.
 * Returns [{ name, dir }] with dir relative to the repo root, or [] when the
 * repo is not a workspace monorepo.
 */
export function resolveWorkspaces(root) {
  const patterns = [];
  const pkg = readJSON(join(root, 'package.json'));
  const ws = pkg?.workspaces;
  if (Array.isArray(ws)) patterns.push(...ws);
  else if (Array.isArray(ws?.packages)) patterns.push(...ws.packages);

  // pnpm-workspace.yaml: the "packages:" block, read line by line. Comments and
  // blank lines are legal inside it (langfuse opens with one), and sibling
  // top-level keys such as "catalog:" end it.
  try {
    const lines = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8').split('\n');
    let inBlock = false;
    for (const line of lines) {
      if (/^packages:\s*$/.test(line)) { inBlock = true; continue; }
      if (!inBlock) continue;
      if (/^\s*(#.*)?$/.test(line)) continue;              // comment or blank
      if (/^\S/.test(line)) break;                          // next top-level key
      const m = /^\s*-\s*["']?([^"'#]+?)["']?\s*$/.exec(line);
      if (m) patterns.push(m[1].trim());
    }
  } catch { /* not a pnpm workspace */ }

  if (!patterns.length) return [];

  const negations = patterns.filter((p) => p.startsWith('!')).map((p) => p.slice(1).replace(/\/+$/, ''));
  const isNegated = (dir) => negations.some((neg) => {
    if (neg.includes('*')) return expand(root, neg).includes(dir);
    return dir === neg || dir.startsWith(`${neg}/`);
  });

  const seen = new Map();
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue;
    for (const dir of expand(root, pattern)) {
      if (!dir || dir === '.' || isNegated(dir) || seen.has(dir)) continue;
      // a workspace package is one that declares itself
      const own = readJSON(join(root, dir, 'package.json'));
      if (!own) continue;
      seen.set(dir, { name: own.name || dir, dir });
    }
  }
  return [...seen.values()].sort((a, b) => a.dir.localeCompare(b.dir));
}
