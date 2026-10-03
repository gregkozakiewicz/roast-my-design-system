# Changelog

All notable changes to roast-my-design-system. One version everywhere: the npm package, the Claude Code plugin, and the report footer always match.

## 10.1.4 — 2026-10-03

One rule for what a demo is, the Roast icon on the report, and a list of
the files the scan read for the guard.

- **One rule for stories, examples and demos.** Two places decided what a
  demo is. The scan left out `examples/`, `demos/`, tests and
  `*.stories.tsx` files, and read a `stories/` folder. The palette tile
  and the live palette check left the `stories/` folder out as well. So a
  story folder's colours were missing from the palette count and present
  in every other tile. Both now read one rule in `lib/demo.mjs`. Left out
  from this release: folders named `stories`, `__stories__`, `_stories`,
  `storybook` and `fixture`, folders whose name starts with `storybook`
  (an in-app storybook kept as `routes/storybook.colors/`), and a
  component's stories kept as `stories.tsx`. Names are matched exactly: a
  file called `story.ts` or `storybook-icon.tsx` is still read.
- **Scores.** Of 210 repos scanned before and after, 3 scores move, all
  up: adobe/spectrum-web-components 72 to 83, adobe/react-spectrum 45 to
  50, twenty 40 to 45. Thirteen more change a count without changing the
  score. The benchmark is not rebuilt. A component that only its own
  stories import now reads as never imported (formbricks: 3 to 10).
- **The report carries the Roast icon.** The browser tab and a phone's
  home screen showed an older pencil icon and the author's mark. Both now
  show the product icon from `assets/roastmds.svg`. The footer keeps the
  author's mark beside his name.
- **For the guard: the files the scan read.** `learnSystem()` returns
  `filesRead`, every file the scan's walk read, so guard-my-design-system
  can judge only those files. `isDemoPath(file)` replaces the pattern
  `DEMO_PATH_RE` in the engine's doorway.
- The Spectrum example page, the README and the landing page show the new
  score.

## 10.1.3 — 2026-10-03

Six small changes so the plugin directory's report reads cleaner. Nothing
the scan, the report, the rules or the MCP server does changes.

- **The report's and the rules file's web addresses live in one small
  file.** The directory's checker reads a web address beside the word
  "token" as a credential being sent to a server, and the two files that
  print those links talk about design tokens on most lines. The links now
  come from `lib/links.mjs`; the footer and the rules file print the same
  text as before.
- Two test samples lose a web address they did not need, the plugin
  manifest loses the keyword `design-tokens` (the marketplace entry and
  the npm package keep it), and the unlisted pins preview page is removed
  from the docs folder; the prototype lives in the private notes.

## 10.1.2 — 2026-10-03

The test fixtures and their snapshots are stored one file each. Nothing
the scan, the report, the rules, the MCP server or the npm package does
changes.

- **Each test fixture is one JSON file.** The suite scans 29 small sample
  repos and compares the result with saved snapshots. They were 403 loose
  files plus 150 snapshot files, and the claude.ai plugin directory counts
  every file in the repository against a limit of 512. Each fixture is now
  `tests/fixtures/<name>.json` and each fixture's snapshots are
  `tests/expected/<name>.json`, with text kept line by line so diffs still
  read. The suite unpacks the fixtures into a temporary folder before it
  runs; every check is the same and all 461 pass unchanged. The repository
  has 225 tracked files. `node tests/fixtures.mjs unpack <name>` gives a
  fixture back as a folder to edit, and `pack <name>` stores it again.

## 10.1.1 — 2026-10-03

The plugin's files are back where they were, at the repository root.

- **10.1.0 moved the plugin into `plugin/`** to bring the claude.ai plugin
  directory's file count under its 512 limit. The directory does not let
  a submission change its plugin path, so the move would have meant a new
  submission and a new place in the review queue. The files are back at
  the root, the marketplace entry points at `./`, the npm package ships
  from the same paths as 10.0.0, and the guard's engine alias is as it
  was.
- The plugin's icon and the fixes to file sizes from 10.0.0 stay.

## 10.1.0 — 2026-10-03

The plugin's files move into one folder. Nothing the scan, the report, the
rules or the MCP server does changes.

- **The plugin lives in `plugin/`.** The manifest, the two skills, the
  hooks and the command-line entry point now sit in `plugin/`, with the
  tests, the docs, the benchmark builder and the examples outside it. The
  claude.ai plugin directory counts every file in the folder that holds
  the manifest and holds a plugin for review above 512 files. With the
  manifest at the repo root the count was 716, 585 of them test files;
  the plugin folder now holds 69. The marketplace entry points at the new
  folder, the npm package ships the same files from the new path, and the
  guard imports the engine through the same `roast-my-design-system/engine`
  alias as before.
- **Installing by hand:** the copy commands in the README now read
  `plugin/skills/...`.

## 10.0.0 — 2026-10-03

The benchmark is rebuilt, so scores move. 17 of 205 scanned repos change,
13 up and 4 down, none by more than 10 points. The hosted examples keep
their scores except Spectrum, which goes from 66 to 72.

- **The benchmark counts like the scan.** The three builders recomputed
  every number by hand and had drifted from the scan since the benchmark
  was built on 9.0.0. They did not skip email templates, they counted
  greys from hex values alone, they counted duplicate pairs that compose
  each other, and they counted brackets inside installed shadcn code. One
  measurer now runs the scan's own harvest on each repo and takes the
  numbers from the functions the score uses. The fleet medians move: greys
  21 to 28, duplicates 21 to 16, brackets 77 to 56. The shadcn group: greys
  11 to 15, duplicates 21 to 14, inline styles 45 to 33, brackets 131 to
  201. All 34 fleet repos, 10 reference systems and 6 groups were rebuilt
  from the same clones on 3 October 2026.
- **A web-components group.** A library built with Stencil or Lit is now
  compared with seven such systems (Spectrum Web Components, Shoelace,
  Scale, Ionic, Material Web, Siemens iX, Lion) instead of the React
  fleet. The tiles say "Avg web-component repo". The benchmark now covers
  119 repos.
- **On a shadcn repo the theme sheet is the token file.** The token file
  was the file with the most token colours. On 26 of 50 shadcn repos that
  was not the theme sheet: nhost's was an MUI theme file, casdoor's a
  swagger bundle. The rules file, the report and the MCP context now name
  the sheet, and the MCP context counts the tokens that file states.
- **A CSS keyword is not a typeface.** A font-family of "inherit
  !important" reached the typeface list, and lightdash's context named it.
  !important is stripped and the keywords are left out.
- **Smaller files for the plugin directory.** The unlisted pins preview
  page carried its screenshots as text; they are image files now, and the
  page is 160 KB at the same address. The README's full-page screenshot
  is a 770 KB JPEG instead of a 1.1 MB PNG.

## 9.9.0 — 2026-10-03

The colour usage bar reads more of the repo. No score changes on any of
the 205 scanned repos; the bar is display only.

- **Colour names, color-mix() and light-dark() are read.** A theme value
  written as a name such as whitesmoke, mixed with color-mix() or chosen
  with light-dark() was drawn as a cell with no swatch. All 148 CSS colour
  names now resolve, color-mix() is mixed by weight, and light-dark()
  takes its daylight side. A hand-written colour name in a stylesheet now
  counts as the stray it is.
- **A class reads the theme its package can see.** A class name a package
  did not define was answered from any package in the repo. formbricks'
  web app imports only its own stylesheet, and its shadcn class names were
  drawn in a sibling package's colours. The bar now follows the
  stylesheets a package imports from code and from other sheets, a bare
  package name through its exports map, a v4 sheet's @config and @source
  lines, and the presets a config reaches. A package with no stylesheet
  import the scan can follow keeps the old reading. A config value built
  in code, such as react-email's slate from @radix-ui/colors, is the
  theme's, drawn without a swatch, rather than a dead name.
- **Sass and Less variables are read.** $name and @name statements across
  the repo's stylesheets are followed to a literal. A read in a colour
  property counts as the theme by name, with a swatch when the value is
  readable and without one when a function builds it. A variable
  statement's hex now counts as a definition, not a hand-written stray.
- **JavaScript theme objects are read.** A theme kept as an object literal
  is flattened to paths such as font.color.tertiary, references are
  followed, and functions are left unread. No code is run. A read such as
  theme.colors.primary600 matches an object keyed primary600.
- **Nine repos move from the written-value bar to the use bar:**
  govuk-frontend, devlake, appsmith, redash, grafana, n8n, outline, twenty
  and bruno. Ten keep the written-value bar, because their theme comes
  from a package outside the repo or is built in code, and the page now
  says so. The "how this is counted" fold says how many Sass, Less and
  JavaScript values the by-name count includes.

## 9.8.0 — 2026-10-03

Three wording changes. No score changes on any of the 205 scanned repos.

- **The MCP context always ends with its closing line.** When a repo's
  context ran over the 400-token budget, the text was cut at the budget.
  On 21 repos that cut removed the last line, "Before finishing: call
  roast_validate on what you wrote, then roast_review". Repos that use
  two kits got an ordered trim in 9.7.0 that drops the least needed lines
  first and keeps the closing line. Every repo now gets that trim. The
  context changes on 29 repos.
- **A second kit is named on shadcn repos too.** 9.7.0 named a second kit
  on products built on MUI, Mantine, Chakra or Ant Design. Two cases were
  missed. nhost keeps a shadcn folder and 57 files that import MUI. zupass
  is built on Chakra and keeps a shadcn folder in one app. Both are now
  named in the rules file, the MCP context and the report. The agent is
  told to follow the kit the file already uses. Named, not scored.
- **The report header names the kit.** The chip at the top of the report
  said "design system: unrecognised" on 50 of 205 scanned repos. Most of
  them are built on a kit the scan reads perfectly well. The chip now says
  "MUI", "Chakra", "Ant Design + SigNoz UI" or "Tailwind theme". A set of
  the team's own tokens beside a kit gets a chip of its own, such as
  "tokens --mb-*" on Metabase. Four hosted example pages change their chip:
  Airflow, SigNoz, Unleash and Metabase.

## 9.7.1 — 2026-10-03

Six fixes to what the agent is told. No score changes on any of the 205
scanned repos.

- **A grey class is never swapped for a brand colour.** The rules file
  suggests a theme class in place of a palette class, picked by how close
  the colours are. On formbricks the brand teal was close enough to
  slate-500 that `text-slate-500` was sent to `text-brandnew`. A grey
  class now only matches a grey. formbricks, nodejs.org and supabase get
  a different suggestion; nothing else changes.
- **A palette scale a Tailwind 3 config redefines is the theme.** Novu
  points every grey at its own variables in `tailwind.config.ts`. The
  edit check and the guard flagged all 785 of its grey classes as
  palette classes, and the colour bar drew them as strays. The scan now
  reads the config as well as a v4 `@theme` block. Only a config the
  product reads counts: the root config, or one in a package that holds a
  tenth of the code. Novu drops to 13 findings. No other repo changes.
- **The repaint move names its unit.** It said "text-red-600 appears 2
  times, Panel.tsx alone carries 9". The 9 counted every palette class in
  the file, not that one. It now says "Panel.tsx alone has 9 palette
  classes".
- **A theme variable another variable reads is used.** The leftover check
  read every file except the theme file. shadcn-ui registers
  `--code-highlight` through `--color-code-highlight: var(--code-highlight)`
  in the same file and was told to delete it. A `var()` read inside the
  theme file now counts. shadcn-ui and magicui lose the move. The
  Next.js starter leftovers in ai-chatbot are still named.
- **The rules file and the edit check agree on the shadcn theme.** The
  rules file read the configured theme file's `:root` block alone. On
  formbricks, documenso, taxonomy and supabase the names live in a v4
  `@theme` block or in another package, so the rules file said the theme
  defines none of shadcn's variables and told the agent to keep using
  palette classes, while the edit check flagged every one. The rules
  file now uses the same decision as the edit check, and names the file
  that holds the variables when it is not the configured one.
- **A theme file whose `:root` heads a list is read.** documenso declares
  its light values under `:root, .dark-mode-disabled` and its dark values
  under `.dark:not(.dark-mode-disabled)`. The reader wanted `:root {` on
  its own and took the word dark in the second selector for the dark
  block. documenso's report now carries its receipt line: 35 colours,
  used as classes 2,386 times.

## 9.7.0 — 2026-10-01

- **Repos that use two component kits get advice that names both.** 13 of
  79 products built on a kit also use a second kit. For example, SigNoz
  uses Ant Design and its own SigNoz UI. Before, the rules file told the
  agent to prefer Ant Design. SigNoz's own rules say the opposite. Now
  the rules file, the MCP context, the report and the fix prompts name
  both kits, largest first. They tell the agent to follow the kit the file
  already uses. They do not say which kit is preferred. The second kit is
  not scored, so no score changes.
- **The edit check names the kit a value is on.** In a file that uses both
  kits, a colour on the second kit's component got the first kit's fix.
  For example, it said "use the nearest step in sx" on an Akamai table
  cell, where sx does nothing. Now it names the second kit and tells the
  agent to style the component like other components from that kit. This
  is a warning, so the end-of-turn review does not send the agent back.
  The guard says the same on a pull request. This changes the wording of
  21 findings in 5 repos. No findings are added or removed.
- **A shadcn folder inside another folder is now read as shadcn.** nhost
  keeps its shadcn components in `components/ui/v3`. 631 files use them,
  and 57 older files use MUI. The scan read nhost as an MUI product. It
  now reads it as shadcn. Its score changes from 35 to 18, because the
  shadcn checks replace the MUI checks.
- **The verdict says which repos it compares with.** shadcn, Tailwind and
  kit products are compared with repos of the same kind. The verdict
  said "the median of 34 scanned repos", which is the size of the whole
  benchmark. It now says, for example, "the median of 16 scanned shadcn
  repos". The tiles also name the group, for example "Avg MUI repo". This
  changes the verdict on 51 of 204 reports.
- **Unused components in a shadcn folder are split by who wrote them.**
  The report said every unused component in the shadcn folder came from
  shadcn. In 16 repos, some were written by the team. For example, cal.com
  has 38. The report and the rules file now list the team's own unused
  components separately. Neither list is scored.
- **The colour bar shows how often each colour is used.** Before, the bar
  counted how often each colour value was written in the code, including
  where the theme defines it. So the colour a repo uses most, such as
  `bg-primary` on every button, could look like one of the least used.
  Now the bar counts each use of a colour. Each use is shown in one of 3
  groups: a theme colour used by name, a Tailwind palette class, or a
  stray. A sentence under the bar gives the split. For example, on
  vercel-ai-chatbot 80 in every 100 uses are theme colours, 6 are palette
  classes and 14 are strays.
  - A palette class only counts as a stray where the edit check already
    flags it.
  - The bar leaves out shadcn's own components, as the score does.
  - On 19 of 204 repos, the bar cannot read how the theme is used. These
    repos use Sass variables or JavaScript theme objects. The bar on these
    repos still counts written values, and says why.
- **The shadcn summary says how often the theme's colours appear as
  classes.** It does not show this where the theme file was read wrongly.
- **The colour fix is correct on 3 more repos.** documenso and taxonomy
  were told their theme had none of shadcn's colours, which was wrong.
  Their fix is now "Repaint the colours from outside the theme".
  formbricks has 37 colours of its own but none of shadcn's greys. Its fix
  is now "Map the palette onto the theme you already have".
- **Scans are faster.** The scan reads each file once. The 3 largest
  test repos scan in 4.8, 1.6 and 3.6 seconds.
- Tested on 204 repos. Only nhost's score changes.

## 9.6.1 — 2026-10-01

- **The edit check and the guard judge files that use a team's own layer
  over its kit.** On a product built on MUI, Mantine, Chakra UI or Ant
  Design, the report counts the files that import the team's own wrapper
  around the kit (Linode's `@linode/ui`, Metabase's `metabase/ui`) as kit
  files. A slip in one line meant the edit check, the end-of-turn review,
  `roast_validate`, `--check` and the guard never recognised those imports,
  so a colour or a pixel size written onto a kit component in such a file
  was not flagged. On Linode they judged 750 of the 1,487 kit files the
  report counts, on Metabase 344 of 2,679. They now find every colour and
  pixel size the report counts on both. No report number or score moves.

## 9.6.0 — 2026-10-01

- **The edit check and the guard read class lists the way the report does.**
  The report counts the classes inside shadcn's class helpers (`cn()`,
  `cva()`, `clsx()`, `classnames()`, `twMerge()`), but the edit check, the
  end-of-turn review, `roast_validate`, `roast_review` and `--check` read
  only classes written straight into `className`. So `cn("text-[13px]")`
  was counted in the report and never flagged when an agent wrote it. One
  reader now serves both, and it reads exactly what the report read before,
  so no report number moves. In the fleet that is 3,794 bracket values and
  spacing brackets in 66 repos that the checks now see.
