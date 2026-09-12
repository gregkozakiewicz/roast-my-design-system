## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `app/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components; add a token first if one is genuinely missing.
- This repo uses shadcn/ui; its components live in `components/ui`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Badge>` from `components/ui/badge.tsx` (used 1x)
  - `<Button>` from `components/ui/button.tsx` (used 1x)
  - `<Card>` from `components/ui/card.tsx` (used 1x)
  - `<Input>` from `components/ui/input.tsx` (used 1x)
  - `<Label>` from `components/ui/label.tsx` (used 1x)

### Catalogue components already installed

- 4 components sit installed and unused in `components/ui` (`<Checkbox>`, `<Dialog>`, `<Select>`…). Reach for one of these before building your own version of the same thing. Do not delete them to tidy up.

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### shadcn: the components and the theme

- This is a shadcn install (style `base-nova`, base colour mist). The theme is a set of CSS variables in `app/globals.css`: background, foreground, primary, muted, border and the rest, each with a light and a dark value. Change a colour there, never in a component.
- Use the semantic classes the theme gives you (`bg-background`, `text-muted-foreground`, `border-border`), never a palette colour like `bg-blue-500` or `text-gray-600`, and never a hand-written `dark:` colour. The variables already carry both modes.
- Before adding classes to a shadcn component, use one of its variants (`variant="outline"`, `size="sm"`). `className` on a shadcn component is for layout only: width, margin, position. Never colour, never typography.
- Edit the component you own in `components/ui`. Never build a second one beside it under another name. A wrapper that composes shadcn components is fine; a second implementation is not.
- Merge classes with `cn()`. Never concatenate strings and never write a ternary inside a className string.
- Add a component with `npx shadcn@latest add <name>`, then edit it. To see what changed upstream, run `npx shadcn@latest add <name> --diff`.
- In your own code, do not write a bracket value: use a step from the scale, or a variable from the theme file. If a value you need is missing, add it to the theme file once and use it by name.
- Radius comes from the `--radius` variable and the scale derived from it; never a bracket value. Never change `--spacing`: it resizes every gap in the app.
- Small habits shadcn expects: `gap-*` not `space-x/y-*`; `size-4` not `w-4 h-4`; `truncate` for one-line clipping; no `z-index` on Dialog, Sheet, Popover or Tooltip, they stack themselves; icons from the project's own icon library only.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
