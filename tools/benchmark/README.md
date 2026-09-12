# Rebuilding the benchmark

The score compares every repo against two yardsticks that live in
`skills/roast-my-design-system/scripts/benchmark/benchmark.json`: the median of
34 public React repos and 10 reputable design systems scanned at a curated
scope. This folder holds the scripts that make that file, so the numbers can
be checked by anyone rather than taken on trust.

The repos are not kept here. Clone them shallowly into a scratch folder first:

```bash
mkdir -p ~/roast-clones && cd ~/roast-clones
grep -v '^#' /path/to/roast-my-design-system/tools/benchmark/repos.txt | grep . | while read r; do git clone --depth 1 "https://github.com/$r"; done
```

Then, from the repo root:

```bash
node tools/benchmark/build.mjs --clones ~/roast-clones
node tools/benchmark/build-refs.mjs --clones ~/roast-clones
```

The first writes the 34-repo statistics and the Ideal Design System norms; the
second scans the 10 reference systems (clone dirs named `org-repo`, see the
SCOPES table inside) and merges them into the same file. Rebuilding moves
scores for everyone, so it is a major release with a changelog entry that says
where the numbers moved. This folder is not part of the npm package.

## The shadcn slice

A shadcn install is compared with the shadcn installs in the fleet, not with
Material or Chakra. The slice is every repo in `repos.txt` the scanner itself
reads as shadcn (the profile layer decides, never a hand list), written into
the same `benchmark.json` under `slices.shadcn` with the same statistics the
general table has, plus the 2 tiles only shadcn repos carry. The curated
ideals for those 2 tiles live in `ideal.mjs` next to the others.

```bash
node tools/benchmark/build-slice.mjs --clones ~/roast-clones
```

Rebuild it whenever the fleet is rebuilt, and after any change to what the
scanner reads as shadcn. The general statistics are not touched by this
script. On a shadcn repo the report's fleet line reads "Avg shadcn repo" and
the "cleaner than" percentage is against the slice.

