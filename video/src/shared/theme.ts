// RecipeReal brand palette, mirrored from mobile/src/theme/tokens.ts.
// "Orange" in the ad scripts maps to the terracotta accent.

export const brand = {
  // Light (kitchen) palette
  canvas: '#FBF8F3',
  surface: '#FFFFFF',
  surfaceSoft: '#F4EFE7',
  hairline: '#ECE4D8',
  hairlineStrong: '#E0D5C5',
  ink: '#241D17',
  inkSecondary: '#6E6357',
  inkFaint: '#9C9082',
  accent: '#BF552B',
  accentPress: '#A4471F',
  accentSoft: '#F8E9DE',
  amber: '#C8821F',
  amberSoft: '#F7EAD0',
  success: '#3F7D52',
  successSoft: '#E4ECDD',
  danger: '#B23A2E',
  dangerSoft: '#F6E1DD',

  // Dark (cinematic) palette — brightened accent holds contrast on near-black.
  darkCanvas: '#171310',
  darkSurface: '#221C16',
  darkSurfaceSoft: '#2C251D',
  cream: '#F3EDE6',
  creamSecondary: '#B5A897',
  creamFaint: '#877B6C',
  accentBright: '#D96E3F',
  amberBright: '#E0A447',
  successBright: '#6FA97F',
  dangerBright: '#D96B5C',
} as const;

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 1500; // 50s @ 30fps

/** seconds → frame */
export const at = (seconds: number): number => Math.round(seconds * FPS);
