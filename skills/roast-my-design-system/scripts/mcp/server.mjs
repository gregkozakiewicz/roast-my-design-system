#!/usr/bin/env node
/**
 * roast-my-design-system --mcp — the local MCP server. A child process of the
 * agent's client (Claude Code, Cursor, Windsurf) speaking JSON-RPC 2.0 over
 * stdio, one message per line. No port, no account, no telemetry; the repo is
 * read, never written.
 *
 * The protocol slice is hand-rolled on purpose: the official SDK is an npm
 * dependency, and this package's promise is zero. We implement exactly what
 * the five tools need: initialize, tools, resources, prompts. Protocol
 * version pinned below; tested against real clients.
 *
 *   node src/mcp/server.mjs <repo-path>
 */
import { createInterface } from 'node:readline';
import { resolve, join, dirname } from 'node:path';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadKnowledge, freshKnowledge } from './knowledge.mjs';
import { getContext, findComponent, findToken, validate, review } from './tools.mjs';
import { rulesMarkdown } from '../rules/build.mjs';
import { VERSION } from '../lib/version.mjs';

const PROTOCOL = '2025-06-18';

// ---------- tool + resource + prompt catalogue ----------
// Descriptions are budgeted: every client loads them into every session, so
// each one carries only what changes an agent's tool choice (5.0.1 trim).
const TOOLS = [
  {
    name: 'roast_get_context',
    description: 'Design-system context before writing UI in this repo: tokens, canonical components, duplicates, spacing and type rules, from a real scan. Optional path ("packages/ui") narrows the slice.',
    inputSchema: { type: 'object', properties: { path: { type: 'string', description: 'Repo-relative folder (optional)' } } },
  },
  {
    name: 'roast_find_component',
    description: 'Find the canonical component for a name or intent ("icon button"). Returns import path, usage count and a real usage example, or an honest zero. Ties are reported, never guessed.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Component name or intent' } }, required: ['query'] },
  },
  {
    name: 'roast_find_token',
    description: 'Snap a raw value (#111111, 13px) to this repo\'s nearest token or scale step. Says so when no scale exists.',
    inputSchema: { type: 'object', properties: { value: { type: 'string', description: 'Colour or length value' } }, required: ['value'] },
  },
  {
    name: 'roast_validate',
    description: 'Check code before saving: hardcoded colours, near-token twins, off-scale spacing, arbitrary brackets, inline styles, !important, duplicate components. Findings name the fix.',
    inputSchema: { type: 'object', properties: { code: { type: 'string', description: 'The code to check' }, file: { type: 'string', description: 'Intended file path (optional)' } }, required: ['code'] },
  },
  {
    name: 'roast_review',
    description: 'Review the working tree\'s changed files (git diff + untracked) against the design system. Reads the diff itself; send no code. Call before finishing UI work.',
    inputSchema: { type: 'object', properties: {} },
  },
];

const RESOURCES = [
  { uri: 'roast://rules', name: 'Design system rules', description: 'Generated agent rules, compact', mimeType: 'text/markdown' },
  { uri: 'roast://components', name: 'Component ledger', description: 'Canonical picks, duplicates, never-imported, with usage counts', mimeType: 'text/plain' },
  { uri: 'roast://tokens', name: 'Token map', description: 'Colour tokens and spacing values in real use', mimeType: 'text/plain' },
];

const PROMPTS = [
  {
    name: 'roast-build-ui',
    description: 'Build UI in this repo the way the repo already does it',
    text: 'Before implementing any UI in this repository: call roast_get_context (pass the folder you will work in), check roast_find_component for anything you are about to create, and roast_find_token for any raw colour or size value. Build. Then call roast_validate on what you wrote and fix every finding, and finish with roast_review. Do not invent components, colours or spacing values this repository does not already have.',
  },
  {
    name: 'roast-review-ui',
    description: 'Review the current UI changes against the design system',
    text: 'Call roast_review to check the working tree\'s changed files against this repository\'s design system. For each finding, apply the named fix (use roast_find_component and roast_find_token to find the canonical replacement). Rerun roast_review until it reports no measured violations, then summarise what changed.',
  },
  {
    name: 'roast-fix',
    description: 'Fix the top Where-to-start move from a fresh scan; call again for the next one',
    dynamic: true,
    arguments: [{ name: 'move', description: 'Which move to fix (1-3); default is the top of the current list', required: false }],
  },
];

