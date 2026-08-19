## Design system rules

Follow these rules when writing or editing UI in this repo; derived from a scan on DATE.

### Colours and tokens

- Design tokens live in `site.css`. Reach for an existing token before inventing any value.
- Never hardcode colour values in components; add a token first if one is genuinely missing.

### Styling discipline

- Never write inline `style="..."` attributes for static values; styling belongs to classes and tokens where the system can see it.
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system --rules*
