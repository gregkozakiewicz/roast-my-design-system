## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `src/styles/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components; add a token first if one is genuinely missing.
- This repo uses shadcn/ui; its components live in `src/components/ui`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Card>` from `src/components/ui/card.tsx` (used 3x)
  - `<Badge>` from `src/components/ui/badge.tsx` (used 2x)
  - `<Button>` from `src/components/ui/button.tsx` (used 2x)
  - `<Input>` from `src/components/ui/input.tsx` (used 1x)
  - `<Label>` from `src/components/ui/label.tsx` (used 1x)

### Catalogue components already installed

- 5 components sit installed and unused in `src/components/ui` (`<Checkbox>`, `<Dialog>`, `<DropdownMenu>`…). Reach for one of these before building your own version of the same thing. Do not delete them to tidy up.

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### shadcn: the components and the theme

- This is a shadcn install (style `new-york`, base colour slate). The theme is a set of CSS variables in `src/styles/globals.css`: background, foreground, primary, muted, border and the rest, each with a light and a dark value. Change a colour there, never in a component.
- Use the semantic classes the theme gives you (`bg-background`, `text-muted-foreground`, `border-border`), never a palette colour like `bg-blue-500` or `text-gray-600`, and never a hand-written `dark:` colour. The variables already carry both modes.
  (23 palette colours already sit in own code, `text-red-600` ×2, `text-gray-500` ×2, `text-green-500` ×1; do not add to them.)
- Before adding classes to a shadcn component, use one of its variants (`variant="outline"`, `size="sm"`). `className` on a shadcn component is for layout only: width, margin, position. Never colour, never typography.
  (3 shadcn components already restyled through className, like `<Card className="bg-blue-100 text-blue-900 font-bold">` and `<Badge className="bg-gray-200 text-gray-700">`; do not add to them.)
- `src/components/ai-elements` is an installed registry (added through the shadcn CLI, not written here). Treat it like `src/components/ui`: reach for what is there before building your own, and do not copy the 3 palette colours inside into own code.
- Edit the component you own in `src/components/ui`. Never build a second one beside it under another name. A wrapper that composes shadcn components is fine; a second implementation is not.
- Merge classes with `cn()`. Never concatenate strings and never write a ternary inside a className string.
- Add a component with `npx shadcn@latest add <name>`, then edit it. To see what changed upstream, run `npx shadcn@latest add <name> --diff`.
- Radius comes from the `--radius` variable and the scale derived from it; never a bracket value. Never change `--spacing`: it resizes every gap in the app.
- Small habits shadcn expects: `gap-*` not `space-x/y-*`; `size-4` not `w-4 h-4`; `truncate` for one-line clipping; no `z-index` on Dialog, Sheet, Popover or Tooltip, they stack themselves; icons from the project's own icon library only.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
