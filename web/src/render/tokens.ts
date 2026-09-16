/**
 * Discrete Token Architecture — Exact Design Tokens
 * 
 * Strict palette:
 *   --ink:      #0D0D0E primary structure, text, active fills
 *   --ink-80:   #2E2E32
 *   --ink-60:   #5A5A5E
 *   --ink-40:   #8A8A8E
 *   --ink-20:   #BCBAB4
 *   --ink-10:   #D8D6CE borders, dividers
 *   --surface:  #EDECEA panel backgrounds
 *   --ground:   #F5F4F0 page / viewport background
 * 
 * State signals (strictly reserved):
 *   Green:  #1C5228 / mid: #2A7A3A / on: #D4EAD8 / text: #0A2E14 (ready / active / confirmed)
 *   Orange: #B24010 / mid: #D4640A / on: #F0E0CC / text: #3A1006 (busy / error / warning)
 */

export const INK_STEPS = [
  '#0D0D0E', // --ink
  '#2E2E32', // --ink-80
  '#5A5A5E', // --ink-60
  '#8A8A8E', // --ink-40
  '#BCBAB4', // --ink-20
  '#D8D6CE', // --ink-10
] as const;

export type InkStep = typeof INK_STEPS[number];

export const INK_RGB: readonly [number, number, number][] = [
  [13, 13, 14],    // #0D0D0E
  [46, 46, 50],    // #2E2E32
  [90, 90, 94],    // #5A5A5E
  [138, 138, 142], // #8A8A8E
  [188, 186, 180], // #BCBAB4
  [216, 214, 206], // #D8D6CE
];

export const SURFACE_COLOR = '#EDECEA';
export const GROUND_COLOR = '#F5F4F0';

// State-only signal tokens (never decorative)
export const STATE_GREEN = {
  base: '#1C5228',
  mid:  '#2A7A3A',
  on:   '#D4EAD8',
  text: '#0A2E14',
} as const;

export const STATE_ORANGE = {
  base: '#B24010',
  mid:  '#D4640A',
  on:   '#F0E0CC',
  text: '#3A1006',
} as const;

// 20-tier halftone radii (power-law ramp: r0=1.0, r19=10.0)
export const HALFTONE_RADII_20: readonly number[] = Array.from({ length: 20 }, (_, k) =>
  Number((1.0 + (k / 19) * 9.0).toFixed(2))
);

// Marching-squares isoline levels (normalized thresholds)
export const ISOLINE_LEVELS: readonly number[] = [0.16, 0.33, 0.50, 0.66, 0.83];

// ASCII luminance ramp (10 density characters)
export const ASCII_RAMP = ' .:-=+*#%@';

/**
 * Quantize a normalized value [0, 1] to one of the 6 discrete ink hex strings.
 */
export function quantizeTone(t: number): InkStep {
  const clamped = Math.max(0, Math.min(1, isNaN(t) ? 0 : t));
  const idx = Math.min(5, Math.floor(clamped * 6));
  return INK_STEPS[idx];
}

/**
 * Quantize a normalized value [0, 1] to one of the 6 discrete ink RGB triplets.
 */
export function quantizeToneRGB(t: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, isNaN(t) ? 0 : t));
  const idx = Math.min(5, Math.floor(clamped * 6));
  return [...INK_RGB[idx]];
}

/**
 * Quantize a normalized value [0, 1] to one of the 20 discrete halftone dot radii.
 */
export function quantizeDotRadius(t: number): number {
  const clamped = Math.max(0, Math.min(1, isNaN(t) ? 0 : t));
  const idx = Math.min(19, Math.floor(clamped * 20));
  return HALFTONE_RADII_20[idx];
}
