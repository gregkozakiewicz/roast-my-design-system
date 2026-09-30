## Design system rules

Too little styling found to derive repo-specific rules; these are universal defaults. Rescan once real UI lands.

### Styling discipline

- Never write `style={{ ... }}` for static values; styling belongs to classes and tokens where the system can see it.
  (12 static inline blocks already exist; do not add to them.)
- Before styling anything new, look at a neighbouring component and match how it does it. Consistency with the repo beats personal preference.

*Compact rules by roast-my-design-system ver. X; the full set with receipts: npx roast-my-design-system@latest --rules*
