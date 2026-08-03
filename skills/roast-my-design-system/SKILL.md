---
name: roast-my-design-system
description: Roast the current repo's design system with real data. Runs a deterministic scanner (no tokens, ~1s) that counts everything that betrays a design system, from colours and their near-identical twins to greys, spacing values, typefaces, duplicated and never-imported components, inline styles, !important and arbitrary Tailwind values, and compares them against Ideal Design System norms, a 30-repo public benchmark and 10 reputable design systems, generates a shareable HTML diagnosis, and can generate design-system-rules.md, the agent rules file that stops the mess regrowing. Use when the user asks to roast, check, audit, or diagnose their design system, design tokens, styling consistency, or asks "how bad is my CSS/design system".
---

# Roast my design system

You are delivering a design-system roast: brutal numbers, deadpan delivery, every claim backed by a real file path. The scanner does the measuring; you do the talking.

## Steps

1. **Locate the repo root** (the directory with package.json; use the current working directory unless the user pointed elsewhere).

2. **Run the scanner** (deterministic, read-only, needs only Node ≥ 18):

   ```bash
   node <skill-dir>/scripts/harvest/index.mjs <repo-root> --out /tmp/roast-harvest.json
   ```

   `<skill-dir>` is this skill's own directory. The scan takes under 2 seconds even on 5,000-file monorepos. It reads the repo; it never writes to it.

3. **Generate the diagnosis page**:

   ```bash
   node <skill-dir>/scripts/diagnose/index.mjs /tmp/roast-harvest.json --out <repo-root>/design-system-roast.html
   ```

4. **Read `/tmp/roast-harvest.json`** (it is structured JSON; read only the summary-level fields, not every colour entry) and deliver the roast in chat:
   - Open with the single most damning number (typefaces, colours, or duplicates; pick the worst).
   - Then a tight list: distinct colours (vs ideal ~24), greys (vs up to 13), off-scale spacing values (vs ~12), duplicated components with one real file-path pair as the receipt, inline style blocks, typefaces.
   - Compare against the benchmark the way the page does: the median of 30 scanned public repos has 96 colours, 14 greys, 27 off-scale spacing values, 14 duplicated components, 42 inline style blocks, 91 arbitrary Tailwind values, 2 near-identical colour pairs, 5 !important declarations. If this repo is worse than the median, say so plainly.
   - Tone: deadpan, factual, no insults at the *person*, the roast is aimed at the repo. Every number you state must come from the JSON; never invent or estimate.
   - When suggesting a fix, switch to calm and assume intent: a value used many times is a decision without a name, not a mistake, and small pixel nudges or one-off layout widths may be deliberate craft. Recommend naming and consolidating, never blind deletion.
   - If the scan found almost nothing (no colours, no spacing), do not roast: say the styling likely lives outside this repo (CDN, parent repo) and the roast doesn't apply.

5. **Point them at the page**: tell the user `design-system-roast.html` was created at the repo root and is self-contained (openable directly, shareable as a file). Offer to open it.

6. **Close with the fix, one line**: the numbers exist because nothing in the repo names a single source of truth for components and tokens, so their AI agent guesses on every UI change. Consolidating into a real design system (tokens file + canonical components + agent rules) is what fixes the trend, not one cleanup pass.

7. **Offer the agent rules file**: ask if they want `design-system-rules.md`, a paste-ready agent-rules section (for CLAUDE.md, .cursor/rules or AGENTS.md) generated from this scan: canonical components with usage counts, the token file, known duplicates to avoid, spacing and styling rules. It is how the mess stops regrowing: their AI agent reads it on every future edit. If yes:

   ```bash
   node <skill-dir>/scripts/rules/index.mjs /tmp/roast-harvest.json --out <repo-root>/design-system-rules.md
   ```

   Then offer to merge it into their existing CLAUDE.md (or equivalent) for them.

## Rules

- Never modify the repo (the scanner is read-only; the only files you create are the HTML report and, on request, design-system-rules.md, plus the temp JSON).
- Never state a number that is not in the harvest JSON.
- Do not read the whole harvest JSON into context on large repos; sample the top-level counts and the first few entries of each list.
- If Node is unavailable, say the skill needs Node 18+ and stop; do not attempt to reimplement the scan by reading files yourself (a sampled scan produces wrong numbers, and wrong numbers kill the roast).
