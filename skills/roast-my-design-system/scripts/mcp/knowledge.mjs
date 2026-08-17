/**
 * Knowledge — the MCP server's one scan, held warm. Runs the same harvest
 * pipeline as the CLI (walk, components, tokens, duplicates, context), then
 * derives the indexes the tools answer from: token set, spacing scale,
 * component ledger, canonical picks, duplicate map.
 *
 * The rule this file enforces: scan ONCE at startup, refresh only when files
 * actually changed (mtime + count check, a stat sweep, never a re-read), and
 * NEVER re-harvest per call. Startup costs 2.5-4s on big monorepos; that is
 * paid once. A stat sweep costs tens of milliseconds; that is the per-call
 * ceiling.
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { walkRepo, profileRepo } from '../harvest/walk.mjs';
import { harvestComponents } from '../harvest/components.mjs';
import { harvestTokens } from '../harvest/tokens.mjs';
import { findDuplicates } from '../harvest/duplicates.mjs';
import { harvestContext } from '../harvest/context.mjs';
import { loadExclusions } from '../lib/exclusions.mjs';
import { resolveWorkspaces } from '../lib/workspaces.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';
import { hexRgb } from '../lib/nearpairs.mjs';

const MAX_DEPTH = 14; // same ruler as the harvest CLI

/** Fingerprint of the walked file set: count + newest mtime. Cheap, honest. */
function fingerprint(root, files) {
  let newest = 0, count = 0;
  for (const f of [...files.code, ...files.styles]) {
    try {
      const s = statSync(join(root, f));
      if (s.mtimeMs > newest) newest = s.mtimeMs;
      count++;
    } catch { /* deleted since walk — counts as change via count */ }
  }
  return `${count}:${Math.round(newest)}`;
}

/** One full scan → knowledge object. */
export function loadKnowledge(root) {
  const t0 = Date.now();
  const exclusions = loadExclusions(root, []);
  const files = walkRepo(root, MAX_DEPTH, exclusions);
  const profile = profileRepo(root, files);
  const { components } = harvestComponents(root, files.code);
  const tokens = harvestTokens(root, files.styles, files.code);
  const duplicates = findDuplicates(components, profile.uiDir, root);
  const context = harvestContext(root);
  const workspaces = resolveWorkspaces(root);

  // ---------- derived indexes ----------
  const colorInfo = new Map(); // value → { count, isToken }
  for (const c of tokens.colors) colorInfo.set(c.value, { count: c.count, isToken: c.isToken });
  const tokenColors = [...colorInfo.entries()].filter(([, i]) => i.isToken).map(([v]) => v);

  // spacing the repo already uses: raw CSS values with counts, plus whether
  // the repo styles spacing through Tailwind at all (decides what "on-scale" means)
  const spacingSeen = new Map(tokens.spacing.map((s) => [s.value, s.count]));
  const twSpacingUse = (tokens.tailwind?.spacing ?? []).reduce((sum, s) => sum + s.count, 0);
  const usesTailwind = twSpacingUse >= 20;

  // component ledger: name → [ {file, usageCount, isPage, props, usageExample} ]
  const byName = new Map();
  for (const c of components) {
    const list = byName.get(c.name) ?? [];
    list.push(c);
    byName.set(c.name, list);
  }

  // canonical picks: same filter as the rules builder (used, unique name, not
  // a framework shadow) — the ruler must match what --rules tells the agent
  const FRAMEWORK_NAMES = new Set(['Link', 'Image', 'Head', 'Script', 'Form']);
  const reusable = components.filter((c) => !c.isPage);
  const canonical = reusable
    .filter((c) => c.usageCount > 0 && !FRAMEWORK_NAMES.has(c.name) && (byName.get(c.name)?.length ?? 0) === 1)
    .sort((a, b) => b.usageCount - a.usageCount);

  const hardDupes = (duplicates.exactDuplicates ?? []).filter((d) => !d.wrapped);
  const dupeByName = new Map(hardDupes.map((d) => [d.name, d]));

  const neverImported = neverImportedComponents(components, profile.uiDir);

  return {
    root,
    scannedAt: new Date().toISOString(),
    tookMs: Date.now() - t0,
    fingerprint: fingerprint(root, files),
    files,
    profile,
    components,
    tokens,
    duplicates,
    context,
    workspaces,
    // indexes
    colorInfo,
    tokenColors,
    tokenColorRgb: tokenColors.map((v) => ({ value: v, rgb: hexRgb(v) })).filter((t) => t.rgb),
    spacingSeen,
    usesTailwind,
    byName,
    canonical,
    dupeByName,
    neverImported,
    agentFiles: (context ?? []).filter((c) => c.kind === 'agent-rules'),
  };
}

/**
 * Return fresh knowledge: the cached object if nothing changed, a rescan if
 * the file set moved. Re-walks the tree (directory listing, no file reads) so
 * NEW files are caught, then fingerprints — a stat sweep, tens of ms. That is
 * the per-call filesystem ceiling; file contents are only re-read on change.
 */
export function freshKnowledge(k) {
  const files = walkRepo(k.root, MAX_DEPTH, loadExclusions(k.root, []));
  if (fingerprint(k.root, files) === k.fingerprint) return k;
  return loadKnowledge(k.root);
}
