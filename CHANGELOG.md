# Changelog

All notable changes to roast-my-design-system. One version everywhere: the npm package, the Claude Code plugin, and the report footer always match.

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
