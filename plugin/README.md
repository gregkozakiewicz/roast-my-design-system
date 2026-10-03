# Roast my design system

Your AI can write the UI. This plugin makes sure it writes *your* UI.

It scans the repo you are working in, scores the design system 0 to 100 against a benchmark of 119 public repos and 10 reputable design systems, writes a shareable HTML report with every finding and its file path, and generates the rules file that keeps AI-written UI on-system. Everything runs on your machine. Nothing is sent anywhere.

## What it installs

- **The `roast-my-design-system` skill.** Scans the whole repo and walks the fixes with you.
- **The `review` skill.** Checks only the files you changed, in about a second.
- **A local MCP server** with five tools: the design-system context before building, a component and a token finder while building, a validator for what was written, and a review of the turn's changes.
- **Two hooks.** A check after every file edit, and a review when the agent ends its turn, so findings reach the agent whether or not it remembers to ask.

## Commands

- `/roast-my-design-system` runs the full scan and opens the report.
- `/roast-my-design-system:review` checks the working tree against the repo's own system.

## Where the rest lives

The full README, the live example reports, the benchmark builder and the test suite are in the repository root, outside this folder: https://github.com/gregkozakiewicz/roast-my-design-system

The same engine ships on npm as `roast-my-design-system` for the command line and CI, and `guard-my-design-system` runs it on pull requests.

Built and designed by Greg Kozakiewicz. MIT licence.
