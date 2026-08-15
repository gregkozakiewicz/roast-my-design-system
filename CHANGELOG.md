# Changelog

All notable changes to roast-my-design-system. One version everywhere: the npm package, the Claude Code plugin, and the report footer always match.

## 4.2.1 — 2026-08-16

- Docs only: the npm description now mentions scoping the scan with .roastignore or --exclude, and that every exclusion is printed in the report header. No code changes.

## 4.2.0 — 2026-08-16

- **Scope the scan yourself, loudly.** Some repos host several visual worlds on purpose (the product plus a playground, a toy site, experiments), and blending them produces a score that describes none of them. A `.roastignore` file at the repo root (one repo-relative folder per line, `#` comments allowed) or a repeatable `--exclude <path>` flag now leaves those folders out of the scan; both routes merge. Honesty is built in: the harvest JSON records every active pattern with the number of files it removed, and the report prints them in the header ("2 folders excluded by .roastignore (lab/, piglet/) · 946 files kept out of this scan"), so a scoped score can never pass itself off as the whole repo. No negation, no globs: plain folder prefixes. The rules generator and SARIF export inherit the same scope automatically because they read the harvest JSON.

## 4.1.1 — 2026-08-15

- Docs only: the README leads and closes with the positioning line ("Your AI can write the UI. This makes sure it writes your UI."), names the CLI before the skill, and the Every command table moved up under Why this exists. The npm description now opens with the same line. No code changes.

## 4.1.0 — 2026-08-15

- **`--by "Full Name"` puts a requester credit in the report header**, next to the scan date, and in the JSON summary. The generated-by authorship stays in the footer; the two are never confused. The skill offers it once, after the roast.
- The README gained an **Every command** table: one place listing everything the tool and the skill can do.

## 4.0.0 — 2026-08-15

The agent release. Nothing breaks; the number is the chapter: the report now speaks the language of what your AI agent gets wrong, and the scan ends with the rules in place instead of in your clipboard.

- **The findings say what they cost you.** "22 components implemented more than once" now finishes the sentence: "so an agent asked for a Button has several random options." Same numbers, same receipts; the copy names the confusion each finding causes the agent that builds your UI.
- **`--apply` puts the rules where agents read them.** It finds CLAUDE.md, AGENTS.md, .cursorrules and .cursor/rules/, and injects the generated rules inside a clearly marked block; re-running replaces only that block and never touches your own text. The npx path now ends where the skill's conversational merge ends: rules in place, zero copy-paste.
- **Stale agent rules are called out.** Every scan now reads the rules files the repo already has and flags references this scan can no longer find: paths that no longer exist, components named canonical that nothing imports. Verified against real repos before shipping (cal.com's rules carry five dead paths; twenty's reference a deleted script) and deliberately silent when a claim can't be verified: placeholder paths, package-relative paths and build outputs never fire it.
- **`--card` writes a shareable roast card.** 1200x630, pure SVG built at scan time: score, the three worst findings, the scan date. No browser, no service, nothing leaves your machine. Embeds in a README as-is.
- **`--sarif` exports for GitHub code scanning.** The same findings in SARIF 2.1.0; upload it in CI and they appear in the Security tab, annotated on the files themselves.

## 3.12.0 — 2026-08-13

