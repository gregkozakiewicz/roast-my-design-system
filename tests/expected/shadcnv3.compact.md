## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `styles/globals.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components. The palette already has 7 tokens; the scan still found 2 hardcoded colours sitting next to them. Do not add more.
- Never eyeball a colour from memory: the scan found 1 nearly identical pair (like hsl(210 40% 96.1%) next to #f2f6fa). Look the exact value up, or better, use its token.
- This repo uses shadcn/ui; its components live in `components/ui`. Prefer extending it over building parallel pieces.

### Canonical components

- Use these existing components instead of writing new ones:
  - `<Button>` from `components/ui/button.tsx` (used 2x)
  - `<Card>` from `components/ui/card.tsx` (used 2x)

### Catalogue components already installed

- 6 components sit installed and unused in `components/ui` (`<Accordion>`, `<Calendar>`, `<Dialog>`…). Reach for one of these before building your own version of the same thing. Do not delete them to tidy up.

### Spacing and sizing

- Stay on the Tailwind spacing scale. If a gap looks wrong on a scale step, flag it instead of nudging by a pixel.

### shadcn: the kit and its theme

- This is a shadcn install (style `default`, base colour slate). The theme is a set of named rows in `styles/globals.css`: background, foreground, primary, muted, border and the rest, each for light and dark. Change a colour there, never in a component.
- Use the semantic utilities the rows give you (`bg-background`, `text-muted-foreground`, `border-border`), never a palette colour like `bg-blue-500` or `text-gray-600`, and never a hand-written `dark:` colour. The rows already carry both modes.
- Before adding classes to a kit component, pick one of its variants (`variant="outline"`, `size="sm"`). `className` on a kit component is for layout only: width, margin, position. Never colour, never typography.
- Edit the component you own in `components/ui`. Never build a second one next door under another name. A wrapper that composes kit components is fine; a sibling re-implementation is not.
- Merge classes with `cn()`. Never concatenate strings and never write a ternary inside a className string.
- Add a component with `npx shadcn@latest add <name>`, then edit it. To see what changed upstream, run `npx shadcn@latest add <name> --diff`.
- Radius comes from the `--radius` row and its derived scale; never a bracket value. Never change `--spacing`: it silently resizes every gap in the app.
- Small habits the kit expects: `gap-*` not `space-x/y-*`; `size-4` not `w-4 h-4`; `truncate` for one-line clipping; no `z-index` on Dialog, Sheet, Popover or Tooltip, they stack themselves; icons from the project's own icon library only.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
