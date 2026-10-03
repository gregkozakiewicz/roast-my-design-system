/**
 * User-declared scan exclusions. Two sources, merged: a .roastignore file at
 * the scanned repo's root (one pattern per line, # comments and blank lines
 * ignored) and --exclude values from the CLI. Patterns are repo-relative
 * directory or file paths ("lab/", "piglet/", "apps/playground"); matching is
 * a whole-segment prefix on the relative path, so "lab" excludes lab/ and
 * everything under it but never labs.css. No negation, no globs: this scopes
 * the scan to the design system being judged, it is not a gitignore clone.
 *
 * Honesty is the point: every active pattern is recorded in the harvest JSON
 * with the number of files it removed, and the report prints them in the
 * header, so an exclusion can narrow the question but never hide the answer.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function normalize(raw) {
  return raw.trim()
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/** Parse a .roastignore body into normalized patterns. */
export function parseRoastignore(text) {
  return (text ?? '').split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map(normalize)
    .filter(Boolean);
}

/**
 * Merge .roastignore (read from repoRoot) with CLI --exclude values into a
 * pattern list plus a matcher. Each entry carries its source and a `files`
 * counter the walker increments, so the harvest can report what each pattern
 * actually removed. Duplicate patterns keep the first source seen.
 */
export function loadExclusions(repoRoot, cliExcludes = []) {
  const patterns = [];
  const seen = new Set();
  const add = (raw, source) => {
    const p = normalize(raw);
    if (!p || seen.has(p)) return;
    seen.add(p);
    patterns.push({ pattern: p, source, files: 0 });
  };

  let ignoreText = null;
  try { ignoreText = readFileSync(join(repoRoot, '.roastignore'), 'utf8'); } catch { /* no file, fine */ }
  for (const p of parseRoastignore(ignoreText)) add(p, '.roastignore');
  for (const p of cliExcludes) add(p, '--exclude');

  // Whole-segment prefix: pattern "lab" matches "lab" and "lab/…", never "labs".
  const matcher = (rel) => patterns.find((e) => rel === e.pattern || rel.startsWith(`${e.pattern}/`)) ?? null;
  return { patterns, match: patterns.length ? matcher : () => null };
}
