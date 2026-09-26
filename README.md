<img src="assets/roster_logo_v1.png?v=8.2.0" width="100" alt="roast-my-design-system">

# roast-my-design-system

[![npm](https://img.shields.io/npm/v/roast-my-design-system?color=2dd4bf&label=npm)](https://www.npmjs.com/package/roast-my-design-system) [![Socket](https://badge.socket.dev/npm/package/roast-my-design-system)](https://socket.dev/npm/package/roast-my-design-system) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![zero dependencies](https://img.shields.io/badge/dependencies-0-2dd4bf)](https://www.npmjs.com/package/roast-my-design-system?activeTab=dependencies) [![no telemetry](https://img.shields.io/badge/no-telemetry-2dd4bf)](#what-makes-the-numbers-trustworthy)

[![MCP verified in Claude Code](https://img.shields.io/badge/MCP_verified-Claude_Code-2dd4bf)](#live-answers-over-mcp) [![MCP verified in Cursor](https://img.shields.io/badge/MCP_verified-Cursor-2dd4bf)](#live-answers-over-mcp) [![MCP verified in Windsurf / Devin Desktop](https://img.shields.io/badge/MCP_verified-Windsurf_%2F_Devin_Desktop-2dd4bf)](#live-answers-over-mcp)

## Find where your AI agent will invent UI.

Your AI can write the UI. This makes sure it writes *your* UI.

An agent builds UI the way a new hire does on their first day: it looks around the repo and copies what it finds. We measured that on 10 real products, 259 agent sessions, with and without this tool. On everyday work the agent reused the components and tokens that were there and stayed on-system. It went off-system in the places where the repo had no answer to copy. A chart, in a codebase with no chart palette. A theme, where nobody had named the surfaces. And it filled each gap the way the repo's own code did: by hand.

```bash
npx roast-my-design-system@latest
```

Run it at the root of a UI repo. About a second later a self-contained HTML report opens. No account, no network, no telemetry, nothing in your repo is changed.

**Current release: 9.0.** What changed in each version is in [CHANGELOG.md](CHANGELOG.md).

### The mess an agent adds is a map of the gaps in your system

An agent copies what it finds. Where the repo has no answer, it makes one up, and the next agent copies that. This tool draws the map before the gap becomes a layer: it finds the places with no answer, measures the mess already there, writes the rules that keep the agent on-system, and puts a check inside the agent's editor that runs whether or not the agent thinks to ask.

**A script does the counting. Claude writes the explanation.** Every number in the report comes from a deterministic read of your files, the same numbers every run. Where an AI reads the scan for you, its text is labelled as written by AI and kept apart from the measurements.

## What you get

**The gaps, named.** A "Where agents will invent" section lists the places where the repo has no answer yet, with the files that prove each one and the single move that closes it. Today it knows one gap for certain, because the agent runs found it: charts that paint their series colours by hand in a repo with no chart palette. Across 126 public repos, 43 look like that. The list grows only when a gap has been measured, never guessed.

**A health score you can defend in a meeting.** 0 to 100, the same number every run, measured against 3 yardsticks: the ideal norms of a design system, the median of 34 scanned public products, and 10 reputable systems (Primer, Polaris, Carbon, shadcn/ui and others). Monorepos get a score per package, so `packages/ui` at 80 stops hiding `apps/web` at 40.

**The receipts behind it.** Every colour and its near-identical twin. Every off-scale spacing value, typeface, duplicated or never-imported component, inline style block and `!important`, each with a real file path. One HTML file you can open, Slack or email.

**The first fixes, ranked by payoff.** A "Where to start" list derived from your own numbers. Each move has a copy button with a ready-made fix prompt for your agent: the finding, the files, the expected payoff, and rules that respect deliberate craft. Fix, rescan, press the next button.

**Rules that stop the mess coming back.** A generated `design-system-rules.md` with the canonical components, your token file and the known duplicates to avoid. `--apply` writes it into every agent file you have: Claude, Cursor, GitHub Copilot and Windsurf. Every scan also checks the rules you already have for stale references, and says which of your tools can actually read them.

## Three ways to use it

### 1. Roast the repo

The scan and the report. The full flag list is under [Every command](#every-command).

```bash
npx roast-my-design-system@latest
```

### 2. Put the system inside the agent

The same engine as a local MCP server. Five read-only tools the agent calls while it writes UI, from "is there a Button already?" to "review my changes". The Claude Code plugin bundles it; any other client registers one command. See [Live answers over MCP](#live-answers-over-mcp).

```bash
claude mcp add roast -- npx roast-my-design-system@latest --mcp
```

### 3. Check what the agent changed

Three doors to the same check. `--check` reads your git diff in the terminal and exits 1 on findings, so it slots into a script. The plugin's `review` skill does it in chat. And the plugin's edit hook runs it after every file the agent edits, writes or produces with a shell command, handing back only the findings that edit added. The agent does not have to remember to ask.

```bash
npx roast-my-design-system@latest --check
```

For pull requests there is a sister package, [guard-my-design-system](https://github.com/gregkozakiewicz/guard-my-design-system): a GitHub Action that runs the same rules on the diff and fails the check when new mess arrives.

## What the agent runs showed

We ran Claude Code headless on 10 public products (cal.com, Dub, Metabase, Plausible, SigNoz, trigger.dev and four more), pinned to one commit each, and counted the design-system findings each session added, by this tool's own rules. 259 sessions, Sonnet 5 and Haiku 4.5, September 2026.

Routine work did not drift, with or without help: 7 findings without this tool and 9 with it, over 80 sessions of moving panels and building dashboards. Invention drifted, and in the shape the repo already had. Three numbers:

- **28 to 2.** Findings a Christmas theme added across 10 products, without and with this tool. The agent called the MCP tools in every theme session.
- **42 in 16 runs, to 3 in 51.** Haiku 4.5 asked for a chart, a status colour, an empty state and a new component, without the tool and with the edit hook on.
- **10 in 20 runs, to 0 in 20.** Sonnet 5 asked for a chart, without and with the plugin installed. It called no tool and the hook never had to speak: the rules in its context were enough.

The agent does not always call a tool when it should: Sonnet in about one session in 3, Haiku never. A check on every edit does not have that problem. Nothing was rendered, so zero findings means on-system by these rules, a floor rather than a design review. Method, tables and limits are in the research write-up, which will be published separately.

## Live examples

Eleven reports, hosted exactly as the tool writes them: self-contained HTML, every number deterministic, every path real. Four kits, a fresh install, a registry, Stencil, Lit and plain React.

- **[npx shadcn create, fresh](https://gregkozakiewicz.github.io/roast-my-design-system/examples/shadcn-create-fresh.html)** (factory install, all 61 components): read as a fresh install, "the score is the kit's, not yours"; 13 colours, every theme variable in place, shadcn's own 24 bracket values named and not counted. No score.
- **[Unleash](https://gregkozakiewicz.github.io/roast-my-design-system/examples/unleash-mui.html)** (MUI): 1,109 files import the kit and the theme is read 6,166 times; 4 colours and 2 spacings per 100 kit files are written onto components. Score 60.
- **[Metabase](https://gregkozakiewicz.github.io/roast-my-design-system/examples/metabase-mantine.html)** (Mantine): its own wrapper over Mantine counts as the kit, so 2,679 files are read instead of 392; nothing written onto components, 2 spacings per 100 kit files. Score 47.
- **[SigNoz](https://gregkozakiewicz.github.io/roast-my-design-system/examples/signoz-antd.html)** (Ant Design): 2 colours and 7 spacings per 100 kit files written in style objects where a token exists. Score 51.
- **[Apache Airflow](https://gregkozakiewicz.github.io/roast-my-design-system/examples/airflow-chakra.html)** (Chakra UI): no colours written onto components, 4 spacings per 100 kit files as pixel strings where a space step exists. Score 43.
- **[vercel/ai-chatbot](https://gregkozakiewicz.github.io/roast-my-design-system/examples/vercel-ai-chatbot.html)** (shadcn install): 74 values like [13px] written outside the Tailwind scale, and 66 palette colours per 100 files where a theme variable exists; Claude's notes embedded. Score 80.
- **[excalidraw/excalidraw](https://gregkozakiewicz.github.io/roast-my-design-system/examples/excalidraw-excalidraw.html)**: 78 off-scale spacing values and 90 !important declarations. Score 55.
- **[dubinc/dub](https://gregkozakiewicz.github.io/roast-my-design-system/examples/dubinc-dub.html)**: 622 arbitrary bracket values, 22 duplicated components, and the chart-palette gap named. Score 20.
- **[telekom/scale](https://gregkozakiewicz.github.io/roast-my-design-system/examples/telekom-scale.html)** (Stencil): 95 Stencil components read by tag; 66 spacing values outside the scale where about 12 would do; Claude's notes embedded. Score 55.
- **[magicuidesign/magicui](https://gregkozakiewicz.github.io/roast-my-design-system/examples/magicui.html)** (registry): counted on the components it publishes, 52 off-theme colours per 100 files in the code it ships, its docs site kept out and named. Score 78.
- **[adobe/spectrum-web-components](https://gregkozakiewicz.github.io/roast-my-design-system/examples/adobe-spectrum.html)** (Lit): hardcoded colours sitting beside 744 colour tokens, and 37 !important declarations. Score 66.

The full report for vercel/ai-chatbot, top to bottom, with "What the numbers mean", Claude's read of the scan, under the verdict:

![The full diagnosis report for vercel/ai-chatbot in dark mode: a fixed side panel with the health score and what it measures, the stack, how the repo was read as a shadcn install, an index of every section and what is not the team's and not counted; then the summary, the What the numbers mean analysis written by Claude, priced Where to start moves each with its copy-the-fix-prompt button, the wrapped present with the agent rules, an agent trap callout, 3-yardstick tiles including the 2 shadcn tiles, the adoption map treemap, palette forensics, the shadcn theme variable by variable, spacing receipts, typography specimens, offenders, duplicates, and the component usage ledger](assets/report-full-dark.png?v=9.0.6)

The same report in light mode (one file, built-in toggle):

![The diagnosis report in light mode](assets/report-light-hero.png?v=9.0.6)

## What makes the numbers trustworthy

- **Deterministic.** A zero-dependency Node script reads every file, about a second on a normal repo, and returns the same numbers every run.
- **Read-only, no network, no telemetry.** Nothing in your repo is modified and nothing about your code leaves your machine. The suite fails if package.json ever declares a dependency.
- **Honest gaps and exclusions.** What the scan cannot read says "not measured" and drops out of the score. Test files, stories, docs sites, artwork and email templates are left out, and your own exclusions are printed in the report header with file counts.
- **A real benchmark.** 112 public React repos scanned; a core fleet of 34 sets the medians, the rest feed the kit profiles so a shadcn repo is compared with shadcn repos. Ten reputable systems (Primer, Polaris, Carbon, GOV.UK and others) are the second yardstick. The builder is in `tools/benchmark/`, so the ruler can be checked.
- **Importable scoring.** `scoreHarvest(harvest)` returns the score and metrics as plain data; the report and a CI check get the same numbers.

The longer version, with what each exclusion covers, how a scan is scoped and what the plugin runs on your machine, is in [docs/reference.md](docs/reference.md).

## What it works on

**Supported**

- React repos: Next, Remix, Vite and plain React.
- Web-component repos: Stencil and Lit.
- 4 kinds of repo: product, library, shadcn, registry.
- 5 kit profiles: Tailwind theme, MUI, Mantine, Chakra, Ant Design.
- Any styling on top: Tailwind, styled-components, Emotion, Sass, Less, vanilla-extract, Stitches, CVA, CSS Modules.

**Recognised, not supported yet**

- Vue, Angular and Svelte: named in the header, colours and spacing still counted, but components are not measured and the report says so.
- HeroUI, NextUI, Radix Themes, Fluent UI, React Bootstrap and Grommet: named in the header, no kit rules.

## Every command

One scan powers all of it; the flags decide what lands on disk. Combine freely.

### Run it yourself

| Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | What you get |
|---|---|
| <code>npx&nbsp;roast-my-design-system@latest</code> | The scan and `design-system-roast.html`, opened in your browser |
| <code>...&nbsp;&lt;path&gt;</code> | Scan a different repo than the current directory |
| `... --apply` | The generated agent rules injected into every agent file you have: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, `.windsurfrules` and `.github/copilot-instructions.md`, inside a marked block. Re-running replaces only that block, never your own text. |
| `... --rules` | The same rules written to `design-system-rules.md` instead, for pasting by hand |
| `... --card` | `roast-card.svg`: a shareable 1200x630 card with the score and worst findings. Pure SVG, embeds in a README |
| `... --sarif` | `design-system-roast.sarif` for GitHub code scanning: upload it in CI and findings appear in the Security tab, annotated on files |
| `... --check` | The working tree's changed files checked against the design system, in the terminal. Exits 1 on findings, so it slots into scripts |
| `/roast-my-design-system:review` (in Claude Code) | The same check in chat, from the plugin's second skill: each changed file's findings with the fix named, then the fixes applied and the check re-run |
| <code>...&nbsp;--exclude&nbsp;lab/</code> | Leave a folder out of the scan (repeat the flag or comma-separate). Or list folders in a `.roastignore` file at the repo root. Either way the report says so in the header |
| `... --json` | The scan summary as JSON on stdout, for scripts and pipelines. Includes `schemaVersion`, the benchmark used, and every metric as a number, so two scans can be compared |
| <code>...&nbsp;--by&nbsp;"Dwayne&nbsp;Hicks"</code> | Puts a name in the report header, for when you ran it for someone else |
| <code>...&nbsp;--theme&nbsp;light</code>&nbsp;/ <code>--out&nbsp;&lt;file&gt;</code>&nbsp;/ <code>--no-open</code>&nbsp;/ <code>--open</code> | Light report, custom report path, never open the browser, always open it |

### For your agent

| Command&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | What you get |
|---|---|
| <code>...&nbsp;--notes&nbsp;&lt;file.md&gt;</code> | The agent's read of this scan, embedded in the report as **"What the numbers mean"**: which findings matter, which good numbers are accidents, what to fix first. Labelled as written by AI and kept apart from the measured numbers. The Claude Code skill writes and passes it automatically; the flag is here so any agent can |
| <code>...&nbsp;--section&nbsp;"Title"&nbsp;&lt;file.md&gt;</code> | A further agent-written chapter after the notes, same styling, same label, sub-headings allowed. Repeatable |
| `... --hook` | The check the Claude Code plugin runs after every edit, for hand-installed setups: reads the hook event on stdin, checks the file that changed, prints only the findings the edit added as JSON. Always exits 0 |
| `... --mcp` | The scan as a local MCP server: 5 tools your agent calls while writing UI, plus the `roast-fix` prompt that serves the top fix from a fresh scan. See [Live answers over MCP](#live-answers-over-mcp) |
| <code>/roast-my-design-system</code> (in&nbsp;Claude&nbsp;Code) | The full experience: the roast in chat *and* embedded in the report as "What the numbers mean", the rules offer, and the fix loop with Claude on your own numbers |

**"Why this matters"** is generic, ships with the tool and reads the same in every report. **"What the numbers mean"** is your agent's read of your repo, and only appears when an agent passed it.

## Live answers over MCP

The report and the rules file describe the repo as it was at scan time. `--mcp` keeps the same engine running while your agent works, so questions get answered from the code as it is right now, and mistakes get caught before they land.

| Tool | The question it answers |
|---|---|
| `roast_get_context` | What should I know before touching UI here? Routed by the folder being edited |
| `roast_find_component` | Is there already a component for this, and which one is canonical? With one real usage example. When two candidates tie, it says so and names both |
| `roast_find_token` | I have `#111111` / `13px` in hand. What should I have used? |
| `roast_validate` | I am about to save this. Does it break the system? |
| `roast_review` | Review my changed files. Reads the git diff itself, so no code is pasted back |

The loop: context before building, find while building, validate before saving, review before finishing.

One real exchange, against [Unleash](https://github.com/Unleash/unleash), an MUI product at 60/100. The agent has a grey in hand and a padding in mind:

```
roast_find_token #6b7280
→ Nearest token: #607d8b, 11 channel steps from #6b7280. Unless the difference is a deliberate decision, use the token.

roast_validate (first draft)
→ ✕ L5 Colour #6b7280 written onto an MUI component, and the theme has no such colour.
     Fix: Add it to the theme once (frontend/src/themes/dark-theme.ts), then read it there: color: 'text.secondary' in sx.
  ✕ L5 Pixel size p: 12px on an MUI component.
     Fix: 12px is between steps 1 (8px) and 2 (16px). Keep it with a comment, or use the nearest step in sx.

roast_validate (second draft: color: 'text.secondary', p: 1.5)
→ No measured violations found. Checked: hardcoded colours vs the token set, near-identical colour twins, off-scale spacing …
```

Four calls, under 800 tokens, and the new component reads the theme instead of adding colour number 44.

Charts get their own rule, because a chart needs several colours that differ from each other and most design systems never name them. Where a repo keeps a chart palette, a colour written by hand in a chart file is a finding that names the palette. Where a repo has charts but no palette, a new chart that paints by hand gets one warning that names the existing chart doing the same and asks for the palette once. That warning is the gap report, live.

The server reads the repo the way the report does. On a product built on MUI, Mantine, Chakra UI or Ant Design, the context names the theme file and the kit's own way of reading it, `roast_find_token` answers in spacing steps, and the checks flag a colour or a pixel size written onto a kit component where the theme has a value. On a Tailwind theme or a shadcn repo they flag a palette class such as `text-gray-500` where the theme names a colour of that kind.

The `roast-fix` prompt serves the top Where-to-start move from a fresh scan, byte-identical to the report's copy buttons. In Claude Code type `/mcp__roast__roast-fix`, add a number to jump the queue. Fix it, ask again, and the next move has risen to the top: the scan is the progress bar.

**Installed the Claude Code plugin?** The server is already there. Otherwise:

```bash
claude mcp add roast -- npx roast-my-design-system@latest --mcp
```

**Verified in Claude Code, Cursor and Windsurf (now Devin Desktop).** Each was tested end to end: server connected, all 5 tools listed, real answers in the editor's own chat. Local, read-only, one scan at startup, no port, no account.

**Cursor**: put this in `.cursor/mcp.json` inside the project (the project, so the scan sees one repo, not your whole disk), then enable `roast` under Settings → Tools & MCP the first time:

```json
{ "mcpServers": { "roast": { "command": "npx", "args": ["roast-my-design-system", "--mcp"] } } }
```

**Windsurf (Devin Desktop)**: its MCP config is global (`~/.codeium/windsurf/mcp_config.json`), so name the project folder to keep the scan scoped to one repo:

```json
{ "mcpServers": { "roast": { "command": "npx", "args": ["roast-my-design-system", "--mcp", "/path/to/your/repo"] } } }
```

Any other MCP client can register the same stdio command.

## In CI

The scanner speaks SARIF, so wiring it into GitHub code scanning is 6 lines. Findings appear in the Security tab, annotated on the files themselves:

```yaml
- uses: actions/checkout@v5
- run: npx roast-my-design-system@latest . --sarif --no-open
- uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: design-system-roast.sarif
```

To fail a pull request on new mess only, use [guard-my-design-system](https://github.com/gregkozakiewicz/guard-my-design-system).

## Install

**No install, no Claude needed:**

```bash
npx roast-my-design-system@latest
```

**Claude Code (recommended):**

```bash
/plugin marketplace add gregkozakiewicz/roast-my-design-system
/plugin install roast-my-design-system@roast-my-design-system
```

What it installs: two skills, one local MCP server and one edit hook, nothing else. **roast** (`/roast-my-design-system`, or "roast my design system") scans the whole repo, writes the report with Claude's read of the numbers inside it, then walks the fixes with you. **review** (`/roast-my-design-system:review`, or "review my UI changes") checks only what changed, in about a second. The hook runs after every file the agent edits and hands back the findings that edit added; a file with nothing new gets no message.

If those commands error, your Claude Code is older than the plugin marketplace. Update it, or use the manual route:

```bash
git clone https://github.com/gregkozakiewicz/roast-my-design-system.git
cp -r roast-my-design-system/skills/roast-my-design-system roast-my-design-system/skills/review ~/.claude/skills/
```

(Use `.claude/skills/` inside a repo to share it with your team. The `review` skill needs the `roast-my-design-system` folder beside it.)

**OpenAI Codex CLI** (same SKILL.md, same folder):

```bash
git clone https://github.com/gregkozakiewicz/roast-my-design-system.git
cp -r roast-my-design-system/skills/roast-my-design-system ~/.codex/skills/
```

Invoke with `$roast-my-design-system`. Use `.codex/skills/` inside a repo to share with your team.

**`npx skills`:** `npx skills add gregkozakiewicz/roast-my-design-system` works for agents that read `~/.agents/skills/`. Claude Code reads `~/.claude/skills/`, so prefer one of the routes above.

Requires Node 18+.

## Use

Open Claude Code in the repo you want roasted and type:

```
/roast-my-design-system
```

Once you have a design system worth protecting, the second skill checks only what you changed:

```
/roast-my-design-system:review
```

It runs the same check as `--check` on the files in your git diff and lists each finding with its fix, in the kit's own vocabulary on a MUI, Mantine, Chakra, Ant Design or Tailwind-theme repo. No score, no report: the small check for Tuesday afternoons. Claude also picks it up from plain words such as "review my UI changes" or "did I break the design system".

You get the roast in chat plus `design-system-roast.html` at your repo root, a self-contained page with:

- a **health score** computed from how your numbers sit against the ideal
- **"What the numbers mean"**: Claude's read of your scan, embedded in the file you'll forward, labelled as written by Claude and kept apart from the measured numbers. The score alone can flatter; this section keeps a shared 85/100 honest
- stat tiles comparing you to all 3 yardsticks
- a **light/dark theme toggle** in one file
- the usage-weighted palette bar, the grey ramp, the off-scale spacing receipts, the duplicate-component receipts with clickable file paths, and the worst-offenders ledger
- a **Where to start** close: up to 3 moves derived from your repo's own numbers, each with a file-path receipt
- a **Where agents will invent** list: the gaps where the repo has no answer yet, with the files that prove each one and the move that closes it
- a **present** 🎁 below it: `design-system-rules.md` wrapped inside the report. Unwrap, then copy or download the agent rules generated from your scan

After the roast, the skill offers to write `design-system-rules.md` to disk and merge it into your CLAUDE.md, `.cursor/rules` or AGENTS.md.

### Four prompts to try

```
Roast my design system.
```

```
How bad is my CSS? Scan this repo and show me the receipts.
```

With the MCP server connected:

```
Is there already a Button component in this repo, and which one should I use?
```

And the everyday one, after you have changed some UI:

```
Review my UI changes against the design system.
```

## Troubleshooting

- **"Command not found" or the plugin will not install.** Update Claude Code; the plugin marketplace needs a recent version. The manual install works on any version.
- **"Nothing to roast" or a near-empty report.** The scan found almost no colours or spacing. The styling probably lives in another repo, a CDN or an installed package. Run it from the repo that holds the styles.
- **A score that looks wrong.** Check the report header: it names how the repo was read (product, library, shadcn, a kit, a Tailwind theme) and every folder that was left out. Scope the scan with `.roastignore` or `--exclude` if a playground or an old app is blurring the numbers.
- **The report did not open.** It is written to `design-system-roast.html` at the repo root. Open it in any browser; it needs no server and makes no requests.
- **The MCP server does not appear.** Restart the client after adding it. In Claude Code, `claude mcp list` shows whether it connected. It needs Node 18 or newer.

## Support

Bugs and questions go to [GitHub Issues](https://github.com/gregkozakiewicz/roast-my-design-system/issues). Everything else reaches Greg through [gregkozakiewicz.com](https://gregkozakiewicz.com). Security problems: see [SECURITY.md](SECURITY.md).

## Privacy

The tool reads the repository you point it at and writes its output next to it. It makes no network requests, collects no data, and has no telemetry. The MCP server answers from the same local scan. Nothing about your code, your prompts or your conversation is sent to anyone, including the author.

## What it measures

| Metric | Ideal Design System | Median of the 34-repo core fleet | Median of 10 reputable systems |
|---|---|---|---|
| Distinct colours | ~24 | 118 | 14 |
| Shades of grey | up to 13 | 21 | 2 |
| Off-scale spacing values | ~12 | 23 | 5 |
| Typefaces | 2 to 3 | 3 | 1 |
| Off-scale border radii | up to 10 | 14 | 0 |
| Duplicated components | 0 | 21 | 9 |
| Inline style blocks | 0 | 51 | 12 |
| Arbitrary Tailwind values | ~20 | 77 | 0 |
| Near-identical colour pairs | 0 | 8 | 1 |
| !important declarations | 0 | 5 | 3 |
| Components never imported | 0 | 0 | 0 |

Yes, the median repo is already a mess. That is the point. An agent arriving in it will copy the mess faithfully and, where the mess runs out, add some of its own.

**Your AI can write the UI. This makes sure it writes *your* UI.**

<a href="https://github.com/gregkozakiewicz/roast-my-design-system"><img src="https://img.shields.io/badge/If%20it%20roasted%20you%20fairly%2C%20a%20star%20helps%20other%20people%20find%20it-a855f7?style=for-the-badge&logo=github&logoColor=white" alt="If it roasted you fairly, a star helps other people find it"></a>

## License

MIT. The code is yours to fork, modify and redistribute; the copyright notice travels with it.

Building your own report, summary or audit from this tool's scores, counts or benchmark comparisons? Keep one line in it: *Built with [roast-my-design-system](https://github.com/gregkozakiewicz/roast-my-design-system) by Greg Kozakiewicz*. The skill asks the same of an AI agent that writes such a document from the scan.

**roast-my-design-system**™ and the GK mark are trademarks of Greg Kozakiewicz. Forking is welcome, republishing under this name is not: see [brand and attribution](https://gregkozakiewicz.github.io/roast-my-design-system/brand.html).

Built and designed by <a href="https://gregkozakiewicz.com"><picture><source media="(prefers-color-scheme: dark)" srcset="assets/gk-mark-dark.png?v=3.10.1"><img src="assets/gk-mark.png?v=3.10.1" height="15" alt="GK mark"></picture> Greg Kozakiewicz</a>.
