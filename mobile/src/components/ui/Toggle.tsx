import { Switch } from "react-native";

import { useThemeColors, useThemePrefs } from "@/theme";

export interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

/**
 * The app's one themed switch. White thumb in BOTH schemes (system-switch
 * convention — colors.surface is near-black in dark mode and made the knob
 * invisible); the off-track brightens in dark mode so the outline reads on
 * a dark card; ON is always the accent. Every checkbox-style control must
 * use this — no raw <Switch> anywhere.
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
}: ToggleProps) {
  const colors = useThemeColors();
  const { scheme } = useThemePrefs();

  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={{
        false: scheme === "dark" ? "#5A5148" : colors.hairline,
        true: colors.accent,
      }}
      thumbColor="#FFFFFF"
    />
  );
}