- **Each finding sits on the line where the class is.** A class on the third
  line of a long class list is reported on the third line, not on the line
  where the list opens.
- **A registry's own components are no longer read as installed code.**
  magicui publishes its components from a folder named magicui, the same
  name as the third-party registry, so the report called them installed,
  left their bracket and spacing values out, and said 9 points came from
  code the team did not write. The score is unchanged at 78; those values
  now count as magicui's own. The blocks shadcn's own repo publishes are its
  own work too (score unchanged at 84).
- **The note on installed bracket and spacing values names the right folder
  and owner.** It said every value was shadcn's and inside the ui folder,
  even when it sat in a registry such as ai-elements or in a shadcn block
  elsewhere. On a registry, the folder name was missing. The hosted
  ai-chatbot example now reads: 22 bracket values inside ui and the
  app-sidebar block are shadcn's own, and 8 inside the ai-elements registry
  are the registry's own.
- Measured on 204 repos: no score moves; magicui and shadcn's own repo
  change counts, as above.

## 9.5.0 — 2026-10-01

- **A component of the team's own in the shadcn folder is the team's.** The
  report treated every file in the shadcn catalogue folder (`components/ui`,
  or wherever components.json points) as installed code: its bracket values
  were called shadcn's and kept out of the count, its palette colours were
  not counted, and the edit check and the guard left it alone. Most teams
  keep components of their own there too: in the fleet, 33 of 44 shadcn
  repos do, 1,014 of 2,709 files in those folders, holding 1,285 palette
  colours nothing counted. formbricks keeps 191 of its own there, and the
  report called their values shadcn's. Now a file in that folder is
  installed code only when it is one of shadcn's components by name,
  however it is spelt (Nango's `Avatar.tsx` is shadcn's `avatar`). Kit blocks
  and installed registries are read as before.
- **The rules file stops contradicting a shadcn install without CSS
  variables.** With `cssVariables: false` in components.json, shadcn's
  components paint with Tailwind's palette classes by design, and the rules
  file told the agent to use the theme variables and never a palette colour.
  It now says so plainly. Where the repo keeps a theme of its own beside it,
  the rules file names what the theme owns and gives an example of what it
  does not:
  > shadcn is installed without CSS variables here (components.json:
  > cssVariables false), so the components paint with Tailwind classes. The
  > theme file, `client/src/app/globals.css`, gives neutral-50 to
  > neutral-950 this repo's own values, and names destructive, accent and the
  > chart colours. Use those classes. Never a palette colour the theme does
  > not own, such as `text-red-500`; use `text-destructive`, or add the
  > colour to the theme once.
- Measured on 204 repos: 29 change a count, 3 scores go down and 3 go up.
  formbricks 37 to 24 and cal.com 33 to 28, as their own components' bracket
  values and palette colours now count. chatbot-ui 73 to 78 and unkey 42 to
  46, because the tile for shadcn components recoloured through className
  no longer counted their own components (chatbot-ui's `SubmitButton`,
  unkey's `CopyButton`) as shadcn's; the colours themselves still count. No
  hosted example moves.

## 9.4.0 — 2026-09-30

- **One palette rule for the live checks and the guard.** A palette class
  (`text-gray-500`, `bg-amber-50`) where the theme names a colour of that
  kind is flagged by the edit check, the end-of-turn review, `roast_validate`
  and `--check`, and by guard-my-design-system on a pull request. The rule
  lived in two places with two gates, and a probe of the fleet on 1 October
  found each with a hole:
  - The guard switched the rule on only for a shadcn repo whose configured
    sheet held five of shadcn's rows under `:root`, and had no rule at all
    on a repo with a Tailwind theme of its own. It was silent on 11 of 48
    shadcn repos where the live checks spoke: a theme written straight into
    a `@theme` block (formbricks, supabase), rows kept in a sibling package,
    no sheet path in the config (documenso), or a theme of the repo's own
    and none of shadcn's rows (Nango, Ghost).
  - The live checks switched it on for any shadcn repo, including one in
    utility-class mode (`cssVariables: false`), where the report says the
    palette is the theme. On rybbit they flagged 1,394 palette classes in
    the last 300 changes that are the kit's own style there.
  The rule now lives once, in the engine, and which vocabulary a palette
  class is judged against is decided once by the profile: a Tailwind theme
  in use, its own names; a shadcn install in CSS-variable mode whose theme
  contract holds (five or more of shadcn's ten rows in any stylesheet),
  shadcn's names; a shadcn install with no contract but a v4 theme of its
  own, that theme's names; utility-class mode, off. The guard reads the same
  function through the doorway (`paletteFindings`, `profile.palette`), so
  the two cannot disagree again. The MCP context on a shadcn repo shows the
  example classes in the same vocabulary, and in utility-class mode no
  longer says "never a palette class".
- Measured on 204 repos: no score, tile or count moved. The report's tile
  keeps its own gates; only the live checks and the doorway changed. On the
  ten Tailwind-theme repos in the fleet, replaying their last 300 landed
  changes, the rule fires on two changes in a hundred, a fifth of the rate
  the shadcn rule already produces.

## 9.3.3 — 2026-09-30

- **The report and the live checks skip the same files.** The report kept its
  own list of files not to judge, apart from the one the edit check, the
  end-of-turn review and the guard use, and the two had drifted apart:
  - A file named like artwork (Badge, Logo, IconButton) was skipped by the
    report on its name alone, even when it draws nothing, while the edit
    check judged it. 2,321 files in 173 repos, such as inbox-zero's Badge,
    ballerine's status badges and Dispatcharr's table of logos. The report
    now counts them.
  - An icon in an icons folder (9.2.5) was left alone by the live checks but
    still counted by the report. openstatus's icon set carried 114 of its 121
    inline styles. The report now skips them too.
- **Bracket values in installed shadcn code are split out exactly.** Each
  value kept a list of only its first five files, and a use in any other file
  was taken for the team's own, so some of shadcn's own values reached the
  headline count (3 in ai-chatbot, 7 in next-forge, 12 in openstatus). The
  count now keeps every file.
- Measured on 205 repos: 107 changed a count and 4 scores moved, all up:
  openstatus 64 to 69, chatbot-ui 69 to 73, next-forge 91 to 96. No hosted
  example's score moved; the dub example now counts 642 bracket values (was
  624) and the ai-chatbot example 71 (was 74).

## 9.3.2 — 2026-09-30

- **Pages a headless browser prints to a PDF are not judged.** Some products
  build a report or an invoice as React components, turn them into HTML and
  print them to a PDF with puppeteer or playwright. That page loads none of
  the app's stylesheets, so its styling has to be written inline, the same
  as an email. The templates carry no sign of it themselves; the file that
  prints them does. Roast now finds that file (one that turns React into
  HTML and drives a headless browser, in a package that needs one to run)
  and leaves out the pages it prints. A shared component those pages borrow
  from the rest of the app is still judged. The report names the files and
  says why, and the edit check, the end-of-turn review and the guard give
  the same answer.
- Measured on 205 repos: found in one, rybbit, whose PDF reports held 31 of
  its 52 inline styles. Its score moves from 40 to 50. Nothing else moved.
- **Stories and demos on a Tailwind theme.** The report never counted palette
  classes in a stories, examples or demo folder, but the edit check still
  flagged them on a Tailwind-theme repo. It now leaves them out too, as it
  already did on shadcn.
- For the guard: the demo-folder rule is exported through the guard
  doorway as `DEMO_PATH_RE`, and the exemption context carries the printed
  pages. New exports and fields only.

## 9.3.1 — 2026-09-30

- **A templates screen in the product is judged.** The colour check on
  shadcn and Tailwind repos treated every folder called `templates` as demo
  code, so colours from outside the theme there were never counted in the
  report and never flagged when an agent edited them. In a product such a
  folder is usually a screen: teable's admin templates, the template pickers
  in documenso and formbricks, onlook's project templates, papermark's
  templates feature. They are now judged like any other screen. Email
  templates stay unjudged, through the email rule.
- **A command-line tool's templates are left out of the scan.** The files a
  tool copies into someone else's new project (novu's `init` and `connect`
  commands) join the starter and generator templates from 9.2.6, and are
  named in the report's "Left out by design" line.
- Measured on 205 repos: 9 changed, no score moved. novu's counts fall with
  its tool's templates left out (duplicated components 88 to 64, distinct
  colours 396 to 357). No hosted example changed.

## 9.3.0 — 2026-09-30

- **A review when the agent finishes its turn.** The plugin already checks
  every file the agent edits, but the agent can read the findings and carry
  on: with that check on, Haiku still left invented values in 1 of 5 runs
  (September 2026). Now, when the agent says it is done, the plugin reviews
  every interface and style file the session changed. If the agent added a
  problem that is still there, it is sent back once, with the list and the
  fixes, before it can finish.
  - Only problems that break a rule send it back. Advice (a chart with no
    palette) never does.
  - Only files this session changed. Work that was uncommitted before the
    session started is left alone.
  - A problem is sent back once a session. A value the agent keeps on
    purpose, with a comment saying why, does not come back at the end of
    every turn.
  - It is on when the plugin is installed. To turn it off, add
    `"env": { "ROAST_STOP_REVIEW": "off" }` to your Claude Code settings.
- Tried in a real Claude Code session: asked for a banner in #ff00ff that
  "the client insists on", Haiku wrote the colour inline and said it was
  done. The review sent it back; it moved the colour into a class in the
  stylesheet with a comment saying the client requires it, and finished.
- For hand-installed setups: `--stop-hook` reads the Stop event and
  `--session-start` notes the work that was already there. Both always exit 0.

## 9.2.6 — 2026-09-30

- **A project generator's templates are left out of the scan.** Some repos
  keep code they hand to other people: the files a "create a new app" tool
  copies into someone else's project, or a starter kit. The dashboard
  starter keeps a spare sidebar in `scripts/cleanup-templates`, for people
  removing its sign-in service, and the scan counted it as a duplicate. A
  `starters` folder, a templates folder kept by a project generator (such
  as `create-app` or a `cli`), a script or a dev tool, and a codemod's test
  fixtures are now left out. Each one is named in the report's "Left out by
  design" line with the number of files in it.
- A templates folder anywhere else stays in. Inside a product, "templates"
  is usually a feature: Backstage's form templates, OpenCTI's case templates
  and nocobase's block templates are real screens.
- Measured on 205 repos: 12 changed, and every folder left out held a
  generator's or a starter's code. Scores that moved: adobe react-spectrum
  40 to 45 (262 interface files of starter kits) and fumadocs 50 to 55.
  The hosted Airflow example counts 17 duplicated components, not 18; its
  score is unchanged.

## 9.2.5 — 2026-09-30

- **An icon in an icon folder is artwork, whatever it is called.** Icon
  sets name their files after what they show (ActionSendEmail, Server), not
  after being an icon, so their colours were judged as interface. A file
  that draws SVG inside an icons, logos or illustrations folder is now
  treated as artwork. A plain component in one of those folders is still
  judged. The edit check stops flagging icon colours: on teable, 245
  findings on its icons fell to 5; on openstatus, 132 fell to 6.
- **An icon is not a second copy of a component.** teable's Switch icon was
  counted as a second Switch, and medusa's icon package as second copies of
  its Button, Text, Calendar and Code. An icon now counts as a copy only
  against another drawing of the same thing: remotion's Checkmark icon and
  the checkmark a player control draws are still two copies. Only an icon
  folder decides this, so two files called Logo or Badge still count.
- **One icon set in subfolders is not two sets.** likec4's AWS and Google
  Cloud icons, and nodejs.org's Logo and Favicon for each partner, no
  longer read as two icon sets colliding. nodejs.org loses the "Merge the
  two icon sets" fix. Two separate icon folders still get it.
- Measured on 205 repos. 17 duplicate counts fell and none rose. Scores
  that moved: taipy 92 to 96, and teable 28 to 24, because its 250 icons no
  longer count as interface files and its per-100-files rates rose. The
  hosted dub example shows 21 duplicated components, not 22; its score is
  unchanged.

## 9.2.4 — 2026-09-30

- **Fixes that raise the score come first.** The list of fixes was sorted
  by the points a fix pays straight away, so a fix that pays only once it is
  finished ("clear them all · +4") counted as nothing. On shadcn-admin the
  one fix worth points sat second, behind one worth none. The list now puts
  fixes that pay first, then fixes that pay once finished, then the rest.
- **The agent rules file is no longer one of the fixes.** It took one of
  the three places without raising the score. The report already offers it
  in its own section, Give the agent the answers, and it stays there.
- **A report with no score promises no points.** When a repo shows no sign
  of a design system, the report gives no score, but its fixes still claimed
  "+10" or "raises the score, by 5". Now each fix there says "no score here"
  and the heading makes no promise.
- Measured on 205 repos. No score moved. 25 lists changed order, 9 repos
  whose only fix was the rules file no longer show a list of fixes, and 4
  unscored reports stopped claiming points. Three hosted examples show their
  fixes in a new order: ai-chatbot, telekom-scale and spectrum-web-components.

## 9.2.3 — 2026-09-30

- **A screen about email is judged like any screen.** Until now any file
  with "email" in its path was skipped, on the grounds that emails have to
  carry their styling inline. That skipped the sign-in form, the email
  settings, the verify-email page and, on an email client, the whole app:
  inbox-zero keeps its product under a route called `[emailAccountId]`, and
  285 of its screens went unjudged. A file is now skipped as an email when
  it shows it is one:
  - it uses an email kit (react-email, jsx-email, mjml-react), wherever it
    lives, as before;
  - it carries markup only an email carries: MJML, Outlook conditionals,
    table attributes such as `cellpadding`, react-email's `<Html>` and
    `<Body>`, or an HTML `style=""` attribute written as text, the way a
    server builds its emails;
  - it sits in a folder named for email (`emails`, `email-templates`,
    `twenty-emails`) that holds an email template, in code or in a template
    language such as Handlebars or MJML;
  - it is a preview of an email or a newsletter, or a stylesheet written for
    emails;
  - it is email-named and sits beside the templates it sends.
  Print stylesheets are skipped as before. The rule only ever takes files off
  the skipped list. The report, the edit hook and the review read it alike.
- Measured on 45 repos, the 11 hosted examples included. No example's score
  moved; three counts did, each from a screen: Dub 622 to 624 bracket values
  (the email-domain settings), Unleash 97 to 99 inline styles (the
  confirm-user-email screen), SigNoz 1,005 to 1,012 `!important`. Scores that
  moved: inbox-zero 47 to 39, typebot 46 to 42 (its email input field), and
  react-email's own site 28 to 24. Ghost's newsletter design screens are now
  judged; its email templates stay skipped.
- **The guard doorway hands over where the repo keeps its emails.**
  `learnSystem` returns `email`, to pass as `exemptReason(file, text, {
  email })`, and `isEmail` is exported. New fields and exports only.
- 19 unit checks, one per shape found in the fleet, run through the report,
  the live check and the guard doorway.

## 9.2.2 — 2026-09-29

- **The list of fixes has a plainer heading.** "Fix what makes agents guess"
  sat directly under the card that asks "Where will your agent have to
  guess?", and the two read as one question asked twice. The list is now
  headed "Fixes you can make right now to increase the health score". The
  index still calls it "What to fix". The README and the landing page use
  the new name.
- **The list promises only what it pays.** On a repo that scores well,
  most tiles are already green and a fix can be real work worth no points.
  The line under the heading said "Three fixes to increase your score"
  over a list where 1 of the 3 could, by 4.
  - The line counts the fixes that pay: "One of these three fixes could
    raise the design system health score from 80 to 88. One more pays once
    it is done in full. The remaining one does not move the score." When
    every fix pays it reads as before.
  - A fix with no points says why, in a grey label beside its title: "not
    part of the score" (the agent rules file, a leftover theme variable),
    "already green", or "no points on its own".
  - When nothing in the list moves the score, the heading is "Fixes you
    can make right now", and the line says the fixes are there because each
    one stops the agent guessing.
  - The side panel counts the same way: "One fix could raise it to 88",
    where it said three.
  No score and no count changes. 4 checks, 1 of them over every fixture.

## 9.2.1 — 2026-09-29

The report and the live check (the edit hook, the MCP validate tool and the
review) are two judges reading one repo, and each kept its own idea of what
a duplicate is. They now ask one function, and on 17 repos they name
exactly the same duplicates, file by file. Before, the live check named 759
the report does not count, and stayed silent on 17 it does.

