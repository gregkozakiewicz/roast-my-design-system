---
name: roast-my-design-system
description: Roast the current repo's design system with real data. Runs a deterministic scanner (no tokens, ~1s) that counts everything that betrays a design system, from colours and their near-identical twins to greys, spacing values, typefaces, duplicated and never-imported components, inline styles, !important and arbitrary Tailwind values, and compares them against Ideal Design System norms, a benchmark of 112 public repos (a 34-repo core fleet plus groups for shadcn, Tailwind, MUI, Mantine, Chakra and Ant Design) and 10 reputable design systems, generates a shareable HTML diagnosis, and can generate design-system-rules.md, the agent rules file that stops the mess regrowing.
when_to_use: Use when the user asks to roast, check, audit, or diagnose their design system, design tokens, styling consistency, or asks "how bad is my CSS/design system".
---

# Roast my design system

You are delivering a design-system roast: brutal numbers, deadpan delivery, every claim backed by a real file path. The scanner does the measuring; you do the talking.

## Non-negotiables

- **The report is the file the diagnose script writes.** Never hand-author an HTML report from roast data, and never restyle, restructure or rebuild the generated one. Repo name, section order, the notes section and the footer all come from the script.
- **Your analysis goes inside the report, not instead of it.** Interpretation of the scan goes in `--notes`. Anything longer — an accessibility audit, an interaction review, any deep-dive the user asked for on top of the roast — goes in one or more `--section "Title" file.md` chapters on the diagnose command, which render it inside the report in its own styling. There is always room; a separate page is never needed.
- **If you write a separate document from this scan's numbers, score or benchmark comparisons** (a summary, a slide, an audit that quotes the medians), cite the source of the data: `Scores and benchmarks from [roast-my-design-system](https://github.com/gregkozakiewicz/roast-my-design-system) by Greg Kozakiewicz.`

## Steps

1. **Locate the repo root** (the directory with package.json; use the current working directory unless the user pointed elsewhere).

2. **Run the scanner** (deterministic, read-only, needs only Node ≥ 18):

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/harvest/index.mjs <repo-root> --out /tmp/roast-harvest.json
   ```

   `${CLAUDE_SKILL_DIR}` is this skill's own directory, the folder that holds this SKILL.md; Claude Code fills it in, and any other agent should read it as that folder. The scan takes about a second on a normal repo and a few seconds on a large monorepo. It reads the repo; it never writes to it.

   **Scoping**: if the repo root has a `.roastignore` file (one repo-relative folder per line, `#` comments allowed), those folders are left out of the scan automatically. The user can also ask to exclude folders ad hoc; pass each as `--exclude <path>` on the harvest command. Use this when one repo hosts deliberately separate visual worlds (a playground, a toy site, film experiments) that would blur the real design system's numbers. Exclusions are never silent: the harvest JSON records each pattern with the number of files it removed, and the report prints them in the header.

