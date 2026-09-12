/**
 * The fix prompt: what the report's per-move copy buttons hand to whatever
 * agent the reader pastes it into. One move per prompt, deliberately: three
 * small finished fixes beat one long homework list, and re-running the scan
 * between them turns the score into a progress bar. The same composer will
 * feed the MCP `roast-fix` prompt, so the two doors always hand out the same
 * plan. Born from the first user feedback (Willem, 2026-08-31).
 */

// The two mistakes an agent chasing points makes (three repos, 2026-09-13):
// repainting a picture to a grey, and rounding a width another element
// depends on. Named in the prompt for the moves where they happen.
const TRAP_LINES = {
  paintTin: '- A gradient, an illustration or a status colour keeps its colour. Add a variable for it rather than swapping it to a grey; the swap is for text, borders and surfaces.',
  colors: '- A gradient, an illustration or a status colour keeps its colour. Add a variable for it rather than swapping it to a grey; the swap is for text, borders and surfaces.',
  arbitrary: '- Never round a width or height another element depends on: a preview panel, a skeleton that mirrors a chart, an editor pane. Name it if it repeats; leave it if it is one.',
  spacing: '- Never round a width or height another element depends on: a preview panel, a skeleton that mirrors a chart, an editor pane. Name it if it repeats; leave it if it is one.',
};

export function fixPrompt({ title, sub, deltaText, repoName, metric = null }) {
  const trap = TRAP_LINES[metric] ? `\n${TRAP_LINES[metric]}` : '';
  return `You are fixing one design-system finding in ${repoName ? `the ${repoName} repository` : 'this repository'}, measured by roast-my-design-system.

The finding: ${title}

The detail: ${sub}
${deltaText ? `\nExpected payoff: ${deltaText} on the report's 0-100 score.\n` : ''}
How to fix it, calmly and with respect for intent:
- A value used many times is a decision without a name, not a mistake. Name it and consolidate; never blind-delete.
- Small pixel nudges and one-off layout widths can be deliberate craft. Keep the deliberate exceptions; round the accidents to a neighbouring step.
- Prefer the tokens, scale steps and canonical components this repository already has over inventing new ones.
- Keep every change mechanical and reviewable. No redesigns, no drive-by refactors, no renamed files unless the finding asks for it.${trap}

Work through the files named in the finding. When you are done, re-run the scan to verify the payoff:

npx roast-my-design-system@latest`;
}
