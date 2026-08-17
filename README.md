# roast-my-design-system

[![npm](https://img.shields.io/npm/v/roast-my-design-system?color=2dd4bf&label=npm)](https://www.npmjs.com/package/roast-my-design-system) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Your AI can write the UI. This makes sure it writes *your* UI.

A free CLI tool (and Claude Code skill) that roasts your repo's design system with real data, then generates the rules that keep your AI agent on-system.

Run it on your codebase and get, in about a second:

- **A health score you can defend in a meeting.** 0-100, deterministic, benchmarked against Ideal Design System norms, 34 scanned public repos and 10 reputable design systems (Primer, Polaris, Carbon, shadcn/ui…).
- **Per-package scores for monorepos.** One blended number hides which package is the problem: `packages/ui` scores 80 while `apps/web` scores 40, and now you can see it.
- **The receipts behind it.** Every colour and its near-identical twin, every spacing value, typeface, duplicated or never-imported component, inline style and !important, with real file paths, in one self-contained HTML report you can open, Slack or email.
- **The first fixes ranked by payoff.** A "Where to start" list derived from your own numbers: keep the report as the audit, or hand it to Claude as the punch list for the fix.
- **Rules that stop the mess coming back.** A generated `design-system-rules.md` for your CLAUDE.md or .cursor/rules: canonical components, your token file, known duplicates to avoid, so your AI agent follows your system instead of guessing at it. `--apply` injects them for you, and every scan checks the rules you already have for stale references: paths that no longer exist, components named canonical that nothing imports anymore.

## Why this exists

Your AI agent (Claude, Cursor, Copilot) builds UI by imitating what's already in your repo. If your repo has 112 colours and four Button implementations, your agent guesses which one is canonical, and it picks wrong half the time. That's why AI-generated UI looks *almost-but-not-quite* right. The first step to fixing it is seeing the mess measured.

## Every command

One scan powers all of it; the flags decide what lands on disk. Combine freely.

| Command | What you get |
|---|---|
| `npx roast-my-design-system` | The scan and `design-system-roast.html`, opened in your browser |
| `npx roast-my-design-system <path>` | Scan a different repo than the current directory |
| `... --apply` | The generated agent rules injected straight into every agent file you have: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.cursor/rules/`, `.windsurfrules` and `.github/copilot-instructions.md`, inside a marked block. Re-running replaces only that block, never your own text. Windsurf and Copilot get a compact variant sized for their limits |
| `... --rules` | The same rules written to `design-system-rules.md` instead, for pasting by hand |
| `... --card` | `roast-card.svg`: a shareable 1200x630 card with the score and worst findings. Pure SVG, embeds in a README |
| `... --sarif` | `design-system-roast.sarif` for GitHub code scanning: upload it in CI and findings appear in the Security tab, annotated on files |
| `... --by "Dwayne Hicks"` | A requester credit in the report header, next to the scan date |
| `... --exclude lab/` | Leave a folder out of the scan (repeat the flag or comma-separate). Or list folders in a `.roastignore` file at the repo root. Either way the report says so in the header; see [Scoping the scan](#scoping-the-scan) |
| `... --json` | The scan summary as JSON on stdout, for scripts and pipelines |
| `... --theme light` / `--out <file>` / `--no-open` | Light report, custom report path, don't open the browser |
| `/roast-my-design-system` (in Claude Code) | The full experience: the roast in chat, the report, the rules offer, and the fix loop with Claude on your own numbers |

Every scan also checks the agent rules you already have and flags stale references, no flag needed.

## Example use cases

- **Pre-refactor audit.** Run `/roast-my-design-system` before a design-system cleanup to get the measured baseline: every colour, spacing value, duplicated component and inline style, with real file paths.
- **Diagnosing almost-right AI output.** When Claude keeps generating UI that looks slightly off, the report shows which duplicated components and stray values it is imitating, and where the canonical ones live.
- **Making the case without a meeting.** Drop the self-contained HTML report in Slack: a health score and three benchmarks (ideal norms, the 34-repo median, 10 reputable systems) argue for the design system for you.
- **The fix loop.** Hand the report back to Claude as the punch list and work through the Where to start section, file by file.

The full report for vercel/ai-chatbot, top to bottom:

![The full diagnosis report for vercel/ai-chatbot in dark mode: health score, three-yardstick tiles, palette forensics, spacing receipts, typography, offenders, duplicates, and the where-to-start close](https://raw.githubusercontent.com/pencilrebel/roast-my-design-system/main/assets/report-full-dark.png?v=3.10.1)

The same report in light mode (one file, built-in toggle):

![The diagnosis report in light mode](https://raw.githubusercontent.com/pencilrebel/roast-my-design-system/main/assets/report-light-hero.png?v=3.10.1)

## What makes the numbers trustworthy

- **Deterministic scanner, not AI sampling.** A zero-dependency Node script reads *every* file (about a second on a normal repo, a few on a large monorepo) and returns the same numbers every run. Claude narrates; it never counts.
- **Read-only.** Nothing in your repo is modified. The only outputs are a temp JSON and the HTML report.
- **No network, no telemetry.** Everything runs locally. Nothing about your code leaves your machine.
- **Honest exclusions.** Test files, Storybook stories, docs sites, example apps, SVG artwork, and email templates (which *must* inline styles) are excluded, so you can't discredit the numbers on a technicality. Your own exclusions (`.roastignore`, `--exclude`) are printed in the report header with file counts, so a scoped scan can never pass itself off as the whole repo.
- **Intent-aware counting (v3).** Runtime-computed inline styles, compound-component APIs and wrapper components are not crimes and are not counted as ones. Token-led repos are judged on their hardcoded strays, not their token architecture. Repeated arbitrary values are read as decisions without names, not drift.
- **A real benchmark.** The "Avg Design System" yardstick comes from scanning 34 public React repos (cal.com, excalidraw, supabase, grafana, twenty, dub, langfuse…). Median: 130 colours, 17 greys, 20 duplicated components, 49 inline style blocks, 70 arbitrary Tailwind values.
- **A second yardstick: reputable systems.** Curated, scoped scans of 10 well-known design systems (shadcn/ui, Primer, Polaris, Carbon, Material UI, Chakra, Ant Design, GOV.UK, Spectrum, Cloudscape) show what disciplined looks like at scale.

## Scoping the scan

Some repos host more than one visual world on purpose: the product plus a marketing site, a playground, a batch of experiments. Blending them produces a score that describes none of them. Scope the scan to the design system you are actually judging:

```bash
npx roast-my-design-system --exclude lab/ --exclude playground/
```

Or make it permanent with a `.roastignore` file at the repo root, one repo-relative folder per line:

```
# separate visual worlds, not the product's design system
lab/
playground/
```

Both routes merge, and both are loud on purpose. The harvest JSON records every active pattern and how many files it removed, and the report prints a line in the header ("2 folders excluded by .roastignore (lab/, playground/) · 946 files kept out of this scan"). You can narrow the question, but the report always says which question was asked, so a scoped score can't be quietly gamed. There is no negation and no glob syntax: plain folder prefixes, nothing clever.

## Install

**No install, no Claude needed — just try it:**

```bash
npx roast-my-design-system
```

Run it inside any repo. Same scanner, same report, straight from npm. The Claude Code skill below adds the conversation on top: the roast in chat, then a punch list you can actually work through with Claude.

**Claude Code (recommended):**

```bash
/plugin marketplace add pencilrebel/roast-my-design-system
/plugin install roast-my-design-system@roast-my-design-system
```

If those commands error, your Claude Code is likely older than the plugin marketplace feature: update Claude Code and retry, or just use the manual route below (it works everywhere and installs the same skill).

**Manual (Claude Code, any version):**

```bash
git clone https://github.com/pencilrebel/roast-my-design-system.git
cp -r roast-my-design-system/skills/roast-my-design-system ~/.claude/skills/
```

(Use `.claude/skills/` inside a repo instead to share it with your team.)

**OpenAI Codex CLI** (same SKILL.md, same folder):

```bash
git clone https://github.com/pencilrebel/roast-my-design-system.git
cp -r roast-my-design-system/skills/roast-my-design-system ~/.codex/skills/
```

Invoke with `$roast-my-design-system` (or let Codex auto-match it). Use `.codex/skills/` inside a repo to share with your team.

**`npx skills`:** `npx skills add pencilrebel/roast-my-design-system` works for agents that read `~/.agents/skills/`. Claude Code currently reads `~/.claude/skills/`, so prefer one of the routes above.

Requires Node 18+.

## Use

Open Claude Code in the repo you want roasted and type:

```
/roast-my-design-system
```

You get the roast in chat plus `design-system-roast.html` at your repo root: a self-contained page (open it, Slack it, email it, no external requests) with:

- a **health score** computed from how your numbers sit against the ideal
- stat tiles comparing you to all three yardsticks: Ideal, the 34-repo average, and the reputable systems
- a **light/dark theme toggle** in one file
- the usage-weighted palette bar, the grey ramp, the off-scale spacing receipts, the duplicate-component receipts with clickable file paths, and the worst-offenders ledger
- a **Where to start** close: up to three moves derived from your repo's own numbers, each with a file-path receipt
- a **present** 🎁 below it: you sat through the roast, so `design-system-rules.md` is wrapped inside the report itself. Unwrap, then copy or download the agent rules generated from your scan.

After the roast, the skill also offers to write `design-system-rules.md` to disk and merge it into your CLAUDE.md, `.cursor/rules` or AGENTS.md.

## Live examples

Three real roasts of public repos, hosted as-is (the same self-contained HTML the skill generates):

- **[excalidraw/excalidraw](https://pencilrebel.github.io/roast-my-design-system/examples/excalidraw-excalidraw.html)**
- **[dubinc/dub](https://pencilrebel.github.io/roast-my-design-system/examples/dubinc-dub.html)**
- **[vercel/ai-chatbot](https://pencilrebel.github.io/roast-my-design-system/examples/vercel-ai-chatbot.html)**

## What it measures

| Metric | Ideal Design System | Median of 34 scanned repos | Median of 10 reputable systems |
|---|---|---|---|
| Distinct colours | ~24 | 130 | 24 |
| Shades of grey | up to 13 | 17 | 5 |
| Off-scale spacing values | ~12 | 34 | 6 |
| Typefaces | 2–3 | 3 | 1 |
| Border radii | up to 10 | 13 | 2 |
| Duplicated components | 0 | 20 | 12 |
| Inline style blocks | 0 | 49 | 12 |
| Arbitrary Tailwind values | ~20 | 70 | 0 |
| Near-identical colour pairs | 0 | 13 | 1 |
| !important declarations | 0 | 7 | 3 |
| Components never imported | 0 | 0 | 0 |

Yes, the median repo is already a mess. That's the point.

**Your AI can write the UI. This makes sure it writes *your* UI.**

## License

MIT. The code is yours to fork, modify and redistribute; the copyright notice travels with it.

**roast-my-design-system**™ and the GK mark are trademarks of Greg Kozakiewicz. Forking is welcome, republishing under this name is not: see [brand and attribution](https://pencilrebel.github.io/roast-my-design-system/brand.html).

Built and designed by <a href="https://gregkozakiewicz.com"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/pencilrebel/roast-my-design-system/main/assets/gk-mark-dark.png?v=3.10.1"><img src="https://raw.githubusercontent.com/pencilrebel/roast-my-design-system/main/assets/gk-mark.png?v=3.10.1" height="15" alt="GK mark"></picture> Greg Kozakiewicz</a>.
