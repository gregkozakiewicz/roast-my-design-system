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
import { typefaceOf } from '../lib/typefaces.mjs';
import { hexRgb } from '../lib/nearpairs.mjs';
import { decideProfile, profileOf } from '../profiles/index.mjs';
import { KITS } from '../profiles/kit-common.mjs';

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
  // The MCP path used to skip the kind decision the CLI harvest makes, so a
  // library read as a product here. Same call, same answer, both doors.
  decideProfile(profile, components, files, root);
  const P = profileOf(profile);
  let tokens = harvestTokens(root, files.styles, files.code);
  // A product built on a kit (MUI, Mantine, Chakra, Ant Design): the theme
  // file is where colours are decided, and its values are the token set the
  // tools snap to. The report reads the same profile; see profiles/kit-common.
  const kit = P.isKit && profile.kit ? { ...profile.kit, def: KITS[profile.kit.name] ?? null } : null;
  if (kit) {
    const themeSet = new Set(kit.themeValues ?? []);
    tokens = {
      ...tokens,
      // the theme first: on a kit repo it is where a colour is decided, whatever
      // stylesheet or palette file holds the most literals
      tokenFile: kit.themeFiles[0] ?? tokens.tokenFile ?? null,
      colors: tokens.colors.map((c) => (themeSet.has(c.value) ? { ...c, isToken: true } : c)),
    };
    // same shape as a harvested colour, so every reader of `files` keeps working
    for (const v of themeSet) if (!tokens.colors.some((c) => c.value === v)) tokens.colors.push({ value: v, count: 1, files: [{ file: kit.themeFiles[0] ?? '', count: 1 }], isToken: true });
  }
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

  // the other declared scales, same shape: value → how often the repo says it.
  // Typefaces collapse to the face itself, so "Inter" and "Inter, sans-serif"
  // are one voice rather than two.
  const radiiSeen = new Map((tokens.radii ?? []).map((r) => [r.value, r.count]));
  const fontSizesSeen = new Map((tokens.fontSizes ?? []).map((f) => [f.value, f.count]));
  const shadowsSeen = new Map((tokens.shadows ?? []).map((s) => [s.value, s.count]));
  const faceCounts = new Map();
  for (const f of tokens.fontFamilies ?? []) {
    const face = typefaceOf(f.value);
    if (face) faceCounts.set(face, (faceCounts.get(face) ?? 0) + f.count);
  }
  const twSpacingUse = (tokens.tailwind?.spacing ?? []).reduce((sum, s) => sum + s.count, 0);
  // a repo with a Tailwind theme of its own is a Tailwind repo, however small
  const usesTailwind = twSpacingUse >= 20 || P.isTailwind;

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
    radiiSeen,
    fontSizesSeen,
    shadowsSeen,
    faceCounts,
    usesTailwind,
    byName,
    canonical,
    dupeByName,
    neverImported,
    // stock, not debt: see profiles/index.mjs
    vendoredUi: P.vendoredUi,
    // the kit the product is built on, and the Tailwind theme it names its
    // colours in: null when the repo is neither (see profiles/)
    kit,
    tailwind: P.isTailwind && profile.tailwind ? profile.tailwind : null,
    // A shadcn kitchen: the sheet names the colours, so a palette class in
    // own code is paint from a tin (shadcn's own rule: semantic colours,
    // never bg-blue-500). The report's tile counts it over own code plus
    // installed registries, never inside the catalogue or a kit block; the
    // checkers judge a file under review by the same line (2026-09-20: the
    // report counted a ring-green-500 that validate, review and --check let
    // through, because the rule was switched on for Tailwind themes only).
    shadcn: P.isShadcn && profile.shadcn ? {
      sheet: profile.shadcn.sheet?.found ? profile.shadcn.sheet.file : null,
      doors: [...P.uiDirs, ...(profile.shadcn.blockFiles ?? [])],
    } : null,
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
