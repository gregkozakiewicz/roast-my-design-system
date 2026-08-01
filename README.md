# roast-my-design-system

[![npm](https://img.shields.io/npm/v/roast-my-design-system?color=2dd4bf&label=npm)](https://www.npmjs.com/package/roast-my-design-system) [![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## A Claude Code skill that roasts your repo's design system with real data.

Run this skill on your codebase and get, in about a second:

- **A health score you can defend in a meeting.** 0-100, deterministic, benchmarked against Ideal Design System norms, 30 scanned public repos and 10 reputable design systems (Primer, Polaris, Carbon, shadcn/ui…).
- **The receipts behind it.** Every colour, spacing value, typeface, duplicated component and inline style, with real file paths, in one self-contained HTML report you can open, Slack or email.
- **The first fixes ranked by payoff.** A "Where to start" list derived from your own numbers: keep the report as the audit, or hand it to Claude as the punch list for the fix.
- **Rules that stop the mess coming back.** A generated `design-system-rules.md` for your CLAUDE.md or .cursor/rules: canonical components, your token file, known duplicates to avoid, so your AI agent follows your system instead of guessing at it.

## Why this exists

Your AI agent (Claude, Cursor, Copilot) builds UI by imitating what's already in your repo. If your repo has 112 colours and four Button implementations, your agent guesses which one is canonical, and it picks wrong half the time. That's why AI-generated UI looks *almost-but-not-quite* right. The first step to fixing it is seeing the mess measured.

## Example use cases

- **Pre-refactor audit.** Run `/roast-my-design-system` before a design-system cleanup to get the measured baseline: every colour, spacing value, duplicated component and inline style, with real file paths.
- **Diagnosing almost-right AI output.** When Claude keeps generating UI that looks slightly off, the report shows which duplicated components and stray values it is imitating, and where the canonical ones live.
- **Making the case without a meeting.** Drop the self-contained HTML report in Slack: a health score and three benchmarks (ideal norms, the 30-repo median, 10 reputable systems) argue for the design system for you.
- **The fix loop.** Hand the report back to Claude as the punch list and work through the Where to start section, file by file.

The full report for vercel/ai-chatbot, top to bottom:

![The full diagnosis report for vercel/ai-chatbot in dark mode: health score, three-yardstick tiles, palette forensics, spacing receipts, typography, offenders, duplicates, and the where-to-start close](https://raw.githubusercontent.com/pencilrebel/roast-my-design-system/main/assets/report-full-dark.png?v=3.3.2)

The same report in light mode (one file, built-in toggle):

![The diagnosis report in light mode](https://raw.githubusercontent.com/pencilrebel/roast-my-design-system/main/assets/report-light-hero.png?v=3.3.2)

## What makes the numbers trustworthy

- **Deterministic scanner, not AI sampling.** A zero-dependency Node script reads *every* file (a 5,000-file monorepo takes ~1.5s) and returns the same numbers every run. Claude narrates; it never counts.
- **Read-only.** Nothing in your repo is modified. The only outputs are a temp JSON and the HTML report.
- **No network, no telemetry.** Everything runs locally. Nothing about your code leaves your machine.
- **Honest exclusions.** Test files, Storybook stories, docs sites, example apps, SVG artwork, and email templates (which *must* inline styles) are excluded, so you can't discredit the numbers on a technicality.
- **Intent-aware counting (v3).** Runtime-computed inline styles, compound-component APIs and wrapper components are not crimes and are not counted as ones. Token-led repos are judged on their hardcoded strays, not their token architecture. Repeated arbitrary values are read as decisions without names, not drift.
- **A real benchmark.** The "Avg Design System" yardstick comes from scanning 30 public React repos (cal.com, excalidraw, outline, twenty, dub, langfuse…). Median: 96 colours, 14 greys, 14 duplicated components, 42 inline style blocks, 91 arbitrary Tailwind values.
- **A second yardstick: reputable systems.** Curated, scoped scans of 10 well-known design systems (shadcn/ui, Primer, Polaris, Carbon, Material UI, Chakra, Ant Design, GOV.UK, Spectrum, Cloudscape) show what disciplined looks like at scale.

## Install

**No install, no Claude needed — just try it:**

```bash
npx roast-my-design-system
```

Run it inside any repo. Same scanner, same report, straight from npm. Add `--rules` to also generate the agent rules file, `--json` for a machine-readable summary, or `--theme light`, `--out <file>`, `--no-open` as you like. The Claude Code skill below adds the conversation on top: the roast in chat, then a punch list you can actually work through with Claude.

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
- stat tiles comparing you to all three yardsticks: Ideal, the 30-repo average, and the reputable systems
- a **light/dark theme toggle** in one file
- the usage-weighted palette bar, the grey ramp, the off-scale spacing receipts, the duplicate-component receipts with clickable file paths, and the worst-offenders ledger
- a **Where to start** close: up to three moves derived from your repo's own numbers, each with a file-path receipt

After the roast, the skill offers `design-system-rules.md`: the agent-rules file generated from the same scan, ready for your CLAUDE.md, `.cursor/rules` or AGENTS.md.

## Live examples

Three real roasts of public repos, hosted as-is (the same self-contained HTML the skill generates):

- **[excalidraw/excalidraw](https://pencilrebel.github.io/roast-my-design-system/examples/excalidraw-excalidraw.html)**
- **[dubinc/dub](https://pencilrebel.github.io/roast-my-design-system/examples/dubinc-dub.html)**
- **[vercel/ai-chatbot](https://pencilrebel.github.io/roast-my-design-system/examples/vercel-ai-chatbot.html)**

## What it measures

| Metric | Ideal Design System | Median of 30 scanned repos | Median of 10 reputable systems |
|---|---|---|---|
| Distinct colours | ~24 | 96 | 24 |
| Shades of grey | up to 13 | 14 | 5 |
| Off-scale spacing values | ~12 | 27 | 6 |
| Typefaces | 2–3 | 2 | 1 |
| Border radii | up to 10 | 12 | 2 |
| Duplicated components | 0 | 14 | 10 |
| Inline style blocks | 0 | 42 | 12 |
| Arbitrary Tailwind values | ~20 | 91 | 0 |

Yes, the median repo is already a mess. That's the point.

## License

MIT

Built and designed by [Greg Kozakiewicz](https://gregkozakiewicz.com).