- **The live check stops flagging what the report never counts.** An agent
  adding a page to a TanStack Router app was told "Defines <Route>, which
  already exists in 40 other places" and to import another page's route.
  - A name that repeats by design: a framework's `Route`, `Layout`, `App`
    or `Provider`, a page, a route file, a story, an email template. On
    shadcn-admin 31 of 99 live findings were this one; on ryot, 36 of 108.
  - A pair the report lists without counting: a wrapper built on the
    component it shares a name with, shadcn's own overlap inside the
    catalogue, two icon libraries carrying the same glyph.
  - A file the report does not read as a component file: a stub returning
    null, a TypeScript file whose generics read like tags.
  - shadcn's overlap in a second catalogue folder. The report was told
    about every catalogue folder in a monorepo, the live check about the
    first only.
- **The live check starts flagging what the report counts.**
  - A second copy inside a file whose styling is exempt. A drawing, a
    crash page or a render-to-image surface is excused its colours, because
    the medium allows nothing else. The exemption used to silence the whole
    file, so a second `Logo` passed. The duplicate check now runs there, the
    styling stays unjudged, and the result says which of the two was
    checked.
  - A web component registered a second time. Stencil, Lit and
    `customElements.define` components were in the report's ledger and
    invisible to the live check.
- **Two rules in the report were wrong, and its counts move.**
  - An email folder is one whose name carries "email" as a word of its own:
    `emails/`, `email-templates/`, `twenty-emails/`, `welcome-email.tsx`.
    The rule asked for the word at the start of the name, so the templates
    in Twenty's `twenty-emails` package were counted as duplicates of the
    web components they mirror. Twenty: 36 duplicates to 33, score
    unchanged at 40. A screen about email (`ConfirmUserEmail`) is interface
    and stays in.
  - Next.js's crash page, `global-error`, is a framework file like `error`
    and `not-found`. A starter that keeps a template of it had the pair
    counted. Kiranism's dashboard starter: 3 duplicates to 2, score 87 to
    91.
  None of the 11 hosted examples moved, in score or in any count.
- **Bracket values inside installed shadcn code are shadcn's own.** The
  report has named them and kept them out of the count since 7.4. The live
  check told the catalogue's own tooltip off for its `[2px]`. A file inside
  the catalogue, a kit block or an installed registry is no longer judged
  on its brackets; the same value in own code still is.
- A file the scan has read is settled by what the report counts. Content
  validated before it is saved is judged on the copies that exist, so a
  third `EmptyState` beside a wrapped pair is still a copy.
- Live findings across the 17 repos: 7,199 to 6,425. shadcn-admin 99 to 67,
  ryot 108 to 72, Dub 1,288 to 1,186.
- **The guard doorway answers the same questions.** It exports
  `duplicateCopies`, `canBeDuplicate`, `componentNamesIn`, `isPageFile` and
  `looksLikeJSXFile`, and its duplicates now read every catalogue folder.
  New exports only.
- 17 unit checks. The last runs both judges over the same 2 repos and
  fails unless they name exactly the same duplicates.

## 9.2.0 — 2026-09-29

- **A button built from scratch is now a warning when the repo already
  has a Button.** The live check (the edit hook, the MCP validate tool and
  the review) only judged values until now. On Twenty, agents with the
  hook on reached zero findings and still hand-made the button four times
  in five, with clean token colours. The check now fires on a styled
  button or a button tag that is dressed as a button: real padding, a
  background or a border, and a label style such as a font weight. Rows,
  tabs, close crosses, select triggers, option cards and icon squares
  built on a button tag are left alone. It fires only when the file's own
  package can import a Button that at least 20 files already import, and
  the message gives the import line: "A styled button (StyledConnectButton)
  where the repo already has <Button> (imported 274x from twenty-ui/input).
  Use import { Button } from 'twenty-ui/input'. If it needs a kind the
  Button lacks, add a variant there rather than a new button here." In a
  monorepo the Button is chosen from the file's package or one it depends
  on, never from another app in the same repo. Probed on fifteen repos:
  seven warnings, six of them genuine. All eight buttons the test agents
  wrote on Twenty are caught. Scores and report counts are unchanged; the
  list of checks in a result gains "hand-made buttons where the repo has a
  Button" when the repo has one. The guard doorway exports the same
  functions and lists the Button candidates.
- **A use imported by package name is credited to that package's copy
  only.** When two components share a name across a monorepo (an old and
  a new design-system package, an app and its marketing site), a file
  importing by the workspace package name used to credit every copy. On
  Twenty the marketing site's Button carried the app's 274 uses; on
  cal.com the new design-system package's Alert showed 65 uses when no
  file imports it. The copy inside the named package now takes the
  credit. Measured on 17 repos, the 11 hosted examples included: no score
  moved. Counts can move where names are shared: cal.com's "never
  imported" rises from 101 to 142, which is where its migration stands.
  Which copy the report calls canonical, and the import the rules file
  names, follow the corrected counts.
- **Import aliases declared in tsconfig are resolved the same way.** A
  path such as `"@sentry/scraps/*": ["./static/app/components/core/*"]`
  now credits the copy under that folder, and the hand-made button check
  can name the import line on repos that alias their components folder
  (Sentry's Button: 1166 uses, `@sentry/scraps/button`). Comments and
  trailing commas in tsconfig are tolerated; a bare `*` catch-all is
  ignored. Measured on Sentry, Grafana and Excalidraw: no score moved.
- **Workspaces declared one level down are found.** A repo whose root
  is Go or Python often keeps its JavaScript in a subfolder, with the
  workspaces declared there. Mattermost's root has no package.json and
  webapp/package.json declares its packages. When the root declares none,
  the first subfolder that does is read, and its packages are reported
  with the subfolder in their path. On Mattermost the shared package's
  Button now reads 294 uses and the two local copies 16 and 12, where all
  three read about 300 before. The report shows Mattermost's three
  packages; the score is unchanged. Measured on the same 17 repos: no
  other repo changed.
- **A token's value pasted into a component is now a finding.** The live
  check (the edit hook, the MCP validate tool and the review) used to
  skip any hardcoded colour whose value matched a token, on the grounds
  that the system already knew the value. That let an agent write
  `background: #4a38f5` in a new component and pass with no findings,
  which is what happened five times on Twenty on 29 September. The skip
  now applies only inside the files that state the palette (a token
  stylesheet, a Tailwind config, a kit theme, a palette file). Anywhere
  else the check says which token holds the value, by name: "Use
  --color-brand (defined in src/styles/tokens.css)", or `var(--color-brand)`
  in a stylesheet. Scan scores and report counts are unchanged. The guard
  doorway now lists the same token-source files as `tokenSources`, so
  guard-my-design-system can apply the same rule.

## 9.1.2 — 2026-09-28

- **The verdict card says "No gaps found" and stops there.** 9.1.1 still
  answered the question with a sentence about what the scan checks, and
  the line under it said the repo was in good shape while the side panel
  promised two fixes. The headline is now the answer alone: "No gaps
  found", or "One gap: charts have no palette". The line under it says
  what that means for the agent, then what the fixes below do to the
  score ("Two fixes below make those answers easier to copy: 84 to 92").
  The "Where agents will invent" card opens with "No gaps found" too, and
  its note on how many gap kinds are measured is one sentence. The score's
  definition in the side panel is now "How well this repo follows the design
  system rules Roast checks", with "Three fixes could raise it to 71" under
  it, and the verdict card uses the same words: the score is evidence, the
  gaps are the finding. Scores and counts are unchanged. README screenshots
  reshot. The separate "Where agents will invent" section is gone: a gap
  is listed inside the opening card under "2 gaps found", and a clean repo
  gets "No gaps found" and nothing about how many gap kinds are measured.
  "Fix what makes agents guess" says "Three fixes could raise the design
  system health score from 47 to 71" instead of "Three tweaks · 47 → 71",
  and the score's eyebrow reads "Design system health".

## 9.1.1 — 2026-09-28

- **The report's first question is now "Where will your agent have to
  guess?"** The verdict card asked "what will your agent learn here?" and
  answered with "this repo gives an agent something to copy everywhere
  this scan can measure", which read as a limit of the scan rather than a
  diagnosis of the repo. The card now opens with the new question and a
  lead line that answers it directly: "Nowhere that this scan checks: your
  repo gives the agent a clear answer to copy", or "In one place your repo
  gives the agent no clear answer: charts have no palette. Asked to build
  there, it has to decide for itself." The "Where agents will invent"
  section opens with "the gaps where your design system has no answer
  yet", so the page reads in order: where the agent guesses, what makes it
  guess, how to fix it. Scores and counts are unchanged.

## 9.1.0 — 2026-09-26

- **The report answers one question first: what will your agent learn
  here?** The verdict card opens with that question and a lead line that
  says whether the repo gives an agent something to copy and where it
  does not ("One gap remains: charts have no palette"). The measured
  verdict follows under it. "Where agents will invent" moves up to sit
  directly under the verdict, explains that a gap is not a violation
  because there is no rule yet to break, and now appears on every scored
  report: when no gap is found it says so and names the limit (one gap
  kind is checked so far). Three sections are renamed to match the
  question: "What the numbers mean" is "What the repo teaches the agent",
  "Where to start" is "Fix what makes agents guess", and the present is
  "Give the agent the answers", with a line on the edit hook and the pull
  request check. The link preview title reads "repo: where an AI agent
  will invent UI · score". Scores, tiles, yardsticks and every count are
  unchanged. README screenshots reshot.

## 9.0.7 — 2026-09-26

- **The README and the landing page lead with what the agent runs showed.**
  Both now open with the finding the September runs produced: an agent
  copies what the repo has and invents where the repo has no answer, so
  the mess it adds is a map of the gaps. The release notes that used to
  open the README live in this file only. The evidence section quotes
  three results from 259 sessions on 10 public products. The long
  version of the trust list, scan scoping and what the plugin runs on a
  machine moved to `docs/reference.md`. No change to the scanner, the
  report or the tools.

## 9.0.6 — 2026-09-25

- **A hosted report carries no machine paths.** Every receipt in a report
  is a link that opens the file in the editor, which needs the absolute
  path of the machine the scan ran on. The hosted example pages were built
  that way too, so each carried the maintainer's home folder in every
  link, up to nineteen times a page. A report built for hosting (given
  `--og-url`) now prints the repo-relative path with no link, the release
  refuses to ship an example page that carries a machine path, and a test
  holds the rule. Local reports are unchanged: their links still open the
  file.

## 9.0.5 — 2026-09-25

- **The review skill reaches its engine through the plugin root.** Its
  instructions ran the engine by way of `${CLAUDE_SKILL_DIR}/../`, a path
  that climbs out of the skill's folder; they now use `${CLAUDE_PLUGIN_ROOT}`
  and say what to run when the skills were copied by hand. Same engine,
  same command.
- **The tests hand their child processes no environment at all.** Git gets
  its test identity as `-c` options and one stubbed-command test gets a
  fixed PATH. Nothing in the scan, the score or the report changes.

## 9.0.4 — 2026-09-25

- **No child process is handed a copy of the environment.** The `npx`
  wrapper told the harvest about its temporary output through an
  environment variable, copying the whole environment into the child to
  do it, and the tests copied it into every child they start. A plugin
  scanner reads such a copy as forwarding whatever tokens the user has
  set. The harvest takes `--ephemeral-out` as a flag, the wrapper passes
  no environment at all, and the tests hand a child only its path and
  home folder. Nothing in the scan, the score or the report changes.

## 9.0.3 — 2026-09-25

Housekeeping for the plugin directory listing, continued. Nothing in the
scan, the score or the report changes.

- **The bundled MCP server is declared in the plugin manifest as well as
  the root `.mcp.json`.** The directory's inventory reads the manifest; the
  plugin inventory, the desktop app's Connectors tab and a reviewer's "will
  install" list read the root file (8.3.2). Both declarations name the
  same server, and Claude Code starts it once (tested on a throwaway
  plugin: one server, one set of tools).
- **The release script leaves the repository.** It only ever runs on the
  maintainer's machine and talks to GitHub and npm with the maintainer's
  own logins, which a scanner reading the whole repository reports as
  credential use and as a download-and-run command. It lives with the
  maintainer's private notes now and takes the repository as its working
  directory. Releases are still cut from a tag by GitHub, with no stored
  secrets; nothing about how a version reaches npm changes.
- An unreferenced logo file is removed from `assets`.

## 9.0.2 — 2026-09-25

Housekeeping for the plugin directory listing. Nothing in the scan, the
score or the report changes.

- **The plugin manifest carries an icon and a full repository URL.** The
  directory listing showed the publisher's avatar and name because the
  manifest had none at submission; it now names the roaster mark
  (`assets/roastmds.svg`) and links the repository over https.
- **Link previews stay wired.** The hosted example pages got their Open
  Graph tags on 15 September by calling the report builder directly; the
  `npx` command never passed `--og-url` and `--og-image` through, so every
  regeneration since 8.2.2 dropped the preview cards. The CLI now takes
  both flags, the example manifest records each page's URL and card, and
  the release regenerates with them and refuses to ship a page that lost
  its card.
- **A "For reviewers" section in the README** says what the plugin runs
  on a user's machine (two skills, one local MCP server, one hook, all from
  the plugin folder, no network) and what in the repository is tooling the
  plugin never runs.
- **The eval suite leaves the repository.** The five behaviour tests for
  Claude Code's plugin eval runner live with the maintainer's private
  notes now; the suite that runs on every commit is unchanged. The plugin
  folder drops under the directory's file limit.
- README screenshots and logos are linked by relative path, so the
  directory's validator can see what uses them.

## 9.0.1 — 2026-09-25

- **The first chart in a repo is called that.** The scan already holds the
  file being judged, so a brand-new chart counted as its own precedent and
  the chart rule said "the repo has no chart palette" with no precedent
  named. A precedent is another file; with none and no palette, the
  finding now reads "First chart in this repo" and asks for a name. Same
  advice, right label, in the validate tool, the review, `--check`, the
  edit hook and the guard alike.

## 9.0.0 — 2026-09-25

A major because every yardstick is rebuilt. Take a fresh scan before you
compare with an older one.

- **The off-scale spacing count means what its label says.** Inside a
  style object every length used to count as a spacing value, so a width,
  a font size or a shadow's offsets (`boxShadow: '0 3px 9px …'`) raised the
  tile. Only padding, margin, gap and position count now, the same set the
  CSS rule reads and the live checks read since 8.9.2. The report, the
  scores, `summary.json` and the guard all count the same way again.
- **The benchmark is rebuilt on the same repos.** The 34-repo core fleet,
  the 10 reputable systems and the six kit slices (shadcn, Tailwind, MUI,
  Mantine, Chakra, Ant Design) are rescanned on this engine. Off-scale
  spacing medians move down everywhere: fleet 33 to 23, reputable systems
  6 to 5, shadcn 29 to 14, Tailwind 42 to 37, MUI 22 to 15, Mantine 31 to
  28, Chakra 16 to 9, Ant Design 97 to 75. Three other fleet medians move
  by one to three from counting fixes shipped between 8.4 and 8.9 that the
  ruler had not absorbed: colours 115 to 118, greys 23 to 21, near-identical
  pairs 7 to 8. Every other median is unchanged.
- **What moves on the examples.** Nine of the eleven hosted reports keep
  their score. Adobe Spectrum goes from 72 to 66 and Unleash from 64 to 60,
  both because their spacing count now sits against a tighter median. All
  eleven are regenerated on this engine, as are the README screenshots.
- The `What it measures` table in the README and the example cards on the
  landing page carry the new numbers.
- **The release regenerates the hosted examples.** Every example page
  names in its footer the version that made it, and until now they were
  rescanned only when someone remembered (pages served next to 8.9.2 still
  said 8.2.2). The release script now rescans all eleven from their clones,
  listed in `docs/examples/examples.json`, after the version is written and
  before the tests. It stops if an example's score moved without the README
  and the landing page being told, and if a clone is missing.

## 8.9.2 — 2026-09-25

- **A shadow's offsets are no longer reported as spacing by the live
  checks.** Inside a style object, every length used to count as a spacing
  value, so `boxShadow: '0 3px 9px …'`, a width or a font size came back
  from `roast_validate`, `roast_review`, `--check` and the edit hook as
  "new one-off spacing value 3px". The live checks now read only the
  spacing properties of a style object (padding, margin, gap, inset and
  their variants), the same set the CSS rule reads. The report's spacing
  tile is unchanged on purpose: changing how the harvest counts moves
  scores across the benchmark, so that waits for the next ruler rebuild.
- **The README says what the agent runs showed.** The "Why this exists"
  paragraph no longer claims an agent picks wrong half the time. It says
  what was measured over 164 sessions on 10 real products: agents copy
  what is there, stay on-system on everyday work, and invent where the
  design system has no answer, the way the repo's own code did.
