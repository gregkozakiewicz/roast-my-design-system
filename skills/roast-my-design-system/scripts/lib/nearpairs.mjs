/**
 * Near-identical colour pairs (#f5f5f5 next to #f6f6f6): copy-paste, not
 * decisions. Hex-parseable colours only; a pair is "near" when every channel
 * sits within 8 of its twin and alpha matches. Two TOKENS sitting close are a
 * designed ramp (every good grey scale has near neighbours) and are skipped;
 * drift needs at least one hardcoded stray. Shared by diagnose and rules.
 */
export function hexRgb(v) {
  const m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (!m) return null;
  let x = m[1];
  if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join('');
  if (x.length !== 6 && x.length !== 8) return null;
  return { r: parseInt(x.slice(0, 2), 16), g: parseInt(x.slice(2, 4), 16), b: parseInt(x.slice(4, 6), 16),
    a: x.length === 8 ? x.slice(6, 8) : 'ff' };
}

export function nearColorPairs(colorList) {
  const hexes = colorList.map((c) => ({ ...c, rgb: hexRgb(c.value) })).filter((c) => c.rgb);
  const pairs = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      const a = hexes[i].rgb, b = hexes[j].rgb;
      if (a.a !== b.a) continue;
      if (hexes[i].isToken && hexes[j].isToken) continue;
      const d = Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
      if (d > 0 && d <= 8) pairs.push({ a: hexes[i], b: hexes[j], d });
    }
  }
  return pairs.sort((x, y) => (y.a.count + y.b.count) - (x.a.count + x.b.count));
}
