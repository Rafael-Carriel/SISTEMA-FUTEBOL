/**
 * Color helpers used by the pitch views to keep team markers legible on any
 * surface (grass, dark cards) regardless of the configured team color.
 */

/** Parse `#rgb` / `#rrggbb` into 0-255 channels, or `null` when invalid. */
function parseHex(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const int = Number.parseInt(full, 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

/** WCAG relative luminance (0 = black, 1 = white). `null` for invalid input. */
export function relativeLuminance(hex: string): number | null {
  const channels = parseHex(hex);
  if (!channels) return null;
  const linear = channels.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/**
 * Ink color to paint **on top of** `hex` so small bold text stays readable:
 * light backgrounds get near-black ink, dark backgrounds get white ink.
 */
export function readableTextColor(hex: string): string {
  const luminance = relativeLuminance(hex);
  if (luminance === null) return '#ffffff';
  return luminance > 0.45 ? '#0b1710' : '#ffffff';
}

/**
 * Accent color to paint `hex` **on a dark surface**: very dark team colors are
 * mixed toward white so the label never disappears into the card background.
 */
export function teamAccent(hex: string): string {
  const luminance = relativeLuminance(hex);
  if (luminance !== null && luminance < 0.14) return `color-mix(in srgb, ${hex} 62%, #ffffff)`;
  return hex;
}