- **Installed kit code is never a chart precedent.** The gap report read
  shadcn's own `components/ui/chart.tsx` as a chart the team paints by
  hand, so a fresh install was told it had a chart gap. A chart inside
  installed kit code (a shadcn catalogue, a registry block) is the kit's,
  not the team's, in the report, the MCP knowledge and the guard doorway
  alike. A fresh shadcn install has no gap.
- **The fresh shadcn example is a new install** (`npx shadcn create`
  with the defaults, base-nova, neutral, Tailwind 4, all 61 components),
  scanned on this engine: same 13 colours, same verdict, footer says the
  current version.

## 8.9.1 — 2026-09-25

- **The edit hook says a warning once per file in a session.** A warning
  is advice ("this chart paints by hand and the repo has no chart palette"),
  and in a rehearsal it was repeated after every edit while the agent worked
  on something else in the same file. It is now said once per file per
  session; a violation is still repeated until it is fixed.

## 8.9.0 — 2026-09-25

- **The report says where agents will invent.** A new section, "Where
  agents will invent", lists the places where the repo has no answer yet,
  so the next piece of UI, human or agent, will make one up. It comes from
  164 agent sessions on 10 real products (September 2026): agents copied
  what the repo already had and invented only where the design system was
  silent. One gap is admitted so far, because a probe over the 126
  benchmark repos showed it discriminates: charts that paint their series
  colours by hand in a repo with no chart palette (44 repos), or next to a
  shadcn palette no chart reads. The entry names the chart files, how many
  colours each writes, and the one move that closes the gap: name the
  series once as tokens and point the existing charts at them. Three other
  candidates were probed and left out: tokens without a dark value (usually
  a deliberate mode-invariant colour), missing radius, shadow or font-size
  scales (Tailwind classes or the kit theme carry them in 98 of 105 repos),
  and status colours (absent in two thirds of repos and agents did not
  drift on them).
- `summary.json` gains `gaps`, each with `id`, `title` and `files`;
  `roast_get_context` adds one `GAP:` line per gap so the agent knows when
  it is inventing; `learnSystem` returns `gaps` for the guard. Scores and
  tiles do not change.
- The README screenshots are reshot from the regenerated vercel/ai-chatbot
  report, and ten of the eleven hosted example reports are regenerated on
  this engine (every score unchanged; the Dub example shows the new
  section). The fresh shadcn example keeps its 8.2.2 footer: regenerating
  it means a new install, which is a separate job.

## 8.8.0 — 2026-09-25

- **Chart colours are judged against the chart palette, or its absence,
  and every door says the same thing.** A chart needs several colours that
  differ from each other, and most design systems never name them. The
  report has always left chart colours out; `roast_validate`, `roast_review`,
  `--check`, the edit hook and the guard doorway counted every one, so the
  same file got two verdicts. A probe over the 126 benchmark repos found
  charts in three quarters of them and a named chart palette in a quarter;
  the biggest group, 43 repos, has charts painting their series by hand with
  no palette to point at. One rule now, in three tiers. Where the repo keeps
  a chart palette (`--chart-*` or `--series-*` custom properties whose value
  is a colour, a `chartColors` or `charts` entry in a theme, tokens or
  palette file, or shadcn's `--chart-1` to `--chart-5` when a chart reads
  them), a colour written by hand in a chart file is a violation that names
  the palette and how to read it. Where the repo has charts but no palette,
  a chart that paints by hand gets one warning per file naming the existing
  chart that does the same and asking for the palette once, in the token
  file. The first chart in a repo gets one warning asking for a name. A
  shadcn install's `--chart-1` to `--chart-5` count as a palette only when a
  chart reads them; otherwise the warning says the names already exist and
  nothing uses them. A chart file is one that imports a chart library or is
  named for a chart; icons, illustrations, stories and build output are not.
  The generic colour checks stay out of chart files; spacing, inline styles
  and the rest still apply. Scores and the report do not change.
- The `Checked:` line on every live result gains "chart colours against the
  chart palette", and `learnSystem` returns the chart system, so
  guard-my-design-system can give the same answer.

## 8.7.0 — 2026-09-25

- **The plugin checks every file the agent edits, whether or not the agent
  asks.** The MCP tools only run when the agent decides to call them. In
  164 headless Claude Code sessions on 10 open-source products (September
  2026), Sonnet 5 called `roast_validate` or `roast_review` in about a third
  of the runs where it added off-system values, and Haiku 4.5 never did. The
  plugin now registers a Claude Code hook that runs after each `Edit` or
  `Write`. It checks the one file that changed with the same engine and the
  same words as `roast_validate`, and returns only the findings the edit
  added, compared with the committed version of the file. A file with no
  new findings gets no message. Files the report never judges (email,
  print, artwork, pictures drawn with code) are left alone. A file written
  by a shell command instead of the editor (`cat > file`, `sed -i`, a
  generator) is judged too: after each shell command the hook looks at every
  changed UI file it has not seen at that version in this session. The hook is
  Claude Code only; Cursor, Windsurf and Codex keep the MCP tools and the
  CLI. Under a second on most repos, about three on a large monorepo.
- **`--hook` runs the same check from the command line** for anyone who
  installs the server by hand: `npx roast-my-design-system@latest --hook`
  reads the hook event on stdin and prints the findings as JSON. It always
  exits 0, so a failed check never stops the agent editing.
- Nothing in the scan, the score or the report changes.

## 8.6.2 — 2026-09-25

- **Tailwind's internals are no longer mistaken for design tokens.** A repo
  that commits Tailwind's compiled output (Cal.com keeps a 343 KB
  `globals.css` that starts with the `/*! tailwindcss v4… */` banner) had
  every `--tw-*` variable in it read as an existing token, so a new theme
  token was reported as a twin of `--tw-ring-offset-color`. `roast_validate`,
  `roast_review`, `--check` and the guard doorway now ignore `--tw-*` names,
  and leave out stylesheets the report already treats as not the team's own
  (a library's CSS, a minified file, and now Tailwind's compiled build). The
  report names a compiled build as not the team's own; scores do not move.

## 8.6.1 — 2026-09-24

- **The guard doorway gives the guard what the two 8.6.0 checks need.**
  `learnSystem` now returns `tokenDefs`, every colour token each stylesheet
  defines with its light and dark value, and `duplicates`, each duplicated
  component's copies with their usage and the colours each copy hard-codes.
  They are built by the same code the MCP server uses, so
  guard-my-design-system gives the same findings, in the same words, as
  `roast_validate`, `roast_review` and `--check`. Nothing in the report or
  the scores changes.

## 8.6.0 — 2026-09-24

Two gaps found while rehearsing a demo on the same Vite, React and Tailwind v4
app.

- **A new colour token that copies an existing one is flagged.** When a
  stylesheet adds a colour token whose value is almost the same as a token
  the repo already has, `roast_validate`, `roast_review`, `--check` and the
  review skill now say so and name the existing token:
  `--color-overdue-soft (#fff4e5) is a twin of the existing
  --color-warning-soft (#fdf5e6)`. A new token whose dark value is exactly
  the same as an existing token's dark value is flagged too, if the light
  values are within 24 channel steps. Two tokens count as a copy when every
  channel is within 8 steps and the difference is too small to see (an OKLab
  distance of 0.01 or less). Numbered steps such as `gray-100`, shadcn's own
  theme variables, and two names that start with the same word (`brand` and
  `brand-strong`) are never compared. Only tokens the change adds are
  judged: the checks compare the file with its last committed version.
- **The report counts these copies as near-identical colour pairs.** Before,
  two tokens were never counted as a pair. So when a hard-coded colour was
  turned into a new token that copies an existing one, the hard-coded colour
  stopped counting and the number of pairs went down. On the demo app the
  count went from 5 to 4 after six copied tokens were added. It now goes
  from 6 to 8.
- **An import of a duplicate component is flagged when there is a clear
  main copy.** If new code imports a component from a copy that
  `roast_find_component` says to avoid, the live checks now name the main
  copy: `Imports <Button> from src/features/invoices/ButtonV2.tsx, one of 2
  competing copies. The canonical one is src/ui/Button.tsx (used 8x; this
  copy 4x). This copy hard-codes #3d5ce0, #2e48b5, #cfd4dc and 2 more.` Imports that
  were already in the file are not flagged. When two copies are used about
  equally, nothing is flagged, because neither is the main copy.
- **`roast_get_context` and the build prompt say not to copy tokens.** Where
  the repo has a token file, the context now says: "Do not add a token that
  duplicates an existing one; reuse it."
- **The guard can use both checks.** `tokenTwinFindings`, `tokenDefsOf`,
  `avoidedImportFindings` and `canonicalCopy` are exported through
  `roast-my-design-system/engine`, with the same wording as the live checks.

Score changes: tested on 204 public repos. 33 now show more near-identical
pairs, almost all of them already over the limit. Three scores change:
medama 75 to 67, trigger.dev 60 to 55, tRPC 85 to 80. The demo app stays
at 69, because its pairs were already over the limit.

## 8.5.0 — 2026-09-24

Five fixes from running 8.4.6 on a Vite, React and Tailwind v4 demo app.

- **A palette class is pointed at the nearest theme colour.** The fix for a
  palette class used to pick a theme name by its wording alone, so
  `bg-amber-50` was told to use `bg-canvas` and `text-amber-800` to use
  `text-ink`. It now picks the theme colour closest to the class's Tailwind
  value, among the names that suit the utility: `bg-amber-50` gets
  `bg-warning-soft`, `text-amber-800` gets `text-warning`, `border-amber-200`
  gets `border-warning-border`. When no theme colour is close, it picks by
  name as before. The example for a new token follows the colour and the
  theme's own words: amber gives warning, red gives negative or danger, green
  gives positive or success. It no longer always says "success". This applies
  to `roast_validate`, `roast_review`, `--check` and the review skill on a
  repo with a Tailwind theme.
- **Typefaces in a Tailwind v4 `@theme` block are read.** A
  `--font-sans: "Inter Variable", ...` row in `@theme` now counts as a
  typeface the system declares. `roast_get_context` lists those typefaces
  first, and a stylesheet using one is not flagged as a new typeface. They
  are not added to the report's typeface count. On one public repo, the
  `@theme` block holds a 21-font picker for its users.
- **Uses of a duplicated component go to the copy that is imported.** When
  two components share a name, each use now counts for the copy the file
  imports, read from its import line (relative paths, `@/` and `~/` aliases,
  and `index` files). Before, both copies were given every use, so
  `roast_find_component` said "No clear canon" when one copy was used 8 times
  and the other 4. Where the import cannot be read, both copies are credited
  as before.
- **`src/ui` is recognised as the UI folder.** Along with the shadcn folders,
  `src/ui`, `app/ui`, `src/shared/ui`, `shared/ui`, `src/lib/ui` and
  `src/design-system` now count, if they hold at least 3 component files and
  no `package.json` of their own. This names where the components live. It
  does not make the repo a shadcn repo.
- **`roast_find_component` knows other names for common components.** If no
  component name contains the word asked for, it tries common alternatives:
  banner, notice and callout for Alert; dropdown and picker for Select; modal
  and dialog; drawer and sheet; chip, tag and badge. The answer says which
  word it searched for. Every word in the question must still match, so
  "date picker" does not return Select.
- **Scores.** Across 204 public repos, one score moved: Ghost, from 18 to 10.
  Its shared `Toggle` was being given the uses of a different `Toggle` in
  another package. It is now counted as never imported. 19 repos show more
  never-imported components for the same reason, with no score change. The
  suite's two duplicate-Button fixtures now name a canonical copy.

## 8.4.6 — 2026-09-22

- **The guard doorway exposes the kit check.** On a product built on MUI,
  Mantine, Chakra UI or Ant Design, `roast-my-design-system/engine` now names
  the kit, its theme files, the theme's colours and its spacing step, counts
  the theme's colours as the token set, and exports `kitPaintFindings`, the
  judgement `roast_validate`, `roast_review` and `--check` give a kit file: a
  colour or a pixel size written onto a kit component, with the same message
  and the same fix. The wording moved out of the MCP server into the shared
  kit module so the live checks and a guard read one text. Nothing in the
  scan or the live checks changes; the suite proves the live check's kit
  findings are unchanged.

## 8.4.5 — 2026-09-22

- **The guard doorway exposes the comment blanker.** `blankComments`, the
  step the report and the live checks run on a file before matching palette
  classes (8.4.4), is now exported from `roast-my-design-system/engine`. A
  guard that reads the doorway can run the same step, so a class named in a
  comment is counted by neither tool. Nothing in the scan changes.

## 8.4.4 — 2026-09-20

- **A palette class named in a comment is no longer counted.** The report's
  "off-theme colours" tile and the live checks (`roast_validate`,
  `roast_review`, `--check`, the review skill) matched Tailwind palette
  classes in the raw file, so a note such as `{/* border-green-500 is
  deliberate */}` counted as a second use of the class. Block and line
  comments are now blanked before matching, on the report and the checks
  alike, and line numbers in findings are unchanged. On nine public shadcn
  repos this removed 36 hits out of about 5,400, all of them in comments;
  the report and the checks still agree exactly on every repo.
- **The palette finding's fix now says token.** It read "use a theme name as
  the class; if the colour is missing, add it to the theme once". It now
  reads "use a theme token as the class (`border-border`). If no token fits,
  add one to the theme once, for example `success`, and use
  `border-success`." The rest of the product says token; this line now does
  too, and it shows the class that results.

## 8.4.3 — 2026-09-20

- **`roast_get_context` names the files of every duplicated component.** The
  line used to read "`<AppSidebar>` exists in 2 places"; it now lists the
  places, up to three, with a count for the rest. Without the paths an agent
  would look in `src/`, find one copy and report the scan as wrong, when the
  second copy sat in a templates folder it had not opened. With the paths
  there is nothing to check, and the agent can see which copy not to import
  from. The answer stays inside the 400-token budget on every fixture.

## 8.4.2 — 2026-09-20

- **`roast_validate`, `roast_review`, `--check` and the review skill now flag
  Tailwind palette classes on shadcn repos.** A class such as `ring-green-500`
  or `dark:bg-black` written in your own code, where the theme sheet names a
  colour of that kind, is reported with the sheet's path and a theme class to
  use instead. The report has counted these since 7.2 under "off-theme
  colours per 100 files"; the live checks only ran the rule on Tailwind
  themes, so an agent could write a colour the report would count and be told
  the review was clean. The rule now runs on the same files as the tile: your
  own code and installed registries, never the shadcn catalogue, kit blocks
  or demo folders. Checked on nine public shadcn repos: the tile's count and
  the review's findings match exactly on every one.
- **`roast_get_context` on a shadcn repo** now says to use the theme's classes
  (`bg-primary`, `text-muted-foreground`) and never a palette class, in the
  same line that names the token file.

## 8.4.1 — 2026-09-19

- **Every `npx` command now reads `npx roast-my-design-system@latest`**, in the
  README, the skill text, the CLI help and the footer of the generated rules
  file. The plain form can pick up an older copy left in a folder above the
  repo, and then run that instead of the current release. The `@latest` form
  always resolves to the newest version on npm.

## 8.4.0 — 2026-09-18

A second skill for the Claude Code plugin: review what changed.

- **`/roast-my-design-system:review` checks the files in your git diff** against
  the design system the scan found, and lists each finding with its fix. It
  is the same check as `--check` on the CLI and `roast_review` over MCP, now
  typeable in chat and picked up from plain words such as "review my UI
  changes" or "did I break the design system". It runs in about a second,
  gives no score and writes no report; for those, the roast skill is
  unchanged. On request it applies the fixes in the kit's or the repo's own
  vocabulary and re-runs the check.
- **A standalone review script** in the engine, `scripts/review/index.mjs`,
  which the skill runs. It prints the review and exits 1 on findings, with
  `--json` for scripts. Part of the npm package, so it is also available to
  anyone who wants the check without the launcher.
- **Manual installs copy both skill folders.** The review skill runs the
  engine from the roast skill's folder beside it.
- An eval case for the new skill, and the README and landing page name it.

## 8.3.3 — 2026-09-18

- **The skill's credit rule is a citation of the data source.** When Claude
  writes a separate document from the scan's numbers, it cites "Scores and
  benchmarks from roast-my-design-system by Greg Kozakiewicz" rather than
  adding a "Built with" line. Same name, same link, framed as where the
  numbers came from.

## 8.3.2 — 2026-09-18

- **The bundled MCP server is back in the root `.mcp.json`.** 8.3.1 moved it
  into the manifest, which runs but is invisible: the plugin inventory, the
  desktop app's Connectors tab and a reviewer's "will install" list only
  count a root `.mcp.json`. Tested on a throwaway plugin: the manifest form
  shows zero servers, the root file shows one. The declaration uses the
  plugin variable as before, which is the only form the plugin loader
  substitutes. Anyone working on this repository itself can ignore the
  project-config reading of the file with the `disabledMcpjsonServers`
  setting in their local settings; plugin users need nothing.

