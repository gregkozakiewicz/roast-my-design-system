## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `src/site.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components. The palette already has 8 tokens; the scan still found 13 hardcoded colours sitting next to them. Do not add more.
- Never eyeball a colour from memory: the scan found 1 nearly identical pair (like #16161a next to #101112). Look the exact value up, or better, use its token.

### Styling discipline

- Never write inline `style="..."` attributes for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system@latest --rules*
