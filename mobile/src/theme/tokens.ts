export const Color = {
  canvas: "#FAF8F5",
  surface: "#FFFFFF",
  surfaceSoft: "#F4EFE7",
  hairline: "#E8E1DC",
  hairlineStrong: "#D9CFC8",
  ink: "#211A17",
  inkSecondary: "#756B66",
  inkFaint: "#9C938E",
  accent: "#E86A33",
  accentPress: "#C95222",
  accentSoft: "#FBE9DE",
  amber: "#D69A2D",
  amberSoft: "#F8EDD4",
  success: "#3D8B5A",
  successSoft: "#E3EFE8",
  danger: "#D9534F",
  dangerSoft: "#FAE6E5",
  /** Timing/calibration accent — the "honest times" teal. */
  timing: "#287C78",
  timingSoft: "#DFEEED",
  scrim: "rgba(0,0,0,0.45)",
} as const;

export type StepType = "active" | "passive" | "cleanup";
export const StepTone: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#F7EAD0", fg: "#8A5A12" },
  passive: { bg: "#E4ECDD", fg: "#4A6A45" },
  cleanup: { bg: "#ECE3EF", fg: "#6A4A78" },
  default: { bg: "#F4EFE7", fg: "#6E6357" },
};

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32, mega: 48 } as const;
export const Radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const Shadow = {
  card: { shadowColor: "#3A2A1F", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  floating: { shadowColor: "#3A2A1F", shadowOpacity: 0.1, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
} as const;

export const Type = {
  timer: { fontSize: 72, fontWeight: "800", fontVariant: ["tabular-nums"] as ("tabular-nums")[], letterSpacing: 1 },
  h1: { fontSize: 28, fontWeight: "700" },
  h2: { fontSize: 22, fontWeight: "700" },
  h3: { fontSize: 18, fontWeight: "700" },
  title: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 15, fontWeight: "400", lineHeight: 22 },
  bodySm: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: "500" },
  overline: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
} as const;

export const MaxContentWidth = 720;

export function stepTone(type?: string): { bg: string; fg: string } {
  return (type && StepTone[type]) || StepTone.default;
}