- **The benchmark fleet grew from 30 to 34 repos.** supabase, sentry, appsmith and grafana joined: large, real products that make the "average repo" yardstick harder to dismiss. Medians moved accordingly (130 colours, 17 greys, 34 off-scale spacing values, 20 duplicated components, 49 inline style blocks), and because the amber band is capped by the fleet median, a repo that used to sit below "even the average" can climb a band: dub's example score moves from 15 to 25 under the new ruler. Ideal norms are untouched.
- **Packages with real components but no raw styling are named, not hidden.** A package styled entirely through tokens or props (Ark's react package holds 583 UI files and not one raw colour) used to vanish from the package table. It now appears with "too little raw styling to judge" instead of a score. Icon sets, email packages and sandboxes stay hidden, for the same reasons the scanner excludes them elsewhere.
- **The package table renders from one row.** It used to need two scored packages, so single-app monorepos (trigger.dev, primer/react) showed the monorepo chip and then nothing.
- **public/ is only skipped when it is actually static assets.** Grafana keeps its entire frontend under public/app (3,541 component files) and twenty keeps its marketplace apps' source under packages/twenty-apps/public; both were silently unmeasured. The walker now probes for component source before skipping. 26 of the 30 existing fleet repos are byte-identical; three gain 1 to 4 files.

## 3.11.1 — 2026-08-13

- **Workspace globs with `**` no longer skip direct children.** Every package manager lets `**` match zero folder levels, but the workspace resolver required at least one, so a declaration like Chakra UI's `packages/**/**` silently dropped every direct child of `packages/`: the report showed the monorepo chip with no package table, and `packages/react` was never scored. Verified against 20 public monorepos, including the whole benchmark fleet: resolution is identical everywhere except chakra, which now resolves all 19 of its workspaces and gets its table (react 90, www 70). No published number moves.

## 3.11.0 — 2026-08-12

- **Zero off-scale spacing no longer scores red.** An old guard treated a near-zero count as "probably no design system here" and could only ever fire on the spacing tile, so a repo keeping every spacing value on tokens (the exact discipline the ideal asks for) was punished with a red tile and capped at 90. The empty-repo note from 3.10.1 already handles the "nothing here to score" case honestly, so the guard is retired. Repos with any off-scale spacing see no change.
- **A clean report now respects your agent rules.** With nothing to criticise, the verdict always said "your agent still can't see the system", even when CLAUDE.md or AGENTS.md was sitting right there. It now checks: with rules present it reads "This repo is in good shape, and your agent has rules to read. Keep them in step with the code."

## 3.10.1 — 2026-08-04

- **The empty-repo case stops over-claiming.** When the scan finds almost no colour or spacing values (a backend repo, a CLI tool, a brand-new project), the report already said "there is most likely no design system in this repo" — but still showed a proud green score above it. The score is now dimmed with a caption pointing at that note, and the rules file's preamble says plainly that its rules are universal defaults rather than findings with receipts. Repos with real UI see no change.
- The rules file footer now names the version that generated it, matching the report footer.

## 3.10.0 — 2026-08-04

- **A depth cap was silently skipping files in monorepos.** The file walker stopped at 8 levels, and a monorepo spends two of those just reaching `apps/web`, so deeply nested routes were never scanned: 12% of twenty's files, 12% of formbricks', 11% of dub's. Raised to 14, where the fleet's file counts plateau. Single-package repos were never affected.
- Both benchmark fleets were rebuilt with the deeper walk, because a changed ruler has to be re-measured: the median repo now shows 45 inline style blocks (was 42) and 3 near-identical colour pairs (was 2). Every other median held.
- Found by the regression suite written for 3.9.0, which rescans a package standalone and checks it reproduces the numbers the monorepo pass reported.

## 3.9.0 — 2026-08-03

- **Monorepos are scored package by package.** The report adds a table: each package with enough UI to judge, its own score against the same nine tiles, and its worst finding. Ten public monorepos were scanned; in every one where both a shared package and an app had enough UI to score (eight of the ten), the shared UI package is disciplined (`packages/ui` 80) and the app is where the mess lives (`apps/web` 40). One blended number was hiding that.
- Workspaces are resolved from the declaration (`package.json` globs, `pnpm-workspace.yaml`) rather than guessed from folder shape, which is why cal.com now resolves 113 packages where a folder scan finds none.
- Styling is measured inside each package, but usage is still counted repo-wide, so a component another package imports counts as adopted rather than dead. Packages with no real UI are listed, never scored.
- The scan-time claim in the README is now honest: about a second on a normal repo, a few on a large monorepo.

## 3.8.0 — 2026-08-03

- **Every fix now carries what it is worth.** "Where to start" shows what each move earns (+10 for crossing into green, +5 for a half step), and the headline projects the result of doing all of them: "Three tweaks · 55 → 85". The total is computed by applying the moves together, never by adding them up, and a move that does not cross a band shows the target to aim at instead of a number it has not earned. Moves are now ranked by real payoff.
- **The values are rendered, not listed.** The type scale at its real sizes, the radii as actual corners, the shadows cast on the light surface they were designed for. Counting says "33 font sizes"; seeing `1.313rem` sat directly above `1.3125rem` says it better.
- Three new moves for the tiles added in 3.6 and 3.7: near-identical colours, !important declarations, components nobody imports.
- Footer: the version sits beside the product name, npm is named alongside the skill, and the author credit gets its own line.

## 3.7.1 — 2026-08-03

- Report housekeeping: every report now carries a scan id in its footer, and a brand and attribution page joins the site.

## 3.7.0 — 2026-08-03

- **The three 3.6.0 findings now affect the score.** Both fleets (30 public repos, 10 reputable design systems) were rescanned with the current scanner, giving near-identical colour pairs, `!important` declarations and never-imported components real yardsticks. Each is now a scored tile: zero is green, a small tolerance is amber (2 pairs / 5 declarations / 2 components), beyond that red.
- The tile grid grows to nine (3×3), and the health score becomes a nine-judge panel. Example scores moved honestly: ai-chatbot 78→75, excalidraw 63→55, dub 18→20.
- All ten reputable design systems have **zero** never-imported components. The bar exists.

## 3.6.0 — 2026-08-02

- **Nearly identical colour pairs.** The palette section now flags colours sitting within a whisker of each other (`#f5f5f5` next to `#f6f6f6`): copy-paste, not decisions. Token pairs are skipped — a designed ramp is supposed to have near neighbours; drift needs at least one hardcoded stray.
- **Components defined but never imported.** The components section lists design-system components nobody imports: candidates for deletion, or the system nobody found. Icon sets and sub-exports of adopted files are excluded, and the report says plainly that routers and barrel files can hide real usage.
- **`!important` tally.** Counted per style file and shown with the inline-styles receipts: the cascade admitting defeat.
- All three appear in the verdict when they are the worst finding, and as new rules in `design-system-rules.md`.

## 3.5.1 — 2026-08-02

- A hover whisper on the present: rest on it for a moment and it quietly says what is inside. Styled to the report, invisible to anyone who just clicks.

## 3.5.0 — 2026-08-01

- **The rules come gift-wrapped.** Every report now embeds `design-system-rules.md` behind a one-click present below "Where to start": confetti poof, then the full rules with Copy and Download buttons. The rules travel inside every shared report; no link to break.
- The npx terminal hints at the wrapped present when `--rules` is not passed.

## 3.4.0 — 2026-08-01

- **`--rules`**: generates `design-system-rules.md`, a paste-ready agent-rules file (CLAUDE.md, `.cursor/rules`, AGENTS.md) built from the scan: canonical components with usage counts, the token file, known duplicates to avoid, spacing and styling rules. Every rule with a receipt.
- **`--json`**: machine-readable scan summary on stdout.
- The skill offers the rules file after every roast.

## 3.3.2 — 2026-08-01

- Publishing moved to GitHub Actions with npm trusted publishing: every release is built from the public repo and ships with a SLSA provenance attestation. No tokens, no manual publish.

## 3.3.1 — 2026-08-01

- Fixed report opening on Windows when the path contains spaces.

## 3.3.0 — 2026-08-01

- **Benchmark rebuilt from 30 public repos** with the audit-hardened scanner (rallly rejoined the fleet from its new GitHub home).
- **Arbitrary Tailwind values became the sixth scored tile** (ideal: ~20 deliberate escape hatches). Nine of ten reputable design systems sit at zero, including Tailwind-native shadcn/ui.
- Components-defined count moved into the "What you actually use" header.

## 3.2.0 — 2026-08-01

- First npm release: `npx roast-my-design-system` runs the same deterministic scanner as the Claude Code skill, prints the score and verdict, and opens the shareable HTML report. Zero dependencies, read-only, no network.
- Earlier history (the skill's v1–v3 evolution, three adversarial audit rounds, the report redesigns) lives in the git log.