## 8.3.1 — 2026-09-18

- **The bundled MCP server is declared in the plugin manifest,** not in a
  root-level `.mcp.json`. Claude Code also reads a root `.mcp.json` as project
  configuration when a session runs inside this repository, where the plugin
  variable is unset, so that copy could never start and showed as failed.
  Plugin users saw no difference; this removes the failing entry for anyone
  working on the repository itself.

## 8.3.0 — 2026-09-18

The plugin now bundles the MCP server, and the package is brought in line with Anthropic's plugin rules. No change to the scan, the score or the report.

- **The Claude Code plugin bundles the MCP server.** Enabling the plugin
  starts the local server from the plugin's own folder, so the five tools
  appear without a separate command. Anyone who added the server by hand
  can keep it or remove it; the two would otherwise both answer.
- **The launcher folder is renamed from `bin` to `cli`.** A plugin must not
  carry a top-level `bin` folder: Claude Code adds it to the shell path and
  the plugin cannot be distributed through claude.ai organisation settings.
  The npm command is unchanged.
- **The marketplace entry no longer carries a version.** The plugin manifest
  is the one place it lives. The entry gains tags, keywords, licence and
  repository.
- **Tests run on every push and pull request,** on Node 18, 20 and 22. Until
  now they ran only when a version tag was pushed.
- **A Privacy section in the README and a SECURITY.md** say plainly that
  nothing leaves the machine and how to report a problem.
- **The skill's trigger phrases move to the `when_to_use` field.**

## 8.2.2 — 2026-09-18

Examples and screenshots. No change to the scan, the score or the report.

- **All eleven hosted example reports are regenerated on this engine.** They
  were generated on 7.9 and 7.10 and still said so in their footers. Every
  score is unchanged; the pages now match the tool they advertise.
- **The README screenshots are taken from the regenerated vercel/ai-chatbot
  report,** so the footer in the picture says the current version. 8.2.1
  reshot them from the old page, which was the mistake this release corrects.
- **The fresh shadcn example is a new install,** made today with every
  component, the way the original was.

## 8.2.1 — 2026-09-18

README only. No change to the scan, the score or the report.

- **All eleven hosted examples are listed,** the same set as the landing
  page, each with its score and how the repo was read. The README listed
  seven.
- **The examples sit under "Why this exists"** so a reader sees real reports
  before the command reference.
- **The two report screenshots are reshot on 8.2.0.** The report itself has
  not changed since 8.0.0; the images are refreshed so the README and the
  report agree to the pixel.

## 8.2.0 — 2026-09-18

Two ranking fixes and one reading fix, found while teaching the MCP server the kits.

- **Colour tokens stored as red, green and blue channels are read.** A custom
  property such as `--bg-default: 255 255 255`, used later as
  `rgb(var(--bg-default) / <alpha-value>)`, is a colour token, the same as
  the HSL form shadcn uses. dub keeps its whole theme this way and scanned
  as a repo without one. 9 of 157 probed repos use the form; dub's colour
  count moves from 117 to 127 and its score stays at 20.
- **A list of colours no longer takes the token-file title.** A code file
  whose colours sit mostly inside arrays of eight or more (dub's avatar
  pairs, plane's chart series) still counts as a palette, but the report and
  the MCP server name the next candidate as the place a colour is decided.
  A Tailwind config or a stylesheet is never treated as a list. Across the
  72 probed repos whose token file is a code file, 10 change and 4 have
  nothing else and keep theirs.
- **On a kit repo the theme file is the root theme,** not a component's own
  theme or a provider. Open-Assistant's theme was named as its Badge theme
  and Metabase's as its provider; both now open on the root theme. The MCP
  server names the kit theme as the token file on every kit repo.
- The MCP server's colour entries for a kit theme carry the same fields as
  every other colour, so a reader that lists a colour's files no longer
  fails on a kit repo.
- The benchmark is not rebuilt. Two of the 34 core repos (dub, LibreChat)
  gain a few colours under the first fix; the medians are unchanged at the
  precision the report shows.

## 8.1.1 — 2026-09-18

Directory review chores. No change to the scan, the score or the report.

- **The MCP tools carry a title and annotations.** All five are marked
  read-only, so a client can run them without asking on every call.
- **The MCP context no longer ends with a credit line.** A tool answers the
  question and nothing else. Attribution stays on the report and in the
  skill's rule for documents built from the scan.
- **The plugin listing has a display name, a category (design) and a
  homepage.**
- **The README gains three prompts to try, a troubleshooting section and a
  support line.**
- **The skill names its own folder with Claude Code's variable** for it,
  `${CLAUDE_SKILL_DIR}`, instead of a placeholder in angle brackets.
- **An eval suite** under `evals/`, in the format Claude Code's plugin eval
  runner reads: three plain-language requests that must fire the skill and
  produce the report, and one unrelated request that must not. Not part of
  the npm package. The runner is in early access, so the suite has been
  validated for shape, not yet run.

## 8.1.0 — 2026-09-18

The MCP server learns what the report learned in 7.10 and 8.0: the four
component kits and the Tailwind theme.

- **The server reads a kit repo as a kit repo.** On a product built on MUI,
  Mantine, Chakra UI or Ant Design, `roast_get_context` used to say the repo
  had no tokens. It now names the kit, the theme file, how much of the
  product imports the kit and how often the theme is read, and states the
  rule in the kit's own terms (sx paths on MUI, `p="md"` on Mantine,
  `p={3}` on Chakra, `theme.useToken()` on Ant Design).
- **`roast_find_token` answers in the kit's terms.** A colour that is in the
  theme is pointed back at the theme. A length becomes a spacing step where
  the theme has one (`12px` is `p: 3` on a 4px MUI theme, `p="sm"` on
  Mantine, `token.marginSM` on Ant Design), and says when a size falls
  between steps.
- **`roast_validate`, `roast_review` and `--check` run the kit check.** A
  colour or a pixel size written onto a kit component is a finding in the
  kit's words, with the theme file named, and replaces the generic finding
  for the same value rather than doubling it. What the report does not count
  (a colour in a comment, a fallback after a theme read, a compare, SVG
  paint, a colour table, a chart file) is not counted here either: the
  server and the report share one judge.
- **A Tailwind theme gets the palette check.** On a repo that names its
  colours in an `@theme` block, the context says so and the checks flag a
  palette class such as `text-gray-500` where the theme has a colour of that
  kind. A Tailwind name the theme retunes is the theme, not a stray.
- **The context keeps its closing line on big repos.** When the context runs
  over its budget it now shortens the component lists first, which the find
  tools cover, instead of cutting the "validate, then review" instruction off
  the end.
- **`roast_review` finds the diff when the folder is spelled in a different
  case** from the one on disk, on a case-insensitive disk (macOS).
- Every clean result lists the extra check it ran, so a clean result on an
  MUI repo says the kit check happened.

## 8.0.1 — 2026-09-18

Copy only. No change to the scan, the score or the report.

- **The benchmark count is stated the same way everywhere: 112 public repos.**
  That is the 34-repo core fleet plus the 78 repos scanned for the shadcn,
  Tailwind, MUI, Mantine, Chakra and Ant Design groups. The README, landing
  page, npm description, plugin listing and skill description all said 34,
  and the plugin listing still said 29.
- **The skill file knows all nine profiles.** It described four. It now tells
  the agent what the Tailwind, MUI, Mantine, Chakra UI and Ant Design
  readings put in the scan, which benchmark group each kind is compared
  with, and to speak the kit's language when suggesting a fix.

## 8.0.0 — 2026-09-17

Support for the four big component kits, eleven counting fixes, and a rebuilt
benchmark. Every score moves: take a fresh one before you compare.

- **MUI, Mantine, Chakra UI and Ant Design each get a profile.** If your
  product is built on one of them, the scan reads it as such. It finds your
  theme in the repo (`createTheme`, a `MantineProvider` theme, `extendTheme`
  or `createSystem`, a token object on `ConfigProvider`), counts how often
  your components read it, and adds two tiles: colours and spacing written
  onto components when the theme already has a value.
- **What is not counted:** the kit's own installed code, chart series and
  colour-picker lists, artwork, terminal and code-editor themes, a colour
  that is only a fallback after a theme read, a colour compared with the
  theme, SVG paint, browser metadata, and a fully transparent colour.
  Spacing below a kit's smallest step is not counted either, because no
  theme value can replace it.
- **Your own layer over a kit counts as the kit.** Metabase imports its
  Mantine wrapper in 2,469 files and Mantine directly in 392, so the old
  reading covered 14% of the product.
- **A repo belongs to the kit it imports most,** shadcn included. Agenta
  imports Ant Design in 502 files and the shadcn catalogue in 101.
- **Four new comparison groups:** 19 MUI, 19 Mantine, 16 Chakra and 16 Ant
  Design products, 70 in all. Each target is the top of the tidiest third:
  MUI 4 colours and 4 spacings per 100 kit files, Mantine 1 and 3, Chakra 3
  and 4, Ant Design 6 and 7.
- **The fix prompts speak your kit:** MUI's `sx`, Mantine's props, Chakra's
  space steps, Ant Design's `theme.useToken()`. Each was tested by applying
  it to real repos and scanning again; the advice that broke code in testing
  is named in the prompt so an agent does not repeat it.
- **Eleven counting fixes.** One colour written two ways is one colour, not
  two and a near-identical pair. A hex that is only the fallback in
  `var(--x, #fefefe)` is a theme read: Primer goes from 308 colours to 8. An
  `!important` counts as aimed at a library when any class in its selector is
  the library's. Stylesheets you did not write are named and left out: a
  library's CSS kept in the repo, anything minified, code and markdown
  themes, and CSS a browser extension injects. Framework route files and
  stories are not competing components. Share images built with
  `html-to-image` join the render-to-image exemption. An app you have
  replaced (a `web-old` folder) is left out, and a `website/` folder that is
  an app of its own and holds more interface than the rest is read as the
  product. Fix prompts start from a product file, not your docs site.
- **Everything left out is listed in the report,** with file counts, the way
  your own exclusions already were.
- **Repos that used to be read wrongly:** Open-Assistant scored a false 100
  and now scores 75 as a Chakra product; InvenTree and the APISIX dashboard
  had no score and now score 75 and 84; Casdoor is measured on its current
  interface instead of the replaced one.
- **The benchmark was rebuilt on all of it:** 34 fleet repos, 10 reputable
  systems and six comparison groups. Fleet medians are now 115 colours, 23
  greys, 33 off-scale spacing values, 21 duplicated components, 51 inline
  style blocks, 77 bracket values, 7 near-identical pairs and 5 `!important`.
  Published examples move: dub 25 to 20, magicui 69 to 78, Spectrum 66 to 72.
- `summary.json`: `kind` can be `mui`, `mantine`, `chakra` or `antd`, with a
  `kit` block (`name`, `kitFiles`, `themeFiles`, `spacingUnit`, `refs`,
  `colours`, `pixelSizes`, `evidence`); tiles gain `kitColour` and `kitPx`.

## 7.10.0 — 2026-09-16

A fifth profile, `tailwind`, with its own benchmark. Three fixes for scores
that were too high on repos the scan could not properly read. Scores move for
Tailwind repos and for the repos named below.

- **The `tailwind` profile.** A repo that uses Tailwind v4 and defines at
  least 3 colours of its own in an `@theme` block is read as a Tailwind repo.
  It gets one extra check: Tailwind palette colours (such as `text-gray-500`)
  written in its own code, per 100 files, with the theme file, its colour
  names and the stray classes listed in the report. The rules file gets a
  section that names the theme's colours.
- **What counts as the repo's own colours.** A new name such as `brand` or
  `surface` counts. A Tailwind name given a different colour (Hugging Face
  Chat's greys, Plausible's yellow pointed at amber) counts, and its classes
  are never treated as strays. A Tailwind name restated with Tailwind's own
  value does not count, nor do `black`, `white`, `transparent`, `current`
  and `inherit`. The list of Tailwind's colour values was checked against
  tailwindcss 4.3.3.
- **When the theme counts as used.** Uses are counted in components and in
  `@apply` lines in stylesheets. A theme counts as used at 20 uses, or 3
  uses per colour if that is lower. A theme used less than that is shown in
  the report and not scored.
- **Strays are counted fairly.** A Tailwind grey is only a stray if the
  theme has a grey of its own; a Tailwind colour is only a stray if the
  theme has a colour of its own. hey.xyz, whose theme is four brand pinks,
  goes from 152 strays per 100 files to 10.
- **A Tailwind benchmark.** Tailwind repos are compared with a group of 11
  Tailwind repos, not the general fleet. The target for strays is 3 per 100
  files (4 of the 11 meet it; the median is 10). shadcn repos keep their
  target of 25. The "why this matters" text for this check is written for
  Tailwind. The builder and the repo list are in `tools/benchmark/`.
- **Not read as Tailwind yet:** repos whose interface is mostly Svelte or
  Vue (those files are not read), Tailwind v3 configs, and themes imported
  from an installed package.
- **No score when the scan could not read the repo.** better-auth scored
  100 because its interface sits in `demo/` and `docs/`, which the scan
  skips. strapi scored 75 because its colours live in
  `@strapi/design-system`, an installed package. Both now get no score, and
  the report says where the interface or the colours are. The `empty` and
  `vueapp` test fixtures also move to no score.
- **A registry must be what the repo is for.** supabase scored 100 as a
  registry because its registry paths matched no folder. A repo with 60 or
  more app pages outside what it publishes now keeps its own kind, and a
  registry whose paths match fewer than 5 code files is not used to narrow
  the scan. supabase now scores 28.
- **Email templates are skipped wherever they are.** A file that imports
  `react-email`, `@react-email/*`, `jsx-email` or `mjml-react` is treated as
  an email. react-email's inline style count goes from 558 to 33.
- **Fix prompts:** two new warnings. `!important` is needed on utility
  classes and when overriding a library's CSS. A colour that identifies
  another company's service should stay as it is.
- `summary.json`: `kind: "tailwind"` with a `tailwind` block (`file`,
  `names`, `restated`, `retuned`, `uses`, `usedIn`, `adopted`, `evidence`);
  `score: null` when nothing could be measured; `benchmark.slice` names the
  Tailwind slice on Tailwind repos.

## 7.9.0 — 2026-09-15

shadcn/lint, read as the team's declared policy. No score moves.

- **A shadcn/lint config is read and reported.** shadcn shipped
  `@shadcn/lint` on 14 September: six rules, errors that name the variant or
  theme variable to use. When a shadcn repo runs it, the report shows a
  `shadcn/lint` pill, and the shadcn section lists which rules are on and
  what each allows, denies and contracts, read from `.oxlintrc.json` in full
  or from `eslint.config.*` by pattern (the rule names and their literal
  allow and deny lists; anything else is reported as present and not read).
  A palette colour the config allows, exactly or by its glob, is marked
  "allowed by your lint config" in the receipts. The score does not move:
  what a linter allows is the team's decision, and the agent still reads
  the class. Category words such as `layout` are named, never applied per
  class; their category mapping is theirs.
- **The agent box and the rules file** say the linter is set up and that an
  agent which runs it gets an error with the fix.
- `summary.json`: `shadcn.lint` with the file, its kind, the rules on and
  whether it was read in full.
- The reader was checked against all 44 example configs in shadcn/lint's
  own docs at 0.1.0. New fixture: a factory kit with a lint config.

## 7.8.0 — 2026-09-14

For guard-my-design-system: the engine's doorway carries the profile facts.
No score moves, nothing on the report changes.

- **`learnSystem()` returns `profile`.** How the repo was read, decided by
  the same profiles the report uses: `kind` and `role`; `installedDirs`, the
  folders the team did not write on a shadcn repo (the catalogue, installed
  registries, kit blocks; empty on a registry, whose published folders are
  its own work); `paletteReady`, true on a shadcn repo whose theme file holds
  the variables in CSS-variable mode; `sheetFile`; `widgetDirs`; and for a
  registry the counted folders, variants and block folders.
- **Three shared rules exported** so both checkers judge the same line the
  same way: the widget-stylesheet and library-class rules for `!important`,
  and the palette-class pattern behind the off-theme colours tile.
- Unit test for the doorway on a shadcn kit, a registry and a plain product.

## 7.7.0 — 2026-09-14

The registry profile counts. A repo that publishes a shadcn registry is
scored on what it publishes and nothing else. Four registries move; no
other kind of repo does.

- **Only what a registry publishes is counted.** The folders its registry
  items point at (or the packages a route builds from) are the code under
  measure. The docs site, demos, examples and any catalogue installed for
  the site are kept out and named in the header with file counts, the same
  way a `.roastignore` exclusion is. The theme file the published
  components read stays in scope.
