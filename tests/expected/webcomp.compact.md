## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- This system's tokens answer to the `--acme-*` namespace. Reach for an existing `var(--...)` from them before inventing any value.
- `--old-*` is also present in the code. Before writing new references to it, check whether this repo treats it as current or as a migration source; when unsure, prefer `--acme-*`.
- Design tokens live in `styles/main.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components. The palette already has 10 tokens; the scan still found 3 hardcoded colours sitting next to them. Do not add more.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Button>` from `design-system/button.tsx` (used 3x)
  - `<Card>` from `design-system/card.tsx` (used 2x)
  - `<ChipEl>` from `design-system/chip.ts` (used 1x)
  - `<Icon>` from `design-system/icon.ts` (used 1x)
  - `<Panel>` from `design-system/panel.tsx` (used 1x)

### Spacing and sizing

- Avoid new one-off CSS spacing values; 3 off-scale values are already in play.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
