/**
 * Terminal summary lines for a harvest, split so the npx wrapper can change
 * the running order: header first, diagnosis from step 2 next, details after.
 * Running harvest/index.mjs directly (the skill flow) prints both in one go.
 * Everything reads from the harvest object itself, so the wrapper can render
 * details from harvest.json after the harvest process has exited.
 */

// A truncated capture like "rgba(var(--ink-rgb)" reads as a glitch in the
// terminal; the token reference inside it is the real story, so show that.
const showVal = (v) => {
  const m = /var\((--[A-Za-z0-9_-]+)/.exec(v);
  const balanced = (v.match(/\(/g) ?? []).length === (v.match(/\)/g) ?? []).length;
  return m && !balanced ? `var(${m[1]})` : v;
};

// A "top" list is only news when something repeats; all-×1 says nothing.
const top = (list, n = 5) => list.some((e) => e.count > 1)
  ? `   top: ${list.slice(0, n).map((e) => `${showVal(e.value)} ×${e.count}`).join(', ')}`
  : (list.length ? ', none repeated' : '');

export function headerLines(h) {
  const p = h.profile;
  return [
    `Harvest: ${p.name ?? h.repo}`,
    `  → framework: ${p.framework}${p.typescript ? ' + TS' : ''}   design system: ${p.designSystem.kind}${p.designSystem.name ? ` (${p.designSystem.name})` : ''}   styling: ${p.stylingDeps.join(', ') || 'none detected'}`,
  ];
}

export function detailLines(h) {
  const lines = [];
  const components = h.components ?? [];
  const duplicates = h.duplicates ?? { exactDuplicates: [], families: [] };
  const tokens = h.tokens;
  const nonPage = components.filter((c) => !c.isPage);
  const hexColors = tokens.colors.filter((c) => c.value.startsWith('#'));

  lines.push(`  files: ${h.files.code} code, ${h.files.styles} style`);
  if (h.exclusions?.patterns?.length) {
    // Same voice as the report header: source named once, slashes on folders,
    // and the total at the end because that is the number that lands.
    const groups = [...new Set(h.exclusions.patterns.map((p) => p.source))].map((src) => {
      const own = h.exclusions.patterns.filter((p) => p.source === src);
      return `(${src}): ${own.map((p, i) => `${p.pattern}/ ${p.files}${i === 0 ? ' files' : ''}`).join(', ')}`;
    });
    lines.push(`  excluded by you ${groups.join(' · ')} · ${h.exclusions.filesExcluded} files kept out of this scan`);
  }
  lines.push('');
  lines.push(`  components: ${components.length} defined (${nonPage.length} reusable, ${components.length - nonPage.length} pages)`);
  lines.push(`  duplicates: ${duplicates.exactDuplicates.length} exact same-name, ${duplicates.families.length} name families`);
  for (const d of duplicates.exactDuplicates.slice(0, 3)) lines.push(`    · ${d.name} defined in ${d.files.length} files`);
  for (const f of duplicates.families.slice(0, 3)) lines.push(`    · ${f.root} family: ${f.members.map((m) => m.name).join(', ')}`);
  lines.push('');
  lines.push(`  colours: ${tokens.colors.length} distinct (${hexColors.length} hex, of which ${tokens.greyCount} greys)${top(tokens.colors, 4)}`);
  lines.push(`  spacing: ${tokens.spacing.length} distinct CSS values${top(tokens.spacing, 5)}`);
  lines.push(`  radii: ${tokens.radii.length}   font sizes: ${tokens.fontSizes.length}   font families: ${tokens.fontFamilies.length}   shadows: ${tokens.shadows.length}`);
  lines.push(`  tailwind: ${tokens.tailwind.colors.length} colour utils, ${tokens.tailwind.spacing.length} spacing utils, ${tokens.tailwind.textSizes.length} text sizes`);
  lines.push(`  inline styles: ${tokens.inlineStyles.count} blocks`);
  lines.push(`  context files: ${(h.context ?? []).map((c) => c.file).join(', ') || 'none'}`);
  return lines;
}
