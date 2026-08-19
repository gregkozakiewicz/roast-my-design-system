## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `packages/ui/tokens.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components. The palette already has 3 tokens; the scan still found 9 hardcoded colours sitting next to them. Do not add more.

### Components nobody imports

- 8 components are defined but never imported (`<UiC0>`, `<UiC1>`, `<UiC2>`…). Before writing any new component, check this list first; adopt one or flag it for deletion instead of adding another.

### Spacing and sizing

- Avoid new one-off CSS spacing values; 10 off-scale values are already in play.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (18 static inline blocks already exist; do not add to them.)
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
