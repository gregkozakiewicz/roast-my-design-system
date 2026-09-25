<img src="https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/roster_logo_v1.png?v=8.2.0" width="100" alt="roast-my-design-system">

# roast-my-design-system

[![npm](https://img.shields.io/npm/v/roast-my-design-system?color=2dd4bf&label=npm)](https://www.npmjs.com/package/roast-my-design-system) [![downloads](https://img.shields.io/npm/dm/roast-my-design-system?color=2dd4bf&label=downloads)](https://www.npmjs.com/package/roast-my-design-system) [![Socket](https://badge.socket.dev/npm/package/roast-my-design-system)](https://socket.dev/npm/package/roast-my-design-system) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![zero dependencies](https://img.shields.io/badge/dependencies-0-2dd4bf)](https://www.npmjs.com/package/roast-my-design-system?activeTab=dependencies) [![no telemetry](https://img.shields.io/badge/no-telemetry-2dd4bf)](https://github.com/gregkozakiewicz/roast-my-design-system#what-makes-the-numbers-trustworthy)

[![MCP verified in Claude Code](https://img.shields.io/badge/MCP_verified-Claude_Code-2dd4bf)](#live-answers-over-mcp) [![MCP verified in Cursor](https://img.shields.io/badge/MCP_verified-Cursor-2dd4bf)](#live-answers-over-mcp) [![MCP verified in Windsurf / Devin Desktop](https://img.shields.io/badge/MCP_verified-Windsurf_%2F_Devin_Desktop-2dd4bf)](#live-answers-over-mcp)

## Your AI can write the UI. This makes sure it writes *your* UI.

A free CLI tool, and a Claude Code plugin with two skills, a bundled local MCP server and an edit hook, that roasts your repo's design system with real data, reviews what you change against it, and generates the rules that keep your AI agent on-system.

> **New in 8.0: support for the four big component kits.**
>
> If your product is built on MUI, Mantine, Chakra UI or Ant Design, roast now reads it as such. It finds your theme in the repo, counts how often your components read it, and measures the two things that drift: colours and spacing written onto components when the theme already has a value.
>
> - **The kit's own code is not counted.** Nor are chart colours, colour pickers, artwork, editor themes or fallbacks.
> - **Your own layer counts as the kit.** Metabase wraps Mantine and imports the wrapper in 2,469 files. The old reading covered 14% of the product.
> - **A repo belongs to the kit it uses most,** shadcn included.
> - **You are compared with products on the same kit:** 19 MUI, 19 Mantine, 16 Chakra and 16 Ant Design, 70 in all. Each target comes from the tidiest third of its group.
> - **The fix prompts speak your kit:** MUI's `sx`, Mantine's props, Chakra's space steps, Ant Design's `theme.useToken()`.
>
> Repos that used to fall through now read properly. Open-Assistant scored a false 100 and now scores 75 as a Chakra product. InvenTree and the APISIX dashboard got no score at all and now score 75 and 84.

> **Also in 8.0: eleven counting fixes.**
>
> The benchmark is rebuilt on them, so every score moves. Take a fresh one before you compare.
>
> - **One colour written two ways is one colour.** It was counted twice and reported as a near-identical pair.
> - **A fallback inside `var(--x, #fefefe)` reads the theme.** It is no longer a stray colour. Primer goes from 308 colours to 8.
> - **Stylesheets you did not write are left out.** So are apps you have replaced, such as a `web-old` folder. The report lists everything left out, with file counts.
> - **Fix prompts start from a product file,** not from your docs site.
>
> Fleet medians are now 115 colours, 23 greys, 33 off-scale spacing values, 21 duplicated components, 51 inline style blocks, 77 bracket values, 7 near-identical pairs and 5 `!important`.

> **New in 7.10: a fifth profile, `tailwind`, with its own benchmark.** A repo that uses Tailwind v4 and defines at least 3 colours of its own in an `@theme` block is read as a Tailwind repo. It gets one extra check: Tailwind palette classes such as `text-gray-500` written where the theme has a colour of that kind, per 100 files. A Tailwind name given a different colour counts as the repo's own. Tailwind repos are compared with a group of 11 Tailwind repos, and the target is 3 per 100 files (median 10). Three scores that were too high now show no score or a lower one: better-auth (100, its interface is in skipped folders), strapi (75, its colours are in an installed package) and supabase (100, now 28). Files that import an email kit are skipped as emails wherever they are. Svelte, Vue and Tailwind v3 configs are not read as Tailwind yet. `summary.json` gains `kind: "tailwind"` and a `tailwind` block, and `score` can be `null`.

> **New in 7.7: four repo profiles, and the fourth is `registry`.** The scanner decides once what kind of repo it is reading, `product`, `library`, `shadcn` or `registry`, and every count, ideal and benchmark line reads that decision. `registry` is new: a repo that publishes a shadcn registry (a `registry.json` with typed items, or a route that builds one from a packages folder) is counted on what it publishes and nothing else. The docs site, demos and examples are kept out and named in the header with file counts; the same components kept in several variants count once; a name repeated only inside published blocks is the range, not a duplicate; published components are the project's own work, with no installed-code exemption. Published themes get their own tile: every shadcn colour variable present for light and for dark, ideal 0. For a registry that publishes themes and no code, that check is the score. Covers shadcn's own source (84), magicui (69), kibo-ui (78) and tweakcn (100, 36 themes, all complete). No other kind of repo moves. `summary.json`: `kind: "registry"` with a `registry` block (`publishes`, `counted`, `showcase`, `variantsDropped`, `themes`); tiles gain `themesIncomplete` on registries.

Run it on your codebase and get, in about a second:

- **A health score you can defend in a meeting.** It measures how safely an AI agent can build new UI on this repo without going off-system. Everything else on the report is receipts for humans. 0 to 100, deterministic, and benchmarked against 3 yardsticks: Ideal Design System norms, 34 scanned public repos and 10 reputable design systems (Primer, Polaris, Carbon, shadcn/ui…).
- **Per-package scores for monorepos.** One blended number hides which package is the problem: `packages/ui` scores 80 while `apps/web` scores 40, and now you can see it.
- **Reads React and web components alike.** Stencil, Lit and custom elements are detected by tag registration and counted by kebab tag. Libraries get composition maps, not adoption accusations. Earned token namespaces are named in the header. Anything the scan can not read is declared "not measured" instead of scored.
- **The receipts behind it.** Every colour and its near-identical twin. Every spacing value, typeface, duplicated or never-imported component, inline style and !important. All with real file paths, in one self-contained HTML report you can open, Slack or email.
- **The first fixes ranked by payoff, each with its prompt.** A "Where to start" list derived from your own numbers. Every move carries a copy button with a ready-made fix prompt for your agent: the finding, the files, the expected payoff, and rules that respect deliberate craft. Fix, re-run the scan, press the next button.
- **Where agents will invent.** The places where the repo has no answer yet, so the next piece of UI, human or agent, will make one up. Today that is one gap, found by measuring 164 agent sessions on real products: charts that paint their series colours by hand in a repo with no chart palette. The section names the files and the one move that closes it.
- **Rules that stop the mess coming back.** A generated `design-system-rules.md` with canonical components, your token file, and known duplicates to avoid, so your AI agent follows your system instead of guessing at it. `--apply` injects them into every agent file you have: Claude, Cursor, GitHub Copilot, and Windsurf. Every scan also checks the rules you already have for stale references: paths that no longer exist, components named canonical that nothing imports anymore. And the agent card states which tools can actually read the rules you have (Claude Code, Codex, Cursor), with the one-line fix where a door is missing.

## Why this exists

Your AI agent (Claude, Cursor, Copilot) builds UI by imitating what's already in your repo. If your repo has 112 colours and 4 Button implementations, your agent guesses which one is canonical, and it picks wrong half the time. That's why AI-generated UI looks *almost-but-not-quite* right. The first step to fixing it is seeing the mess measured.

## Live examples

The same eleven reports the landing page shows, hosted exactly as the tool generates them: self-contained HTML, every number deterministic, every path real. Four kits, a fresh install, a registry, Stencil, Lit and plain React.

- **[npx shadcn create, fresh](https://gregkozakiewicz.github.io/roast-my-design-system/examples/shadcn-create-fresh.html)** (factory install, all 61 components): read as a fresh install: "the score is the kit's, not yours"; 13 colours, every theme variable in place, shadcn's own 24 bracket values named and not counted. No score: a fresh install is the kit's, not yours.
- **[Unleash](https://gregkozakiewicz.github.io/roast-my-design-system/examples/unleash-mui.html)** (MUI): read as an MUI product: 1,109 files import the kit and the theme is read 6,166 times; 4 colours and 2 spacings per 100 kit files are written onto components. Score 64.
- **[Metabase](https://gregkozakiewicz.github.io/roast-my-design-system/examples/metabase-mantine.html)** (Mantine): its own wrapper over Mantine counts as the kit, so 2,679 files are read instead of 392; nothing written onto components, 2 spacings per 100 kit files. Score 47.
- **[SigNoz](https://gregkozakiewicz.github.io/roast-my-design-system/examples/signoz-antd.html)** (Ant Design): read as an Ant Design product: 2 colours and 7 spacings per 100 kit files written in style objects where a token exists. Score 51.
- **[Apache Airflow](https://gregkozakiewicz.github.io/roast-my-design-system/examples/airflow-chakra.html)** (Chakra UI): read as a Chakra product: no colours written onto components, 4 spacings per 100 kit files as pixel strings where a space step exists. Score 43.
- **[vercel/ai-chatbot](https://gregkozakiewicz.github.io/roast-my-design-system/examples/vercel-ai-chatbot.html)** (shadcn install): 74 values like [13px] written outside the Tailwind scale, and 66 palette colours per 100 files where a theme variable exists; Claude's notes embedded. Score 80.
- **[excalidraw/excalidraw](https://gregkozakiewicz.github.io/roast-my-design-system/examples/excalidraw-excalidraw.html)**: 84 off-scale spacing values and 90 !important declarations. Score 55.
- **[dubinc/dub](https://gregkozakiewicz.github.io/roast-my-design-system/examples/dubinc-dub.html)**: 622 arbitrary bracket values and 22 duplicated components. Score 20.
- **[telekom/scale](https://gregkozakiewicz.github.io/roast-my-design-system/examples/telekom-scale.html)** (Stencil): 95 Stencil components read by tag; 66 spacing values outside the scale where about 12 would do; Claude's notes embedded. Score 55.
- **[magicuidesign/magicui](https://gregkozakiewicz.github.io/roast-my-design-system/examples/magicui.html)** (registry): read as a shadcn registry and counted on the components it publishes: 52 off-theme colours per 100 files in the code it ships, its docs site kept out and named. Score 78.
- **[adobe/spectrum-web-components](https://gregkozakiewicz.github.io/roast-my-design-system/examples/adobe-spectrum.html)** (Lit): hardcoded colours sitting beside 744 colour tokens, and 37 !important declarations. Score 72.

## Every command

One scan powers all of it; the flags decide what lands on disk. Combine freely.

### Run it yourself

Type these in a terminal and you get a result.

| Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | What you get |
|---|---|
| <code>npx&nbsp;roast-my-design-system@latest</code> | The scan and `design-system-roast.html`, opened in your browser |
| <code>...&nbsp;&lt;path&gt;</code> | Scan a different repo than the current directory |
| `... --apply` | The generated agent rules injected straight into every agent file you have: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, `.windsurfrules` and `.github/copilot-instructions.md`, inside a marked block. Re-running replaces only that block, never your own text. Windsurf and Copilot get a compact variant sized for their limits |
| `... --rules` | The same rules written to `design-system-rules.md` instead, for pasting by hand |
| `... --card` | `roast-card.svg`: a shareable 1200x630 card with the score and worst findings. Pure SVG, embeds in a README |
| `... --sarif` | `design-system-roast.sarif` for GitHub code scanning: upload it in CI and findings appear in the Security tab, annotated on files |
| `... --check` | The working tree's changed files checked against the design system, in the terminal. Exits 1 on findings, so it slots into scripts |
| `/roast-my-design-system:review` (in Claude Code) | The same check in chat, from the plugin's second skill: each changed file's findings with the fix named, then the fixes applied and the check re-run |
| <code>...&nbsp;--exclude&nbsp;lab/</code> | Leave a folder out of the scan (repeat the flag or comma-separate). Or list folders in a `.roastignore` file at the repo root. Either way the report says so in the header; see [Scoping the scan](#scoping-the-scan) |
| `... --json` | The scan summary as JSON on stdout, for scripts and pipelines. Includes `schemaVersion`, the benchmark used, and every metric as a number, so two scans can be compared |
| <code>...&nbsp;--by&nbsp;"Dwayne&nbsp;Hicks"</code> | Puts a name in the report header, for when you ran it for someone else |
| <code>...&nbsp;--theme&nbsp;light</code>&nbsp;/ <code>--out&nbsp;&lt;file&gt;</code>&nbsp;/ <code>--no-open</code>&nbsp;/ <code>--open</code> | Light report, custom report path, never open the browser, always open it |

### For your agent

These need an agent.

| Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | What you get |
|---|---|
| <code>...&nbsp;--notes&nbsp;&lt;file.md&gt;</code> | The agent's read of this scan, embedded in the report as **"What the numbers mean"**: which findings matter, which good numbers are accidents, what to fix first. Labelled as written by AI and kept apart from the measured numbers. The Claude Code skill writes and passes it automatically; the flag is here so any agent can |
| <code>...&nbsp;--section&nbsp;"Title"&nbsp;&lt;file.md&gt;</code> | A further agent-written chapter after the notes, same styling, same label, sub-headings allowed. Repeatable, so analysis that outgrows the notes still lives inside the report instead of a hand-built page |
| `... --hook` | The check the Claude Code plugin runs after every edit, for hand-installed setups: reads the hook event on stdin, checks the one file that changed, prints only the findings the edit added as JSON. Always exits 0 |
| `... --mcp` | The scan as a local MCP server: 5 tools your agent calls while writing UI, from "is there a Button already?" to "review my changes", plus the `roast-fix` prompt that serves the top fix from a fresh scan. See [Live answers over MCP](#live-answers-over-mcp) |
| <code>/roast-my-design-system</code> (in&nbsp;Claude&nbsp;Code) | The full experience: the roast in chat *and* embedded in the report as "What the numbers mean", the rules offer, and the fix loop with Claude on your own numbers |

Not to be confused with each other: **"Why this matters"** is generic, ships with the tool and reads the same in every report. **"What the numbers mean"** is your agent's read of your repo, and only appears when an agent passed it.

**One scan writes rules for every agent: Claude, Cursor, GitHub Copilot, and Windsurf.** Every scan also checks the agent rules you already have and flags stale references, no flag needed.

## Example use cases

- **Pre-refactor audit.** Run `/roast-my-design-system` before a design-system cleanup to get the measured baseline: every colour, spacing value, duplicated component and inline style, with real file paths.
- **Diagnosing almost-right AI output.** When Claude keeps generating UI that looks slightly off, the report shows which duplicated components and stray values it is imitating, and where the canonical ones live.
- **Making the case without a meeting.** Drop the self-contained HTML report in Slack: a health score and 3 benchmarks (ideal norms, the median of 112 scanned repos, 10 reputable systems) argue for the design system for you.
- **The fix loop.** Hand the report back to Claude as the punch list and work through the Where to start section, file by file.

The full report for vercel/ai-chatbot, top to bottom, including "What the numbers mean", Claude's read of the scan, embedded right under the verdict:

![The full diagnosis report for vercel/ai-chatbot in dark mode: a fixed side panel with the health score and what it measures, the stack, how the repo was read as a shadcn install, an index of every section and what is not the team's and not counted; then the summary, the What the numbers mean analysis written by Claude, priced Where to start moves each with its copy-the-fix-prompt button, the wrapped present with the agent rules, an agent trap callout, 3-yardstick tiles including the 2 shadcn tiles, the adoption map treemap, palette forensics, the shadcn theme variable by variable, spacing receipts, typography specimens, offenders, duplicates, and the component usage ledger](https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/report-full-dark.png?v=8.9.0)

The same report in light mode (one file, built-in toggle):

![The diagnosis report in light mode](https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/report-light-hero.png?v=8.9.0)

## What it works on

**Supported**

- React repos: Next, Remix, Vite and plain React.
- Web-component repos: Stencil and Lit.
- 4 kinds of repo: product, library, shadcn, registry.
- 5 kit profiles: Tailwind theme, MUI, Mantine, Chakra, Ant Design.
- Any styling on top: Tailwind, styled-components, Emotion, Sass, Less, vanilla-extract, Stitches, CVA, CSS Modules.

**Recognised, not supported yet but on the roadmap**

- Vue, Angular and Svelte: named in the header, colours and spacing still counted, but components are not measured and the report says so.
- HeroUI, NextUI, Radix Themes, Fluent UI, React Bootstrap and Grommet: named in the header, no kit rules.

## What makes the numbers trustworthy

- **Deterministic scanner, not AI sampling.** A zero-dependency Node script reads *every* file (about a second on a normal repo, a few on a large monorepo) and returns the same numbers every run. Claude narrates; it never counts.
- **Read-only.** Nothing in your repo is modified. The only outputs are a temp JSON and the HTML report.
- **No network, no telemetry.** Everything runs locally. Nothing about your code leaves your machine. Dependency scanners such as Socket may flag URL strings in this package; they are product links and format identifiers written into generated reports, never fetched.
- **Zero dependencies, enforced by the test suite.** The package installs nothing but itself. That is a tested promise rather than a habit: the suite fails if package.json ever declares a dependency. The exact file list npm ships is a photographed contract too, so nothing can stow away in a release.
- **Honest gaps.** When a repo's components register in a pattern the scan can not read, the component tiles say "not measured" and drop out of the score. A zero the scanner never earned is presented as blindness, not discipline.
- **Honest exclusions.** Test files, Storybook stories, docs sites, example apps, SVG artwork, and email templates (which *must* inline styles) are excluded, so you can't discredit the numbers on a technicality. Your own exclusions (`.roastignore`, `--exclude`) are printed in the report header with file counts, so a scoped scan can never pass itself off as the whole repo.
- **Intent-aware counting (v3).** Runtime-computed inline styles, compound-component APIs and wrapper components are not crimes and are not counted as ones. Token-led repos are judged on their hardcoded strays, not their token architecture. Repeated arbitrary values are read as decisions without names, not drift.
- **The scoring code can be imported.** `scoreHarvest(harvest)` in `diagnose/score.mjs` returns the score, the nine tile results and the metrics as plain data. The report uses the same function. A CI check gets the same numbers as the page, and every `summary.json` records its schema version and the benchmark used.
- **A real benchmark.** The "Avg Design System" yardstick comes from scanning 112 public React repos. A core fleet of 34 (cal.com, excalidraw, supabase, grafana, twenty, dub, langfuse…) sets the medians for ordinary product repos: 115 colours, 23 greys, 21 duplicated components, 51 inline style blocks, 77 arbitrary Tailwind values. The other 78 were scanned for the kit profiles, so a repo built on shadcn, Tailwind, MUI, Mantine, Chakra or Ant Design is compared with repos built the same way. The builder and the repo list are in `tools/benchmark/`, so the ruler can be checked, not just quoted.
- **A second yardstick: reputable systems.** Curated, scoped scans of 10 well-known design systems (shadcn/ui, Primer, Polaris, Carbon, Material UI, Chakra, Ant Design, GOV.UK, Spectrum, Cloudscape) show what disciplined looks like at scale.

## Scoping the scan

Some repos host more than one visual world on purpose: the product plus a marketing site, a playground, a batch of experiments. Blending them produces a score that describes none of them. Scope the scan to the design system you are actually judging:

```bash
npx roast-my-design-system@latest --exclude lab/ --exclude playground/
```

Or make it permanent with a `.roastignore` file at the repo root, one repo-relative folder per line:

```
# separate visual worlds, not the product's design system
lab/
playground/
```

Both routes merge, and both are loud on purpose. The harvest JSON records every active pattern and how many files it removed. The report prints a line in the header ("2 folders excluded by .roastignore (lab/, playground/) · 946 files kept out of this scan"). You can narrow the question, but the report always says which question was asked, so a scoped score can't be quietly gamed. There is no negation and no glob syntax: plain folder prefixes, nothing clever.

## Live answers over MCP

The report and the rules file describe the repo as it was at scan time. `--mcp` keeps the same engine running while your agent works, so questions get answered from the code as it is right now, and mistakes get caught before they land:

| Tool | The question it answers |
|---|---|
| `roast_get_context` | What should I know before touching UI here? Routed by the folder being edited |
| `roast_find_component` | Is there already a component for this, and which one is canonical? With one real usage example. When two candidates tie, it says so and names both |
| `roast_find_token` | I have `#111111` / `13px` in hand. What should I have used? |
| `roast_validate` | I am about to save this. Does it break the system? |
| `roast_review` | Review my changed files. Reads the git diff itself, so no code is pasted back |

The loop: context before building, find while building, validate before saving, review before finishing.

Charts get their own rule, because a chart needs several colours that differ from each other and most design systems never name them. In a repo that keeps a chart palette (its own `--chart-*` or `--series-*` tokens, a `chartColors` entry in the theme, or shadcn's `--chart-1` to `--chart-5` when a chart actually reads them), a colour written by hand in a chart file is a finding that names the palette. In a repo that has charts but no palette, a new chart that paints by hand gets one warning that names the existing chart doing the same and asks for the palette once. The first chart in a repo gets one warning asking for a name. The report never counted chart colours; the live checks now agree with it.

The server reads the repo the way the report does. On a product built on MUI, Mantine, Chakra UI or Ant Design, the context names the theme file and the kit's own way of reading it, `roast_find_token` answers in spacing steps (`12px` is `p: 3` on a 4px MUI theme), and `roast_validate` and `roast_review` flag a colour or a pixel size written onto a kit component where the theme has a value. On a Tailwind theme or a shadcn repo they flag a palette class such as `text-gray-500` or `ring-green-500` where the theme names a colour of that kind.

### What a session looks like

A real exchange against [Unleash](https://github.com/Unleash/unleash), an MUI product that scores 64/100. The agent was asked to add a small usage hint to a feature page. Every answer is the server's own text, unedited.

Before writing anything, the agent calls `roast_get_context`:

```
KIT: MUI (1109 files import it, the theme is read 6162x). A colour, a spacing step or a radius is decided in frontend/src/themes/dark-theme.ts. On a component, read it: sx paths (color: 'text.secondary', p: 2) or theme.palette / theme.spacing() in styled().
  43 colours are already written onto components (#6c65e5, #f1f0fc, #302e42); do not add one.
USE THESE, DO NOT REBUILD THEM:
  <Dialogue> from frontend/src/component/common/Dialogue/Dialogue.tsx (97x)
  <TextCell> from frontend/src/component/common/Table/cells/TextCell/TextCell.tsx (96x)
  <PageContent> from frontend/src/component/common/PageContent/PageContent.tsx (84x)
DUPLICATES, DO NOT MAKE IT WORSE:
  <StyledSuccessIcon> exists in 6 places; match what the surrounding code imports, never create another.
SPACING: Use spacing steps (p: 2), not pixels. 17 pixel sizes are already written onto components; do not add one.
TYPE: Sen. No new typefaces, no hand-declared font stacks.
Before finishing: call roast_validate on what you wrote, then roast_review.
```

It has a grey in hand and a padding in mind, so `roast_find_token` twice:

```
#6b7280 → Nearest token: #607d8b, 11 channel steps from #6b7280. Unless the difference is a deliberate decision, use the token.
12px    → 12px is between steps 1 (8px) and 2 (16px) on the default theme. If the design needs 12px exactly, keep it with a comment; otherwise use the nearest step in sx.
```

It writes a first draft anyway and runs `roast_validate` before saving:

```
2 findings:
✕ L5 Colour #6b7280 written onto an MUI component, and the theme has no such colour.
   Fix: Add it to the theme once (frontend/src/themes/dark-theme.ts), then read it there. On an MUI component, point at it: color: 'text.secondary' in sx, or theme.palette.primary.main in a styled() call.
✕ L5 Pixel size p: 12px on an MUI component.
   Fix: 12px is between steps 1 (8px) and 2 (16px) on the default theme. If the design needs 12px exactly, keep it with a comment; otherwise use the nearest step in sx.
```

Second draft: `color: 'text.secondary'`, `p: 1.5`, the radius read from the theme. `roast_validate` again:

```
No measured violations found. Checked: hardcoded colours vs the token set, near-identical colour twins, off-scale spacing, off-scale radii, font sizes and shadows, typefaces outside the system, arbitrary bracket values, static inline style blocks, !important, duplicate component definitions, new colour tokens that twin an existing token, imports of a duplicate the canonical copy replaces, chart colours against the chart palette, colours and pixel sizes written onto kit components where the theme has a value.
```

Four calls, under 800 tokens in total, and the new component reads the theme instead of adding colour number 44. `roast_review` then checks the whole diff the same way before the agent says it is done.

When the goal is fixing the system rather than building on it, the `roast-fix` prompt serves the top Where-to-start move from a fresh scan. It is a ready-made fix prompt, byte-identical to the report's copy buttons. Fix it, ask again, and the next move has risen to the top: the scan is the progress bar. Pass `move: 2` to jump the queue.

To use it in Claude Code, type `/mcp__roast__roast-fix` in the chat. MCP prompts appear as slash commands, named after whatever you registered the server as, and the `/` autocomplete menu lists them too. Add the move number to jump the queue: `/mcp__roast__roast-fix 2`. Other clients list server prompts in their own prompt picker; wherever `roast-build-ui` and `roast-review-ui` show up, `roast-fix` sits beside them.

**Installed the Claude Code plugin?** The server is already there: the plugin bundles it, so the five tools appear as soon as the plugin is enabled. Nothing to add.

Otherwise, add it to Claude Code by hand:

```bash
claude mcp add roast -- npx roast-my-design-system@latest --mcp
```

**Verified in Claude Code, Cursor, and Windsurf (now Devin Desktop).** Each was tested end to end: server connected, all 5 tools listed, real answers in the editor's own chat. Same promise as the scan: local, read-only, one scan at startup, no port, no account, nothing about your code leaves your machine. A clean answer reads "no measured violations found" with the list of checks attached, because a scanner can only certify what it can count.

**Cursor**: put this in `.cursor/mcp.json` inside the project (the project, not your home directory, so the scan sees one repo, not your whole disk):

```json
{ "mcpServers": { "roast": { "command": "npx", "args": ["roast-my-design-system", "--mcp"] } } }
```

Cursor holds workspace servers at arm's length until you approve them: open Settings → Tools & MCP and enable `roast` the first time. The first start takes a few seconds while npx fetches the package; Cursor retries on its own.

**Windsurf (Devin Desktop)**: its MCP config is global (`~/.codeium/windsurf/mcp_config.json`), so name the project folder in the entry to keep the scan scoped to one repo:

```json
{ "mcpServers": { "roast": { "command": "npx", "args": ["roast-my-design-system", "--mcp", "/path/to/your/repo"] } } }
```

Any other MCP client can register the same stdio command.

## In CI

The scanner already speaks SARIF, so wiring it into GitHub code scanning is 6 lines. Findings appear in the Security tab, annotated on the files themselves:

```yaml
- uses: actions/checkout@v5
- run: npx roast-my-design-system@latest . --sarif --no-open
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: design-system-roast.sarif
```

## Install

**No install, no Claude needed. Just try it:**

```bash
npx roast-my-design-system@latest
```

Run it inside any repo. Same scanner, same report, straight from npm. The Claude Code skill below adds the conversation on top: the roast in chat, then a punch list you can actually work through with Claude.

**Claude Code (recommended):**

```bash
/plugin marketplace add gregkozakiewicz/roast-my-design-system
/plugin install roast-my-design-system@roast-my-design-system
```

What it installs: two skills, one local MCP server and one edit hook, nothing else. **roast** (`/roast-my-design-system`, or "roast my design system") scans the whole repo and writes the report with Claude's read of the numbers inside it, then walks the fixes with you. **review** (`/roast-my-design-system:review`, or "review my UI changes") checks only what changed, in about a second. The bundled server gives your agent five read-only tools while it writes UI. The hook runs after every file the agent edits and hands back the findings that edit added, so the check happens whether or not the agent thought to ask; a file with nothing new gets no message. Local, no network, no telemetry.

If those commands error, your Claude Code is likely older than the plugin marketplace feature. Update Claude Code and retry, or use the manual route below: it works everywhere and installs the same skill.

**Manual (Claude Code, any version):**

```bash
git clone https://github.com/gregkozakiewicz/roast-my-design-system.git
cp -r roast-my-design-system/skills/roast-my-design-system roast-my-design-system/skills/review ~/.claude/skills/
```

(Use `.claude/skills/` inside a repo instead to share it with your team. The `review` skill needs the `roast-my-design-system` folder beside it; it runs the engine from there.)

**OpenAI Codex CLI** (same SKILL.md, same folder):

```bash
git clone https://github.com/gregkozakiewicz/roast-my-design-system.git
cp -r roast-my-design-system/skills/roast-my-design-system ~/.codex/skills/
```

Invoke with `$roast-my-design-system` (or let Codex auto-match it). Use `.codex/skills/` inside a repo to share with your team.

**`npx skills`:** `npx skills add gregkozakiewicz/roast-my-design-system` works for agents that read `~/.agents/skills/`. Claude Code currently reads `~/.claude/skills/`, so prefer one of the routes above.

Requires Node 18+.

## Use

Open Claude Code in the repo you want roasted and type:

```
/roast-my-design-system
```

And once you have a design system worth protecting, the second skill checks only what you changed, in about a second:

```
/roast-my-design-system:review
```

It runs the same check as `--check` on the files in your git diff and lists each finding with its fix, in the kit's own vocabulary on a MUI, Mantine, Chakra, Ant Design or Tailwind-theme repo. No score, no report: the small check for Tuesday afternoons. Claude also picks it up from plain words such as "review my UI changes" or "did I break the design system".

You get the roast in chat plus `design-system-roast.html` at your repo root: a self-contained page (open it, Slack it, email it, no external requests) with:

- a **health score** computed from how your numbers sit against the ideal
- **"What the numbers mean"**: Claude's read of your scan. Which findings actually matter, which good numbers are accidents, what to fix first. It is embedded in the same file you'll forward, labelled as written by Claude and kept apart from the measured numbers. The score alone can flatter; this section is what keeps a shared 85/100 honest
- stat tiles comparing you to all 3 yardsticks: Ideal, the benchmark median (112 scanned repos), and the reputable systems
- a **light/dark theme toggle** in one file
- the usage-weighted palette bar, the grey ramp, the off-scale spacing receipts, the duplicate-component receipts with clickable file paths, and the worst-offenders ledger
- a **Where to start** close: up to 3 moves derived from your repo's own numbers, each with a file-path receipt
- a **Where agents will invent** list: the gaps where the repo has no answer yet, with the files that prove each one and the move that closes it
- a **present** 🎁 below it: you sat through the roast, so `design-system-rules.md` is wrapped inside the report itself. Unwrap, then copy or download the agent rules generated from your scan.

After the roast, the skill also offers to write `design-system-rules.md` to disk and merge it into your CLAUDE.md, `.cursor/rules` or AGENTS.md.

### Three prompts to try

Type any of these in Claude Code, inside the repo:

```
Roast my design system.
```

```
How bad is my CSS? Scan this repo and show me the receipts.
```

With the MCP server connected (see [Live answers over MCP](#live-answers-over-mcp)):

```
Is there already a Button component in this repo, and which one should I use?
```

And the everyday one, after you have changed some UI:

```
Review my UI changes against the design system.
```

## Troubleshooting

- **"Command not found" or the plugin will not install.** Update Claude Code; the plugin marketplace needs a recent version. The manual install above works on any version.
- **"Nothing to roast" or a near-empty report.** The scan found almost no colours or spacing. The styling probably lives in another repo, a CDN or an installed package. Run it from the repo that holds the styles.
- **A score that looks wrong.** Check the header of the report: it names how the repo was read (product, library, shadcn, a kit, a Tailwind theme) and every folder that was left out. Scope the scan with a `.roastignore` file or `--exclude` if a playground or an old app is blurring the numbers.
- **The report did not open.** It is written to `design-system-roast.html` at the repo root. Open it in any browser; it needs no server and makes no requests.
- **The MCP server does not appear.** Restart the client after adding it. In Claude Code, `claude mcp list` shows whether it connected. Everything it needs is Node 18 or newer.

## Support

Bugs and questions go to [GitHub Issues](https://github.com/gregkozakiewicz/roast-my-design-system/issues). Everything else reaches Greg through [gregkozakiewicz.com](https://gregkozakiewicz.com). Security problems: see [SECURITY.md](SECURITY.md).

## Privacy

The tool reads the repository you point it at and writes its output next to it. It makes no network requests, collects no data, and has no telemetry. The MCP server answers from the same local scan and never leaves the machine. Nothing about your code, your prompts or your conversation is sent to anyone, including the author.

## What it measures

| Metric | Ideal Design System | Median of the 34-repo core fleet | Median of 10 reputable systems |
|---|---|---|---|
| Distinct colours | ~24 | 115 | 14 |
| Shades of grey | up to 13 | 23 | 2 |
| Off-scale spacing values | ~12 | 33 | 6 |
| Typefaces | 2 to 3 | 3 | 1 |
| Off-scale border radii | up to 10 | 14 | 0 |
| Duplicated components | 0 | 21 | 9 |
| Inline style blocks | 0 | 51 | 12 |
| Arbitrary Tailwind values | ~20 | 77 | 0 |
| Near-identical colour pairs | 0 | 7 | 1 |
| !important declarations | 0 | 5 | 3 |
| Components never imported | 0 | 0 | 0 |

Yes, the median repo is already a mess. That's the point.

**Your AI can write the UI. This makes sure it writes *your* UI.**

<a href="https://github.com/gregkozakiewicz/roast-my-design-system"><img src="https://img.shields.io/badge/If%20it%20roasted%20you%20fairly%2C%20a%20star%20helps%20other%20people%20find%20it-a855f7?style=for-the-badge&logo=github&logoColor=white" alt="If it roasted you fairly, a star helps other people find it"></a>

## License

MIT. The code is yours to fork, modify and redistribute; the copyright notice travels with it.

Building your own report, summary or audit from this tool's scores, counts or benchmark comparisons? Keep one line in it: *Built with [roast-my-design-system](https://github.com/gregkozakiewicz/roast-my-design-system) by Greg Kozakiewicz*. The skill asks the same of an AI agent that writes such a document from the scan.

**roast-my-design-system**™ and the GK mark are trademarks of Greg Kozakiewicz. Forking is welcome, republishing under this name is not: see [brand and attribution](https://gregkozakiewicz.github.io/roast-my-design-system/brand.html).

Built and designed by <a href="https://gregkozakiewicz.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/gk-mark-dark.png?v=3.10.1"><img src="https://raw.githubusercontent.com/gregkozakiewicz/roast-my-design-system/main/assets/gk-mark.png?v=3.10.1" height="15" alt="GK mark"></picture> Greg Kozakiewicz</a>.