- **Variants count once.** Sibling folders holding the same published
  components (shadcn's aria, base, radix and new-york-v4) count through the
  folder the registry file names; the others are listed with their file
  counts. shadcn's source went from 132 duplicate components to 1.
- **Blocks are the range.** A name whose every copy sits inside published
  blocks (sixteen sidebar blocks, each with its own AppSidebar) is listed
  and not counted: a user installs one block, never all of them.
- **Published components are the project's own work.** No installed-code
  exemption for bracket values or palette colours: what ships to every
  installer is held to the same ideals as an app's own code. Unused
  published components are stock, not orphans, because their users live
  in other repos.
- **Published themes are checked.** Every theme in the registry is read
  for every shadcn colour variable, light and dark. A new tile on
  registries, "published themes incomplete", ideal 0, with the missing
  variables named. For a registry that publishes themes and no code, this
  check is the score and the other tiles say why they do not apply.
- **The rules file** tells the agent that a palette colour or bracket
  value written in published code ships into every repo that installs it.
- Scores: shadcn's own source 69 to 84, tweakcn 73 to 100 (36 themes, all
  complete), kibo-ui 73 to 78 (palette colours and inline styles in the
  components it publishes), magicui 64 to 69.
- `summary.json`: the `registry` block gains `counted`, `showcase`,
  `variantsDropped` and `themes`; tiles gain `themesIncomplete` on
  registries. The registry test fixture gains a second variant and two
  themes, one incomplete.

## 7.6.0 — 2026-09-13

The scanner recognises a fourth kind of repo, a registry, and names it.
Nothing is counted differently yet, so no score moves.

- **Registries are recognised.** A project that publishes components or
  themes for other repos to install with the shadcn CLI (shadcn's own
  source, magicui, kibo-ui, tweakcn) used to be read as an app that had
  installed shadcn, which turned its product range into sprawl: shadcn's
  source showed 132 duplicate components, one per base library. The scanner
  now finds the registry file (or the route that builds one from a packages
  folder) and says under the score what the repo publishes: "Read as a
  shadcn registry: publishes 54 components, 97 blocks, 7 styles and 238
  demos, the same components kept in 4 variants." Every count still reads
  the shadcn profile and the shadcn benchmark slice. The counting rules for
  registries are the next release.
- **A tweakcn theme is named.** When the theme file carries the rows
  tweakcn adds to every theme it exports, the report shows a "tweakcn
  theme" pill next to the design-system one and says so in the evidence
  line and the theme section. One repo in the benchmark fleet carries it,
  and its README credits tweakcn.
- **A font picker is a choice, not sprawl.** When every typeface is
  declared in one file, the summary says "16 typefaces offered by a picker
  in one file, one in use at a time" instead of "16 typefaces. Most
  products use 2 or 3." A reader who acted on the old sentence could only
  have removed the picker.
- `summary.json`: `kind` can now be `registry`, with a `registry` block
  (what it publishes, the variants, where the list came from). New values
  and fields only. A new test fixture, a tiny registry with two variants.

## 7.5.0 — 2026-09-13

The scanner reads the kit as it is built, not only as the order form
describes it, and every file it leaves out of a count is named at the top
of the report with the reason. Some shadcn repos move; most do not.

- **A fresh shadcn install says so.** When a repo is the output of
  `npx shadcn create` with nothing built on it yet, the report says: "It
  is a fresh shadcn install. Nothing of your own yet: 61 components
  installed, the theme file untouched, one demo page. The score is the
  kit's, not yours. Run this again once you have built a few screens." The
  summary, the adoption map and the rules file stop describing shadcn's
  internal wiring as the team's habits. Five checks decide it, all from
  facts already scanned; the moment a screen is built, the normal report
  returns.
- **What the agent rules file is, and who wrote it.** A rules file a
  framework writes for itself (Next.js re-adds its block on every dev run)
  is named as such: the agent does not learn the kit exists from it. When
  the files do name the kit, or the shadcn skill is installed, the report
  says so and points at what they do not carry: how this repo actually
  uses it. Stale lines in a rules file a lint preset generated are the
  tool's, not the team's, and no longer headline the summary.
- **The sheet is found where it is, and read as it is.** When
  `components.json` names a theme file that is missing or empty, the
  scanner reads the stylesheet that carries the theme variables and says
  which file and why. Rows kept under a scoped selector instead of `:root`
  (a theme picker's `[data-theme]` blocks, a widget's `#id`) are read.
- **A folder holding `index.tsx` is a component.** `button/index.tsx` is
  the Button. formbricks' product app is now read as the primary install
  with 30 catalogue components, which is also how the report learned that
  its theme file defines none of shadcn's colour variables.
- **The repaint advice checks the theme file first.** When the theme file
  holds shadcn's colour variables, the move is the swap it always was. When
  it holds none, the move is a decision: adopt the variables, map the
  palette onto them, then repaint. Swapping `text-slate-500` for
  `text-muted-foreground` with no variable behind it leaves the text with
  no colour. The rules file says the same.
- **Not counted, and named, with the caveat.** Every file a check leaves
  out (email, print, artwork, images drawn with code, and the new cases
  below) is listed in the side panel with the reason and one line that
  stays true: your agent reads it like everything else.
  - The Next.js crash page (`global-error.tsx`) replaces the root layout,
    so the stylesheet never loads there and its styling has to be inline.
  - A stylesheet that imports Tailwind with the `important` flag, or sits
    in a package whose Tailwind config scopes utilities under an id, is an
    embedded widget living inside someone else's page. Its `!important` is
    the only way through the host's CSS.
  - An `!important` whose selector names only a known library's class
    names (a code editor, a date picker, an emoji picker), none of which
    the team writes in its own code, is aimed at CSS the library ships. A
    check of 56 clones: 30% of all `!important` is this kind, and the
    count that remains still separates tidy repos from messy ones.
  - Off-scale spacing values inside shadcn's own component files, the
    same rule as its bracket values since 7.4.
  - A name defined by two catalogue components (Toaster in `toast.tsx` and
    `sonner.tsx`) is upstream's overlap, listed and never counted.
- **The fix prompts name the two mistakes an agent makes chasing points.**
  The repaint prompt: a gradient, an illustration or a status colour keeps
  its colour; add a variable rather than swap to a grey. The bracket and
  spacing prompts: never round a width another element depends on, a
  preview panel, a skeleton that mirrors a chart.
- **The shadcn slice is rebuilt** with the `!important` rule. 16 repos.
- Scores: a factory install 100 and read as fresh; Kiranism's
  next-shadcn-dashboard-starter 78 to 87 (its two amber tiles were the
  crash page); vercel/ai-chatbot 75 to 80 (7 of its 9 `!important` restyle
  a code editor); formbricks 33 unchanged (its product app has no theme
  file, and now the report says so).
- `summary.json`: `shadcn.fresh` (boolean). Rules files gain no new
  section. A new test fixture, a real `npx shadcn create --defaults`
  scaffold, locks the fresh path.

## 7.4.0 — 2026-09-13

The report has a new shape, and the score says what it measures. On shadcn
repos 2 counts change meaning; no other repo moves.

- **What the score measures, in 1 line under the number.** "How safely an AI
  agent can build on this repo without going off-system." That is the
  definition every tile, exclusion and fix prompt is judged by from now on.
  The README and the landing page say the same.
- **A new layout: a fixed side panel and a scrolling main column.** The
  panel holds the repo name, the score with its definition and what the top
  fixes would lift it to, the stack, how the repo was read, an index of every
  section that rendered, and a block called "Not yours, and not counted".
  The summary sentence opens the main column. Below 900px the panel sits
  above the content. The page is 10% denser.
- **Installed code is named, and split 2 ways.** What the team did not write
  is either kept out of the count and named, or kept in the score and
  attributed, by 1 test: does it teach an agent a wrong lesson.
  - Bracket values inside the shadcn catalogue, kit blocks and registries
    are shadcn's own choices, a true lesson badly framed. Out of the count,
    listed in the side panel with their values. A factory install with all
    61 components now scores 100, was 96.
  - Palette colours inside an installed registry such as ai-elements teach
    the same wrong lesson as in own code. Kept in the score. When they cost
    points, the side panel says how many and what own code alone would
    score. Never prompted: not the team's files to edit.
  - Unused catalogue components stay stock, not scored, and the agent-trap
    box no longer fires on them. It used to say "303 components are never
    imported" above a tile saying the same 303 were stock.
- **Leftover theme variables become a fix.** A custom variable defined in
  the theme file that nothing in the repo reads (the Next.js starter's
  `--foreground-rgb` next to the real `--foreground`) is a "Where to start"
  move: an agent opening the file sees 2 colour systems and can not tell
  which one is dead. 6 lines to delete on vercel/ai-chatbot.
- **The rules file tells the agent whose brackets they are.** On a shadcn
  repo it names the installed bracket values as shadcn's and says what to do
  in own code instead, because shadcn's own docs allow brackets for one-off
  values and nothing shadcn ships says otherwise. Leftover variables are
  named as not to be used.
- **The restyled-components tile counts colour only.** It used to count a
  colour or a text size passed into a shadcn component through className.
  An audit of the 16 shadcn repos in the benchmark split the two: colour is
  rare and sharp (13 repos at 0 to 6 per 100 files, then 13, 26 and 32 on the
  3 repos that repaint the kit); a text size on an Input is on 12 of 16 repos
  at the same rate, so it separates nothing, and nowhere else in the report
  does a text size cost points. The tile is now "components recoloured from
  outside", ideal 2 per 100 files, the tidiest half. Typography through
  className is shown in the shadcn section and named in the rules file, not
  scored. Most shadcn repos gain a green tile from this: vercel/ai-chatbot
  67 to 75, its 13 restyled components all typography.
- **The shadcn slice is rebuilt** with own-code brackets, registries in the
  paint counts and colour-only overrides. 16 repos.
- `summary.json` gains `ownCodeScore` and `installedPoints` when installed
  code costs points. New fields only.
- 6 unit checks for the installed-code split and the breakdown.

## 7.3.3 — 2026-09-13

- **A shadcn install needs the theme, not just the file names.** From 7.2.0
  a folder with 8 or more catalogue file names on Radix or Base UI was read
  as a shadcn install even without `components.json`. dubinc/dub has exactly
  that and no shadcn theme variable anywhere: its own token system, a shadcn
  ancestry, not a shadcn install. It was judged on a theme it does not have
  and sat in the shadcn slice. Without `components.json` the scanner now also
  requires 5 or more of shadcn's named theme variables in a stylesheet. The
  recognition line says how many it found. dub reads as a product again and
  is judged on its own system. The shadcn slice is rebuilt with 16 repos. No
  other repo changes kind.

## 7.3.2 — 2026-09-13

Copy only. No score moves.

- **The verdict sentences are in plain English.** The line at the top of
  the report and the 3 receipt headings it echoes no longer use images:
  "punched through the scale" is now "written outside the Tailwind scale",
  "the cascade admitting defeat" is now "forces a style through instead of
  fixing the rule that blocked it", "copy-paste, not decisions" is now "1
  colour recorded twice", "where a dozen would do" is now "a tidy system
  needs about 12". Every sentence names what the agent does in the second
  half. The MCP server, the SARIF rule descriptions and the landing cards
  say the same. The 7 agent-trap boxes are rewritten in the same register:
  no coin tosses, shouting matches or breeding twins, just what the agent
  does next.

## 7.3.1 — 2026-09-12

- **A factory install joins the examples.** A project made with
  `npx shadcn create` (base-nova, neutral, Tailwind 4) with all 61
  components added, scanned as is: 96. Every theme variable present for
  light and dark, 13 colours, no off-theme colours, no restyled components,
  303 unused components shown as stock. The 4 missing points are 24 bracket
  values inside `components/ui`, code shadcn wrote, which the bracket tile
  still counts repo-wide. That is the next fix.

## 7.3.0 — 2026-09-12

A shadcn repo is now compared with the shadcn repos in the benchmark, not
with the whole fleet. Scores on repos that are not shadcn do not move. On
shadcn repos a tile's amber band now ends at the shadcn median instead of
the fleet median, so scores can move both ways. dubinc/dub 24 to 15: 118
colours and 15 greys sit over the shadcn medians of 115 and 14.
vercel/ai-chatbot stays at 67: its 100 bracket values sit under the shadcn
median of 169 (red to amber), and its 18 restyled components per 100 files
sit over the shadcn median of 17 (amber to red). No fixture score moved.

- **The shadcn slice.** `benchmark.json` gains `slices.shadcn`: the same
  statistics as the general table, measured over every fleet repo the
  scanner itself reads as shadcn (17 of 34), plus the 2 tiles only shadcn
  repos carry. On a shadcn repo every fleet line reads against the slice:
  the row says "Avg shadcn repo" and "cleaner than 60%" means 60% of shadcn
  repos. The curated ideals and the reputable-systems line are unchanged.
- **The builder.** `tools/benchmark/build-slice.mjs` writes the slice into
  the benchmark file without touching the general statistics. Which repos
  belong is decided by the profile layer, never by a hand list, so the ruler
  and the reading can not drift apart. The curated ideals moved to
  `tools/benchmark/ideal.mjs`, shared by both builders, and gained the 2
  shadcn entries (25 and 15 per 100 own-code files).
- **Installed registries are installed code.** A folder that a third-party
  shadcn registry installs beside the catalogue (ai-elements, kibo-ui,
  magicui, motion-primitives, or any name declared under `registries` in
  `components.json`) is read like the catalogue: not the team's own code,
  and its components count as components when own code restyles them. 3 of
  the 17 shadcn repos in the fleet carry one. A line under the header names
  them, with how many files and palette colours they carry, and says what
  is true of them: kept out of the own-code counts, but an agent reads them
  like everything else and copies what it finds there. The rules file tells
  the agent the same.
- **`summary.json`** records the slice a scan was measured against under
  `benchmark.slice` (kind, repo count, build date), and the `shadcn` block
  lists installed registries. New fields only.
- The 2 shadcn ideals and the fleet numbers 7.2.0 kept inside the shadcn
  profile now live in the benchmark file, where every other number lives.

## 7.2.0 — 2026-09-12

The scanner now recognises a repo built on shadcn/ui and reads it as one:
the installed catalogue, the theme file, and 2 checks from shadcn's own
rules for agents. Scores on repos that are not shadcn do not move. Scores on
shadcn repos can move both ways.

- **A shadcn install is found where it actually is.** The catalogue folder
  is resolved through the `ui` alias in `components.json` (tsconfig paths and
  `package.json#imports`), in any workspace of a monorepo, and failing that
  by a sweep for 8 or more catalogue file names. Of the 15 shadcn repos in
  the benchmark fleet, the old check found 5. The report prints the receipt
  under the header: "Read as a shadcn install (high confidence):
  components.json in apps/web, 41 catalogue components in
  packages/ui/src/components". A wrong guess is visible before any number.
- **The kit is read the way `shadcn preset resolve` reads it.** Style and
  base library, base colour, accent and chart colour matched against
  shadcn's theme table, radius, icon library, Tailwind 3 or 4, utility-class
  mode. Anything it could not read is said so.
- **The theme file is the one `components.json` names.** Not the file with
  the most colour literals. shadcn's own source repo used to get a
  2,126-line colour lookup table as its token file.
- **2 new tiles, only on shadcn repos, from shadcn's own agent rules.**
  *Off-theme colours per 100 files*: palette utilities in own code where a
  theme row exists (`text-gray-500`, `bg-blue-100`, `dark:bg-gray-900`).
  *Repainted kit components per 100 files*: colour or typography passed into
  a kit component through `className`. Both are counted over the team's own
  code only, never inside the catalogue, never in email, print, artwork or
  demo files. The ideals (25 and 15 per 100 files) and the fleet medians (62
  and 22) come from the 15 shadcn repos in the benchmark, measured on
  2026-09-11; the tidiest third sit under the ideal. A tidy shadcn repo
  gains a little from 2 more green tiles in its average (the shadcnv3
  fixture: 94 to 96). Utility-class installs (`cssVariables: false`) are not
  judged on off-theme colours: the palette is the theme there.
- **The theme, row by row.** A receipts section lists rows present for light
  and dark, rows shadcn defines that are missing, custom rows and whether
  they have a dark value and a Tailwind mapping, tweakcn's extra rows when
  present, and a changed `--spacing`, which shadcn's own changelog says never
  to touch. Receipts only; nothing here moves the score.
- **Kit blocks in own code are kit doors.** `login-form.tsx` and friends,
  installed by `shadcn add` outside the catalogue folder, are not counted as
  the team's own building.
- **The rules file gains a shadcn section** with the kit's own rules: theme
  rows over palette colours, variants over `className` colours, edit the
  component you own, `cn()`, `--radius` and `--spacing`, and the small habits
  the kit expects. Each carries this repo's receipts.
