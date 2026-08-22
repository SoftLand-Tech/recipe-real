import { Easing } from "remotion";

/**
 * RecipeReal ad design system.
 * Palette mirrors mobile/src/theme/tokens.ts so the mockups read as the real app.
 */

export const C = {
  // Stage (warm dark — app DarkColors.canvas family)
  stage: "#171310",
  stageDeep: "#0E0B09",
  stageLift: "#221C16",
  // Light UI (app LightColors)
  canvas: "#FAF8F5",
  surface: "#FFFFFF",
  surfaceSoft: "#F4EFE7",
  hairline: "#E8E1DC",
  hairlineStrong: "#D9CFC8",
  ink: "#211A17",
  inkSecondary: "#756B66",
  inkFaint: "#9C938E",
  // Brand
  accent: "#E86A33",
  accentBright: "#F07A45",
  accentSoft: "#FBE9DE",
  amber: "#D69A2D",
  amberSoft: "#F8EDD4",
  success: "#3D8B5A",
  danger: "#D9534F",
  // Timing (cooking-mode teal)
  timing: "#287C78",
  timingBright: "#3E9B96",
  timingSoft: "#DFEEED",
  // Cream text on dark
  cream: "#F3EDE6",
  creamDim: "#B5A897",
  creamFaint: "#877B6C",
  // Step tones (app StepTone)
  stepActive: { bg: "#F7EAD0", fg: "#8A5A12" },
  stepPassive: { bg: "#E4ECDD", fg: "#4A6A45" },
  stepCleanup: { bg: "#ECE3EF", fg: "#6A4A78" },
  stepDefault: { bg: "#F4EFE7", fg: "#6E6357" },
} as const;

/** Motion language lifted from the reference ad. */
export const EASE = {
  /** Snappy settle — most entrances. */
  outExpo: Easing.bezier(0.16, 1, 0.3, 1),
  /** Symmetric drift — camera-ish moves. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Overshoot — chips and badges popping in. */
  overshoot: Easing.bezier(0.34, 1.56, 0.64, 1),
  /** Accel out — elements leaving. */
  inBoost: Easing.bezier(0.7, 0, 0.84, 0),
} as const;

/** Deterministic PRNG — particles and drifts must not flicker between frames. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Format seconds as M:SS (cook-screen stopwatch format). */
export function formatMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Recipes shown in the ad — names cleaned up from the Food.com dataset rows. */
export interface Food {
  file: string;
  title: string;
  minutes: number;
  rating: number;
}

export const FOODS: Food[] = [
  { file: "potroast.jpg", title: "Simple Pot Roast", minutes: 180, rating: 5.0 },
  { file: "biryani.jpg", title: "Chicken Biryani", minutes: 75, rating: 4.8 },
  { file: "drumsticks.jpg", title: "Spicy Drumsticks", minutes: 50, rating: 4.9 },
  { file: "focaccia.jpg", title: "Focaccia", minutes: 90, rating: 4.8 },
  { file: "moussecake.jpg", title: "Almond Mousse Cake", minutes: 55, rating: 4.9 },
  { file: "ratatouille.jpg", title: "Ratatouille", minutes: 240, rating: 4.8 },
  { file: "friedrice.jpg", title: "Fried Rice", minutes: 30, rating: 4.7 },
  { file: "greeksalad.jpg", title: "Greek Salad", minutes: 20, rating: 4.5 },
  { file: "lambpasta.jpg", title: "Lamb & Leek Pasta", minutes: 45, rating: 4.8 },
  { file: "currypasta.jpg", title: "Curried Pasta Salad", minutes: 25, rating: 4.6 },
  { file: "pastasalad.jpg", title: "Ranch Pasta Salad", minutes: 30, rating: 4.6 },
  { file: "soup.jpg", title: "5-Can Soup", minutes: 20, rating: 4.4 },
  { file: "frittata.jpg", title: "Zucchini Frittata", minutes: 40, rating: 4.6 },
  { file: "eggdrop.jpg", title: "Egg Drop Soup", minutes: 15, rating: 4.5 },
  { file: "vegfriedrice.jpg", title: "Veggie Fried Rice", minutes: 25, rating: 4.5 },
  { file: "cookies.jpg", title: "Butter Pecan Cookies", minutes: 35, rating: 4.7 },
  { file: "muffins.jpg", title: "English Muffins", minutes: 120, rating: 4.7 },
  { file: "roast.jpg", title: "Apple Juice Roast", minutes: 150, rating: 4.9 },
];

/** Community members — warm initial avatars (halal-first audience). */
export const MEMBERS = [
  { name: "Amina", color: "#E86A33" },
  { name: "Yusuf", color: "#287C78" },
  { name: "Laila", color: "#D69A2D" },
  { name: "Omar", color: "#3D8B5A" },
  { name: "Sara", color: "#6A4A78" },
  { name: "Mariam", color: "#C95222" },
  { name: "Ahmad", color: "#4A6A45" },
  { name: "Noor", color: "#8A5A12" },
] as const;

export const FPS = 30;
