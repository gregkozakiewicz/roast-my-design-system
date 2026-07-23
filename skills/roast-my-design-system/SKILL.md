---
name: roast-my-design-system
description: Roast the current repo's design system with real data. Runs a deterministic scanner (no tokens, ~1s) that counts every colour, grey, spacing value, typeface, duplicated component and inline style, compares them against Ideal Design System norms and a 27-repo public benchmark, and generates a shareable HTML diagnosis. Use when the user asks to roast, check, audit, or diagnose their design system, design tokens, styling consistency, or asks "how bad is my CSS/design system".
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
   - Then a tight list: distinct colours (vs ideal ~20), greys (vs 5–7), spacing values (vs ~8), duplicated components with one real file-path pair as the receipt, inline style blocks, typefaces.
   - Compare against the benchmark the way the page does: the median of 27 scanned public repos has 112 colours, 15 greys, 48 spacing values, 19 duplicated components. If this repo is worse than the median, say so plainly.
   - Tone: deadpan, factual, no insults at the *person*, the roast is aimed at the repo. Every number you state must come from the JSON; never invent or estimate.
   - If the scan found almost nothing (no colours, no spacing), do not roast: say the styling likely lives outside this repo (CDN, parent repo) and the roast doesn't apply.

5. **Point them at the page**: tell the user `design-system-roast.html` was created at the repo root and is self-contained (openable directly, shareable as a file). Offer to open it.

6. **Close with the fix, one line**: the numbers exist because nothing in the repo names a single source of truth for components and tokens, so their AI agent guesses on every UI change. Consolidating into a real design system (tokens file + canonical components + agent rules) is what fixes the trend, not one cleanup pass.

## Rules

- Never modify the repo (the scanner is read-only; the only file you create is the HTML report, plus the temp JSON).
- Never state a number that is not in the harvest JSON.
- Do not read the whole harvest JSON into context on large repos; sample the top-level counts and the first few entries of each list.
- If Node is unavailable, say the skill needs Node 18+ and stop; do not attempt to reimplement the scan by reading files yourself (a sampled scan produces wrong numbers, and wrong numbers kill the roast).
