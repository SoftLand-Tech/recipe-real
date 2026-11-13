import { useMemo, useState, type ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "./Button";
import { Radius, Shadow, Space, Type, useThemeColors } from "@/theme";

/**
 * Centered confirmation dialog — THE app-wide confirm pattern (never native
 * Alert). Extracted verbatim from the cook-mode finish/discard dialogs:
 * dimmed scrim (tap to dismiss), floating card with a round icon badge, then
 * stacked full-width pill actions. The SAFE action is always the primary
 * button on top; the risky one sits below it — rendered red-soft in
 * `destructive` tone, as a plain primary in `neutral` tone.
 */
export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Glyph in the round badge (omit to render no badge). */
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** Badge glyph size — the cook dialogs use 28 (neutral) / 26 (destructive). */
  iconSize?: number;
  /**
   * "neutral" → accent badge, confirm as primary. "destructive" → danger
   * badge, confirm as the red-soft pressable (opacity-only press feedback).
   */
  tone?: "neutral" | "destructive";
  /** The action being confirmed ("Finish & log time", "Sign out", …). */
  confirmLabel: string;
  /** The safe action / dismissal ("Keep cooking", "Cancel", …). */
  cancelLabel: string;
  onConfirm: () => void;
  /** Scrim tap, hardware back, and the cancel button all land here. */
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  icon,
  iconSize = 28,
  tone = "neutral",
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colors = useThemeColors();
  const destructive = tone === "destructive";
  const [pressed, setPressed] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrim: {
          flex: 1,
          backgroundColor: colors.scrim,
          alignItems: "center",
          justifyContent: "center",
          padding: Space.xl,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: Space.xl,
          maxWidth: 360,
          width: "100%",
          alignItems: "center",
          gap: Space.md,
          ...Shadow.floating,
        },
        iconBadge: {
          width: 56,
          height: 56,
          borderRadius: Radius.pill,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: Space.xs,
        },
        title: {
          ...Type.h3,
          color: colors.ink,
          textAlign: "center",
        },
        message: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
          lineHeight: 20,
        },
        actions: {
          alignSelf: "stretch",
          gap: Space.sm,
          marginTop: Space.xs,
        },
        pillBtn: {
          minHeight: 48,
        },
        destructiveBtn: {
          alignSelf: "stretch",
          minHeight: 48,
          borderRadius: Radius.pill,
          backgroundColor: colors.dangerSoft,
          borderWidth: 1,
          borderColor: colors.dangerSoft,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: Space.md,
          paddingHorizontal: Space.xl,
        },
        destructivePressed: {
          opacity: 0.75,
        },
        destructiveText: {
          fontSize: Type.title.fontSize,
          fontWeight: "600",
          color: colors.danger,
          textAlign: "center",
        },
      }),
    [colors],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.scrim}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
        />
        <View style={styles.card}>
          {icon != null ? (
            <View
              style={[
                styles.iconBadge,
                {
                  backgroundColor: destructive
                    ? colors.dangerSoft
                    : colors.accentSoft,
                },
              ]}
            >
              <Ionicons
                name={icon}
                size={iconSize}
                color={destructive ? colors.danger : colors.accent}
              />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {message != null ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}
          <View style={styles.actions}>
            {destructive ? (
              <>
                <Button
                  title={cancelLabel}
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={onCancel}
                  style={styles.pillBtn}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={confirmLabel}
                  onPress={onConfirm}
                  onPressIn={() => setPressed(true)}
                  onPressOut={() => setPressed(false)}
                  style={
                    pressed
                      ? [styles.destructiveBtn, styles.destructivePressed]
                      : styles.destructiveBtn
                  }
                >
                  <Text style={styles.destructiveText}>{confirmLabel}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Button
                  title={confirmLabel}
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={onConfirm}
                  style={styles.pillBtn}
                />
                <Button
                  title={cancelLabel}
                  variant="secondary"
                  size="lg"
                  fullWidth
                  onPress={onCancel}
                  style={styles.pillBtn}
                />
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
