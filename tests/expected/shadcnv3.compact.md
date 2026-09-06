## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `styles/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components. The palette already has 14 tokens; the scan still found 2 hardcoded colours sitting next to them. Do not add more.
- Never eyeball a colour from memory: the scan found 1 nearly identical pair (like hsl(210 40% 96.1%) next to #f2f6fa). Look the exact value up, or better, use its token.
- This repo uses shadcn/ui; its components live in `components/ui`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Button>` from `components/ui/button.tsx` (used 2x)
  - `<Card>` from `components/ui/card.tsx` (used 2x)

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
