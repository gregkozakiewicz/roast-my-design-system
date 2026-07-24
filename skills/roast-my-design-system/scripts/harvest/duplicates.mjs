import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Duplicate detection — the "4 Button implementations" finder. Two signals:
 *
 * 1. Same-name components defined in different files (Button in ui/button.tsx
 *    AND legacy/Button.jsx) — a straight duplicate.
 * 2. Name families: components whose normalized names contain a shared root
 *    (Button, PrimaryButton, IconBtn) — likely re-implementations of one idea.
 *
 * Both are heuristics for the diagnosis; the proposal step decides what merges.
 */

const norm = (name) => name.toLowerCase().replace(/[^a-z]/g, '');

// Common roots worth clustering on. Order matters: longest match wins.
const ROOTS = [
  'button', 'btn', 'input', 'textfield', 'select', 'dropdown', 'modal', 'dialog',
  'card', 'badge', 'chip', 'tag', 'tooltip', 'popover', 'table', 'list', 'menu',
  'nav', 'header', 'footer', 'sidebar', 'tabs', 'tab', 'accordion', 'alert',
  'toast', 'notification', 'avatar', 'spinner', 'loader', 'checkbox',
  'radio', 'switch', 'toggle', 'slider', 'progress', 'form', 'label', 'link',
];
// Roots that are aliases of each other (btn → button, dialog ↔ modal…)
// NB: 'icon' is deliberately NOT a root — an icon set is a glyph library
// (Excalidraw has 100+), not duplication to consolidate.
const ALIASES = { btn: 'button', dialog: 'modal', loader: 'spinner', tab: 'tabs', notification: 'toast' };

// CamelCase words of a component name: "DownlinkPanel" → ["downlink","panel"].
// A root must match a WHOLE word — "link" must not match inside "Downlink".
const camelWords = (name) => name.split(/(?=[A-Z])/).map((w) => w.toLowerCase()).filter(Boolean);

function rootOf(name) {
  const words = camelWords(name);
  for (const r of ROOTS) {
    if (words.includes(r)) return ALIASES[r] ?? r;
  }
  return null;
}