// roast-fix runs the real report pipeline (harvest, then diagnose --summary)
// so the prompt is byte-identical to what the report's copy buttons hold: one
// composer, two doors. Fresh scan every call, deliberately: fix the top move,
// ask again, and the next move has risen to the top. The two temp files match
// the promise the README already makes (a temp JSON and the report).
function fixMovePrompt(root, moveArg) {
  const dir = mkdtempSync(join(tmpdir(), 'roast-fix-'));
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const hPath = join(dir, 'h.json'), sPath = join(dir, 's.json');
    const run = (script, args) => {
      const r = spawnSync(process.execPath, [join(here, script), ...args], { encoding: 'utf8', timeout: 120000 });
      if (r.status !== 0) throw new Error(`${script} exited ${r.status}`);
    };
    run('../harvest/index.mjs', [root, '--out', hPath]);
    run('../diagnose/index.mjs', [hPath, '--out', join(dir, 'report.html'), '--summary', sPath]);
    const summary = JSON.parse(readFileSync(sPath, 'utf8'));
    const moves = summary.moves ?? [];
    if (!moves.length) {
      return `A fresh scan of this repository found no Where-to-start moves: nothing at the top level is worth a fix prompt right now${summary.score !== null && summary.score !== undefined ? ` (score ${summary.score}/100)` : ''}. Run roast_review on your changed files if you want the working tree checked instead.`;
    }
    const idx = Math.min(Math.max(parseInt(moveArg, 10) || 1, 1), moves.length) - 1;
    const extra = moves.length > 1 ? `\n\n(${moves.length} moves on the current list; this is number ${idx + 1}. Ask for roast-fix again after fixing: the scan refreshes and the next move rises to the top.)` : '';
    return moves[idx].prompt + extra;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- resource bodies ----------
function resourceBody(uri, k) {
  if (uri === 'roast://rules') {
    return rulesMarkdown(harvestShape(k), { compact: true }).text;
  }
  if (uri === 'roast://components') {
    const L = ['Reusable components (usage counts are repo-wide):'];
    for (const c of k.canonical.slice(0, 40)) L.push(`  <${c.name}> ${c.file} (${c.usageCount}x)`);
    const dupes = [...k.dupeByName.values()];
    if (dupes.length) {
      L.push('Duplicates (competing copies, do not add more):');
      for (const d of dupes.slice(0, 15)) L.push(`  <${d.name}> in ${d.files.map((f) => (typeof f === 'string' ? f : f.file)).join(' + ')}`);
    }
    if (k.neverImported.length) {
      L.push(`Defined but never imported (adopt or delete, never duplicate): ${k.neverImported.slice(0, 10).map((c) => `<${c.name}>`).join(' ')}`);
    }
    return L.join('\n');
  }
  if (uri === 'roast://tokens') {
    const L = [];
    L.push(k.tokens.tokenFile ? `Token file: ${k.tokens.tokenFile}` : 'No token file exists in this repo.');
    if (k.tokenColors.length) L.push(`Colour tokens: ${k.tokenColors.join(' ')}`);
    const strays = k.tokens.colors.filter((c) => !c.isToken).slice(0, 10);
    if (strays.length) L.push(`Top hardcoded strays (do not copy these): ${strays.map((c) => `${c.value} (${c.count}x)`).join(', ')}`);
    L.push(k.usesTailwind ? 'Spacing: Tailwind scale.' : `Spacing values in use: ${[...k.spacingSeen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([v, c]) => `${v} (${c}x)`).join(', ') || 'none on record'}`);
    return L.join('\n');
  }
  return null;
}

// knowledge → the harvest-shaped object rulesMarkdown expects
function harvestShape(k) {
  return {
    repo: k.root, harvestedAt: k.scannedAt, profile: k.profile,
    components: k.components, tokens: k.tokens, duplicates: k.duplicates,
    context: k.context, staleRules: [], packages: [],
  };
}

// ---------- server loop ----------
export function serve(root) {
  let k = loadKnowledge(root);
  const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  const reply = (id, result) => send({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => send({ jsonrpc: '2.0', id, error: { code, message } });

  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params } = msg;

    try {
      switch (method) {
        case 'initialize':
          reply(id, {
            protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : PROTOCOL,
            capabilities: { tools: {}, resources: {}, prompts: {} },
            serverInfo: { name: 'roast-my-design-system', version: VERSION },
            instructions: 'Design-system answers for this repo, from a real scan, all local and read-only. Loop: roast_get_context before building, find_component / find_token while building, roast_validate before saving, roast_review before finishing.',
          });
          return;
        case 'notifications/initialized':
        case 'initialized':
          return; // notification, no reply
        case 'ping':
          reply(id, {});
          return;
        case 'tools/list':
          reply(id, { tools: TOOLS });
          return;
        case 'tools/call': {
          k = freshKnowledge(k);
          const { name, arguments: args = {} } = params ?? {};
          const impl = {
            roast_get_context: () => getContext(k, args),
            roast_find_component: () => findComponent(k, args),
            roast_find_token: () => findToken(k, args),
            roast_validate: () => validate(k, args),
            roast_review: () => review(k),
          }[name];
          if (!impl) { fail(id, -32602, `Unknown tool: ${name}`); return; }
          const out = impl();
          // invalid input: same guidance text, but flagged so the calling
          // model self-corrects (spec: input-validation errors are results
          // with isError true, not plain successes)
          if (out?.invalidInput) { reply(id, { content: [{ type: 'text', text: out.text }], isError: true }); return; }
          reply(id, { content: [{ type: 'text', text: out }] });
          return;
        }
        case 'resources/list':
          reply(id, { resources: RESOURCES });
          return;
        case 'resources/read': {
          k = freshKnowledge(k);
          const body = resourceBody(params?.uri, k);
          if (body === null) { fail(id, -32602, `Unknown resource: ${params?.uri}`); return; }
          reply(id, { contents: [{ uri: params.uri, mimeType: RESOURCES.find((r) => r.uri === params.uri)?.mimeType ?? 'text/plain', text: body }] });
          return;
        }
        case 'prompts/list':
          reply(id, { prompts: PROMPTS.map(({ name, description, arguments: args }) => ({ name, description, ...(args ? { arguments: args } : {}) })) });
          return;
        case 'prompts/get': {
          const p = PROMPTS.find((x) => x.name === params?.name);
          if (!p) { fail(id, -32602, `Unknown prompt: ${params?.name}`); return; }
          const text = p.dynamic ? fixMovePrompt(root, params?.arguments?.move) : p.text;
          reply(id, { description: p.description, messages: [{ role: 'user', content: { type: 'text', text } }] });
          return;
        }
        default:
          if (id !== undefined) fail(id, -32601, `Method not found: ${method}`);
      }
    } catch (e) {
      if (id !== undefined) fail(id, -32603, `Internal error: ${e.message}`);
    }
  });
}

// direct run: node src/mcp/server.mjs <repo-path>
if (import.meta.url === `file://${process.argv[1]}`) {
  serve(resolve(process.argv[2] ?? '.'));
}
