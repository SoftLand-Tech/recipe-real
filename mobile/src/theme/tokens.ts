export const Color = {
  canvas: "#FBF8F3",
  surface: "#FFFFFF",
  surfaceSoft: "#F4EFE7",
  hairline: "#ECE4D8",
  hairlineStrong: "#E0D5C5",
  ink: "#241D17",
  inkSecondary: "#6E6357",
  // Darkened from #9C9082 — too low-contrast for text on canvas.
  inkFaint: "#857A6D",
  accent: "#BF552B",
  accentPress: "#A4471F",
  accentSoft: "#F8E9DE",
  amber: "#C8821F",
  amberSoft: "#F7EAD0",
  success: "#3F7D52",
  successSoft: "#E4ECDD",
  danger: "#B23A2E",
  dangerSoft: "#F6E1DD",
  scrim: "rgba(0,0,0,0.45)",
} as const;

export type StepType = "active" | "passive" | "cleanup";
export const StepTone: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#F7EAD0", fg: "#8A5A12" },
  passive: { bg: "#E4ECDD", fg: "#4A6A45" },
  cleanup: { bg: "#ECE3EF", fg: "#6A4A78" },
  default: { bg: "#F4EFE7", fg: "#6E6357" },
};

// `tap` = touch-target spacer (48px-min era); alias of md so existing rhythm
// is preserved while tappable rows can be tuned independently.
export const Space = { xs: 4, sm: 8, md: 12, tap: 12, lg: 16, xl: 20, xxl: 24, huge: 32, mega: 48 } as const;
export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const Shadow = {
  card: { shadowColor: "#3A2A1F", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  floating: { shadowColor: "#3A2A1F", shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
} as const;

// Accessibility-first scale (elderly / low-tech users): large base text,
// nothing meant for body reading below ~13, strong hierarchy steps.
export const Type = {
  timer: { fontSize: 76, fontWeight: "800", fontVariant: ["tabular-nums"] as ("tabular-nums")[], letterSpacing: 1 },
  h1: { fontSize: 30, fontWeight: "700" },
  h2: { fontSize: 26, fontWeight: "700" },
  h3: { fontSize: 21, fontWeight: "700" },
  title: { fontSize: 19, fontWeight: "600" },
  body: { fontSize: 17, fontWeight: "400", lineHeight: 25 },
  bodySm: { fontSize: 14, fontWeight: "400", lineHeight: 20 },
  caption: { fontSize: 13.5, fontWeight: "500" },
  overline: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
} as const;

export const MaxContentWidth = 720;

export function stepTone(type?: string): { bg: string; fg: string } {
  return (type && StepTone[type]) || StepTone.default;
}
