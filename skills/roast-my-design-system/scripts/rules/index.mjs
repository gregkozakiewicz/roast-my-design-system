#!/usr/bin/env node
/**
 * Rules — turns a harvest.json into design-system-rules.md: a paste-ready
 * agent-rules section (CLAUDE.md, .cursor/rules, AGENTS.md) generated from
 * what the scan actually measured. The report diagnoses the past; this file
 * protects the future — every rule carries a receipt from this repo.
 * (The report also embeds this same markdown behind the gift reveal.)
 *
 *   node src/rules/index.mjs <harvest.json> [--out design-system-rules.md]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rulesMarkdown } from './build.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const inPath = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!inPath) { console.error('Usage: node src/rules/index.mjs <harvest.json> [--out design-system-rules.md]'); process.exit(1); }
const outPath = resolve(arg('out', 'design-system-rules.md'));

const h = JSON.parse(readFileSync(inPath, 'utf8'));
const { text, ruleCount } = rulesMarkdown(h);
writeFileSync(outPath, text);
console.log(`✓ Agent rules for ${h.profile?.name ?? 'this repo'}: ${ruleCount} rules, all with receipts`);
console.log(`  → ${outPath}`);
