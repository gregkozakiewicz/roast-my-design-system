#!/usr/bin/env node
/**
 * SARIF export — the same findings, written in the format GitHub's code
 * scanning tab and enterprise tooling ingest (SARIF 2.1.0). File-level
 * results (the scanner counts per file, it does not keep line numbers), which
 * code scanning renders as file annotations.
 *
 *   node src/sarif/index.mjs <harvest.json> --out design-system-roast.sarif
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VERSION } from '../lib/version.mjs';
import { nearColorPairs } from '../lib/nearpairs.mjs';
import { neverImportedComponents } from '../lib/neverimported.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const inPath = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!inPath) { console.error('Usage: node src/sarif/index.mjs <harvest.json> --out design-system-roast.sarif'); process.exit(1); }
const outPath = resolve(arg('out', 'design-system-roast.sarif'));

const h = JSON.parse(readFileSync(inPath, 'utf8'));
const t = h.tokens;

const RULES = {
  'duplicate-component': { name: 'Duplicated component', desc: 'A component implemented more than once. An agent asked for it has several plausible answers.' },
  'never-imported-component': { name: 'Component nobody imports', desc: 'Defined in the system, imported by nothing. It sits there as a wrong answer waiting to be picked.' },
  'inline-styles': { name: 'Inline style blocks', desc: 'Static values written as style attributes, bypassing the system and teaching the agent to do the same.' },
  'important-styles': { name: '!important declarations', desc: 'The cascade admitting defeat. Fix specificity at the source and these stop being necessary.' },
  'stray-colors': { name: 'Hardcoded colours', desc: 'Colour values no token names. Each one is a value the agent will happily copy.' },
  'stale-rule-reference': { name: 'Stale agent-rule reference', desc: 'The agent rules reference something this scan can no longer find. A rule the agent obeys is worse than no rule when the repo has moved on.' },
};

const results = [];
const loc = (file) => [{ physicalLocation: { artifactLocation: { uri: file } } }];
const push = (ruleId, level, text, file) => results.push({ ruleId, level, message: { text }, locations: loc(file) });

for (const d of (h.duplicates?.exactDuplicates ?? [])) {
  if (d.wrapped) continue;
  for (const f of d.files) {
    const file = typeof f === 'string' ? f : f.file;
    push('duplicate-component', 'warning', `<${d.name}> is implemented in ${d.files.length} places. This is one of them; an agent has to guess which is canonical.`, file);
  }
}
for (const c of neverImportedComponents(h.components ?? [], h.profile?.uiDir ?? null)) {
  push('never-imported-component', 'note', `<${c.name}> is defined here and imported by nothing.`, c.file);
}
for (const f of (t.inlineStyles?.files ?? [])) {
  push('inline-styles', 'warning', `${f.count} static inline style block${f.count === 1 ? '' : 's'} in this file. Dynamic positioning is already excluded, so these could be classes or tokens today.`, f.file);
}
for (const f of (t.important?.files ?? [])) {
  push('important-styles', 'warning', `${f.count} !important declaration${f.count === 1 ? '' : 's'} in this file.`, f.file);
}
// stray colours: per file, counting only non-token values
const strayByFile = new Map();
for (const c of (t.colors ?? [])) {
  if (c.isToken) continue;
  for (const f of (c.files ?? [])) strayByFile.set(f.file, (strayByFile.get(f.file) ?? 0) + 1);
}
for (const [file, count] of [...strayByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)) {
  push('stray-colors', 'note', `${count} hardcoded colour value${count === 1 ? '' : 's'} no token names.`, file);
}
for (const s of (h.staleRules ?? [])) {
  push('stale-rule-reference', 'warning', `${s.ref} is ${s.problem === 'missing' ? 'referenced here but no longer exists in the repo' : 'named here but nothing imports it this scan'}.`, s.file);
}

const sarif = {
  $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
  version: '2.1.0',
  runs: [{
    tool: {
      driver: {
        name: 'roast-my-design-system',
        version: VERSION,
        informationUri: 'https://github.com/pencilrebel/roast-my-design-system',
        rules: Object.entries(RULES).map(([id, r]) => ({
          id, name: r.name,
          shortDescription: { text: r.name },
          fullDescription: { text: r.desc },
          helpUri: 'https://github.com/pencilrebel/roast-my-design-system',
        })),
      },
    },
    results,
  }],
};
writeFileSync(outPath, JSON.stringify(sarif, null, 2));
console.log(`✓ SARIF: ${results.length} findings → ${outPath}`);
console.log(`  Upload it in CI and they appear in GitHub's code scanning tab, annotated on files.`);
