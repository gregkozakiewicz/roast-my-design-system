/**
 * Near-identical colour pairs (#f5f5f5 next to #f6f6f6): copy-paste, not
 * decisions. Hex-parseable colours only; a pair is "near" when every channel
 * sits within 8 of its twin and alpha matches. Two TOKENS sitting close are
 * usually a designed ramp (every good grey scale has near neighbours) and are
 * skipped; drift needs at least one hardcoded stray. The exception (8.6.0):
 * two tokens named for different roles (overdue-soft next to warning-soft) are
 * one colour under two names. Without it, a stray "fixed" by minting a twin
 * token left the count and the score went up (Ledgerly, 2026-09-24).
 * Shared by diagnose and rules.
 */
import { parseColor } from './color.mjs';
import { canonical } from './color.mjs';
import { isRoleName, familyOf, tokenTwinColours } from './tokentwins.mjs';

// Two token colours whose names are roles in different families: a twin.
// Colours harvested before 8.6.0 carry no names and never pair this way.
// Same test as the live check (lib/tokentwins.mjs), so both say the same.
function twinTokens(x, y) {
  const a = (x.names ?? []).filter(isRoleName), b = (y.names ?? []).filter(isRoleName);
  return a.some((n) => b.some((m) => familyOf(n) !== familyOf(m)))
    && tokenTwinColours(canonical(x.value), canonical(y.value));
}

// Kept under its historical name (the MCP engine imports it): since 5.10.0 it
// parses every literal colour space, not just hex, so an hsl or oklch
// palette gets its twins found like a hex one. Alpha is rounded so that
// float noise never splits two identical alphas into "different".
export function hexRgb(v) {
  const c = parseColor(v);
  return c ? { r: c.r, g: c.g, b: c.b, a: Math.round(c.a * 100) / 100 } : null;
}

export function nearColorPairs(colorList) {
  const hexes = colorList.map((c) => ({ ...c, rgb: hexRgb(c.value) })).filter((c) => c.rgb);
  const pairs = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      const a = hexes[i].rgb, b = hexes[j].rgb;
      if (a.a !== b.a) continue;
      const tokens = hexes[i].isToken && hexes[j].isToken;
      if (tokens && !twinTokens(hexes[i], hexes[j])) continue;
      // Entries are distinct strings by construction, so d = 0 means the same
      // colour written in two notations (hsl token, rgb stray): the strongest
      // twin there is, not a non-event. Rounded so the report never prints
      // 7.9199999.
      const d = Math.round(Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) * 10) / 10;
      if (d <= 8) pairs.push({ a: hexes[i], b: hexes[j], d, ...(tokens ? { tokens } : {}) });
    }
  }
  // One twin per stray. A stray sitting inside a dense token ramp is within 8
  // of many tokens, and counting every such pair turned one #eeeeee into
  // eight findings (telekom/scale) and one Spectrum stray into dozens. The
  // finding is "this stray has a token twin", and the fix is one redirect,
  // so each stray keeps only its closest twin (a stray-stray pair survives
  // when it is the closest for either side).
  // Twin tokens are thinned the same way among themselves: each token keeps
  // its closest twin.
  const best = new Map(), bestTwin = new Map();
  for (const p of pairs) {
    for (const side of ['a', 'b']) {
      const c = p[side];
      const into = p.tokens ? bestTwin : best;
      if (c.isToken && !p.tokens) continue;
      const cur = into.get(c.value);
      if (!cur || p.d < cur.d) into.set(c.value, p);
    }
  }
  const kept = [...new Set([...best.values(), ...bestTwin.values()])];
  return kept.sort((x, y) => (y.a.count + y.b.count) - (x.a.count + x.b.count));
}
