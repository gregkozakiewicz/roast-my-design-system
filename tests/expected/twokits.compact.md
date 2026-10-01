## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- There is no token file yet. Until one exists, reuse the colours already in the codebase instead of introducing new ones (3 distinct colours are already in play).
- This repo uses two kits: MUI (35 files) and Backstage UI (`@backstage/ui`, 14 files in `src/plugins`). Follow the kit the file already uses and extend it rather than building parallel pieces. Never put one kit's styling on the other's components.

### Spacing and sizing

- Avoid new one-off CSS spacing values; 1 off-scale value is already in play.

### MUI: the theme and the components

- This product is built on MUI. A colour, a spacing step or a radius is decided in `src/theme/theme.ts`. On a component, read it: sx paths (`color: 'text.secondary'`, `p: 2`) or `theme.palette` / `theme.spacing()` in styled().
- The rules in this section are for MUI components. Backstage UI (`@backstage/ui`) is imported in 14 files, 11 of them without MUI. On Backstage UI components, style them the way the files around them do; `sx`, `styled()` and the MUI theme do not reach them.
- The scan found 12 colours written onto components (`#667085`, `#3355ff`). Do not add more; if a colour is missing from the theme, add it to the palette once.
- The scan found 13 pixel sizes written onto components (`p: 12px`, `p: 20px`, `m: 8px`). Use spacing steps (`p: 2`), not pixels; a size between steps is a deliberate exception, left with a comment.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (2 static inline blocks already exist; do not add to them.)
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system@latest --rules*
