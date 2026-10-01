## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `apps/web/modules/ui/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components; add a token first if one is genuinely missing.
- This repo uses shadcn/ui; its components live in `apps/web/modules/ui/components`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Button>` from `apps/web/modules/ui/components/button.tsx` (used 1x)

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### shadcn: the components and the theme

- This is a shadcn install (style `new-york`, base colour slate). The theme is a set of CSS variables in `apps/web/modules/ui/globals.css`: background, foreground, primary, muted, border and the rest, each with a light and a dark value. Change a colour there, never in a component.
- `apps/web/modules/ui/globals.css` defines none of shadcn's colour variables, so `bg-background` and `text-muted-foreground` have nothing behind them here. Until the theme variables are adopted, stay with the palette classes the surrounding file already uses; do not introduce semantic classes with no variable behind them, and do not add a second palette.
  (16 palette colours already sit in own code, `text-slate-500` ×7, `text-slate-900` ×3, `bg-slate-50` ×2; do not add to them.)
- Before adding classes to a shadcn component, use one of its variants (`variant="outline"`, `size="sm"`). `className` on a shadcn component is for layout only: width, margin, position. Never colour, never typography.
- Edit the component you own in `apps/web/modules/ui/components`. Never build a second one beside it under another name. A wrapper that composes shadcn components is fine; a second implementation is not.
- Merge classes with `cn()`. Never concatenate strings and never write a ternary inside a className string.
- Add a component with `npx shadcn@latest add <name>`, then edit it. To see what changed upstream, run `npx shadcn@latest add <name> --diff`.
- In your own code, do not write a bracket value: use a step from the scale, or a variable from the theme file. If a value you need is missing, add it to the theme file once and use it by name.
- Radius comes from the `--radius` variable and the scale derived from it; never a bracket value. Never change `--spacing`: it resizes every gap in the app.
- Small habits shadcn expects: `gap-*` not `space-x/y-*`; `size-4` not `w-4 h-4`; `truncate` for one-line clipping; no `z-index` on Dialog, Sheet, Popover or Tooltip, they stack themselves; icons from the project's own icon library only.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (2 static inline blocks already exist; do not add to them.)
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system@latest --rules*
