/**
 * Installed code on a shadcn repo: which files the team did not write.
 *
 * Until 9.5.0 every file in the catalogue folder (components/ui, or wherever
 * components.json points) counted as installed: its bracket values were
 * called shadcn's, its palette classes were not counted, and the guard left
 * it alone. Probed on the fleet (2026-10-01): 33 of 44 shadcn product repos
 * keep components of their own in that folder, 1,014 of 2,709 files, with
 * 1,285 palette classes nothing counted. formbricks keeps 191 of its own
 * there, and the report called their values shadcn's.
 *
 * The rule, in one place for the report, the live checks and the guard:
 *   - a third-party registry folder (ai-elements, magicui) is installed
 *   - a kit block (app-sidebar, login-form) is installed
 *   - a file in the catalogue folder is installed only when it is one of
 *     shadcn's components by name, however the team spells it (Nango keeps
 *     Avatar.tsx and Checkbox.tsx); anything else there is the team's
 *
 * The name list is shadcn's own (CATALOGUE, BLOCK_COMPONENTS in
 * shadcn-data.mjs), checked on 2026-10-01 against every component name
 * shadcn has shipped, current and historical. A third-party component
 * installed straight into the catalogue folder, rather than a folder of its
 * own, reads as the team's: nothing on disk tells the two apart.
 */
import { basename, dirname } from 'node:path';
import { CATALOGUE, BLOCK_COMPONENTS } from './shadcn-data.mjs';

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();

/** The component a file holds, by shadcn's naming: index files take their folder's name. */
function componentName(file) {
  const stem = basename(file).replace(/\.[cm]?[jt]sx?$/, '');
  return kebab(stem === 'index' ? basename(dirname(file)) : stem);
}

/** Is this one of shadcn's own files: a catalogue component or a kit block, by name? */
export function isShadcnFile(file) {
  const n = componentName(file);
  return CATALOGUE.has(n) || BLOCK_COMPONENTS.has(n);
}

const prefixUnder = (file, dirs) => (dirs ?? []).some((d) => file === d || file.startsWith(`${d}/`));

/**
 * Is `file` a kit door: one of shadcn's own components in the catalogue
 * folder, or a kit block? Editing a door is the intended use, so the paint
 * checks leave doors alone.
 * @param from { uiDirs, shadcn: { blockFiles } } (a profileOf() reading, or the
 *   plain `installedFrom` object the knowledge and the doorway carry)
 * @param under how a file is matched to a folder; the guard passes its own,
 *   which also matches when it runs in a subdirectory
 */
export function doorFile(from, file, under = prefixUnder) {
  if (!from || !file) return false;
  if (under(file, from.shadcn?.blockFiles)) return true;
  return under(file, from.uiDirs) && isShadcnFile(file);
}

/** Is `file` installed code: a door (above), or a file in a third-party registry folder? */
export function installedFile(from, file, under = prefixUnder) {
  if (!from || !file) return false;
  return under(file, from.shadcn?.registryDirs) || doorFile(from, file, under);
}

/**
 * The plain facts installedFile and doorFile read, for a profileOf() reading:
 * what the knowledge and the guard doorway carry. Null when nothing is
 * installed (no shadcn kit, or a registry, whose published folders are its
 * own work).
 */
export function installedFrom(P) {
  if (!P?.isShadcn || P.isRegistry) return null;
  return { uiDirs: [...(P.uiDirs ?? [])], shadcn: { blockFiles: [...(P.shadcn?.blockFiles ?? [])], registryDirs: [...(P.shadcn?.registryDirs ?? [])] } };
}
