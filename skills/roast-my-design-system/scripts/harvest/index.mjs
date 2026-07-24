#!/usr/bin/env node
/**
 * Harvest — step 1 of the Proffer pipeline. Non-destructive scan of a repo:
 * components (real props, real usages), all styling, implicit tokens with
 * frequency counts, duplicates, context files. Writes harvest.json; prints a
 * one-screen summary (the seed of the step-2 diagnosis).
 *
 *   node src/harvest/index.mjs <repo-path> [--out harvest.json]
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { walkRepo, profileRepo } from './walk.mjs';
import { harvestComponents } from './components.mjs';
import { harvestTokens } from './tokens.mjs';
import { findDuplicates } from './duplicates.mjs';
import { harvestContext } from './context.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const target = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!target) {
  console.error('Usage: node src/harvest/index.mjs <repo-path> [--out harvest.json]');
  process.exit(1);
}
const outPath = resolve(arg('out', 'harvest.json'));

const t0 = Date.now();
const files = walkRepo(target);
const profile = profileRepo(target, files);
const { components } = harvestComponents(target, files.code);
const tokens = harvestTokens(target, files.styles, files.code);
const duplicates = findDuplicates(components, profile.uiDir, target);
const context = harvestContext(target);

const harvest = {
  repo: target,
  harvestedAt: new Date().toISOString(),
  tookMs: null, // set below
  profile,
  files: {
    code: files.code.length,
    styles: files.styles.length,
    styleFiles: files.styles,
  },
  components,
  tokens,
  duplicates,
  context,
};
harvest.tookMs = Date.now() - t0;

writeFileSync(outPath, JSON.stringify(harvest, null, 2));

// ---------- one-screen summary ----------
const nonPage = components.filter((c) => !c.isPage);
const hexColors = tokens.colors.filter((c) => c.value.startsWith('#'));
const top = (list, n = 5) => list.slice(0, n).map((e) => `${e.value} ×${e.count}`).join(', ');

console.log(`\nHarvest: ${profile.name ?? target}`);
console.log(`  framework: ${profile.framework}${profile.typescript ? ' + TS' : ''}   design system: ${profile.designSystem.kind}${profile.designSystem.name ? ` (${profile.designSystem.name})` : ''}   styling: ${profile.stylingDeps.join(', ') || 'none detected'}`);
console.log(`  files: ${files.code.length} code, ${files.styles.length} style`);
console.log(`\n  components: ${components.length} defined (${nonPage.length} reusable, ${components.length - nonPage.length} pages)`);
console.log(`  duplicates: ${duplicates.exactDuplicates.length} exact same-name, ${duplicates.families.length} name families`);
for (const d of duplicates.exactDuplicates.slice(0, 3)) console.log(`    · ${d.name} defined in ${d.files.length} files`);
for (const f of duplicates.families.slice(0, 3)) console.log(`    · ${f.root} family: ${f.members.map((m) => m.name).join(', ')}`);
console.log(`\n  colours: ${tokens.colors.length} distinct (${hexColors.length} hex, of which ${tokens.greyCount} greys)   top: ${top(tokens.colors, 4)}`);
console.log(`  spacing: ${tokens.spacing.length} distinct CSS values   top: ${top(tokens.spacing, 5)}`);
console.log(`  radii: ${tokens.radii.length}   font sizes: ${tokens.fontSizes.length}   font families: ${tokens.fontFamilies.length}   shadows: ${tokens.shadows.length}`);
console.log(`  tailwind: ${tokens.tailwind.colors.length} colour utils, ${tokens.tailwind.spacing.length} spacing utils, ${tokens.tailwind.textSizes.length} text sizes`);
console.log(`  inline styles: ${tokens.inlineStyles.count} blocks`);
console.log(`  context files: ${context.map((c) => c.file).join(', ') || 'none'}`);
console.log(`\n  → ${outPath}   (${harvest.tookMs}ms)\n`);
