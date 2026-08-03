/**
 * Design-system components defined but never imported — scoped so the claim
 * is honest. File-local subcomponents elsewhere legitimately never get
 * imported by name; icon sets are deliberately complete; sub-exports of an
 * adopted file are API surface, not dead code. Shared by diagnose, rules and
 * the benchmark builder.
 */
export function neverImportedComponents(components, uiDir) {
  const reusable = (components ?? []).filter((c) => !c.isPage);
  const dsDirRe = uiDir
    ? new RegExp(`^${uiDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`)
    : /(^|\/)(packages\/ui|design-system|ui-kit)\//;
  const usedFiles = new Set(reusable.filter((c) => c.usageCount > 0).map((c) => c.file));
  return reusable.filter((c) => !c.usageCount && dsDirRe.test(c.file)
    && !/(^|\/)icons?\//.test(c.file)
    && !usedFiles.has(c.file));
}
