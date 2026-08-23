# Changelog

All notable changes to roast-my-design-system. One version everywhere: the npm package, the Claude Code plugin, and the report footer always match.

## 5.2.2 — 2026-08-20

- The project moved home: GitHub account renamed `pencilrebel` → `gregkozakiewicz`. Every reference in the package, docs, landing page, plugin manifests and report links now points at the new owner. Old `github.com/pencilrebel/...` URLs redirect automatically; old `pencilrebel.github.io/...` pages forward via the pencilrebel org's site repo, so no published link dies. npm Trusted Publishing re-bound to the new owner. No engine changes.

## 5.2.1 — 2026-08-22

- **The roast cuts both ways.** The terminal outro now pairs the feedback ask with its twin: "Think it got it right? A star helps other people find it", linking to the repo. The README carries the same ask as a badge under the tagline, and a live monthly-downloads badge at the top.
- No engine changes: the scanner, the report and the five MCP tools are what 5.2.0 shipped.

## 5.2.0 — 2026-08-21

- **The report can hold chapters now.** New `--section "Title" <file.md>` on the diagnose step, repeatable, renders agent-written chapters after "What the numbers mean": same styling, same accent spine, same written-by-AI label, with `## ` sub-headings allowed. Born from a report seen in the wild: asked for an interaction audit on top of the roast, an agent found the notes box too small for ten findings and built its own page from scratch, no footer, no credit, none of this report's design. A document with spare rooms never forces a guest to build a second house. Re-runs must re-pass every `--section` (and `--notes`), and an unreadable file is a hard error; `--summary` JSON lists embedded section titles under `sectionsEmbedded`.
- **The scan data now introduces its maker.** The harvest JSON opens with an `_attribution` block (tool, author, repo link, and the credit line any derived document should carry), placed first so agents that sample the top of the file meet it before the numbers. The MCP server's `roast_get_context` closes with the same one-line credit request. Nothing is enforced and nothing is collected; the data simply asks to be cited, the way a dataset does.
- The skill gains a **non-negotiables** block: the report is always the file the diagnose script writes, never a hand-authored page; analysis beyond the roast goes into `--section` chapters; and any separate document built from the scan's numbers carries the credit line.
- README states the same credit norm for humans, one line under License.
- The report itself is unchanged when no new flags are passed, footer and all.

## 5.1.4 — 2026-08-20

- npm search catches up with the GitHub topics: mcp-server, ai-agents, linter, code-quality, cursor and windsurf join the package keywords.
- Republished so npm's provenance attestation points at a live commit again: a repository history cleanup earlier today orphaned the commit 5.1.3 was built from, and npm showed a "cannot verify source" banner on the package page. No code changes; the engine is byte-for-byte 5.1.3.

## 5.1.3 — 2026-08-20

- **The tool asks for feedback now.** The terminal outro and the report footer both carry one line, "Think it got something wrong? Say so, and say which bit", pointing at a GitHub issue form that opens with the version already filled in and the questions already written. Around 2,000 people had run the scanner by then and the only way to answer back was to know where the issues tab lived. Nothing is sent and nothing is collected: the link carries the version and nothing else, so a scan can never publish itself by accident.
- The questions and the note that comes with them live in `.github/ISSUE_TEMPLATE/feedback.yml`, so the wording can change without a release.
- The link wears a pulse that traces itself left to right, drawn in CSS so a forwarded report keeps it, and held still for anyone who asked for reduced motion. The credit link now carries `?utm_source=roast-report`, which is the first honest measure of whether shared reports actually travel.

## 5.1.2 — 2026-08-20

- **Listed in the official MCP registry.** A `server.json` at the repo root describes the stdio server (`npx roast-my-design-system --mcp`) for registry.modelcontextprotocol.io, and `mcpName` in package.json is the ownership proof the registry checks against the published npm package. The publish workflow now sends the listing itself, authenticated with GitHub OIDC, so npm and the registry can never drift apart.
- **One release path, in one file.** `release.mjs` is now the only supported way to cut a release: it syncs the version across package.json, the engine constant, the plugin manifest and server.json, refuses to move without a changelog entry, runs the smoke test and the 55-check snapshot suite, shows the diff, then commits, tags and pushes and watches npm and the registry receive it. Publishing by hand from a laptop skips the tests and drops npm's provenance badge, so the script never does it and neither should anyone else.
- The plugin manifest, stale at 5.0.2 since the 5.1 releases, is back in step with everything else.
- No engine changes: the scanner, the report and the five MCP tools are what 5.1.1 shipped.

