import { useState, type ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable } from "react-native";

export interface IconPressableProps {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "image" | "text";
  hitSlop?: number | { top: number; bottom: number; left: number; right: number };
  style?: StyleProp<ViewStyle>;
}

/**
 * A Pressable with reliable pressed feedback for icon/glyph buttons.
 *
 * Static style only (no Pressable style function, no width:"100%"/flex —
 * Android paint rules, see commit c0be039). Feedback is an opacity dim set
 * from onPressIn/onPressOut state: opacity is GPU-composited and always
 * repaints instantly, on every device — unlike android_ripple (which some
 * devices never render) or a background-color swap (which some devices fail
 * to repaint). This guarantees the user always sees the tap acknowledged,
 * even when the onPress handler itself is slow.
 *
 * On web (React Native Web fires onHoverIn/onHoverOut, native ignores them)
 * the same dim applies on hover so buttons announce themselves to a mouse
 * before the click.
 */
export function IconPressable({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityRole = "button",
  hitSlop,
  style,
}: IconPressableProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      hitSlop={hitSlop}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[style, !disabled && (pressed || hovered) ? { opacity: 0.6 } : null]}
    >
      {children}
    </Pressable>
  );
}
