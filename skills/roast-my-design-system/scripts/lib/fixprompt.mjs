/**
 * The fix prompt: what the report's per-move copy buttons hand to whatever
 * agent the reader pastes it into. One move per prompt, deliberately: three
 * small finished fixes beat one long homework list, and re-running the scan
 * between them turns the score into a progress bar. The same composer will
 * feed the MCP `roast-fix` prompt, so the two doors always hand out the same
 * plan. Born from the first user feedback (Willem, 2026-08-31).
 */

export function fixPrompt({ title, sub, deltaText, repoName }) {
  return `You are fixing one design-system finding in ${repoName ? `the ${repoName} repository` : 'this repository'}, measured by roast-my-design-system.

The finding: ${title}

The detail: ${sub}
${deltaText ? `\nExpected payoff: ${deltaText} on the report's 0-100 score.\n` : ''}
How to fix it, calmly and with respect for intent:
- A value used many times is a decision without a name, not a mistake. Name it and consolidate; never blind-delete.
- Small pixel nudges and one-off layout widths can be deliberate craft. Keep the deliberate exceptions; round the accidents to a neighbouring step.
- Prefer the tokens, scale steps and canonical components this repository already has over inventing new ones.
- Keep every change mechanical and reviewable. No redesigns, no drive-by refactors, no renamed files unless the finding asks for it.

Work through the files named in the finding. When you are done, re-run the scan to verify the payoff:

npx roast-my-design-system@latest`;
}
