## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `app/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components; add a token first if one is genuinely missing.
- This repo uses a Tailwind theme. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Panel>` from `components/panel.tsx` (used 1x)

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### The Tailwind theme

- This repo names its colours in `app/globals.css`: `surface`, `surface-raised`, `ink`, `ink-quiet`, `brand`, `brand-strong`, `edge`, `danger`. Use them as classes (`bg-surface`), never a palette class like `bg-blue-500` or `text-gray-600` where one of these exists.
- The scan found 4 palette classes in own code (`text-slate-500`, `bg-blue-100`, `text-blue-700`). Do not add more; if a colour you need is missing, add it to the theme once and use it by name.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
