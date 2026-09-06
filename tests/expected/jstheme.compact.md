## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `src/theme.ts`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components. The palette already has 22 tokens; the scan still found 5 hardcoded colours sitting next to them. Do not add more.
- This repo uses Mantine. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Card>` from `src/components/Card.tsx` (used 1x)

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
