/**
 * guard-api — the one official doorway into the engine for OTHER packages.
 *
 * guard-my-design-system imports this file (through the roast npm package's
 * "./engine" export). Everything else in the engine stays private and free to
 * refactor; what is exported here is a public promise — rename or reshape it
 * only with a deliberate version bump and a changelog line.
 *
 * Kept deliberately narrow: learn what the repo's system is, scan a piece of
 * text for styling, and say which on-system value a stray most resembles.
 */
import { extname, join } from 'node:path';
import { walkRepo, readSource, profileRepo } from '../harvest/walk.mjs';
import { chartSystemOf } from './charts.mjs';
import { designGaps } from './gaps.mjs';
export { designGaps } from './gaps.mjs';
import { decideProfile, profileOf, installedDirs, installedFile, installedFrom } from '../profiles/index.mjs';
import { KITS } from '../profiles/kit-common.mjs';
import { kitPaintFindings } from './kitpaint.mjs';
import { paletteFindings } from './palette.mjs';
import { PALETTE_CLASS_RE, DEMO_PATH_RE, blankComments } from '../harvest/paint.mjs';
import { harvestTokens, extractStyling, normalizeHex, isGrey } from '../harvest/tokens.mjs';
import { harvestComponents, definedComponents, tsconfigAliases } from '../harvest/components.mjs';
import { findDuplicates } from '../harvest/duplicates.mjs';
import { repoTokenDefs } from './tokentwins.mjs';
import { dupeCopiesOf } from './avoidedimports.mjs';
import { loadExclusions } from './exclusions.mjs';
import { WIDGET_CONFIG_RE } from './exempt.mjs';
import { buttonCandidates } from './handmade.mjs';
import { resolveWorkspaces } from './workspaces.mjs';
import { hexRgb } from './nearpairs.mjs';
import { typefaceOf, GENERIC_FONTS } from './typefaces.mjs';

export { extractStyling, normalizeHex, isGrey, hexRgb, typefaceOf, GENERIC_FONTS };

// The components a piece of text defines. With the ledger below, a guard can
// tell a second <Button> from an edit to the first one.
export { definedComponents };
// Duplicates, by the report's own answer (9.2.1). duplicateCopies(def,
// copies, counted, same) returns the other copies that make one definition a
// duplicate, or none: `copies` is the ledger's entries for the name
// (learnSystem's components), `counted` the files of the duplicate the report
// counts under it (the copies in learnSystem's duplicates), `same` how two
// paths compare. canBeDuplicate({ name, file, isPage }) is the first question
// it asks: a framework's Route, a page, a route file, the crash page, a story
// and an email template repeat by design. isPageFile(file) answers isPage for
// a file not in the ledger. componentNamesIn(text, file) lists what a whole
// file defines for the report: React components in a .tsx, .jsx or .js file
// with markup in it, and web components registered by tag. The exemptions
// (exemptReason) are about styling, so a duplicate is still a duplicate in
// an exempt file.
export { canBeDuplicate, duplicateCopies } from '../harvest/duplicates.mjs';
export { isPageFile, looksLikeJSXFile, componentNamesIn } from '../harvest/components.mjs';

