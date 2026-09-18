#!/usr/bin/env node
/**
 * The review, standalone: the working tree's changed UI and style files
 * (git diff plus untracked) judged against the design system the scan found.
 * Same engine and same words as roast_review over MCP and `--check` on the
 * CLI; this entry exists so the review skill can run it from its own folder
 * without the npm launcher. Read-only. Exits 1 when there are findings, so a
 * script can gate on it.
 *
 *   node review/index.mjs <repo-root> [--json]
 */
import { resolve } from 'node:path';
import { loadKnowledge } from '../mcp/knowledge.mjs';
import { reviewData } from '../mcp/tools.mjs';
import { VERSION } from '../lib/version.mjs';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const root = resolve(argv.find((a) => !a.startsWith('--')) ?? '.');
const { text, total } = reviewData(loadKnowledge(root));
if (asJson) console.log(JSON.stringify({ version: VERSION, root, findings: total, text }, null, 2));
else console.log(text);
process.exit(total ? 1 : 0);
