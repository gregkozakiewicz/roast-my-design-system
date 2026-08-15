#!/usr/bin/env node
/**
 * Card — a shareable roast card from a scan summary. Pure SVG built at scan
 * time: no browser, no server, no dependency, nothing leaves the machine.
 * 1200x630 (the OG-image ratio), dark glass look matching the report.
 *
 *   node src/card/index.mjs <summary.json> --out roast-card.svg
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const inPath = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : null;
if (!inPath) { console.error('Usage: node src/card/index.mjs <summary.json> --out roast-card.svg'); process.exit(1); }
const outPath = resolve(arg('out', 'roast-card.svg'));

const s = JSON.parse(readFileSync(inPath, 'utf8'));
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const score = s.score ?? 0;
const band = score >= 85 ? 'good' : score >= 55 ? 'warn' : 'bad';
const COLORS = { good: '#2dd4bf', warn: '#fbbf24', bad: '#fb7185' };
const scoreColor = COLORS[band];

// top findings: bad tiles first, then warn, by how far past zero/ideal they read
const order = { bad: 0, warn: 1, good: 2, info: 3 };
const tiles = [...(s.tiles ?? [])].sort((a, b) => (order[a.health] ?? 9) - (order[b.health] ?? 9));
const findings = tiles.filter((t) => t.health === 'bad' || t.health === 'warn').slice(0, 3);
const allGood = findings.length === 0;

const repoName = esc((s.repo ?? 'this repo').split('/').slice(-2).join('/'));
const date = new Date().toISOString().slice(0, 10);
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'SF Mono', 'Cascadia Code', Consolas, Menlo, monospace";

const rows = allGood
  ? `<text x="620" y="300" font-family="${SANS}" font-size="30" font-weight="600" fill="#e6e9ef">nothing over the line</text>
     <text x="620" y="344" font-family="${SANS}" font-size="22" fill="#8b93a7">this repo is in better shape than most of the internet</text>`
  : findings.map((t, i) => {
    const y = 262 + i * 74;
    const c = COLORS[t.health] ?? '#8b93a7';
    return `<circle cx="632" cy="${y - 9}" r="7" fill="${c}"/>
      <text x="660" y="${y}" font-family="${SANS}" font-size="30" font-weight="700" fill="#e6e9ef">${esc(t.value)}</text>
      <text x="660" y="${y + 32}" font-family="${SANS}" font-size="21" fill="#8b93a7">${esc(t.label)}</text>`;
  }).join('\n');

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="blob1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${scoreColor}" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="${scoreColor}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b0d11"/>
  <circle cx="1080" cy="80" r="360" fill="url(#blob1)"/>
  <circle cx="140" cy="580" r="330" fill="url(#blob2)"/>
  <rect x="44" y="44" width="1112" height="542" rx="28" fill="#11141a" fill-opacity="0.72" stroke="#272c37" stroke-width="1.5"/>

  <text x="96" y="132" font-family="${MONO}" font-size="21" letter-spacing="3" fill="#8b93a7">${repoName.toUpperCase()}</text>
  <text x="1104" y="132" font-family="${MONO}" font-size="18" letter-spacing="2" fill="#5a6172" text-anchor="end">DESIGN SYSTEM ROAST</text>

  <text x="96" y="360" font-family="${SANS}" font-size="190" font-weight="800" fill="${scoreColor}">${score}</text>
  <text x="${96 + String(score).length * 105 + 14}" y="360" font-family="${SANS}" font-size="52" font-weight="600" fill="#5a6172">/100</text>
  <text x="96" y="416" font-family="${SANS}" font-size="24" fill="#8b93a7">design system health</text>

  <line x1="560" y1="200" x2="560" y2="430" stroke="#272c37" stroke-width="1.5"/>
  <text x="620" y="212" font-family="${MONO}" font-size="17" letter-spacing="2.5" fill="#5a6172">${allGood ? 'THE VERDICT' : 'WHAT YOUR AGENT LEARNS FROM'}</text>
  ${rows}

  <line x1="96" y1="486" x2="1104" y2="486" stroke="#272c37" stroke-width="1.5"/>
  <text x="96" y="536" font-family="${MONO}" font-size="20" fill="#8b93a7">npx roast-my-design-system</text>
  <text x="1104" y="536" font-family="${MONO}" font-size="17" fill="#5a6172" text-anchor="end">scanned ${date} · ver. ${esc(s.version ?? '')}</text>
</svg>
`;
writeFileSync(outPath, svg);
console.log(`✓ Roast card: ${outPath}`);
console.log(`  1200x630, pure SVG. Post it, or screenshot it for platforms that reject SVG.`);
