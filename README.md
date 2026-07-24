# roast-my-design-system

## A Claude Code skill that roasts your repo's design system with real data.

Run this skill on your codebase and it counts every colour, grey, spacing value, typeface, duplicated component and inline style. Then it compares you against an Ideal Design System, against 29 scanned public repos, and against 10 reputable design systems (Primer, Polaris, Carbon, shadcn/ui…) and generates a shareable HTML diagnosis with real file paths: **keep it as a report, or hand it back to Claude as the punch list for the fix.**

## Why this exists

Your AI agent (Claude, Cursor, Copilot) builds UI by imitating what's already in your repo. If your repo has 112 colours and four Button implementations, your agent guesses which one is canonical, and it picks wrong half the time. That's why AI-generated UI looks *almost-but-not-quite* right. The first step to fixing it is seeing the mess measured.

The full report for vercel/ai-chatbot, top to bottom:

![The full diagnosis report for vercel/ai-chatbot in dark mode: health score, three-yardstick tiles, palette forensics, spacing receipts, typography, offenders, duplicates, and the where-to-start close](assets/report-full-dark.png)

The same report in light mode (one file, built-in toggle):

![The diagnosis report in light mode](assets/report-light-hero.png)

## What makes the numbers trustworthy

- **Deterministic scanner, not AI sampling.** A zero-dependency Node script reads *every* file (a 5,000-file monorepo takes ~1.5s) and returns the same numbers every run. Claude narrates; it never counts.
- **Read-only.** Nothing in your repo is modified. The only outputs are a temp JSON and the HTML report.
- **No network, no telemetry.** Everything runs locally. Nothing about your code leaves your machine.
- **Honest exclusions.** Test files, Storybook stories, docs sites, example apps, SVG artwork, and email templates (which *must* inline styles) are excluded, so you can't discredit the numbers on a technicality.
- **Intent-aware counting (v3).** Runtime-computed inline styles, compound-component APIs and wrapper components are not crimes and are not counted as ones. Token-led repos are judged on their hardcoded strays, not their token architecture. Repeated arbitrary values are read as decisions without names, not drift.
- **A real benchmark.** The "Avg Design System" yardstick comes from scanning 29 public React repos (cal.com, excalidraw, outline, twenty, dub, langfuse…). Median: 88 colours, 12 greys, 17 duplicated components, 42 inline style blocks.
- **A second yardstick: reputable systems.** Curated, scoped scans of 10 well-known design systems (shadcn/ui, Primer, Polaris, Carbon, Material UI, Chakra, Ant Design, GOV.UK, Spectrum, Cloudscape) show what disciplined looks like at scale.

## Install

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
- stat tiles comparing you to all three yardsticks: Ideal, the 29-repo average, and the reputable systems
- a **light/dark theme toggle** in one file
- the usage-weighted palette bar, the grey ramp, the off-scale spacing receipts, the duplicate-component receipts with clickable file paths, and the worst-offenders ledger
- a **Where to start** close: up to three moves derived from your repo's own numbers, each with a file-path receipt

## Live examples

Three real roasts of public repos, hosted as-is (the same self-contained HTML the skill generates):

- **[excalidraw/excalidraw](https://pencilrebel.github.io/roast-my-design-system/examples/excalidraw-excalidraw.html)** — 237 colours, 49 greys, 3 typefaces declared 9 different ways
- **[dubinc/dub](https://pencilrebel.github.io/roast-my-design-system/examples/dubinc-dub.html)** — 138 colours and 86 spacing values across a monorepo
- **[vercel/ai-chatbot](https://pencilrebel.github.io/roast-my-design-system/examples/vercel-ai-chatbot.html)** — a small starter with 61 colours and 69 inline style blocks

## What it measures

| Metric | Ideal Design System | Median of 29 scanned repos | Median of 10 reputable systems |
|---|---|---|---|
| Distinct colours | ~24 | 88 | 24 |
| Shades of grey | up to 13 | 12 | 5 |
| Off-scale spacing values | ~12 | 26 | 6 |
| Typefaces | 2–3 | 2 | 1 |
| Border radii | up to 10 | 12 | 2 |
| Duplicated components | 0 | 17 | 10 |
| Inline style blocks | 0 | 42 | 11 |

Yes, the median repo is already a mess. That's the point.

## License

MIT

Built and designed by [Greg Kozakiewicz](https://gregkozakiewicz.com).