// The files no checker should judge. Exported so a guard reads the same list
// as the engine rather than keeping a copy that drifts.
export { EMAIL_PRINT_RE, ARTWORK_NAME_RE, ARTWORK_DIR_RE, SVG_MARKUP_RE, exemptReason, isEmail, isDrawing } from './exempt.mjs';
// !important as the medium (7.5): a widget stylesheet that must beat its host
// page, and a selector aimed at a library's own class names. The guard reads
// the same patterns, so the two checkers agree about the same declaration.
export { WIDGET_CSS_RE, WIDGET_CONFIG_RE, LIBRARY_CLASS_RE, isLibraryClass } from './exempt.mjs';
// A palette class (bg-blue-500, text-gray-600) where a theme variable exists:
// the shadcn paint check (7.2). Only meaningful when system.profile.paletteReady.
// blankComments (8.4.5) is what the report and the live checks run on a file
// before matching, so a class named in a comment paints nothing; a guard that
// matches the raw text counts it, and disagrees with the report.
// DEMO_PATH_RE (9.3.2) is the folders the palette count leaves out, stories,
// examples and demos: a guard that skips them flags palette classes in the
// same files the report counts.
export { PALETTE_CLASS_RE, DEMO_PATH_RE, blankComments };
// The palette rule itself (9.4.0): paletteFindings(fileText, system.profile
// .palette, { file }) returns the worded findings the live checks give for
// the same file, with the index of each in the text; empty when the rule is
// off, on a stylesheet, in a demo folder or inside a kit door. Which
// vocabulary applies was decided once by the profile (lib/palette.mjs), so
// a guard that calls this agrees with the report's live checks by
// construction, on a Tailwind theme and on a shadcn kit alike.
export { paletteFindings };
// Installed code, file by file (9.5.0, profiles/installed.mjs): a guard
// leaves installedFile(system.profile.installedFrom, file, under) alone and
// judges everything else, including the team's own components kept in the
// shadcn catalogue folder. isShadcnFile(file) is the name test on its own.
export { installedFile, doorFile, isShadcnFile } from '../profiles/installed.mjs';
// A product built on a kit (MUI, Mantine, Chakra UI, Ant Design), 8.4.6: a
// colour or a pixel size written onto a kit component where the theme has a
// value. kitPaintFindings(fileText, system.profile.kit, { file }) returns the
// worded findings the report's live checks give for the same file, with the
// index of each in the text; null when the file is not a kit file, { exempt }
// when it is not judged. Only meaningful when system.profile.kit is set.
export { kitPaintFindings };
// Twin tokens and avoided copies (8.6.0). tokenTwinFindings(text, { before,
// others, tailwind }) words the colour tokens a stylesheet ADDS that twin one
// the repo already has (tokenDefsOf reads a stylesheet's tokens, light and
// dark, for `others`). avoidedImportFindings(text, { file, before, dupes })
// words a new import of a duplicate where a clear canonical copy exists.
// Same words as roast_validate, roast_review and --check.
export { tokenTwinFindings, tokenDefsOf } from './tokentwins.mjs';
export { avoidedImportFindings, canonicalCopy } from './avoidedimports.mjs';
export { isChartFile, chartSystemOf, chartTier, chartFindings } from './charts.mjs';
// a button from scratch where the repo has a Button (9.2.0); learnSystem
// hands over `buttons`, `workspaces` and `packageDeps` for buttonFor
export { handmadeButtons, handmadeButtonFindings, buttonCandidates, buttonFor, BUTTON_MIN_USES } from './handmade.mjs';

// Radius, font size, shadow and typeface: the patterns, so both checkers agree
// on what a declaration is and what counts as a disciplined value.
export {
  EXTRA_KINDS, FONT_LINE_RE, BENIGN_VALUE_RE, extraValue, extraDeclarations, fontDeclarations,
} from './declarations.mjs';

// Same classification walkRepo uses, exposed so a caller looking at one file
// (a diff hunk) treats it the way the full scan would.
const CODE_EXTS = new Set(['.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs']);
const STYLE_EXTS = new Set(['.css', '.scss', '.sass', '.less']);
export const isCodeFile = (p) => CODE_EXTS.has(extname(p));
export const isStyleFile = (p) => STYLE_EXTS.has(extname(p));

/**
 * Scan the whole repo once and return what its design system IS — the
 * reference a guard judges new lines against. Respects .roastignore.
 *
 * Returns {
 *   tokenFile,        // the file defining the most --vars, or null
 *   colors,           // [{ value, count, isToken, files }] every colour seen
 *   tokens,           // shorthand: just the token colour values
 *   tokenNames,       // { normalizedValue: '--var-name' } for every --var definition
 *   spacing,          // [{ value, count, files }] every length seen
 *   radii,            // [{ value, count, files }] every border-radius declared
 *   fontSizes,        // [{ value, count, files }] every font-size declared
 *   shadows,          // [{ value, count, files }] every box-shadow declared
 *   fontFamilies,     // [{ value, count, files }] every family declared
 *   tailwind,         // { colors, spacing, radii, textSizes, arbitrary }
 *   components,       // [{ name, file, usageCount, isPage }] the ledger
 *   tokenDefs,        // [{ name, file, value, canon, darkValue?, darkCanon? }] colour tokens
 *   charts,           // { palette, precedents, chartFiles } the chart palette or its absence
 *   duplicates,       // Map<name, { copies: [{ file, usageCount }], strays }>
 *   files,            // { styles: n, code: n } — how much was read
 * }
 */
