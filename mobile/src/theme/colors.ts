import { Color, StepTone } from "./tokens";

/**
 * Scheme-resolved palette. `LightColors` mirrors the classic `Color` tokens
 * exactly (plus the `StepTone` map); `DarkColors` is the warm dark counterpart.
 * Components consume these through `useThemeColors()` from the theme provider.
 */
export interface ThemeColors {
  canvas: string;
  surface: string;
  surfaceSoft: string;
  hairline: string;
  hairlineStrong: string;
  ink: string;
  inkSecondary: string;
  inkFaint: string;
  accent: string;
  accentPress: string;
  accentSoft: string;
  amber: string;
  amberSoft: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  /** Timing/calibration accent — the "honest times" teal. */
  timing: string;
  timingSoft: string;
  scrim: string;
  /** Tone map for step badges: active / passive / cleanup / default. */
  stepTones: Record<string, { bg: string; fg: string }>;
}

/** Light palette — identical values to the classic `Color` + `StepTone` tokens. */
export const LightColors: ThemeColors = {
  ...Color,
  stepTones: { ...StepTone },
};

/**
 * Warm dark palette. Keeps the new terracotta identity: near-black browns for
 * canvas/surface, cream ink, a brightened terracotta accent and a brightened
 * timing teal so both hold contrast on dark backgrounds.
 */
export const DarkColors: ThemeColors = {
  canvas: "#171310",
  surface: "#221C16",
  surfaceSoft: "#2C251D",
  hairline: "#332B22",
  hairlineStrong: "#443A2E",
  ink: "#F3EDE6",
  inkSecondary: "#B5A897",
  inkFaint: "#877B6C",
  accent: "#F07A45",
  accentPress: "#E86A33",
  accentSoft: "#3A2417",
  amber: "#E0A447",
  amberSoft: "#3A2E18",
  success: "#5CA576",
  successSoft: "#243326",
  danger: "#E46B67",
  dangerSoft: "#3E211D",
  timing: "#3E9B96",
  timingSoft: "#1E3433",
  scrim: "rgba(0,0,0,0.6)",
  stepTones: {
    active: { bg: "#3A2E18", fg: "#E8C87E" },
    passive: { bg: "#243326", fg: "#9CC7A8" },
    cleanup: { bg: "#322640", fg: "#C0A6D6" },
    default: { bg: "#2C251D", fg: "#B5A897" },
  },
};
