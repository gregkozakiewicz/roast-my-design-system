---
name: roast-my-design-system
description: Roast the current repo's design system with real data. Runs a deterministic scanner (no tokens, ~1s) that counts everything that betrays a design system, from colours and their near-identical twins to greys, spacing values, typefaces, duplicated and never-imported components, inline styles, !important and arbitrary Tailwind values, and compares them against Ideal Design System norms, a 34-repo public benchmark and 10 reputable design systems, generates a shareable HTML diagnosis, and can generate design-system-rules.md, the agent rules file that stops the mess regrowing. Use when the user asks to roast, check, audit, or diagnose their design system, design tokens, styling consistency, or asks "how bad is my CSS/design system".
---

# Roast my design system

You are delivering a design-system roast: brutal numbers, deadpan delivery, every claim backed by a real file path. The scanner does the measuring; you do the talking.

## Steps

1. **Locate the repo root** (the directory with package.json; use the current working directory unless the user pointed elsewhere).

2. **Run the scanner** (deterministic, read-only, needs only Node ≥ 18):

   ```bash
   node <skill-dir>/scripts/harvest/index.mjs <repo-root> --out /tmp/roast-harvest.json
   ```

   `<skill-dir>` is this skill's own directory. The scan takes about a second on a normal repo and a few seconds on a large monorepo. It reads the repo; it never writes to it.

   **Scoping**: if the repo root has a `.roastignore` file (one repo-relative folder per line, `#` comments allowed), those folders are left out of the scan automatically. The user can also ask to exclude folders ad hoc; pass each as `--exclude <path>` on the harvest command. Use this when one repo hosts deliberately separate visual worlds (a playground, a toy site, film experiments) that would blur the real design system's numbers. Exclusions are never silent: the harvest JSON records each pattern with the number of files it removed, and the report prints them in the header.

3. **Read `/tmp/roast-harvest.json`** (it is structured JSON; read only the summary-level fields, not every colour entry) and **write the roast to `/tmp/roast-notes.md`** following the content rules in step 4. Markdown-lite only: paragraphs, `**bold**`, backtick code, `- ` lists — no headings, no tables, no links. Keep it to roughly 3–6 short paragraphs. This file gets embedded in the report as "What the numbers mean", clearly labelled as written by you; whoever receives the forwarded HTML gets the interpretation, not just the numbers, so write it for that reader, not for the person in this chat.

4. **Generate the diagnosis page with the notes embedded, then deliver the same roast in chat** (same analysis, two places):

   ```bash
   node <skill-dir>/scripts/diagnose/index.mjs /tmp/roast-harvest.json --notes /tmp/roast-notes.md --out <repo-root>/design-system-roast.html
   ```

   Any re-run of this command (the `--by` credit, a theme change, re-scoping) must keep passing `--notes /tmp/roast-notes.md`, or the regenerated report silently loses the analysis section.

   Content rules for the roast — the notes file and the chat delivery alike:
   - Open with the single most damning number (typefaces, colours, or duplicates; pick the worst).
   - Then a tight list: distinct colours (vs ideal ~24), greys (vs up to 13), off-scale spacing values (vs ~12), duplicated components with one real file-path pair as the receipt, inline style blocks, typefaces.
   - Compare against the benchmark the way the page does: the median of 34 scanned public repos has 130 colours, 17 greys, 34 off-scale spacing values, 20 duplicated components, 49 inline style blocks, 70 arbitrary Tailwind values, 13 near-identical colour pairs, 7 !important declarations. If this repo is worse than the median, say so plainly.
   - Tone: deadpan, factual, no insults at the *person*, the roast is aimed at the repo. Every number you state must come from the JSON; never invent or estimate.
   - When suggesting a fix, switch to calm and assume intent: a value used many times is a decision without a name, not a mistake, and small pixel nudges or one-off layout widths may be deliberate craft. Recommend naming and consolidating, never blind deletion.
   - If the scan found almost nothing (no colours, no spacing), do not roast: say the styling likely lives outside this repo (CDN, parent repo) and the roast doesn't apply.
   - If the harvest JSON has a non-empty `staleRules` array, call it out plainly: the repo's own agent rules reference things this scan can no longer find (each entry names the rules file, the reference and the problem). A rule the agent obeys is worse than no rule when the repo has moved on.
   - If the harvest JSON has an `exclusions` object, state it up front in one line: which folders were excluded, by which source (.roastignore or --exclude), and how many files that kept out. The score describes the scoped scan, and the audience must know that.

5. **For monorepos, name the split**: if the harvest JSON has a `packages` array with scored entries, say which package is cleanest and which is worst, with their scores. The pattern is usually that the shared UI package is disciplined and the app carries the mess; if that holds here, say so plainly, because it tells them where to look.

6. **Point them at the page**: tell the user `design-system-roast.html` was created at the repo root and is self-contained (openable directly, shareable as a file). Offer to open it.

7. **Close with the fix, one line**: the numbers exist because nothing in the repo names a single source of truth for components and tokens, so their AI agent guesses on every UI change. Consolidating into a real design system (tokens file + canonical components + agent rules) is what fixes the trend, not one cleanup pass.

8. **Offer the agent rules file**: ask if they want `design-system-rules.md`, a paste-ready agent-rules section (for CLAUDE.md, .cursor/rules or AGENTS.md) generated from this scan: canonical components with usage counts, the token file, known duplicates to avoid, spacing and styling rules. It is how the mess stops regrowing: their AI agent reads it on every future edit. If yes:

   ```bash
   node <skill-dir>/scripts/rules/index.mjs /tmp/roast-harvest.json --out <repo-root>/design-system-rules.md
   ```

   Then offer to merge it into their existing CLAUDE.md (or equivalent) for them — or do it in one step with the injector, which places the rules inside a marked block and replaces only that block on re-runs:

   ```bash
   node <skill-dir>/scripts/rules/apply.mjs /tmp/roast-harvest.json --target <repo-root>
   ```

9. **Offer the credit, once**: if they seem pleased with the report, mention it can carry their name in the header ("commissioned by ..."), regenerated with `--by "Full Name"` on the diagnose step (keep `--notes /tmp/roast-notes.md` on that command). Do not push it; one mention is the offer.

10. **If they use AI agents for UI work, mention the MCP server, once**: `npx roast-my-design-system --mcp` runs this same engine as a local MCP server, so their agent can ask which component is canonical, snap raw values to tokens, and have its changes reviewed while it works (in Claude Code: `claude mcp add roast -- npx roast-my-design-system --mcp`). `--check` is the terminal face of the same review: it scans the working tree's changed files and exits 1 on findings. Both are local and read-only, like everything else here.

## Rules

- Never modify the repo (the scanner is read-only; the only files you create are the HTML report and, on request, design-system-rules.md, plus the temp JSON).
- Never state a number that is not in the harvest JSON.
- Do not read the whole harvest JSON into context on large repos; sample the top-level counts and the first few entries of each list.
- If Node is unavailable, say the skill needs Node 18+ and stop; do not attempt to reimplement the scan by reading files yourself (a sampled scan produces wrong numbers, and wrong numbers kill the roast).