export function learnSystem(repoRoot, { exclude = [] } = {}) {
  const exclusions = loadExclusions(repoRoot, exclude);
  const files = walkRepo(repoRoot, 14, exclusions);
  const t = harvestTokens(repoRoot, files.styles, files.code, { email: files.email });
  const ledger = harvestComponents(repoRoot, files.code).components;
  const components = ledger.map(({ name, file, usageCount, isPage }) => ({ name, file, usageCount, isPage }));
  const profile = profileRepo(repoRoot, files);
  decideProfile(profile, components, files, repoRoot);
  // the same two lists the MCP knowledge builds (mcp/knowledge.mjs), from the
  // same helpers, for tokenTwinFindings and avoidedImportFindings (8.6.1)
  const read = (f) => readSource(join(repoRoot, f));
  const hardDupes = (findDuplicates(ledger, profile.uiDir, repoRoot, profile.uiDirs ?? null).exactDuplicates ?? []).filter((d) => !d.wrapped);
  const P = profileOf(profile);
  const charts = chartSystemOf(files, read, { own: (f) => !installedFile(P, f) });
  // the kit the product is built on, with its definition attached, the way
  // the MCP knowledge reads it (mcp/knowledge.mjs): the theme's colours are
  // the token set on a kit repo, whatever stylesheet holds the most literals
  const kit = P.isKit && profile.kit && KITS[profile.kit.name] ? { ...profile.kit, def: KITS[profile.kit.name] } : null;
  const widgetDirs = files.code.filter((f) => /(^|\/)tailwind\.config\.[mc]?[jt]s$/.test(f))
    .filter((f) => WIDGET_CONFIG_RE.test(readSource(join(repoRoot, f)) ?? ''))
    .map((f) => f.slice(0, f.lastIndexOf('/') + 1));

  // Every --var definition, as normalizedValue → name, so a guard can say
  // "use var(--blue-500)" instead of leaving the reader to hunt the hex.
  // First definition wins; later duplicates are aliases, not the canon.
  const tokenNames = {};
  const HEX = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
  for (const f of files.styles) {
    const text = readSource(join(repoRoot, f));
    if (text === null) continue;
    for (const m of text.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g)) {
      const hex = HEX.exec(m[2]);
      const value = hex ? normalizeHex(hex[0]) : m[2].trim().replace(/\s+/g, ' ').toLowerCase();
      if (!(value in tokenNames)) tokenNames[value] = m[1];
    }
  }

  // the Button the repo answers with, per package (lib/handmade.mjs)
  const workspaces = resolveWorkspaces(repoRoot);
  const buttons = buttonCandidates(ledger, read, workspaces, tsconfigAliases(repoRoot));
  const packageDeps = new Map();
  for (const w of workspaces) {
    let pj = null;
    try { pj = JSON.parse(read(`${w.dir}/package.json`) ?? 'null'); } catch { /* not a package after all */ }
    packageDeps.set(w.dir, new Set(Object.keys({ ...pj?.dependencies, ...pj?.devDependencies, ...pj?.peerDependencies })));
  }

  return {
    // where the repo keeps its emails: pass it to exemptReason(file, text,
    // { email }) so a guard judges an email the way the report does (9.2.3)
    email: files.email ?? null,
    tokenFile: t.tokenFile,
    buttons,
    workspaces,
    packageDeps,
    // The files that state the palette: token stylesheets, a Tailwind config,
    // palette data, a kit theme. Only there is a token's raw value the
    // definition; in any other file it is a paste of the value where the
    // name belongs, and a guard should say so (9.1.3).
    tokenSources: [...new Set([...(t.tokenSources ?? []), ...(kit?.themeFiles ?? []), t.tokenFile].filter(Boolean))],
    colors: t.colors,
    // Every named colour, variants included — not the counted palette. The
    // report counts a token's base statement only, because a dark theme is
    // the system working rather than sprawl; a guard needs the opposite, the
    // full set, or it cannot recognise a dark-theme value as on-system.
    tokens: [...new Set([...(t.tokenColors ?? t.colors.filter((c) => c.isToken).map((c) => c.value)), ...(kit?.themeValues ?? [])])],
    tokenNames,
    spacing: t.spacing,
    radii: t.radii,
    fontSizes: t.fontSizes,
    shadows: t.shadows,
    fontFamilies: t.fontFamilies,
    tailwind: t.tailwind,
    // Trimmed to the four fields a guard can act on: what it is called, where
    // it lives, how much the repo leans on it, and whether it is a page (pages
    // are routes, not reusable parts, so two of a name is not a duplicate).
    components,
    // every colour token each stylesheet defines, light and dark: the
    // `others` tokenTwinFindings compares a new token with (8.6.1)
    tokenDefs: repoTokenDefs(files.styles, read),
    // the chart palette, or the charts painting by hand without one (lib/charts.mjs)
    charts,
    gaps: designGaps({ charts, tokenFile: t.tokenFile ?? null }),
    // each duplicated name's copies, their usage and the colours each
    // non-canonical copy hard-codes: the `dupes` avoidedImportFindings reads
    duplicates: dupeCopiesOf(hardDupes, ledger, read),
    files: { styles: files.styles.length, code: files.code.length },
    // How the repo was read (7.1 to 7.7), decided once by the same profiles
    // the report uses, so a guard treats installed code, a registry's
    // published folders and a widget's stylesheet the way the score does.
    profile: {
      kind: P.kind,
      role: P.role,
      // folders that hold installed code (a shadcn catalogue, installed
      // registries, kit blocks). Empty on a registry: what it publishes is
      // its own work. Only a shadcn kit has installed code; a hand-written
      // components/ui on a plain product is the team's own.
      installedDirs: P.isShadcn && !P.isRegistry ? installedDirs(P) : [],
      // Which files in those folders are installed, file by file (9.5.0): a
      // component of the team's own kept in the catalogue folder is the
      // team's, and judged. installedFile(profile.installedFrom, file, under)
      // answers; `under` is how the caller matches a file to a folder.
      installedFrom: installedFrom(P),
      // a product built on a kit: name, theme files and values, spacing step,
      // the team's own layers over it, and the definition kitPaintFindings reads
      kit,
      // the vocabulary the palette rule judges against, or null when it is
      // off: a Tailwind theme's own names, shadcn's names when the sheet's
      // contract holds in CSS-variable mode, or the repo's own theme under a
      // shadcn kit with no rows (lib/palette.mjs, 9.4.0). Hand it to
      // paletteFindings.
      palette: P.palette,
      // superseded by `palette` in 9.4.0; kept one release for readers of the
      // old shape. The old gate read the configured sheet's :root rows alone.
      paletteReady: P.isShadcn && (P.shadcn?.sheet?.shadcnPresent ?? 0) >= 5 && P.designSystem?.cssVariables !== false,
      sheetFile: P.shadcn?.sheet?.found ? P.shadcn.sheet.file : null,
      // packages whose Tailwind config scopes utilities under an id: widgets
      widgetDirs,
      // a registry: only the published folders are counted; sibling variants
      // and blocks hold the same names by design
      registry: P.isRegistry && P.registry ? {
        countedDirs: P.registry.publishedDirs ?? [],
        variants: P.registry.variants ?? [],
        blockDirs: P.registry.blockDirs ?? [],
      } : null,
    },
  };
}

