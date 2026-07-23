/**
 * Deterministic string -> hex color. Used as the default color for
 * special-query column values, which are completely dynamic (any column
 * can have any set of values) so they can't be predefined like the
 * fixed Status/Schedule/Invoice palettes. Same string always produces
 * the same color across sessions, and the result is a real hex string
 * (not an hsl() CSS string) so it's directly usable in an
 * <input type="color"> if the user wants to override it.
 */
export function hashToHexColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 60, 55);
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) =>
    Math.round(255 * f(x))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}