## 5.1.1 — 2026-08-20

- Docs and examples catch up with 5.1.0: the hosted vercel/ai-chatbot example report is regenerated from a fresh scan **with Claude's notes embedded** ("What the numbers mean" live on the page, same 75/100), its card on the landing page carries a "with Claude's notes" chip, README screenshots are reshot on that report so the analysis section is visible, and the landing page leads with the analysis-travels-with-the-report bullet. No engine changes.

## 5.1.0 — 2026-08-20

- **The roast's analysis ships inside the report.** New `--notes <file.md>` on the diagnose step (and passed through by the npx CLI) embeds an agent-written analysis in the report as **"What the numbers mean"**, between the verdict and Where to start. Born from the first user feedback: an 85/100 report got forwarded to the team while the critical read of those numbers stayed behind in the requester's chat — the score flattered, the analysis never travelled. Now the shared file carries both.
- Kept honest by design: the section is labelled "Written by Claude from this scan · date · not part of the measurement" (author overridable with `--notes-author` for other agents), rendered from markdown-lite (paragraphs, bold, code, lists) with everything HTML-escaped, so notes can never inject markup and prose can never pass as measurement. No flag, no section: the CLI report without notes is byte-for-byte what 5.0.2 produced.
- The skill now writes the roast to `/tmp/roast-notes.md` first and generates the report from it, so chat and report carry the same analysis; every regeneration (`--by` credit, theme change) re-passes the notes, and a missing notes file is a hard error rather than a silently thinner report.
- `--summary` JSON reports `notesEmbedded: true` when the section is present.

## 5.0.2 — 2026-08-18

- Docs only: npm's README now carries the reshot screenshots (the report as it looks today, agent trap and present included; the old images dated from 3.10.1) and the current image cache keys. No code changes.

## 5.0.1 — 2026-08-18

- The MCP tool catalogue went on a diet: tool and resource descriptions trimmed from 754 to 636 tokens, saving 118 tokens in every session of every client that loads the server. Same tools, same behaviour, fewer words describing them.
- npm now shows the README as it looks on GitHub: the New in 5.0 callout up top, the command table with commands held on one line, and the landing-page pointer. (npm freezes the README at publish time, so 5.0.0's copy predated the polish.)

## 5.0.0 — 2026-08-18

- **The MCP server: the scan, live in your agent's loop.** `--mcp` runs the same deterministic engine as a local MCP server over stdio, so your agent asks the design system before writing UI and gets the work checked after. Five tools: `roast_get_context` (what to know before touching UI here, routed by the folder being edited), `roast_find_component` (the canonical component with one real usage example; a tie between two candidates is reported as a tie, never guessed), `roast_find_token` (raw value in, nearest token out, and an honest "no scale exists here" when that is the truth), `roast_validate` (the code about to be saved, checked against the token set, the spacing scale and the component ledger), `roast_review` (the working tree's changed files, read from the git diff itself so the agent pastes nothing back). Plus three compact resources (rules, components, tokens) and two prompts for clients without the skill.
- **`--check`: the same review in the terminal.** Scans the changed files and exits 1 on findings, so it slots into scripts and pre-commit hooks you control.
- **The same promise as everything else.** Local child process, no port, no account, no telemetry, zero dependencies (the MCP protocol slice is hand-rolled). One scan at startup, cached, refreshed only when files change. A clean answer reads "no measured violations found" with the list of checks attached, because a scanner can only certify what it can count.
- Suite grows to 55 checks: every tool snapshotted on all six fixtures, token budgets asserted (context answers stay under 400 tokens), and the server driven over real stdio in CI. Tested end to end with Claude Code as a real client; Cursor and Windsurf speak the same protocol.
- Report and scores untouched: example reports keep their 4.5.1 stamps because nothing in the diagnosis changed. The major version marks the new surface, nothing breaks.

## 4.5.1 — 2026-08-17

- Greg's placement note: the agent trap boxes move from inside the findings sections to one spot high in the report, directly below the present. The traps read as one message now instead of two footnotes. No copy changes, no score changes.

## 4.5.0 — 2026-08-17

- **Agent traps.** Some findings do not just sit there; they multiply, because an agent reads the repo as instruction. The report now names them where they live: duplicated components ("every wrong pick becomes the example the next agent copies"), a bad value repeated dozens of times ("repetition reads as intent, so it will write occurrence 25"), and two spacing dialects coexisting ("every edit is a coin toss between systems"). Copy only, no new measurement, and a trap renders only when its mechanism is real for the repo, so the marker stays scarce enough to mean something. Clean repos see nothing.
- The README gained an **In CI** section: six lines of workflow that put the scan's SARIF findings in the GitHub Security tab.

