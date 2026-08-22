import { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useThemePrefs } from "@/theme";

/**
 * Animated splash reveal, layered over the whole app — AT MOST ONCE PER DAY
 * (first launch of each day; every other launch skips straight to the app).
 * Both the native splash and this overlay open as a plain canvas color (no
 * static logo anywhere), so the handoff is invisible and the sequence starts
 * immediately: accent lines sweep across the center, the lines converge into
 * a splash of rings, and the mark springs in — its first and only appearance.
 * The overlay then fades away to reveal the app. Total ≈ 2.1s.
 */

const LOGO_SOURCE = require("@/assets/images/recipereallogo.webp");
/** Trimmed mark w/h — keep in sync with the asset (it is pre-trimmed). */
const LOGO_ASPECT = 949 / 919;
const FINAL_WIDTH = 132;

/**
 * AsyncStorage key holding the date string of the day the sequence last
 * PLAYED. The reveal runs at most once per day: repeat launches skip the
 * overlay entirely and dismiss the native splash immediately.
 */
const SPLASH_LAST_SHOWN_KEY = "recipereal.splashLastShown";

const SCREEN_WIDTH = Dimensions.get("window").width;

/** One sweeping accent line: screen-relative width, opacity peak, stagger. */
const LINES = [
  { widthFrac: 0.52, peak: 0.3, delay: 290, fromLeft: true, dy: -30 },
  { widthFrac: 0.7, peak: 0.55, delay: 145, fromLeft: false, dy: -15 },
  { widthFrac: 0.88, peak: 0.95, delay: 0, fromLeft: true, dy: 0 },
  { widthFrac: 0.7, peak: 0.55, delay: 145, fromLeft: false, dy: 15 },
  { widthFrac: 0.52, peak: 0.3, delay: 290, fromLeft: true, dy: 30 },
] as const;

/** Per-line sweep length inside the master clock below. */
const SWEEP_MS = 820;
const SWEEP_TOTAL_MS = SWEEP_MS + 290;

/** Timeline offsets (ms from start). */
const T = {
  sweep: 120,
  flash: 600,
  ring1: 600,
  ring2: 690,
  reveal: 680,
  fade: 1760,
  fadeMs: 340,
} as const;

