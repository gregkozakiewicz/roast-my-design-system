## Design system rules

Too little styling found to derive repo-specific rules; these are universal defaults. Rescan once real UI lands.

### Colours and tokens

- There is no token file yet. Until one exists, reuse the colours already in the codebase instead of introducing new ones (2 distinct colours are already in play).
- This repo uses MUI. Prefer extending it over building parallel pieces.

### MUI: the theme and the components

- This product is built on MUI. A colour, a spacing step or a radius is decided in `src/theme/theme.ts`. On a component, read it: sx paths (`color: 'text.secondary'`, `p: 2`) or `theme.palette` / `theme.spacing()` in styled().
- The scan found 6 colours written onto components (`#667085`). Do not add more; if a colour is missing from the theme, add it to the palette once.
- The scan found 6 pixel sizes written onto components (`p: 12px`). Use spacing steps (`p: 2`), not pixels; a size between steps is a deliberate exception, left with a comment.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system@latest --rules*