## 4.4.0 — 2026-08-17

- **Golden examples: the rules file now shows the dish, not just the recipe.** Each canonical component in the generated rules carries the repo's own most common real usage, quoted verbatim with a receipt: "most common usage, as in `apps/web/.../modal.tsx` (matching 97 of 180 usages): `<Modal showModal={isOpen} setShowModal={setIsOpen}>`". Agents learn far more from a concrete example than from an instruction, and every example is harvested, never invented.
- **Honesty guards built in.** A component needs 6+ usages with a real majority pattern (40%+, at least 3 agreeing) to earn an example; no dominant habit means no example, because printing one would be a lie. Template-literal and oversized tags are never quoted. The compact variants for Windsurf and Copilot skip examples by design and are byte-identical to 4.3.1.
- No score changes anywhere; the scan cost is unmeasurable. Example reports regenerated (scores hold at 75/55/25).

## 4.3.1 — 2026-08-17

- Docs only: the README and landing page lead the agent story with one line, "One scan writes rules for every agent: Claude, Cursor, GitHub Copilot, and Windsurf", and the npm description now names the four agents. No code changes.

## 4.3.0 — 2026-08-17

- **One scan, every agent obeys.** `--apply` now also reaches Windsurf and GitHub Copilot: it injects the rules into `.windsurfrules` (when you have one) and `.windsurf/rules/`, and writes `.github/copilot-instructions.md` (read by Copilot chat and Copilot code review) whenever the repo has a `.github/` folder. Same marked block, same guarantee: re-running replaces only our block, your own text is never touched.
- **A compact rules variant for hosts with tight limits.** Windsurf caps rules files at a few thousand characters and Copilot's guidance prefers short instructions, so those two targets get a size-aware edition: same rules, fewer receipts per rule, no prose preamble, and a hard character budget that trims at a section boundary on very messy repos with a pointer to the full set. CLAUDE.md, AGENTS.md and Cursor keep the full rules with receipts.

## 4.2.6 — 2026-08-16

- **The verdict leads, the evidence follows.** In the npx flow the running order is now: banner, repo and profile, the diagnosis (score, verdict, report path), and only then the harvest details. The summary lines moved to a shared module so the wrapper renders the details from harvest.json after the diagnosis; running the harvest script directly (the skill flow) prints everything in one go as before.

## 4.2.5 — 2026-08-16

- Terminal layout round, Greg's notes: the banner, Harvest line and profile arrow now sit together without stray blank lines; the diagnosis block breathes instead ("score" then a beat, then "Verdict:"); and the report path reads as a sentence, "Your free report is here → …", instead of a bare arrow.

## 4.2.4 — 2026-08-16

- **A design system does not have to arrive through npm.** The profiler only knew design systems as packages (shadcn, Material UI, Chakra…) or component folders, so a hand-built site running entirely on CSS custom properties read "design system: none · styling: none detected" right next to a perfect score. A stylesheet defining a real set of tokens now reads "design system: custom (CSS tokens)", and when stylesheets exist without any styling toolchain in package.json, styling says "plain CSS" instead of pretending nothing is there. Labels only; no score changes.

## 4.2.3 — 2026-08-16

Terminal copy round: the CLI now tells the same story as the report.

- The exclusions line matches the report header's voice: source named once, slashes on folders, and the total at the end ("excluded by you (.roastignore): piglet/ 191 files, lab/into-the-blue/ 753, lab/assets/ 2 · 946 files kept out of this scan").
- Truncated token captures like "rgba(var(--ink-rgb)" no longer read as a glitch; the terminal shows the token reference itself: var(--ink-rgb) ×6.
- The "top:" list only appears when something actually repeats; ten values all used once now read "10 distinct CSS values, none repeated" instead of a meaningless ranking.
- Hand-built sites are a category, not a detection failure: a repo with HTML pages and no framework now reads "framework: static HTML/CSS" instead of "unknown", in the terminal and as a report chip.
- The npx flow no longer prints the temp harvest path it deletes seconds later; it says "scanned in 27ms" instead. Running the harvest script directly still prints the real output path.

## 4.2.2 — 2026-08-16

- Docs only: the npm description now fits npm's 255-character display window, so nothing is cut off mid-word on the package page; it keeps the positioning line and names .roastignore and --apply. The --by example name in the README and landing page changed. No code changes.

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