function c01(v: number): number {
  "worklet";
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

const OUT_CUBIC = Easing.out(Easing.cubic);

export function AnimatedSplash() {
  const { colors } = useThemePrefs();
  // The overlay view mounts ONLY when the sequence will play. Until the
  // once-per-day check resolves (a few ms) the NATIVE splash is still
  // covering the screen (preventAutoHideAsync in the root layout), so there
  // is no flash risk in either direction.
  const [visible, setVisible] = useState(false);
  const started = useRef(false);

  // Once-per-day gate: play the full sequence only on the first launch of
  // each day; every other launch skips the overlay and dismisses the native
  // splash right away (never leave it stuck covering the app).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let lastShown: string | null = null;
      try {
        lastShown = await AsyncStorage.getItem(SPLASH_LAST_SHOWN_KEY);
      } catch {
        // Unreadable storage — treat as a fresh day so the sequence plays.
      }
      if (cancelled) return;
      if (lastShown === new Date().toDateString()) {
        // Already played today: skip the overlay entirely and hand the
        // screen straight to the app beneath the native splash.
        SplashScreen.hideAsync().catch(() => {
          // Already hidden or unavailable (dev web) — nothing to do.
        });
        return;
      }
      // First ever launch / new day: mount the overlay. Its onLayout then
      // dismisses the native splash and starts the unchanged sequence.
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sweep = useSharedValue(0);
  const ring1 = useSharedValue(0);
  const ring2 = useSharedValue(0);
  const flash = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.3);
  const overlayOpacity = useSharedValue(1);

  const start = useCallback(() => {
    if (started.current) return;
    started.current = true;

    // Stamp the day the moment the sequence STARTS (not when it finishes):
    // even if the app is killed mid-reveal, today counts as shown.
    AsyncStorage.setItem(SPLASH_LAST_SHOWN_KEY, new Date().toDateString()).catch(
      () => {
        // Best-effort persistence — tomorrow's play doesn't depend on it.
      },
    );

    // Lines sweep — a linear master clock each line windows into.
    sweep.value = withDelay(
      T.sweep,
      withTiming(1, { duration: SWEEP_TOTAL_MS, easing: Easing.linear }),
    );

    // Splash: a soft flash plus two rings expanding out of the center.
    flash.value = withDelay(T.flash, withTiming(1, { duration: 430, easing: OUT_CUBIC }));
    ring1.value = withDelay(T.ring1, withTiming(1, { duration: 560, easing: OUT_CUBIC }));
    ring2.value = withDelay(T.ring2, withTiming(1, { duration: 600, easing: OUT_CUBIC }));

    // Mark springs in — its first and only appearance.
    logoOpacity.value = withDelay(
      T.reveal,
      withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
    );
    logoScale.value = withDelay(
      T.reveal,
      withSpring(1, { damping: 13, stiffness: 175, mass: 0.95 }),
    );

    // Fade the whole overlay away, then unmount.
    logoScale.value = withDelay(
      T.fade,
      withTiming(1.045, { duration: 320, easing: Easing.inOut(Easing.quad) }),
    );
    overlayOpacity.value = withDelay(
      T.fade,
      withTiming(
        0,
        { duration: T.fadeMs, easing: Easing.inOut(Easing.quad) },
        (finished) => {
          if (finished) scheduleOnRN(setVisible, false);
        },
      ),
    );
  // Reanimated shared values are stable mutable refs — mutating them here is
  // the intended API, so they are deliberately left out of the deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = useCallback(() => {
    // The overlay opens as the same plain canvas as the native splash, so
    // dismiss the native one only once this view exists, then play.
    SplashScreen.hideAsync()
      .catch(() => {
        // Already hidden or unavailable (dev web) — play anyway.
      })
      .finally(() => start());
  }, [start]);

  if (!visible) return null;

  return (
    <Animated.View
      onLayout={onLayout}
      style={[styles.overlay, { backgroundColor: colors.canvas, opacity: overlayOpacity }]}
    >
      {LINES.map((_, i) => (
        <SweepLine key={i} index={i} progress={sweep} color={colors.accent} />
      ))}
      <Flash value={flash} color={colors.accent} />
      <Ring value={ring1} color={colors.accent} border={2} maxScale={3.4} />
      <Ring value={ring2} color={colors.accent} border={1.5} maxScale={4.6} />
      <Animated.View
        style={[styles.centerLayer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
      >
        <Image source={LOGO_SOURCE} style={styles.logo} />
      </Animated.View>
    </Animated.View>
  );
}

/** Full-screen centered track so each effect element animates from center. */
function SweepLine({
  index,
  progress,
  color,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const cfg = LINES[index];
    const p = c01((progress.value * SWEEP_TOTAL_MS - cfg.delay) / SWEEP_MS);
    const eased = OUT_CUBIC(p);
    const width = cfg.widthFrac * SCREEN_WIDTH;
    const half = (SCREEN_WIDTH + width) / 2 + 64;
    const from = cfg.fromLeft ? -half : half;
    return {
      width,
      transform: [{ translateX: from * (1 - 2 * eased) }, { translateY: cfg.dy }],
      // Symmetric fade-in/out envelope over the sweep.
      opacity: cfg.peak * Math.min(1, 4 * p * (1 - p) * 1.25),
    };
  });

  return (
    <View style={styles.centerLayer} pointerEvents="none">
      <Animated.View style={[styles.line, style, { backgroundColor: color }]} />
    </View>
  );
}

function Flash({ value, color }: { value: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const v = value.value;
    return {
      transform: [{ scale: 0.25 + 2.3 * v }],
      opacity: 0.3 * (1 - v) * Math.min(1, v * 10),
    };
  });

  return (
    <View style={styles.centerLayer} pointerEvents="none">
      <Animated.View style={[styles.flash, style, { backgroundColor: color }]} />
    </View>
  );
}

function Ring({
  value,
  color,
  border,
  maxScale,
}: {
  value: SharedValue<number>;
  color: string;
  border: number;
  maxScale: number;
}) {
  const style = useAnimatedStyle(() => {
    const v = value.value;
    return {
      transform: [{ scale: 0.12 + maxScale * v }],
      // Snap in fast, dissolve as the ring expands.
      opacity: Math.min(1, v * 8) * (1 - v),
    };
  });

  return (
    <View style={styles.centerLayer} pointerEvents="none">
      <Animated.View
        style={[styles.ring, style, { borderColor: color, borderWidth: border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    // Sweep direction must not mirror under RTL.
    direction: "ltr",
  },
  centerLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  line: {
    height: 2.5,
    borderRadius: 2.5,
  },
  flash: {
    width: FINAL_WIDTH,
    height: FINAL_WIDTH,
    borderRadius: FINAL_WIDTH / 2,
  },
  ring: {
    width: FINAL_WIDTH,
    height: FINAL_WIDTH,
    borderRadius: FINAL_WIDTH / 2,
  },
  logo: {
    width: FINAL_WIDTH,
    aspectRatio: LOGO_ASPECT,
  },
});