// Framework-boilerplate exports that recur by design, not by accident.
const NOT_DUPLICATES = new Set(['Route', 'Layout', 'App', 'Providers', 'Provider',
  // Next.js route-handler exports — HTTP verbs, never components.
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

// Route-colocated page fragments (app/**/form.tsx, header.tsx…) share names by
// Next.js convention, not by duplication.
const ROUTE_FRAGMENT_RE = /(^|\/)app\/.*\/(form|header|footer|nav|page|layout|loading|error|route)\.[jt]sx?$/;

/**
 * @param components output of harvestComponents (non-page components matter most)
 * @param uiDir the design-system dir if one exists (e.g. "src/components/ui")
 * @param root repo root; when given, same-name pairs where one file imports the
 *   name from the other are tagged wrapped:true (composition, not competition)
 * @returns { exactDuplicates: [{name, files, wrapped?}], families: [{root, members: [{name, file, usageCount}]}] }
 */
export function findDuplicates(components, uiDir = null, root = null) {
  // Email templates legitimately mirror web component names (email Footer !=
  // web Footer); cross-matching them manufactures duplicates.
  const EMAIL_PATH_RE = /(^|\/)emails?(\/|-)/i;
  const comps = components.filter((c) => !c.isPage && !NOT_DUPLICATES.has(c.name)
    && !ROUTE_FRAGMENT_RE.test(c.file) && !EMAIL_PATH_RE.test(c.file));

  // 1. exact same component name defined in >1 file
  const byName = new Map();
  for (const c of comps) {
    if (!byName.has(c.name)) byName.set(c.name, []);
    byName.get(c.name).push(c);
  }
  let exactDuplicates = [...byName.entries()]
    .filter(([, defs]) => new Set(defs.map((d) => d.file)).size > 1)
    .map(([name, defs]) => ({
      name,
      files: [...new Set(defs.map((d) => d.file))],
      totalUsages: defs.reduce((s, d) => s + d.usageCount, 0),
    }))
    .sort((a, b) => b.files.length - a.files.length);

  // Same-name components living in different icons/ directories are ONE
  // problem — two icon libraries colliding — not N separate duplicates.
  const ICON_DIR_RE = /(^|\/)icons?\//i;
  const iconCollisions = exactDuplicates.filter((d) => d.files.every((f) => ICON_DIR_RE.test(f)));
  exactDuplicates = exactDuplicates.filter((d) => !iconCollisions.includes(d));

  // A "duplicate" where one file imports the same identifier from the other is
  // a wrapper/composition (memoized variant, styled passthrough) — still an
  // agent trap worth listing, but not a competing implementation.
  const perFile = new Map();
  for (const c of comps) perFile.set(c.file, (perFile.get(c.file) ?? 0) + 1);
  if (root) {
    for (const d of exactDuplicates) {
      if (d.files.length !== 2) continue;
      // A file defining 8+ components is an API surface (menu-item variants of
      // real components elsewhere) — same-name there is deliberate, not a copy.
      if (d.files.some((f) => (perFile.get(f) ?? 0) >= 8)) { d.wrapped = true; continue; }
      const base = (f) => f.replace(/\.[jt]sx?$/, '').split('/').pop();
      // Wrapper evidence must be strong: the same name imported ALIASED
      // (`EmptyState as EmptyStateBlock`) — a bare same-name import next to a
      // competing local definition would be a redeclaration error anyway, and
      // a loose match here would excuse real duplicates.
      const importsAliased = (fromFile, name, otherBase) => {
        let src; try { src = readFileSync(join(root, fromFile), 'utf8'); } catch { return false; }
        return new RegExp(`import\\s*(?:type\\s*)?{[^}]*\\b${name}\\s+as\\s+\\w+[^}]*}\\s*from`).test(src)
          || new RegExp(`import\\s*(?:type\\s*)?{[^}]*\\b${name}\\b[^}]*}\\s*from\\s*['"][^'"]*${otherBase}['"]`).test(src);
      };
      const [a, b] = d.files;
      if (importsAliased(a, d.name, base(b)) || importsAliased(b, d.name, base(a))) d.wrapped = true;
    }
  }

  // 2. name families around a shared root (only interesting with >1 distinct component)
  const byRoot = new Map();
  for (const c of comps) {
    const r = rootOf(c.name);
    if (!r) continue;
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(c);
  }
  const families = [...byRoot.entries()]
    .map(([root, members]) => {
      const uniq = new Map();
      for (const m of members) uniq.set(`${m.name}::${m.file}`, m);
      return { root, members: [...uniq.values()].map((m) => ({ name: m.name, file: m.file, usageCount: m.usageCount })) };
    })
    // A compound component (DialogHeader/DialogTitle/… in ONE file) is good
    // structure, not duplication — require multiple files. And when the repo
    // HAS a ui/ dir, sibling primitives inside it (ContextMenu vs Menubar) are
    // the library, not duplication: only flag families that CROSS the boundary
    // (a re-implementation outside echoing a root that exists inside).
    .filter((f) => {
      if (new Set(f.members.map((m) => m.name)).size < 2) return false;
      if (new Set(f.members.map((m) => m.file)).size < 2) return false;
      if (!uiDir) return true;
      const inside = f.members.filter((m) => m.file.startsWith(uiDir));
      const outside = f.members.filter((m) => !m.file.startsWith(uiDir));
      if (inside.length === 0 || outside.length === 0) return false;
      // The inside anchor must BE the root primitive (Card, Form) — a compound
      // part that merely contains the word (BreadcrumbList) is not a List
      // primitive, and outside echoes of it are not duplication.
      const canonical = inside.filter((m) => norm(m.name) === f.root
        || Object.entries(ALIASES).some(([a, r]) => r === f.root && norm(m.name) === a));
      if (canonical.length === 0) return false;
      f.members = [...canonical, ...outside];
      return true;
    })
    // Past ~8 members a "family" is a generic word (Input matching 37
    // components), not a consolidation target — noise that costs credibility.
    .filter((f) => f.members.length <= 8)
    .sort((a, b) => b.members.length - a.members.length);

  return { exactDuplicates, iconCollisions, families };
}
