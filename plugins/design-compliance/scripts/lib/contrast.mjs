// WCAG color math + color parsing helpers. Zero dependencies.
// Reference: https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio

/** Parse a CSS color string into {r,g,b} (0-255) or null if unsupported. */
export function parseColor(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();

  // #rgb / #rgba / #rrggbb / #rrggbbaa
  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length === 6 || h.length === 8) {
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
    return null;
  }

  // rgb()/rgba() including modern slash syntax
  const rgb = s.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const parts = rgb[1].split(/[,\/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const ch = (v) => (v.endsWith('%') ? Math.round((parseFloat(v) / 100) * 255) : parseInt(v, 10));
      const r = ch(parts[0]), g = ch(parts[1]), b = ch(parts[2]);
      if ([r, g, b].every((n) => Number.isFinite(n))) return { r, g, b };
    }
    return null;
  }

  // A few common named colors (enough for contrast checks on demo/markup).
  const named = {
    white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000',
    blue: '#0000ff', gray: '#808080', grey: '#808080', silver: '#c0c0c0',
    transparent: null,
  };
  if (s in named) return named[s] ? parseColor(named[s]) : null;
  return null;
}

/** Normalize any parseable color to lowercase #rrggbb, or null. */
export function toHex(input) {
  const c = parseColor(input);
  if (!c) return null;
  const h = (n) => n.toString(16).padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

function channelToLinear(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.1. */
export function relativeLuminance({ r, g, b }) {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Contrast ratio (1..21) between two colors given as {r,g,b} or CSS strings. */
export function contrastRatio(a, b) {
  const ca = typeof a === 'string' ? parseColor(a) : a;
  const cb = typeof b === 'string' ? parseColor(b) : b;
  if (!ca || !cb) return null;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Euclidean distance in RGB space (rough perceptual proxy). */
function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * Nearest brand color to a given color.
 * @param {string} input  color string
 * @param {Array<{name:string, hex:string}>} palette
 * @returns {{name:string, hex:string, distance:number}|null}
 */
export function nearestBrandColor(input, palette) {
  const c = parseColor(input);
  if (!c) return null;
  let best = null;
  for (const entry of palette) {
    const pc = parseColor(entry.hex);
    if (!pc) continue;
    const d = colorDistance(c, pc);
    if (!best || d < best.distance) best = { name: entry.name, hex: entry.hex, distance: d };
  }
  return best;
}
