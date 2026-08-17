## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on 2026-08-17.

### Colours and tokens

- There is no token file yet. Until one exists, reuse the colours already in the codebase instead of introducing new ones (2 distinct colours are already in play).

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Panel>` from `src/components/Panel.js` (used 2x)
  - `<Login>` from `src/components/Login.js` (used 1x)

### Spacing and sizing

- Avoid new one-off CSS spacing values; 3 off-scale values are already in play.

### Typography

- The repo uses 1 typeface: Segoe UI. Do not introduce another, and do not re-declare font stacks by hand; use the existing setup.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (1 static inline block already exist; do not add to them.)
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
