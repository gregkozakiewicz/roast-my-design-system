## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- There is no token file yet. Until one exists, reuse the colours already in the codebase instead of introducing new ones (1 distinct colours are already in play).
- This repo uses shadcn/ui; its components live in `components/ui`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Button>` from `components/ui/button.tsx` (used 1x)

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
