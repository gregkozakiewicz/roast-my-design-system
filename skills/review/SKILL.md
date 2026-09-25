---
name: review
description: Review the UI and style files changed in the working tree against this repo's own design system, before they are saved or committed. Runs the same deterministic check as the CLI's --check flag (no tokens, about a second): hardcoded colours where a token exists, near-identical colour twins, off-scale spacing, radii, font sizes and shadows, typefaces outside the system, arbitrary Tailwind values, static inline styles, !important, duplicate component definitions and imports of the copy to avoid, new tokens that copy an existing one, chart colours written by hand where the repo keeps a chart palette (and one calm warning asking for a palette where it keeps none), and on a repo built on MUI, Mantine, Chakra, Ant Design or a Tailwind theme, colours or pixel sizes written onto kit components where the theme has a value. Findings name the file, the line and the fix. This is the small, fast check for what just changed; the roast skill is the full scan of the whole repo with a report.
when_to_use: Use when the user asks to review, check or validate their UI changes, their diff, their branch or "what I just wrote" against the design system, asks "did I break the design system", or wants a design-system check before committing. Do not use for a full audit or a score of the whole repo; that is the roast skill.
---

# Review my UI changes

You are checking the files that changed against the design system this repo already has. The engine does the judging; you explain the findings and help fix them.

## Steps

1. **Locate the repo root** (the directory with package.json; the current working directory unless the user pointed elsewhere). The check reads the git diff against HEAD plus untracked files, so it needs a git repository. If the user wants a different base (a branch, a commit), tell them the check compares with HEAD and suggest `git stash` or a branch checkout; do not fake it.

2. **Run the review** (deterministic, read-only, needs only Node 18 or newer):

   ```bash
   node ${CLAUDE_SKILL_DIR}/../roast-my-design-system/scripts/review/index.mjs <repo-root>
   ```

   `${CLAUDE_SKILL_DIR}` is this skill's own folder; the engine lives beside it in the roast skill's folder. Exit code 1 means findings, 0 means none. The output lists each changed file with its findings, a `Checked:` line naming every rule that ran, and a note for files left unjudged (email, print, artwork, pictures drawn with code).

3. **Report in chat, file by file.** For each finding: the line, what was found, and the fix the engine names. Keep the engine's numbers and paths exactly; never add findings of your own or soften the engine's. If there are no findings, say so in one line and quote the `Checked:` list, so "clean" is never mistaken for "certified".

4. **Offer to fix, then re-run.** When the user wants the fixes made, apply them in the kit's or the repo's own vocabulary as the finding says (a token, a spacing step, a theme path), never by deleting the code. Re-run step 2 after the edits and show that the count dropped. A finding the user calls deliberate stays, with a one-line comment in the code saying why.

5. **Keep it short.** This is a two-second check, not a roast: no verdict paragraph, no score. If the user wants the whole repo scored, point them to the roast skill.

## Rules

- Every number and path you state comes from the engine's output.
- A file the engine left unjudged is named as such, not passed as clean.
- Nothing here writes to the repo except the fixes the user asked for.