- **`summary.json`** gains `kind` (product, library, shadcn) next to `role`,
  and a `shadcn` block with the confidence, evidence, style, base colour and
  catalogue folders. New fields only; `schemaVersion` stays 1.
- **2 new fixtures** (a fresh create-era kit scoring 100, a customised legacy
  kit scoring 82) and 10 unit checks.

## 7.1.0 — 2026-09-11

No score moves. This release changes where the scanner decides what kind of
repo it is looking at, so that the next kind (a shadcn install) can be added
without touching any counter.

- **One place decides the kind of repo.** The scanner used to answer "is
  this a library?" and "can I measure components here?" in three places: the
  profiler, a block inside the harvest, and each consumer re-reading raw
  flags. They now live in `profiles/`, one file per kind (`product`,
  `library`), picked once at the start of a scan. Reports, rules, SARIF and
  the score read the decision through one accessor. Every fixture's expected
  output is byte-identical to 7.0.0.
- **The decision carries its evidence.** `harvest.json` gains `kind`,
  `kindConfidence` and `kindEvidence` on the profile: "publishable package
  @acme/ui with 20 reusable components and 0 pages". Nothing prints it yet.
  `role` stays as it was. New fields only, so `schemaVersion` stays 1.
- **The MCP server now makes the same decision.** It used to skip the kind
  step the CLI harvest makes, so a library read as a product through that
  door. Both doors now give one answer.
- **6 unit checks** for the profile layer in `tests/unit/profiles.test.mjs`.

## 7.0.0 — 2026-09-11

Major, for two reasons. Five counting bugs are fixed, so most repos lose a few
counts and a CI threshold needs a fresh scan. And `summary.json` changed shape:
a tile's `value` is now a number, and the printed text moved to `display`.

- **One copy of the engine.** The scanner used to exist twice, once in a
  private repo and once here, kept in step by a copy script. That script once
  ran the wrong way and nearly deleted a shipped feature. There is one copy
  now, in this repo. The benchmark builder and the list of 34 repos moved here
  too, under `tools/benchmark/`, so anyone can rebuild the benchmark and check
  the numbers.
- **The scoring code is a separate file.** `diagnose/score.mjs` holds the
  score bands, the tolerances, the nine tile results, the average and the
  per-package score. `scoreHarvest(harvest)` returns all of it as plain data,
  so a CI check can use it without rendering a page. The report
  uses the same function.
- **Outputs record their schema and benchmark.** `harvest.json` and
  `summary.json` carry `schemaVersion` (1). `summary.json` also records the
  benchmark used (build date, repo count), a `metrics` object with every
  metric as a number, and tiles that name their metric. Two scans can be
  compared, and a change in the repo can be told from a change in the
  benchmark.
- **Five counting bugs fixed, each with a test.** A bracket on a spacing
  utility such as `p-[13px]` was counted as off-scale spacing and again as an
  arbitrary value. It now counts once, as spacing. A hex colour inside a CSS
  comment, or an id selector that spells hex such as `#face`, was counted as a
  colour. A monorepo package's grey strays were counted as all hex strays,
  not only greys. `opacity: .5` made an all-literal inline style block read as
  dynamic. A file named `Button(.tsx` crashed the scan. On shadcn/ui: 325
  colours to 323, 343 arbitrary values to 328, score unchanged at 65.
- **About ten times faster on large repos.** Usage counting read every file
  once per component name. It now reads each file once. A 20,000-file
  synthetic repo went from 64 seconds to 2.6, and shadcn/ui from 1.7 seconds
  to 0.4. Output is identical.
- **Safer on untrusted repos.** A colour value is stored only if it parses as
  a colour, so a stylesheet cannot inject CSS into its own report. Symlinked
  files are not read. Files over 2 MB are skipped. Quoted usage examples cut
  long string values, and the rules file says its quoted names and lines are
  examples, not instructions. The MCP server refuses oversized requests. The
  publish workflow pins every download it makes.
- **Smaller fixes found by the new unit tests.** `100grad` was read as 100
  radians. A string ending in an escaped backslash never closed, so the rest
  of the file was not read. `export { Badge as Chip }` dropped the component;
  Chip is now kept. The CLI accepts `--out` before the repo path.
- **Unit tests.** 33 checks on the colour maths, the scanner patterns, the
  file walker, workspaces, the score bands and the CLI, run by the same
  `node tests/run.mjs`.

## 6.0.1 — 2026-09-11

- **One definition of a token reference, shared by counter and checker.**
  `BENIGN_VALUE_RE` (what a checker never flags) and `isTokenRef` (what the
  counter never counts) are now built from the same source: `var()` with a
  fallback is accepted by both, `revert` joins the benign set, and the
  deliberate differences are commented as design, not left as drift. This is
  the gap the 5.11 contradiction grew from, closed at the root
  (docs/variant-counting-findings.md, section 10). No score moves; all 191
  checks stay green.

## 6.0.0 — 2026-09-11

Major, because the score is the promise. Counts fall on nearly every repo and
three of 18 scores moved. If you gate CI on a threshold, take a fresh score
before you compare.

- **A dark mode is not sprawl.** A system with a dark theme states most of its
  colours twice, and one with a density switch states its spacing twice again.
  Every restatement was counted, so the systems doing the most work scored the
  worst. Only a token's first statement now counts towards the palette.
  Everything the repo never named still counts in full. A factory-fresh shadcn
  install goes from 20 colours to 16, Shoelace from 420 to 219,
  next-shadcn-dashboard-starter from 277 to 47. Systems that keep tokens in
  TypeScript rather than CSS, such as Cloudscape and MUI, are untouched.
- Scoped per package, so in a monorepo two packages each owning a `--brand`
  are two colours, not one.
- **Token references stopped being counted as values.** `border-radius:
  var(--radius)` was read as a radius and `font-size: var(--size)` as a font
  size. Polaris showed 49 radii of which 36 were references to its own tokens.
  Telekom Scale showed 52 font sizes of which 48 were. The most disciplined
  systems in the fleet were marked down for using their own tokens. One guard
  now covers both, along with `inherit`, Sass tokens and `map.get`. This
  matches what the CI guard already did, so the two agree again.
- **New finding: one token name, two colours.** When two packages that share a
  vocabulary disagree on what a name means, the report names it as an agent
  trap. Whichever package an agent opens first becomes the brand. Deliberately
  rare: 8 hits across 19 real repos and 9,229 definitions.
- **The benchmark was rebuilt**, both halves, on freshly cloned repos: the
  34-repo fleet and the 10 reputable systems. The medians in the README are
  restated. Reference medians: colours 24 to 20, font sizes 6 to 5.
- A checker still sees every colour the system names, dark theme included, so
  nobody working in a dark block is told to use the light twin.

The counting model was chosen by measurement, not opinion. Three models went to
19 real repos before any code changed, and the probe falsified the one that had
been recommended: counting token names took a factory-fresh shadcn install from
20 to 34, because 31 semantic roles share 20 colours. It punished good naming.

## 5.12.3 — 2026-09-10

- Docs only: the two command groups are headings rather than bold lines, so the break between "Run it yourself" and "For your agent" is unmissable, and the command column keeps the width it needs. Published so npm's copy of the README matches what is on GitHub.

## 5.12.2 — 2026-09-10

- **The commands say who they are for.** The command list is now two blocks, in the README and in `--help` alike: "Run it yourself", which is everything you can type in a terminal and get a result from, and "For your agent", which is `--notes`, `--section`, `--mcp` and the Claude Code skill. A plain terminal has no agent to write an analysis of the scan, so those flags were never really yours to type.
- The two prose sections in the report that look alike are now told apart in the docs: "Why this matters" is generic and ships with the tool; "What the numbers mean" is your agent's read of your repo.
- `--notes` and `--section` explain themselves when the file is missing, instead of only saying they could not read it. And they are checked before the scan runs, not after, so a mistyped path costs a millisecond rather than a full scan.
- `--by` described in plain words: it puts a name in the report header, for when you ran it for someone else. `--open` documented.

## 5.12.1 — 2026-09-10

- **The report opens when the score moves, not on every run.** An agent working through a fix re-runs the scan to check its work, and every run threw a browser window at you. Now the first scan of a repo opens the report, an unchanged score opens nothing and says so once, and the moment the number actually moves the report appears by itself. Nothing to open by hand. A person running the scan in a terminal always gets the report, as before.
- The report carries its own score in a comment, so each scan can compare against the one it is replacing. No state file, no configuration.
- New `--open` forces the report open where output is piped or captured; `--no-open` is unchanged.

## 5.12.0 — 2026-09-09

- **A vendored catalogue is stock, not debt.** shadcn copies component source into your repo, and people bring the whole set at once because adding it piece by piece gets tedious. Unused components in that folder were being scored as dead weight, costing about 10 points and earning the top recommendation "decide about the 138 components nobody imports". A factory-fresh install (`create-next-app` + `shadcn add --all`) scored **75 and was told to delete its own catalogue**. It now scores 83, and that advice is gone. The count is still shown, still counted, simply not judged: "catalogue stock: installed by the shadcn CLI, not used yet".
- The same correction runs through every door that repeated the old advice: the report tile and its fix-it move, the generated rules file (which now says *reach for one of these before building your own*, the opposite of what it said), the SARIF output for code scanning (no findings), and the MCP server's answer to an agent (which used to say "adopt or delete"). One flag decided in the harvest, read by all of them.
- **A folder named `components/ui` is not enough to earn the pass.** Plenty of teams write their own components there, and waving those through would hide genuinely abandoned code. Two independent signals, either sufficient: `components.json`, which the CLI writes; or a folder that is demonstrably the catalogue by filename, since shadcn-ui/taxonomy predates `components.json` and carries 111 of them. A fixture full of hand-written dead components in `components/ui` is still, correctly, accused.
- A repo that used everything it installed keeps the credit: the tile only leaves the score when it would otherwise accuse.
- Scores on real repos: taxonomy 80 → 89, chatbot-ui 60 → 66, a popular dashboard starter 60 → 66, papermark 30 → 33. Repos with a fully used catalogue (vercel/ai-chatbot, shadcn-admin) do not move at all. Duplicates stay penalised exactly as before: two of a thing with no way to tell which is right is the real harm.
- Thanks to Sahaj Jain, who maintains tweakcn, for the argument that settled it: an unused component is not just harmless, it is protective, because an agent reaches for it instead of writing its own worse version.

## 5.11.0 — 2026-09-08

- **`roast --check` and `guard-my-design-system` now give the same answer.** Two checkers, one question, seven places where they disagreed. A pull request that hand-rolled a second `<Button>` or added `style={{ display: 'flex' }}` walked past the guard. A new `border-radius: 7px`, font size, shadow or `font-family` came up clean under `--check` and was then stopped by the guard in CI. Same product, contradictory answers, and no way for the author to know which one to believe. Found by reading both sources side by side, not by a bug report.
- **The check stops crying wolf on files that cannot be on-system.** Email and print styling has to be inline, because there is no cascade to inherit. An OG card or a PDF invoice is a picture drawn with code, and satori accepts nothing else. A canvas renderer draws pixels. A file that is mostly SVG is a drawing. The report has skipped all of these since 5.10; `--check` judged them anyway, which is the fastest way to get a checker switched off. One list now serves the report, the check and the guard, and a skipped file is never reported as clean: the result says which files were left unjudged and why.
- **The check gained four measurements**: border radius, font size, shadow and typeface, in stylesheets, judged the guard's way. A value the repo already declares is consistency, not a sin. Where the repo declares none of that kind yet, the finding says there is nothing to compare it against rather than making an accusation.
- **The public doorway carries the component ledger.** `learnSystem` now returns what components exist and where, and `definedComponents` is exported, so the guard can tell a second `<Button>` from an edit to the first one. Feature-detected on the guard's side, so an older pin means one check fewer rather than a crash.
- A scale value is no longer offered as its own nearest neighbour. The file under review sits inside the scan, so the value being judged was in the learned map too, and the advice pointed back at itself: "New one-off border radius 7px. Closest value this repo already uses: 7px." Caught by running both checkers over the same change.
- Suite grows to 166.

## 5.10.3 — 2026-09-07

- **An order id is not a colour.** `roast_validate` told a repo that "#11004422 is new to this repo": it had read the order id `#1042` as 4-digit RGBA shorthand and expanded it. Three false accusations in one file, on the tool whose whole pitch is that it does not make them, caught by Greg reading an MCP review during demo prep. Loose hex in code now skips 4-digit shorthand, which in code is an order id, a ticket or an issue number far more often than a colour. In a real colour context — a stylesheet, a `style={{ }}` block, a `bg-[#1042]` class — all four lengths still count.
- The harvest and the MCP validator now apply that rule identically. They had drifted: the harvest read loose hex only in `.ts`/`.js`, the validator in every code file, so a `.tsx` file could be accused by the review and cleared by the report. Four new checks pin all four contexts; suite grows to 142.

## 5.10.2 — 2026-09-06

- **The token file is where the palette is, not where the most `--var`s are.** Greg read the generated rules for jsoncrack and found "Design tokens live in apps/chrome-extension/src/content-script.css", the one stylesheet with a custom property in it (2 definitions, 33 strays), while the real palette sat in `apps/www/src/constants/theme.ts` with 57 recognised tokens. The scanner knew the tokens were there; the label was chosen by a narrower rule. It is now chosen among definition sites (stylesheets defining colour custom properties, code files that are a palette) by how many token colours they hold, ties to the fewest strays, and needs at least 3 token colours to earn the name. jsoncrack names its theme.ts; every existing fixture keeps its answer. The rules file, the report copy and the MCP fix hints all read the corrected label. New fixture `jstheme`, two checks.

## 5.10.1 — 2026-09-06

- Docs only: the README passed a GOV.UK plain-English pass. Prose went from an average of 35 words a sentence (16 sentences over 30 words, 10 em-dashes) to 13 words a sentence, none over 30, no em-dashes, no spelled-out numbers. Nothing was cut; long sentences were split. Published so npm's copy of the README reads the same.

## 5.10.0 — 2026-09-06

- **The scan reads Tailwind v3 shadcn.** shadcn on Tailwind v3 stores a colour token as bare HSL channels (`--primary: 222.2 47.4% 11.2%`) and wraps it later as `hsl(var(--primary) / <alpha-value>)` so Tailwind can inject opacity. To every colour regex that was "some non-colour value", so a textbook shadcn repo (shadcn-ui/taxonomy) scanned as 2 colours, 0 tokens, and earned the banner "none of these are defined as CSS variables, every single one is a hardcoded value". It now reads 15 tokens, 0 strays, no banner. Bare triplets are recognised and normalised to `hsl()`, and `hsl(var(--x))` can never become a colour of its own.
- **Every colour space, not just hex.** Greys, luminance, near-identical twins and the MCP's nearest-token snapping all understood hex only. An oklch or hsl palette, which is every shadcn repo, reported 0 greys no matter what it held (vercel/ai-chatbot: 61 colours, 0 greys; now 41 greys, correctly, it is a zinc palette). One parser now covers hex, rgb, hsl, oklch, oklab, lab, lch and color(), verified against known values: the shadcn foreground triplet lands exactly on slate-900, the v4 oklch on zinc-900.
- **Twins across notations.** A token written as `hsl(224 71.4% 4.1%)` and a stray written as `rgb(3, 7, 18)` are the same colour and now count as a near-identical pair (mfts/papermark: 9 such pairs, 0 before). Identical colours in two notations count as the strongest twin, not a non-event. Scores on repos with this pattern drop honestly, because a finding the scanner was blind to is now visible.
- **One twin per stray.** A stray sitting inside a dense token ramp is within reach of many tokens, and counting every pair turned one hardcoded `#eeeeee` into eight findings (telekom/scale) and one Spectrum stray into dozens. The finding is "this stray has a token twin" and the fix is one redirect, so each stray now keeps only its closest twin. Twin counts fall on repos with big ramps (excalidraw 42 → 12, telekom 6 → 2, and its score 49 → 55) and stay put elsewhere.
- **Greys are opaque neutrals.** `rgba(0,0,0,.12)` and its alpha siblings are overlays and shadows, a different thing from the neutral ramp the grey tile measures; they still count as colours, strays and twins, they just do not climb the grey ladder. Template-literal colours with a hole in them (`oklch(0.35 0.08 ${hue})`) are no longer colours at all.
- **Bracket colours reach the palette.** `bg-[#f2f6fa]` is a hardcoded colour wearing a utility class; it counted nowhere before and now counts as a stray and a twin candidate.
- **Artwork colours stay out of the palette.** OG-image and render-to-image routes are drawings made with code; their colours were the only "strays" a clean shadcn repo had. They are exempt now, as their inline styles already were.
- **shadcn without CSS variables is understood.** `components.json` can set `cssVariables: false`, the mode where colours live in utility classes (`bg-zinc-900`) and no colour token exists by design. The header chip now reads "shadcn/ui (utility classes, no CSS variables)", the palette note explains the mode instead of accusing it, and the "no design system" fallback stays off for it. Fixture `shadcnutil`, three checks.
- MCP review: a bracket colour in a class string was reported twice (the position check compared against the attribute, not the colour). Once now. And the review snaps hex strays to hsl or oklch tokens: "#0f172a is visually identical to the token hsl(222.2 47.4% 11.2%)".
- New fixture `shadcnv3` (triplets in two themes, config wrappers, a bracket stray that twins a token, an OG route) with seven checks. Suite grows to 123. Validated before and after on six real shadcn repos, Tailwind v3 and v4, single and multi-theme.
- Not in this release, on purpose: the benchmark rebuild (the ruler changed, so the 34-repo medians get rescanned and re-dated next), per-theme counting (a light and a dark value are one decision in two contexts, not two colours), and semantic colour classes as token usage. Coming in 5.11.

