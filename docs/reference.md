# Reference: how the numbers are made, how a scan is scoped, what runs on your machine

The long version of three README sections. The README keeps the short one.

## What makes the numbers trustworthy

- **Deterministic scanner, not AI sampling.** A zero-dependency Node script reads *every* file (about a second on a normal repo, a few on a large monorepo) and returns the same numbers every run. Claude narrates; it never counts.
- **Read-only.** Nothing in your repo is modified. The only outputs are a temp JSON and the HTML report.
- **No network, no telemetry.** Everything runs locally. Nothing about your code leaves your machine. Dependency scanners such as Socket may flag URL strings in this package; they are product links and format identifiers written into generated reports, never fetched.
- **Zero dependencies, enforced by the test suite.** The package installs nothing but itself. That is a tested promise rather than a habit: the suite fails if package.json ever declares a dependency. The exact file list npm ships is a photographed contract too, so nothing can stow away in a release.
- **Honest gaps.** When a repo's components register in a pattern the scan can not read, the component tiles say "not measured" and drop out of the score. A zero the scanner never earned is presented as blindness, not discipline.
- **Honest exclusions.** Test files, Storybook stories, docs sites, example apps, SVG artwork, and email templates (which *must* inline styles) are excluded, so you can't discredit the numbers on a technicality. Your own exclusions (`.roastignore`, `--exclude`) are printed in the report header with file counts, so a scoped scan can never pass itself off as the whole repo.
- **Intent-aware counting (v3).** Runtime-computed inline styles, compound-component APIs and wrapper components are not crimes and are not counted as ones. Token-led repos are judged on their hardcoded strays, not their token architecture. Repeated arbitrary values are read as decisions without names, not drift.
- **The scoring code can be imported.** `scoreHarvest(harvest)` in `diagnose/score.mjs` returns the score, the nine tile results and the metrics as plain data. The report uses the same function. A CI check gets the same numbers as the page, and every `summary.json` records its schema version and the benchmark used.
- **A real benchmark.** The "Avg Design System" yardstick comes from scanning 112 public React repos. A core fleet of 34 (cal.com, excalidraw, supabase, grafana, twenty, dub, langfuse…) sets the medians for ordinary product repos: 118 colours, 21 greys, 23 off-scale spacing values, 21 duplicated components, 51 inline style blocks, 77 arbitrary Tailwind values. The other 78 were scanned for the kit profiles, so a repo built on shadcn, Tailwind, MUI, Mantine, Chakra or Ant Design is compared with repos built the same way. The builder and the repo list are in `tools/benchmark/`, so the ruler can be checked, not just quoted.
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

## For reviewers

What runs on a user's machine, and what does not, in one place.

- **The plugin runs three things, all from its own folder.** Two skills, which run `node` on scripts inside the plugin; one local MCP server, started with `node` on a script inside the plugin; and one edit hook, which runs the bundled CLI on the file that changed. Nothing is downloaded at install or run time, nothing is fetched from the network, and nothing leaves the machine. There is no telemetry and no credential is read.
- **The rest of the repository is tooling and documentation, never run by the plugin.** `.github/workflows` publishes a tagged version to npm and the MCP registry from GitHub, with no stored secrets; the release script that cuts the tag lives outside this repository; `tools/benchmark` rebuilds the benchmark from public repos; `tests` is the snapshot suite; `docs` is the landing page and the hosted example reports; `assets` holds the README screenshots, the logo and the icon. A scanner reading the whole folder sees these too. None of them is reachable from a skill, the server or the hook.
- **`npx roast-my-design-system@latest` appears in the documentation only.** It is how people run the scanner without the plugin. The plugin itself never calls a package launcher.
- **Images.** The PNGs are the two README screenshots, the logo marks, and the seven link-preview cards the hosted example pages reference. No code opens them.

