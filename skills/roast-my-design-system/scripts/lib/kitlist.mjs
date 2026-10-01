/**
 * The component kits a file can import, by the package it imports them from.
 * One list for two jobs: naming a second kit beside the one a product is
 * built on (profiles/kit-common.mjs), and naming the kit an element comes
 * from in the live checks (lib/kitpaint.mjs). One list, so the report and
 * the live checks never disagree about whose component a line is on.
 *
 * Fourteen of 80 kit products import a second, different kit in earnest
 * (2026-10-01): Backstage (MUI and Backstage UI), OpenCTI (MUI and the
 * Filigran design system), SigNoz (Ant Design and SigNoz UI), Linode (MUI
 * and Akamai CDS). Only kits seen beside a kit product in the fleet are
 * listed; add another on evidence.
 *
 * A pattern is tested on the import source alone. A kit's icons, hooks and
 * utilities are not its components (Stirling-PDF imports only MUI's icons in
 * 83 files, Metabase @mantine/hooks in 227). A scope is never listed whole:
 * @filigran/chatbot is not the Filigran design system. Headless libraries
 * (react-aria-components, Radix, Headless UI, Base UI) bring no styling of
 * their own and are not kits. No imports here: both users import this file.
 */

export const KIT_LIST = [
  { name: 'MUI', re: /^@(?:mui|material-ui)\/(?!icons-material|icons(?:\/|$)|utils|types)/ },
  { name: 'Mantine', re: /^@mantine\/(?!hooks|form(?:\/|$)|colors-generator)/ },
  { name: 'Chakra', re: /^@chakra-ui\/(?!icons|utils)/ },
  // ProComponents are Ant Design's own (APISIX imports them in 13 of 16 files)
  { name: 'Ant Design', re: /^(?:antd(?:\/|$)|@ant-design\/pro-)/ },
  { name: 'Backstage UI', re: /^@backstage\/ui(?:\/|$)/ },
  { name: 'Akamai CDS', re: /^@akamai\/cds-/ },
  { name: 'Filigran Design System', re: /^@filigran\/design-system(?:\/|$)/ },
  { name: 'SigNoz UI', re: /^@signozhq\/ui(?:\/|$)/ },
  { name: 'Cube UI Kit', re: /^@cube-dev\/ui-kit(?:\/|$)/ },
  { name: 'TiDB Cloud UIKit', re: /^@tidbcloud\/uikit(?:\/|$)/ },
  { name: 'Grafana UI', re: /^@grafana\/ui(?:\/|$)/ },
  { name: 'Bootstrap', re: /^(?:reactstrap|react-bootstrap)(?:\/|$)/ },
  { name: 'NativeBase', re: /^native-base(?:\/|$)/ },
  { name: 'React Native Paper', re: /^react-native-paper(?:\/|$)/ },
  { name: 'Agenta UI', re: /^@agenta\/ui(?:\/|$)/ },
];

/** The kit an import source belongs to, or null. */
export function kitOfSource(source) {
  for (const k of KIT_LIST) if (k.re.test(source)) return k.name;
  return null;
}

const SOURCE_RE = /\bfrom\s+['"]([^'"\n]+)['"]|\brequire\(\s*['"]([^'"\n]+)['"]\s*\)/g;

/** Every import source in a file: from '…' and require('…'). */
export function importSources(code) {
  return [...code.matchAll(SOURCE_RE)].map((m) => m[1] ?? m[2]);
}

/** The package an import source comes from: @akamai/cds-components/react/Table is @akamai/cds-components. */
export function pkgRoot(source) {
  const parts = source.split('/');
  return source.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
