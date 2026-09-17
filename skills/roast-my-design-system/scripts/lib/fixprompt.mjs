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
// A colour that identifies someone else's service is data, not styling, and
// !important is required by a utility class and by any override of CSS a
// library ships. Both were found by reading n8n's own prompts, 2026-09-16.
const BRAND_LINE = "- A colour that identifies someone else's service stays where it is: an integration's brand colour, a provider's badge, a logo. Tokenise the colours your own interface uses.";
const IMPORTANT_LINE = '- A utility class and an override of CSS a library ships both need !important to work at all. Fix the specificity only where the selector is your own; leave the ones aimed at a library, and the single-purpose classes that have to win.';

const TRAP_LINES = {
  paintTin: `- A gradient, an illustration or a status colour keeps its colour. Add a variable for it rather than swapping it to a grey; the swap is for text, borders and surfaces.\n${BRAND_LINE}`,
  colors: `- A gradient, an illustration or a status colour keeps its colour. Add a variable for it rather than swapping it to a grey; the swap is for text, borders and surfaces.\n${BRAND_LINE}`,
  kitColour: `- A chart series, an illustration or a status colour keeps its colour. Add it to the theme palette under a name rather than swapping it to a grey.\n- Read the theme where the kit reads it: sx paths ('text.secondary', 'primary.main'), theme.palette in styled() and makeStyles. Never import the theme file into a component just to read a hex.\n${BRAND_LINE}`,
  kitPx: `- Convert a spacing only when it lands exactly on a step of this theme's spacing unit. A size between steps is a decision: leave it and say so.\n- Only padding, margin and gap. Font size and line height belong to typography variants, radius to the theme's shape; a bare number for lineHeight is a multiplier, not pixels.\n- Never touch width, height or a size another element depends on.`,
  nearPairs: `- A near-white surface next to white, or a near-black next to black, is usually a deliberate layer (an input's fill on a dialog). Check where each is used before merging.\n- Only merge colours that do the same job in the same mode: a text colour and a border colour, or a light-mode and a dark-mode value, are not twins even when they look alike.\n- If one side is already a theme value, point the other at the theme, not at the hex.\n${BRAND_LINE}`,
  important: IMPORTANT_LINE,
  arbitrary: '- Never round a width or height another element depends on: a preview panel, a skeleton that mirrors a chart, an editor pane. Name it if it repeats; leave it if it is one.',
  spacing: '- Never round a width or height another element depends on: a preview panel, a skeleton that mirrors a chart, an editor pane. Name it if it repeats; leave it if it is one.',
};

// On a kit product, moving style={{}} to sx is only safe where the component
// takes sx: Linode's Akamai web components and OpenAEV's own field wrappers
// dropped it silently (2026-09-17).
const KIT_INLINE_LINE = "- Move a style to the kit's own styling (sx, a styled() component) only on the kit's components or on wrappers that pass their props to one kit component. Your own wrappers that take a style prop keep style; web components ignore sx.";

export function fixPrompt({ title, sub, deltaText, repoName, metric = null, kit = null }) {
  const lines = [TRAP_LINES[metric], kit && metric === 'inlineStyles' ? KIT_INLINE_LINE : null].filter(Boolean);
  const trap = lines.length ? `\n${lines.join('\n')}` : '';
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