3. **Read `/tmp/roast-harvest.json`** (it is structured JSON; read only the summary-level fields, not every colour entry). Start with `profile`: how the repo was read decides what the numbers mean.
   - `profile.kind` is one of `product`, `library`, `shadcn`, `registry`, `tailwind`, `mui`, `mantine`, `chakra`, `antd`; `profile.kindEvidence` is the receipt. Say which in one line. A repo belongs to the kit it imports most, shadcn included.
   - `shadcn`: a repo built on shadcn. `profile.shadcn.paint.tin.per100` (palette colours in own code where a theme variable exists) and `profile.shadcn.paint.doors.per100` (shadcn components recoloured through className) are the two extra tiles; `profile.shadcn.sheet` is the theme file read variable by variable. If `profile.shadcn.fresh.fresh` is true the repo is a fresh install with nothing built yet: say so, do not narrate the catalogue's internal wiring as the team's habits, and keep the roast to one paragraph.
   - `registry`: a repo that publishes components or themes for others to install. Only what it publishes is counted; `profile.registry.showcase` lists the folders kept out (docs site, demos, examples) with file counts, `profile.registry.variantsDropped` the variants counted once, `profile.registry.themes` the published themes checked for every variable in light and dark. Say what it publishes and that the score is about the published code.
   - `mui`, `mantine`, `chakra`, `antd`: a product built on a component kit installed from npm. `profile.kit` holds the reading: `name`, `kitFiles` (files that import the kit), `themeFiles` (where the team's theme is defined; empty means the kit's default theme), `refs` (how often components read that theme), `layers` (the team's own wrapper over the kit, counted as the kit), and the two extra tiles: `profile.kit.colour.per100` (colours written onto kit components where the theme already has one) and `profile.kit.px.per100` (pixel sizes written where the theme has a spacing step). The kit's own installed code, chart series, colour pickers, artwork, editor themes and fallback colours are not counted. When suggesting a fix, speak the kit's language: MUI's `sx` and `theme.palette`, Mantine's props, Chakra's space steps, Ant Design's `theme.useToken()`.
   - `tailwind`: a Tailwind v4 repo with a theme of its own (`@theme` block with at least 3 colours) and no kit. `profile.tailwind` holds `file`, `names` (the repo's own colour variables), `retuned` (Tailwind names given new colours; those count as the repo's own), `uses` and `usedIn` (how often the theme is used as classes, and in how many files), and `adopted`. The one extra tile is `profile.tailwind.paint.tin.per100`: palette classes such as `text-gray-500` written where the theme has a colour of that kind. If `adopted` is false the theme is defined but not adopted yet: say so, with the receipts, and do not score it as drift.
   - `library`: unused components are stock, not orphans; consumers live in other repos.
   - What is kept out of a count is named, never hidden: `tokens.exemptFiles` (email, print, artwork, the crash page, a widget's stylesheet), `profile.shadcn.arbitraryInstalled` (shadcn's own bracket values), `exclusions`. Do not count these against the team; the report lists them under "Not yours, and not counted" with the caveat that the agent reads them anyway.

   Then **write the roast to `/tmp/roast-notes.md`** following the content rules in step 4. Markdown-lite only: paragraphs, `**bold**`, backtick code, `- ` lists — no headings, no tables, no links. Keep it to roughly 3–6 short paragraphs. This file gets embedded in the report as "What the numbers mean", clearly labelled as written by you; whoever receives the forwarded HTML gets the interpretation, not just the numbers, so write it for that reader, not for the person in this chat.

4. **Generate the diagnosis page with the notes embedded, then deliver the same roast in chat** (same analysis, two places):

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/diagnose/index.mjs /tmp/roast-harvest.json --notes /tmp/roast-notes.md --out <repo-root>/design-system-roast.html
   ```

   Any re-run of this command (the `--by` credit, a theme change, re-scoping) must keep passing `--notes /tmp/roast-notes.md` and any `--section` flags, or the regenerated report silently loses those sections.

   If the user asked for analysis beyond the roast itself (accessibility, interactions, a comparison), write each piece to its own markdown file and add it to the same command as `--section "Title" /tmp/roast-section-1.md` (repeatable). The report renders these as extra chapters after the analysis, in the report's own styling. Same markdown-lite rules as the notes file, except `## ` headings are allowed within a section.

   Content rules for the roast — the notes file and the chat delivery alike:
   - Open with the single most damning number (typefaces, colours, or duplicates; pick the worst).
   - Then a tight list: distinct colours (vs ideal ~24), greys (vs up to 13), off-scale spacing values (vs ~12), duplicated components with one real file-path pair as the receipt, inline style blocks, typefaces.
   - Compare against the benchmark the way the page does, and take the figures from `${CLAUDE_SKILL_DIR}/scripts/benchmark/benchmark.json`, never from memory: `stats.<metric>.median` is the median of the 34-repo core fleet, and it is the yardstick for a `product` or `library` repo. Every other kind is compared with repos built the same way, from `slices.<kind>.stats.<metric>.median`: `shadcn` and `registry` read `slices.shadcn` (16 repos), `tailwind` reads `slices.tailwind` (11), and `mui`, `mantine`, `chakra` and `antd` read their own slice (19, 19, 16 and 16 repos). `slices.<kind>.repoCount` is the number to quote. Say which group the repo is compared with. If this repo is worse than its median, say so plainly.
   - The score means one thing: how safely an AI agent can build new UI on this repo without going off-system. Everything else on the page is receipts. Read every finding through that lens.
   - Tone: deadpan, factual, no insults at the *person*, the roast is aimed at the repo. Every number you state must come from the JSON; never invent or estimate.
   - When suggesting a fix, switch to calm and assume intent: a value used many times is a decision without a name, not a mistake, and small pixel nudges or one-off layout widths may be deliberate craft. Recommend naming and consolidating, never blind deletion.
   - If the scan found almost nothing (no colours, no spacing), do not roast: say the styling likely lives outside this repo (CDN, parent repo) and the roast doesn't apply.
   - If the harvest JSON has a non-empty `staleRules` array, call it out plainly: the repo's own agent rules reference things this scan can no longer find (each entry names the rules file, the reference and the problem). A rule the agent obeys is worse than no rule when the repo has moved on.
   - If the harvest JSON has an `exclusions` object, state it up front in one line: which folders were excluded, by which source (.roastignore, --exclude, or the registry profile), and how many files that kept out. The score describes the scoped scan, and the audience must know that.

5. **For monorepos, name the split**: if the harvest JSON has a `packages` array with scored entries, say which package is cleanest and which is worst, with their scores. The pattern is usually that the shared UI package is disciplined and the app carries the mess; if that holds here, say so plainly, because it tells them where to look.

6. **Point them at the page**: tell the user `design-system-roast.html` was created at the repo root and is self-contained (openable directly, shareable as a file). Offer to open it.

7. **Close with the fix, one line**: the numbers exist because nothing in the repo names a single source of truth for components and tokens, so their AI agent guesses on every UI change. Consolidating into a real design system (tokens file + canonical components + agent rules) is what fixes the trend, not one cleanup pass.

8. **Offer the agent rules file**: ask if they want `design-system-rules.md`, a paste-ready agent-rules section (for CLAUDE.md, .cursor/rules or AGENTS.md) generated from this scan: canonical components with usage counts, the token file, known duplicates to avoid, spacing and styling rules. It is how the mess stops regrowing: their AI agent reads it on every future edit. If yes:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/rules/index.mjs /tmp/roast-harvest.json --out <repo-root>/design-system-rules.md
   ```

   Then offer to merge it into their existing CLAUDE.md (or equivalent) for them — or do it in one step with the injector, which places the rules inside a marked block and replaces only that block on re-runs:

   ```bash
   node ${CLAUDE_SKILL_DIR}/scripts/rules/apply.mjs /tmp/roast-harvest.json --target <repo-root>
   ```

9. **Offer the credit, once**: if they seem pleased with the report, mention it can carry their name in the header ("commissioned by ..."), regenerated with `--by "Full Name"` on the diagnose step (keep `--notes /tmp/roast-notes.md` on that command). Do not push it; one mention is the offer.

10. **If they use AI agents for UI work, mention the MCP server, once**: `npx roast-my-design-system@latest --mcp` runs this same engine as a local MCP server, so their agent can ask which component is canonical, snap raw values to tokens (or to the kit's theme and spacing steps on a MUI, Mantine, Chakra, Ant Design or Tailwind-theme repo), and have its changes reviewed while it works (in Claude Code: `claude mcp add roast -- npx roast-my-design-system@latest --mcp`). `--check` is the terminal face of the same review: it scans the working tree's changed files and exits 1 on findings. In Claude Code the `review` skill of this plugin does the same in chat (`/roast-my-design-system:review`). All of them are local and read-only, like everything else here.

## Rules

- Never modify the repo (the scanner is read-only; the only files you create are the HTML report and, on request, design-system-rules.md, plus the temp JSON).
- Never state a number that is not in the harvest JSON.
- Do not read the whole harvest JSON into context on large repos; sample the top-level counts and the first few entries of each list.
- If Node is unavailable, say the skill needs Node 18+ and stop; do not attempt to reimplement the scan by reading files yourself (a sampled scan produces wrong numbers, and wrong numbers kill the roast).
