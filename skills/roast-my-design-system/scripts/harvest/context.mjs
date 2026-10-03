/**
 * Context-file harvest — the agent-facing and design-facing docs the repo
 * already has. Step 5 (wire up their agent) needs to know what exists so it
 * extends rather than clobbers; the diagnosis mentions what's missing.
 *
 * Two passes: the root checklist below (known doors at known paths), then a
 * nested sweep for rules files living inside subfolders, because that is how
 * monorepos actually do it (twenty carries 35 AGENTS.md files; a root-only
 * look reported 1 and called it the whole story). Nested entries carry
 * nested:true so the report can summarise them instead of flooding chips.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CONTEXT_FILES = [
  { file: 'CLAUDE.md',        kind: 'agent-rules', tool: 'Claude Code' },
  { file: 'AGENTS.md',        kind: 'agent-rules', tool: 'generic (AGENTS.md standard)' },
  { file: 'GEMINI.md',        kind: 'agent-rules', tool: 'Gemini CLI' },
  { file: '.cursorrules',     kind: 'agent-rules', tool: 'Cursor (legacy format)' },
  { file: '.cursor/rules',    kind: 'agent-rules', tool: 'Cursor', dir: true },
  { file: '.github/copilot-instructions.md', kind: 'agent-rules', tool: 'GitHub Copilot' },
  { file: '.github/instructions', kind: 'agent-rules', tool: 'GitHub Copilot (scoped)', dir: true },
  { file: '.windsurfrules',   kind: 'agent-rules', tool: 'Windsurf (legacy format)' },
  { file: '.windsurf/rules',  kind: 'agent-rules', tool: 'Windsurf', dir: true },
  { file: 'components.json',  kind: 'design-config', tool: 'shadcn/ui' },
  { file: 'tailwind.config.js',  kind: 'design-config', tool: 'Tailwind' },
  { file: 'tailwind.config.ts',  kind: 'design-config', tool: 'Tailwind' },
  { file: 'design-system.md', kind: 'design-doc' },
  { file: 'DESIGN.md',        kind: 'design-doc' },
  { file: 'STYLEGUIDE.md',    kind: 'design-doc' },
];

// Nested sweep targets: the doors that tools officially read from
// subdirectories (closer file wins, per the AGENTS.md standard and Cursor's
// docs). Only these — a nested tailwind.config is build detail, not a door.
const NESTED_FILES = {
  'CLAUDE.md': 'Claude Code',
  'AGENTS.md': 'generic (AGENTS.md standard)',
  'GEMINI.md': 'Gemini CLI',
};
const NESTED_DIRS = {
  '.cursor': { child: 'rules', tool: 'Cursor' },
  '.windsurf': { child: 'rules', tool: 'Windsurf' },
};

const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.cache', 'vendor', 'tmp',
]);
const MAX_DEPTH = 6;
// where the skills CLI installs a skill, per tool
const SKILL_DIRS = ['.claude/skills', '.agents/skills', '.cursor/skills', '.codex/skills', '.github/skills', '.windsurf/skills', 'skills'];
// framework-managed blocks: markers and who writes them
const MANAGED = [
  { by: 'Next.js', start: /<!--\s*(BEGIN:nextjs-agent-rules|NEXT-AGENTS-MD-START)\s*-->/, end: /<!--\s*(END:nextjs-agent-rules|NEXT-AGENTS-MD-END)\s*-->/ },
];
function managedBlock(raw) {
  for (const m of MANAGED) {
    const a = raw.search(m.start), e = raw.search(m.end);
    if (a < 0 || e < 0) continue;
    const rest = (raw.slice(0, a) + raw.slice(e).replace(m.end, '')).trim();
    return { by: m.by, only: rest.length === 0 };
  }
  return null;
}
const MAX_NESTED = 60; // entries recorded; the true count keeps counting

function sweepNested(root) {
  const found = [];
  let total = 0;
  const walk = (dir, rel, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        const nd = NESTED_DIRS[e.name];
        if (nd) {
          // rel is empty at the root, where the checklist above already owns
          // these paths; the sweep only reports the nested ones.
          if (rel && existsSync(join(dir, e.name, nd.child))) {
            total++;
            if (found.length < MAX_NESTED) found.push({ file: `${relPath}/${nd.child}`, kind: 'agent-rules', tool: nd.tool, nested: true, size: null, mentionsDesign: null });
          }
          continue; // never descend into tool dot-dirs
        }
        if (e.name.startsWith('.')) continue;
        walk(join(dir, e.name), relPath, depth + 1);
      } else if (depth > 0 && NESTED_FILES[e.name]) {
        total++;
        if (found.length < MAX_NESTED) {
          let size = 0;
          try { size = statSync(join(dir, e.name)).size; } catch { /* unreadable */ }
          found.push({ file: relPath, kind: 'agent-rules', tool: NESTED_FILES[e.name], nested: true, size, mentionsDesign: null });
        }
      }
    }
  };
  walk(root, '', 0);
  return { found, total };
}

export function harvestContext(root) {
  const found = [];
  for (const c of CONTEXT_FILES) {
    const p = join(root, c.file);
    if (!existsSync(p)) continue;
    let size = 0, mentionsDesign = false;
    try {
      const st = statSync(p);
      if (c.dir || st.isDirectory()) { found.push({ ...c, size: null, mentionsDesign: null }); continue; }
      size = st.size;
      if (size < 200_000) {
        const raw = readFileSync(p, 'utf8');
        const text = raw.toLowerCase();
        mentionsDesign = /design system|component|token|color|colour|styling|tailwind|css/.test(text);
        // A block a framework writes and re-writes (Next.js's dev server adds
        // its agent-rules block whenever it sees an agent) is not the team's
        // guidance. managedOnly: nothing else in the file.
        const m = managedBlock(raw);
        if (m) { found.push({ file: c.file, kind: c.kind, tool: c.tool ?? null, size, mentionsDesign, managedBy: m.by, managedOnly: m.only }); continue; }
      }
    } catch { /* unreadable */ }
    found.push({ file: c.file, kind: c.kind, tool: c.tool ?? null, size, mentionsDesign });
  }
  // shadcn's own skill, installed by the skills CLI into a tool's skills
  // folder: the one thing that tells an agent the kit is there.
  for (const dir of SKILL_DIRS) {
    const p = join(root, dir);
    if (!existsSync(p)) continue;
    let names = [];
    try { names = readdirSync(p); } catch { continue; }
    const hit = names.find((nm) => /^shadcn/i.test(nm));
    if (hit) { found.push({ file: `${dir}/${hit}`, kind: 'agent-skill', tool: 'shadcn skill', size: null, mentionsDesign: true }); break; }
  }
  const nested = sweepNested(root);
  found.push(...nested.found);
  if (nested.total > nested.found.length) {
    found.push({ file: `(+${nested.total - nested.found.length} more nested rules files)`, kind: 'agent-rules', tool: null, nested: true, size: null, mentionsDesign: null });
  }
  return found;
}
