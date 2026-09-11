## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- There is no token file yet. Until one exists, reuse the colours already in the codebase instead of introducing new ones (5 distinct colours are already in play).

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Card>` from `components/Card.tsx` (used 1x)

### Known duplicates: do not make it worse

- `<Button>` exists in 2 places. Treat `components/Button.tsx` as canonical; do not import the other copy, and never create another.

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.
- No new arbitrary bracket values (`p-[13px]`, `text-[10px]`). The scan found 3 already. If a value repeats, it is a decision: name it as a token instead of writing the bracket again.
- Avoid new one-off CSS spacing values; 3 off-scale values are already in play.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (1 static inline block already exist; do not add to them.)
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
