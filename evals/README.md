# Evals

Behaviour tests for the Claude Code plugin, run with Claude Code's own eval
runner. Each case is a prompt, a scaffolded repo and a few graders. Three
cases check that plain-language requests fire the roast skill and produce the
report with real numbers, one checks that a request to review changed files fires
the review skill and not the roast, and one checks that an unrelated request
leaves both alone.

```bash
claude plugin eval . --scaffold --allow-tools Write "Bash(node *)"
```

Results land in `evals/results/` (ignored by git). The runner also runs every
case without the plugin, so the report shows what the plugin adds.
