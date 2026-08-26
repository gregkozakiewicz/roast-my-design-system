## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- There is no token file yet. Until one exists, reuse the colours already in the codebase instead of introducing new ones (24 distinct colours are already in play).
- Never eyeball a colour from memory: the scan found 51 nearly identical pairs (like #6b6f70 next to #6b6f71). Look the exact value up, or better, use its token.

### Known duplicates: do not make it worse

- `<Button>` exists in 2 places. Treat `components/Button.jsx` as canonical; do not import the other copy, and never create another.
- `<Card>` exists in 2 places. Treat `components/Card.jsx` as canonical; do not import the other copy, and never create another.

### Components nobody imports

- 12 components are defined but never imported (`<Lone0>`, `<Lone1>`, `<Lone10>`…). Before writing any new component, check this list first; adopt one or flag it for deletion instead of adding another.

### Spacing and sizing

- Avoid new one-off CSS spacing values; 25 off-scale values are already in play.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (54 static inline blocks already exist; do not add to them.)
- Never write !important; the scan found 25 declarations already. When a style does not apply, fix the selector or the source of the conflict instead of shouting over it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
