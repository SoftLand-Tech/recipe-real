import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useT } from "@/i18n";
import { Radius, Shadow, Space, Type, useThemeColors } from "@/theme";

/** The sheet slides in from ~120% of its own measured height. */
const TRAVEL_RATIO = 1.2;
/** Exit: quick drop + scrim fade. */
const EXIT_DURATION_MS = 160;
/** Scrim fade-in on entry. */
const ENTER_SCRIM_MS = 180;

const SCREEN_H = Dimensions.get("window").height;

export interface SheetAction {
  key: string;
  label: string;
  /** Leading glyph (20, inkSecondary — danger for destructive rows). */
  icon?: ComponentProps<typeof Ionicons>["name"];
  /** destructive = danger label + glyph (delete / block rows). */
  tone?: "default" | "destructive";
  onPress: () => void;
}

export interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** e.g. "Post actions". */
  title?: string;
  /** e.g. confirm text ("Delete your post permanently…"). */
  message?: string;
  actions: SheetAction[];
}

/**
 * One full-width action row: leading glyph + 600 label, pressed feedback via
 * the state-driven opacity dim (never a Pressable style function and never
 * width:"100%" — Android paint rules, see Button/Card).
 */
function SheetRow({
  label,
  icon,
  tone = "default",
  onPress,
}: {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  tone?: SheetAction["tone"];
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const destructive = tone === "destructive";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          minHeight: 52,
          paddingHorizontal: Space.lg,
          paddingVertical: Space.sm,
        },
        // Opacity dim (GPU-composited) — the one pressed treatment that
        // repaints reliably on every Android device.
        rowPressed: { opacity: 0.6 },
        label: {
          ...Type.body,
          fontWeight: "600",
          color: destructive ? colors.danger : colors.ink,
          flex: 1,
        },
      }),
    [colors, destructive],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.row, pressed ? styles.rowPressed : null]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={destructive ? colors.danger : colors.inkSecondary}
        />
      ) : null}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Bottom action sheet — the app's replacement for native Alert menus and
 * confirm dialogs (post/comment moderation). One surface card (Radius.lg top
 * corners, grabber bar, optional title + message) listing full-width rows in
 * the settings grouped-card language, with a visually separated Cancel row
 * at the bottom.
 *
 * Motion: the scrim fades in while the sheet springs up from just below the
 * fold (~120% of its own height, subtle overshoot). Every dismissal path —
 * scrim tap, hardware back, the Cancel row, or an action press — plays a
 * quick exit (~160ms drop + fade) and only then calls onClose; action
 * callbacks run AFTER the sheet is dismissed, so the caller can swap in the
 * next sheet of a confirm flow without a visual seam.
 *
 * Self-contained via a transparent Modal — composites above the current
 * screen without navigation. statusBarTranslucent + navigationBarTranslucent
 * let it draw edge to edge.
 *
 * Android paint rules: static styles only, no width:"100%" on any Pressable,
 * pressed feedback is the opacity dim from state. RTL-safe (row direction
 * flips automatically; only logical paddings are used).
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  message,
  actions,
}: ActionSheetProps) {
  const colors = useThemeColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  // Entry/exit animation values (native-driven: opacity + translateY).
  // useState's lazy initializer (not useRef(...).current) keeps one value per
  // instance WITHOUT reading a ref during render — this app runs the React
  // Compiler, whose rules flag that classic Animated pattern.
  const [scrimOpacity] = useState(() => new Animated.Value(0));
  const [sheetY] = useState(() => new Animated.Value(SCREEN_H));
  // Slide travel, captured from the sheet's own height on first layout.
  const travelRef = useRef(SCREEN_H * TRAVEL_RATIO);
  // Guards: entry starts once per show; exit runs once per dismissal.
  const startedRef = useRef(false);
  const closingRef = useRef(false);

  // Reset before paint whenever the sheet is (re)shown. Safe for both usage
  // patterns — conditionally mounted (key remount) or kept mounted with the
  // visible prop toggled — because this runs before the modal content paints.
  useLayoutEffect(() => {
    if (!visible) return;
    startedRef.current = false;
    closingRef.current = false;
    scrimOpacity.setValue(0);
    sheetY.setValue(SCREEN_H);
  }, [visible, scrimOpacity, sheetY]);

  // Entry: start from the measured travel distance (offscreen), scrim fades
  // in while the sheet springs up with a subtle overshoot.
  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      travelRef.current = event.nativeEvent.layout.height * TRAVEL_RATIO;
      if (startedRef.current) return;
      startedRef.current = true;
      Animated.parallel([
        Animated.timing(scrimOpacity, {
          toValue: 1,
          duration: ENTER_SCRIM_MS,
          useNativeDriver: true,
        }),
        Animated.spring(sheetY, {
          toValue: 0,
          speed: 20,
          bounciness: 5,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [scrimOpacity, sheetY],
  );

  /**
   * The single dismissal path: quick drop + scrim fade, then onClose — and
   * for action presses, the action AFTER the sheet is gone.
   */
  const dismiss = useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.parallel([
        Animated.timing(sheetY, {
          toValue: travelRef.current,
          duration: EXIT_DURATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, {
          toValue: 0,
          duration: EXIT_DURATION_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        // finished=false means the animation was stopped mid-flight (the
        // parent unmounted or reset the sheet) — the parent already closed.
        if (!finished) return;
        onClose();
        after?.();
      });
    },
    [onClose, scrimOpacity, sheetY],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: "flex-end" },
        // StyleSheet.absoluteFillObject is gone from the RN 0.86 types —
        // spell the insets out.
        fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        sheet: {
          ...Shadow.floating,
          borderTopLeftRadius: Radius.lg,
          borderTopRightRadius: Radius.lg,
          overflow: "hidden",
          alignSelf: "stretch",
        },
        grabberWrap: {
          alignItems: "center",
          paddingTop: Space.sm,
          paddingBottom: Space.xs,
        },
        grabber: { width: 36, height: 4, borderRadius: 2 },
        header: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.md,
          paddingBottom: Space.sm,
          gap: Space.xs,
        },
        title: { ...Type.title, fontWeight: "700", color: colors.ink },
        message: { ...Type.bodySm, color: colors.inkSecondary },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.hairline,
        },
        // The Cancel group sits under a stronger divider — visually a
        // separate block from the actions above it.
        strongDivider: { backgroundColor: colors.hairlineStrong },
      }),
    [colors],
  );

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => dismiss()}
    >
      <View style={styles.overlay}>
        {/* Scrim — fades in/out; tapping it dismisses the sheet. */}
        <Pressable
          accessible={false}
          onPress={() => dismiss()}
          style={styles.fill}
        >
          <Animated.View
            style={[
              styles.fill,
              { backgroundColor: colors.scrim, opacity: scrimOpacity },
            ]}
          />
        </Pressable>

        {/* The sheet card — slides up from just offscreen. */}
        <Animated.View
          onLayout={handleSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              // Bottom safe-area inset (never less than one lg of air).
              paddingBottom: Math.max(insets.bottom, Space.lg),
            },
            { transform: [{ translateY: sheetY }] },
          ]}
        >
          <View style={styles.grabberWrap}>
            <View
              style={[styles.grabber, { backgroundColor: colors.hairline }]}
            />
          </View>

          {title != null || message != null ? (
            <View style={styles.header}>
              {title != null ? <Text style={styles.title}>{title}</Text> : null}
              {message != null ? (
                <Text style={styles.message}>{message}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Action rows, hairline-divided. */}
          {actions.map((action, index) => (
            <Fragment key={action.key}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <SheetRow
                label={action.label}
                icon={action.icon}
                tone={action.tone}
                onPress={() => dismiss(action.onPress)}
              />
            </Fragment>
          ))}

          {/* Cancel — a separate block under a stronger divider. */}
          <View style={[styles.divider, styles.strongDivider]} />
          <SheetRow label={t("common.cancel")} onPress={() => dismiss()} />
        </Animated.View>
      </View>
    </Modal>
  );
}