/**
 * The token a stray colour most resembles. Distance is the largest channel
 * difference (the same yardstick nearColorPairs uses), so "8" here means what
 * "near-identical" means everywhere else in the engine. Hex-parseable values
 * only; returns { value, distance } or null.
 */
export function nearestColor(value, tokenValues) {
  const target = hexRgb(normalizeHex(value));
  if (!target) return null;
  let best = null;
  for (const t of tokenValues) {
    const rgb = hexRgb(t);
    if (!rgb || rgb.a !== target.a) continue;
    const d = Math.max(Math.abs(rgb.r - target.r), Math.abs(rgb.g - target.g), Math.abs(rgb.b - target.b));
    if (d === 0) continue; // identical to a token: not a stray at all
    if (!best || d < best.distance) best = { value: t, distance: d };
  }
  return best;
}

/**
 * The on-scale length a stray spacing value most resembles. Same-unit
 * comparison only (12px is not "near" 0.75rem here; unit conversion is a
 * judgement the guard should not fake). Returns { value, distance } or null.
 */
export function nearestLength(value, scaleValues) {
  const parse = (v) => {
    const m = /^(-?\d*\.?\d+)(px|rem|em|%|vh|vw|pt)$/.exec(String(v).trim());
    return m ? { n: parseFloat(m[1]), unit: m[2] } : null;
  };
  const target = parse(value);
  if (!target) return null;
  let best = null;
  for (const s of scaleValues) {
    const p = parse(s);
    if (!p || p.unit !== target.unit) continue;
    const d = Math.abs(p.n - target.n);
    if (d === 0) continue;
    if (!best || d < best.distance) best = { value: s, distance: d };
  }
  return best;
}
