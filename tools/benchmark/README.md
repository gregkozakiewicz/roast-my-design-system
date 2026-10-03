# Rebuilding the benchmark

The score compares every repo against two yardsticks that live in
`plugin/skills/roast-my-design-system/scripts/benchmark/benchmark.json`: the median of
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

Every builder measures through `measure.mjs`, which runs the scan's own
harvest on each clone and reads the numbers from the same functions the
score uses. Until 10.0.0 each builder recomputed the metrics by hand and had
drifted from the scan (it did not skip email templates, counted greys from
hex alone, and read nothing of the paint or kit checks). The yardstick counts
exactly like the ruler it is held against; a change to what the scan counts
is a change to the benchmark on the next rebuild, never a second opinion.

The first writes the 34-repo core-fleet statistics and the Ideal Design System norms; the
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


## The Tailwind slice

A repo with a Tailwind v4 theme of its own is compared with other such repos.
Few of them sit in the general fleet (most Tailwind repos there are shadcn
installs, which the shadcn slice takes first), so the candidates have their
own list, `tailwind-repos.txt`. The engine still decides membership: only the
repos it reads as `tailwind` with the theme adopted are measured. The slice
carries the general statistics plus `paintTin`; it has no `doorOverrides`.

```bash
node tools/benchmark/build-slice.mjs --clones ~/roast-clones --kind tailwind --repos tools/benchmark/tailwind-repos.txt
```

Clone folders may be named `repo` or `org-repo`. The slice carries its own
`paintTin` ideal (3 per 100 files, from `IDEAL_BY_KIND` in `ideal.mjs`) in
place of the shadcn one (25): 4 of the 11 Tailwind repos sit at or under 3
and the median is 10 (2026-09-16).

## The kit slices

A product built on MUI, Mantine, Chakra UI or Ant Design is compared with
other products on the same kit. Each kind has its own candidate list
(`mui-repos.txt`, `mantine-repos.txt`, `chakra-repos.txt`, `antd-repos.txt`),
and the engine decides membership: a repo joins the slice for the kit it
imports most, shadcn included.

```bash
node tools/benchmark/build-slice.mjs --clones ~/roast-clones --kind mui --repos tools/benchmark/mui-repos.txt
```

Each slice carries `kitColour` and `kitPx` and its own ideals for them, set
in `IDEAL_BY_KIND` in `ideal.mjs` at the top of the tidiest third of the
slice (2026-09-17: mui 4/4, mantine 1/3, chakra 3/4, antd 6/7).


## The web-components group

A library built as web components (Stencil, Lit) is compared with other such
systems, not with the React fleet: about 41 of its 350 `!important`
declarations are web-component idioms, and the React medians read them as
drift. The candidates are in `webcomponents-repos.txt`; the engine decides
membership (`benchKind` in `diagnose/score.mjs`: kind library, framework web
components). Baloise's repo reads as shadcn through its token app and sits
that slice out.

```bash
node tools/benchmark/build-slice.mjs --clones ~/roast-clones --kind webcomponents --repos tools/benchmark/webcomponents-repos.txt
```

Seven systems on 2026-10-03: Spectrum Web Components, Shoelace, Scale, Ionic,
Material Web, Siemens iX and Lion. The slice carries the general statistics
and no kind-only tile.
