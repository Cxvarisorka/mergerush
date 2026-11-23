/** Colours, fonts and timings. Colours are 0xRRGGBB numbers. */

export const COLORS = {
  background: 0x15172b,
  board: 0x23264a,
  slot: 0x2e3262,
  panel: 0x262a52,
  dim: 0x07081a,
  text: 0xf2f2f7,
  muted: 0xa9aed6,
  accent: 0xffd166,
  button: 0x363c78,
  buttonPressed: 0x4a52a0,
  danger: 0xff6b7a,
  path: 0xffffff,
} as const;

export const FONT_FAMILY = '"Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';

const TILE_COLORS: readonly number[] = [
  0xf4e3b5, // 2
  0xffd166, // 4
  0xffa94d, // 8
  0xff7a59, // 16
  0xff5370, // 32
  0xe0457b, // 64
  0xb44bd6, // 128
  0x7c5cff, // 256
  0x3366e0, // 512
  0x1f9bb8, // 1024
  0x2fbf71, // 2048
  0xa3d93b, // 4096
  0xffffff, // 8192
];

const DARK_TEXT = 0x1b1b2f;
const LIGHT_TEXT = 0xffffff;

export function tileColor(value: number): number {
  const index = Math.max(0, Math.round(Math.log2(value)) - 1);
  return TILE_COLORS[Math.min(index, TILE_COLORS.length - 1)]!;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(color: number): number {
  return 0.2126 * channel((color >> 16) & 0xff) + 0.7152 * channel((color >> 8) & 0xff) + 0.0722 * channel(color & 0xff);
}

export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Text colour with the higher contrast against the tile. */
export function tileTextColor(value: number): number {
  const bg = tileColor(value);
  return contrastRatio(bg, DARK_TEXT) >= contrastRatio(bg, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
}

export const toCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

/** Font size for a tile label as a fraction of the tile side. */
export function tileFontScale(value: number): number {
  const digits = String(value).length;
  if (digits <= 2) return 0.46;
  if (digits === 3) return 0.38;
  if (digits === 4) return 0.3;
  return 0.24;
}

export const TIMING = {
  place: 110,
  mergeMove: 90,
  slidePerCell: 55,
  pop: 120,
  /** Upper bound for a whole move's playback. */
  maxMove: 1200,
} as const;
