## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- This system's tokens answer to the `--neutral-*` namespace. Reach for an existing `var(--...)` from them before inventing any value.
- Design tokens live in `src/app/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components; add a token first if one is genuinely missing.
- This repo uses shadcn/ui; its components live in `src/components/ui`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<SiteRow>` from `src/components/shared/SiteRow.tsx` (used 2x)
  - `<Button>` from `src/components/ui/button.tsx` (used 1x)
  - `<Card>` from `src/components/ui/card.tsx` (used 1x)
  - `<Usage>` from `src/components/shared/Usage.tsx` (used 1x)

### Catalogue components already installed

- 6 components sit installed and unused in `src/components/ui` (`<Badge>`, `<Dialog>`, `<Input>`…). Reach for one of these before building your own version of the same thing. Do not delete them to tidy up.

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### shadcn: the components and the theme

- This is a shadcn install (style `new-york`, base colour neutral).
- shadcn is installed without CSS variables here (components.json: cssVariables false), so the components paint with Tailwind classes. The theme file, `src/app/globals.css`, gives neutral-50 to neutral-950 this repo's own values, and names destructive, accent and the chart colours. Use those classes. Never a palette colour the theme does not own, such as `text-red-500`; use `text-destructive`, or add the colour to the theme once.
  (3 palette colours the theme does not own already sit in own code, `text-red-500` ×2, `bg-emerald-500` ×1; do not add to them.)
- Before adding classes to a shadcn component, use one of its variants (`variant="outline"`, `size="sm"`). `className` on a shadcn component is for layout only: width, margin, position. Never colour, never typography.
  (1 shadcn component already recoloured through className, like `<Card className="border-neutral-200">`; do not add to them.)
- Edit the component you own in `src/components/ui`. Never build a second one beside it under another name. A wrapper that composes shadcn components is fine; a second implementation is not.
- Merge classes with `cn()`. Never concatenate strings and never write a ternary inside a className string.
- Add a component with `npx shadcn@latest add <name>`, then edit it. To see what changed upstream, run `npx shadcn@latest add <name> --diff`.
- In your own code, do not write a bracket value: use a step from the scale, or a variable from the theme file. If a value you need is missing, add it to the theme file once and use it by name.
- Radius comes from the `--radius` variable and the scale derived from it; never a bracket value. Never change `--spacing`: it resizes every gap in the app.
- Small habits shadcn expects: `gap-*` not `space-x/y-*`; `size-4` not `w-4 h-4`; `truncate` for one-line clipping; no `z-index` on Dialog, Sheet, Popover or Tooltip, they stack themselves; icons from the project's own icon library only.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system@latest --rules*
