import { loadFont as loadManrope } from "@remotion/google-fonts/Manrope";
import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";

const manrope = loadManrope("normal", {
  weights: ["400", "500", "600", "700", "800"],
});

const fraunces = loadFraunces("normal", {
  weights: ["500", "600", "700"],
});

export const FONTS = {
  sans: manrope.fontFamily,
  serif: fraunces.fontFamily,
} as const;

export interface Palette {
  dark: boolean;
  bg: string;
  /** soft ambient blobs behind content */
  glow1: string;
  glow2: string;
  panel: string;
  panelBorder: string;
  ink: string;
  sub: string;
  faint: string;
  accent: string;
  accent2: string;
  soft: string;
  good: string;
  bad: string;
  onAccent: string;
}

/** Ad 1 — warm light, empathetic */
export const LIGHT: Palette = {
  dark: false,
  bg: "#FAF4EC",
  glow1: "rgba(232, 161, 60, 0.16)",
  glow2: "rgba(217, 91, 54, 0.10)",
  panel: "#FFFDF8",
  panelBorder: "#EADCC8",
  ink: "#33241A",
  sub: "#6E574B",
  faint: "#A6907E",
  accent: "#D95B36",
  accent2: "#E8A13C",
  soft: "#F4E7D4",
  good: "#4E8A5D",
  bad: "#C4472F",
  onAccent: "#FFF8F0",
};

/** Ad 2 — warm dark, energetic */
export const DARK: Palette = {
  dark: true,
  bg: "#191310",
  glow1: "rgba(240, 166, 60, 0.10)",
  glow2: "rgba(232, 99, 44, 0.08)",
  panel: "#261D15",
  panelBorder: "#3D2F23",
  ink: "#F7EEE2",
  sub: "#CBB7A4",
  faint: "#8C7663",
  accent: "#F0A63C",
  accent2: "#E8632C",
  soft: "#32261C",
  good: "#8CC49A",
  bad: "#E2604A",
  onAccent: "#241A10",
};