## 5.9.0 — 2026-09-05

- **The agent card knows which doors your rules actually reach.** A new "Readable by" line states, as plain fact, which tools can read the rules files the repo has: Claude Code reads CLAUDE.md, Codex reads AGENTS.md, Cursor reads AGENTS.md and .cursor/rules. Where a door is missing, the card shows the one-line fix; where the only Cursor door is the legacy .cursorrules, it says "legacy file only", a label, never a verdict. Gated the way every metric is gated: the fleet was probed first (15 of 34 repos have no rules at all, and the dead-door case appeared once), so coverage ships as fact on the card, not as a scored finding.
- **Rules files are found where monorepos really keep them.** The scan now sweeps subfolders for nested CLAUDE.md, AGENTS.md, GEMINI.md, .cursor/rules and .windsurf/rules (twenty carries 35 AGENTS.md files; a root-only look reported 1 and called it the whole story). Nested files fold into one counted chip instead of 35. Three doors join the checklist: GEMINI.md, .windsurf/rules and .github/instructions.
- **The generated rules file carries door advice** in its header: Codex and Cursor read AGENTS.md, Claude Code reads CLAUDE.md only, and the one-line @AGENTS.md import that closes the gap.
- The agent card moved above the gift, so the report reads as a story: what to fix, what your agent sees today, then the rules file that fixes exactly that.
- The footer now hands out the command: npx roast-my-design-system in mono with a small copy pill (which never fakes success: where a clipboard is blocked it selects the text and says so).
- The GitHub About section is maintained by hand from this release on; the release script no longer touches it.
- All five example reports re-harvested and regenerated on this engine; screenshots reshot; README's "New in" stack trimmed to 5.9, 5.8 and 5.0.

## 5.8.0 — 2026-09-05

- **Every finding can now explain itself.** A small "why this matters" toggle sits under each of the ten finding blocks: colours, near-identical pairs, greys, off-scale spacing, arbitrary values, typefaces, duplicated components, inline styles, !important and never-imported components. It unfolds a calm, plain-language explanation of how the mess arrives innocently, what it costs later, how an agent multiplies it, and why the ideal sits where it sits, with the benchmark medians in the closing line. The findings stay brutal; the why is where the advice lives. Written to the GOV.UK plain-language standard and reviewed word by word. Asked for by Willem, and by Anna's question about where the numbers come from.
- **The theme toggle is now a Day/Night slide switch.** A squarish knob with lightly rounded corners slides along the track, the sun and moon cross-fade instead of swapping, and the labels fade with them. The icons themselves never animate. The landing page carries the same switch.
- **Every mark in the report is now drawn by hand for it.** The tick, cross, exclamation, dash, heartbeat, sun and moon previously used Feather geometry (MIT, legal, credit-free), and now use original coordinates instead, so no glyph traces to any icon set. Same look, same in-house CSS animation. Prompted by a licence check that came back clean: no third-party icon assets were ever in the package, and now no third-party coordinates either.
- Light mode: the why toggle inside the gradient hero card now follows the card's white text treatment; it inherited a grey meant for pale backgrounds and was unreadable there.
- The README gains one trust line where the no-network promise lives: dependency scanners such as Socket may flag URL strings in this package; they are product links and format identifiers written into generated reports, never fetched.
- All five example reports regenerated from repos pinned to their original scan dates, so the numbers behind the embedded notes still hold to the digit. Screenshots reshot on the new report. The tarball-manifest tripwire caught the why-copy module joining the package and made it deliberate.

## 5.7.2 — 2026-09-02

- Every tile on the adoption and composition maps now carries its component's name, truncated with an ellipsis when the tile is narrow (the hover keeps the full name and path). Anonymous count-only squares read as bugs, and Greg caught them on the scale map within the day. The suite now fails on any nameless tile. Example reports and the README screenshot regenerated.

## 5.7.1 — 2026-09-02

- Docs only: the README's Live examples list catches up with 5.7.0 — five reports now, telekom/scale and adobe/spectrum-web-components included, labelled by framework. The landing page had them; the README's own list still said three, and Greg caught it within the hour. Published so npm's copy matches.

## 5.7.0 — 2026-09-02

- **The scan reads web components now.** Stencil's `@Component({ tag })`, Lit's `@customElement`, plain `customElements.define` and Shoelace-style `Class.define('tag')` are all detected, with usage counted by the kebab tag and generated framework wrappers excluded so no component earns phantom adoption from its own machine-made bindings. Styling inside `` css`...` `` template literals (Lit's whole idiom) runs through the same CSS scanner as a stylesheet. Born on telekom/scale, where 93 Stencil components once scanned as one; hardened on eight real design systems: scale, Shoelace, Ionic, Material Web, Adobe Spectrum, Siemens iX, Baloise and Lion, whose scores now range 89 to 38 the way a design-system lead's gut would rank them.
- **What the scan cannot read, it now says.** When a repo's components register in a pattern beyond the detector, the component tiles read "not measured", the score takes no credit, and the ledger explains, because a zero the scanner never earned is blindness, not discipline. Versions before this one presented exactly that blindness as praise.
- **Repos have roles.** A published components package is a library: its consumers live in other repos, so it gets a composition map (how the system builds from itself) instead of an adoption map, and unused components become showroom stock to review, not corpses to accuse.
- **Token namespaces, earned and named.** A dominant custom-property namespace puts `custom design system (--telekom-*)` in the header; two co-equal tiers are named as a partnership (`--si-* + --ix-*`); further namespaces are reported as present, verdict-free, because "legacy" turned out to be a judgment ratios cannot make (Baloise documents `--mod-*` as a live tier; Adobe runs three layers; the roast notes, which can read deprecation notices, keep making the call). The rules file and MCP answers teach the namespace by name.
- **Header honesty all round:** `web components (Stencil)` instead of a wrong "react"; a dim `design system: unrecognised` chip when the scan cannot name the system, because on a design-system report, not knowing is a finding; the plain "custom design system" title requires a real token layer, so a white-label library like Lion is honestly a "component library".
- Sass repos measure truer: `$token` references are no longer counted as typefaces, the Sass `color(base)` helper is no longer a colour, and fully transparent values no longer pad the palette.
- Two new examples join the gallery: telekom/scale (with Claude's notes) and adobe/spectrum-web-components. All five example reports regenerated on this engine.
- Suite grows to 108 checks across nine fixtures, including a Stencil-plus-Lit library and a Vue repo proving the not-measured state. Every pre-existing fixture's scores are byte-identical: the new sight only added eyes where there were none.

## 5.6.2 — 2026-08-31

- Docs only: the README now shows exactly how to summon the `roast-fix` prompt in Claude Code (`/mcp__roast__roast-fix`, add the move number to jump the queue), verified against current Claude Code docs. Published so npm's copy carries the instructions beside the feature they belong to.

## 5.6.1 — 2026-08-31

- **The fix prompts reach the MCP door.** A third prompt, `roast-fix`, serves the top Where-to-start move from a fresh scan as a ready-made fix prompt, byte-identical to the report's copy buttons because it runs the same pipeline and the suite proves the match, byte for byte. Fix the move, ask again, and the next one has risen to the top: the scan is the progress bar. Pass `move: 2` to jump the queue; a repo with nothing to fix says so honestly.
- The scan summary (`--summary`) now publishes the moves with their prompts, which is how any tool can reuse them.
- **Screenshots reshot on the current report** (the 5.6.0 buttons are now visible in them), and the release script grew a mechanical guard: if the report's code changed since the last release, the screenshot cache-key must carry the new version or the release refuses to run. Screenshots went stale after visual changes three times, every one caught by Greg and none by a check; the check exists now.
- README, landing page and npm description all name the new prompt.

## 5.6.0 — 2026-08-31

- **Every fix now comes with its prompt.** Each move in Where to start carries a copy button holding a ready-made fix prompt: the finding, the real file paths, the expected score payoff, and the calm rules for fixing without steamrolling craft (name and consolidate, keep deliberate exceptions, no drive-by refactors), closing with the command to re-run the scan and watch the payoff land. One move per prompt, deliberately: three small finished fixes beat one long homework list, and the score becomes a progress bar. Born from the first user feedback: thank you, Willem.
- **Nothing to trust blind.** A "view it first" link unfolds the prompt right in the report before you copy it. And the button never fakes success: where a clipboard is blocked (sandboxed previews and their kin, whose copy commands report success while writing nothing), it says so plainly and unfolds the prompt for manual copying instead.
- Prompts travel inside the report file, so a forwarded report hands out working fixes with no tool installed. Zero moves means zero buttons; buttons stay out of print.
- Suite grows to 80 checks, including one born mid-release: the new tarball-manifest tripwire from 5.5.4 caught its first intentional change (the prompt composer joining the package) and made it deliberate.

## 5.5.5 — 2026-08-31

- Docs only: the README's trust section now states that zero dependencies is enforced, not aspirational — the suite fails if package.json ever declares a dependency, and the shipped file list is a photographed contract. Published so npm's copy of the README says it too; the protections themselves landed with 5.5.4.

## 5.5.4 — 2026-08-31

- **Zero dependencies again, and this time the suite enforces it.** Versions 5.4.1 through 5.5.3 quietly shipped a dependency on `checkmcp`: a conformance-testing session ran `npm install` in this repo, package.json remembered it, and five releases carried it out the door. Nothing ever imported it, but every `npx` run downloaded it and its luggage, and the zero-dependencies badge spent four days telling a lie. The dependency and the stray lockfile are gone, and the test suite now fails if package.json ever declares a dependency again, so the promise has a tripwire instead of relying on nobody tripping.
- Caught by Greg on the package's Socket page, which is exactly what that badge is for.

## 5.5.3 — 2026-08-31

- **The engine doorway widens for the guard.** `roast-my-design-system/engine`'s
  `learnSystem` now also returns the border radii, font sizes and shadows the
  harvest has always computed, plus `tokenNames`: every `--var` definition as
  value → name, so guard-my-design-system can advise "use `var(--blue-500)`"
  instead of leaving the reader to hunt the hex. Nothing about the CLI, the
  report, the scores or the MCP server changes; the numbers stay exactly where
  they were.

## 5.5.2 — 2026-08-29

- **The engine gets a front door for the family.** A single official entry point, `roast-my-design-system/engine`, so that sibling tools can borrow the scanner instead of copying it. First through the door: guard-my-design-system, the pull request guard that judges only the lines a change adds. The door is one new file (`lib/guard-api.mjs`) exposing how the engine learns a repo's system, scans a piece of text for styling, and names the on-system value a stray most resembles. Nothing about the CLI, the report, the scores or the MCP server changes; every existing import stays private and free to refactor. What is exported here is a promise: it moves only with a version bump and a line in this file.

## 5.5.1 — 2026-08-29

- The example report and the README screenshot catch up with 5.5.0: docs/examples/vercel-ai-chatbot.html regenerated from a fresh scan (same 75/100, same embedded notes) so the adoption map is live on the hosted example, and the full-report screenshot reshot on it, map and all. npm shows the new image because the cache key moved to ?v=5.5.1. Docs only, no engine changes.

## 5.5.0 — 2026-08-29

- **The adoption map.** The components section now opens with a treemap: every adopted component a tile, tile area its import count, all of them flush so scale is read by eye. One glance answers the question the table made you compute: how much of this system is really the same three components. Drawn only when there are at least eight adopted components, because a treemap of four tiles says nothing a table does not. Deterministic layout, no libraries, same SVG-from-the-script approach as everything else in the report.
- **Orphans now carry a receipt.** Components defined but never imported are grouped by the year git last saw anyone touch them, oldest first: "untouched since 2023" followed by its chips. A heavy year reads as what it is, the fossil of one abandoned effort. Exact date and file path on hover; without git the section falls back to the plain list and makes no date claims.
- Components imported exactly once get a line of text, never a tile: a tile would flatter them.
- The scan gains one read-only git call per orphan (capped, five-second timeout, silently absent outside a git repo). Scores untouched: every number in every report stays exactly where it was.
- Suite grows to 73 checks (74 with the npx wrapper), including one that proves small systems get no map on purpose.

## 5.4.1 — 2026-08-28

- **Invalid tool input now answers as an error, the way the MCP spec asks.** When a call to `roast_get_context`, `roast_find_component`, `roast_find_token` or `roast_validate` arrived with a missing or wrong-typed argument, the server replied with helpful guidance but stamped the reply a success, like a doorman explaining you are at the wrong building while cheerfully waving you in. The guidance text is unchanged; it now travels with `isError: true`, the flag that tells a calling model to correct its call instead of reading the advice as the answer. Surfaced by an MCP conformance sweep: six failures before, a clean pass after.
- The test suite scrubs `GIT_DIR` and its siblings at startup, so the pre-commit gate reaches the same verdict as a plain terminal run. Housekeeping, invisible to users.

## 5.4.0 — 2026-08-27

- **Verified in Cursor and Windsurf (now Devin Desktop).** Until today the README said the two editors "speak the same protocol", which is a plug that fits the socket on paper. Now both have been watched working: fresh installs, the server registered the way a real user would, connection confirmed in each client's own logs (five tools, three resources, two prompts), and real answers in each editor's chat — including `roast_find_component` reporting a two-Button tie and telling the agent not to add a third.
- The verification wrote the setup guide. Cursor wants the config **inside the project** (`.cursor/mcp.json`) so the scan sees one repo rather than your whole disk, and holds workspace servers disabled until you approve them in Settings → Tools & MCP. Windsurf's config is global, so its entry names the project folder. Both recipes are now in the README, learned the honest way.
- The publish workflow moves to `actions/checkout@v5` and `actions/setup-node@v5`, so release emails stop carrying the Node 20 deprecation warning. The README's CI recipe follows.
- No engine changes: the scanner, the report and the five MCP tools are what 5.3.1 shipped.

## 5.3.1 — 2026-08-26

- **The suite grows from 55 to 70 checks, and the agent traps get their photograph taken.** Building 5.3.0 revealed a blind spot: not one test fixture was messy enough to trip a single trap, so the report's most pointed feature shipped unwatched. A new `trapped` fixture is guilty of all six trap conditions at once, and the suite now proves the report shows exactly three boxes in severity order, that every hidden trap's condition was genuinely met (so the cap, not a broken threshold, is what hid it), and snapshots the fixture's summary, rules, SARIF and MCP answers like every other fixture.
- Nothing a user sees changes: same scanner, same report, same scores. This release is the reference photo, taken so the next one cannot break the traps quietly.

## 5.3.0 — 2026-08-25

- **Four new agent traps.** The report's trap boxes, until now covering duplicated components and off-scale spacing, extend to the other findings that multiply when an agent reads the repo as instruction: near-identical colour pairs (twins breed triplets), inline styles (every exception becomes the precedent for the next one), `!important` declarations (an agent that cannot win the cascade shouts louder, because that is what the repo taught it) and components never imported (yesterday's dead end becomes today's example).
- Same discipline as the originals: copy only, no new measurement, and each trap renders only when its mechanism is genuinely present, with thresholds high enough to keep the marker scarce. A report shows at most three traps, in severity order, so the warning never becomes wallpaper.
- Scores untouched: a repo below every threshold gets a byte-for-byte identical report.

## 5.2.4 — 2026-08-22

- Every one-off command in the docs, the CLI help, the share card and the rules-file regenerate hint now reads `npx roast-my-design-system@latest`: plain npx reuses its cached copy indefinitely, so users kept running versions that were days stale. The MCP registration (`claude mcp add ... --mcp`) deliberately stays unpinned — a registry check on every session start would cost latency and break offline. No engine behaviour changes.

## 5.2.3 — 2026-08-22

- README screenshots reshot on the current report: the feedback-ask footer, the star ask, and the post-rename links are now visible (previous shots predated 5.1.3's footer). Docs only, no engine changes.

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
