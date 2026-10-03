/**
 * An import of the copy roast says to avoid. roast_find_component answers
 * "Canonical: src/ui/Button.tsx … Avoid: src/features/invoices/ButtonV2.tsx",
 * but on the Ledgerly demo (2026-09-24) an agent asked to match a spec colour
 * imported the avoided copy anyway, because its hard-coded blue matched, and
 * nothing in the live checks said a word: the colour lives inside the copy,
 * not in the file under review. This names the canonical copy instead.
 *
 * Only a clear canon is named: the same tie rule roast_find_component uses
 * (the most used copy must lead the next by half again). Two copies in equal
 * use have no wrong pick, and saying otherwise would be inventing one.
 */
import { posix } from 'node:path';
import { extractStyling } from '../harvest/tokens.mjs';

const CODE_EXT_RE = /\.(?:tsx|ts|jsx|js|mjs|cjs|vue|svelte)$/;
const stem = (f) => f.replace(CODE_EXT_RE, '').replace(/\/index$/, '');

/** Each name a text imports, with where from: [{ name, spec, index }]. */
export function importsOf(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(/(?:^|\n)\s*import\s+(?:type\s+)?([^'";]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    const [, clause, spec] = m;
    const index = m.index + m[0].indexOf('import');
    const named = /\{([^}]*)\}/.exec(clause);
    for (const part of named ? named[1].split(',') : []) {
      const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
      if (name) out.push({ name, spec, index });
    }
    // the default import takes the copy's own name
    const def = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+\w+/, '').replace(/,/g, ' ').trim();
    if (/^[A-Z]\w*$/.test(def)) out.push({ name: def, spec, index, isDefault: true });
  }
  return out;
}

/** The file among `candidates` an import specifier points at, or null. */
export function resolveSpec(spec, file, candidates) {
  if (spec.startsWith('.') && file) {
    const target = posix.normalize(posix.join(posix.dirname(file), spec));
    return candidates.find((c) => stem(c) === target || stem(c) === stem(target)) ?? null;
  }
  // an alias (@/features/invoices/ButtonV2) or no file to resolve against:
  // the path's tail must name the copy, folder included
  const tail = stem(spec.replace(/^(?:\.{1,2}\/)+/, '').replace(/^[@~#]\//, ''));
  if (!tail.includes('/') && !spec.startsWith('.')) return null; // a package, not a file
  return candidates.find((c) => stem(c) === tail || stem(c).endsWith(`/${tail}`)) ?? null;
}

/**
 * The clear canon among the copies of a name, or null on a tie.
 * copies: [{ file, usageCount }]
 */
export function canonicalCopy(copies) {
  const [top, second] = [...copies].sort((a, b) => b.usageCount - a.usageCount);
  if (!top || !top.usageCount) return null;
  if (second && second.usageCount > 0 && top.usageCount / second.usageCount < 1.5) return null;
  return top;
}

/**
 * The copies of each duplicated name, with their usage and the colours each
 * non-canonical copy hard-codes: the `dupes` map avoidedImportFindings reads.
 * `hardDupes` is findDuplicates' exactDuplicates minus wrapped pairs;
 * `components` the harvested ledger; `read(file)` a file's text or null.
 * Shared by the MCP knowledge and the guard doorway.
 */
export function dupeCopiesOf(hardDupes, components, read) {
  const dupes = new Map();
  for (const d of hardDupes) {
    const paths = d.files.map((f) => (typeof f === 'string' ? f : f.file));
    const copies = paths.map((file) => ({
      file, usageCount: components.find((c) => c.name === d.name && c.file === file)?.usageCount ?? 0,
    }));
    const canon = canonicalCopy(copies);
    const strays = new Map();
    for (const file of paths) {
      if (file === canon?.file) continue;
      const text = read(file);
      if (text) strays.set(file, [...new Set(extractStyling(text).colors.map((c) => c.value))]);
    }
    dupes.set(d.name, { copies, strays });
  }
  return dupes;
}

/**
 * Findings for imports of a non-canonical duplicate that the change ADDS.
 * @param dupes  Map<name, { copies: [{ file, usageCount }], strays?: Map<file, [colour]> }>
 * @param before the file before the change: null for a new file, undefined
 *               when unknown (every import is then judged)
 * @returns [{ rule: 'avoided-copy', index, name, from, canonical, message, fix }]
 */
export function avoidedImportFindings(text, { file = null, before, dupes } = {}) {
  if (!dupes?.size) return [];
  const key = (i) => {
    const d = dupes.get(i.name);
    const hit = d ? resolveSpec(i.spec, file, d.copies.map((c) => c.file)) : null;
    return hit ? `${i.name}|${hit}` : null;
  };
  const had = new Set(before == null ? [] : importsOf(before).map(key).filter(Boolean));
  const out = [], seen = new Set();
  for (const i of importsOf(text)) {
    const d = dupes.get(i.name);
    if (!d) continue;
    const from = resolveSpec(i.spec, file, d.copies.map((c) => c.file));
    if (!from || from === file || had.has(`${i.name}|${from}`) || seen.has(`${i.name}|${from}`)) continue;
    seen.add(`${i.name}|${from}`);
    const canon = canonicalCopy(d.copies);
    if (!canon || canon.file === from) continue;
    const mine = d.copies.find((c) => c.file === from);
    const strays = d.strays?.get(from) ?? [];
    out.push({
      rule: 'avoided-copy', index: i.index, name: i.name, from, canonical: canon.file,
      message: `Imports <${i.name}> from ${from}, one of ${d.copies.length} competing copies. The canonical one is ${canon.file} (used ${canon.usageCount}x; this copy ${mine?.usageCount ?? 0}x).${strays.length ? ` This copy hard-codes ${strays.slice(0, 3).join(', ')}${strays.length > 3 ? ` and ${strays.length - 3} more` : ''}.` : ''}`,
      fix: `Import <${i.name}> from ${canon.file}. If the design needs something it lacks, add it there, not to the copy.`,
    });
  }
  return out;
}
