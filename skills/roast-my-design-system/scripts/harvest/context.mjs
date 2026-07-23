/**
 * Context-file harvest — the agent-facing and design-facing docs the repo
 * already has. Step 5 (wire up their agent) needs to know what exists so it
 * extends rather than clobbers; the diagnosis mentions what's missing.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const CONTEXT_FILES = [
  { file: 'CLAUDE.md',        kind: 'agent-rules', tool: 'Claude Code' },
  { file: 'AGENTS.md',        kind: 'agent-rules', tool: 'generic (AGENTS.md standard)' },
  { file: '.cursorrules',     kind: 'agent-rules', tool: 'Cursor (legacy format)' },
  { file: '.cursor/rules',    kind: 'agent-rules', tool: 'Cursor', dir: true },
  { file: '.github/copilot-instructions.md', kind: 'agent-rules', tool: 'GitHub Copilot' },
  { file: '.windsurfrules',   kind: 'agent-rules', tool: 'Windsurf' },
  { file: 'components.json',  kind: 'design-config', tool: 'shadcn/ui' },
  { file: 'tailwind.config.js',  kind: 'design-config', tool: 'Tailwind' },
  { file: 'tailwind.config.ts',  kind: 'design-config', tool: 'Tailwind' },
  { file: 'design-system.md', kind: 'design-doc' },
  { file: 'DESIGN.md',        kind: 'design-doc' },
  { file: 'STYLEGUIDE.md',    kind: 'design-doc' },
];

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
        const text = readFileSync(p, 'utf8').toLowerCase();
        mentionsDesign = /design system|component|token|color|colour|styling|tailwind|css/.test(text);
      }
    } catch { /* unreadable */ }
    found.push({ file: c.file, kind: c.kind, tool: c.tool ?? null, size, mentionsDesign });
  }
  return found;
}
