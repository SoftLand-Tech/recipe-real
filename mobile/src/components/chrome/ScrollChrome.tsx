import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { Animated } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs/utils/useBottomTabBarHeight";
import { useFocusEffect } from "expo-router";

// Facebook-style thresholds. SHOW is deliberately LARGER than a hair
// trigger: with the old 10pt, very-slow-scroll finger jitter produced
// rapid hide→show→hide alternation (flicker) — asymmetric hysteresis in
// the WRONG direction. Sub-pixel deltas (<1pt) are jitter noise.
const HIDE_THRESHOLD = 28;
const SHOW_THRESHOLD = 16;
const TOP_ALWAYS_SHOW_OFFSET = 24;
const ANIM_DURATION_MS = 200;
/** No transition decision until the previous animation has settled. */
const TRANSITION_COOLDOWN_MS = 260;

interface ScrollChromeContextValue {
  /** 0 = visible, 1 = hidden. Drives both header and tab bar interpolations. */
  hidden: Animated.Value;
  /** Imperative controls — fire-and-forget, transition-only. */
  hideChrome: () => void;
  showChrome: () => void;
  /**
   * Screen-entry reset: drops the accumulators and skips the NEXT scroll
   * event's delta (it carries the previous screen's baseline — a huge
   * stale jump that used to auto-hide the chrome without any gesture).
   */
  resetChrome: () => void;
  /** Direct scroll handler for screens that want manual wiring. */
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const ScrollChromeContext = createContext<ScrollChromeContextValue | null>(null);

export function ScrollChromeProvider({ children }: { children: React.ReactNode }) {
  const hidden = useRef(new Animated.Value(0)).current;
  // Tracks current visual state (0 visible, 1 hidden) to avoid redundant anims.
  const isHiddenRef = useRef(false);
  // Accumulated scroll deltas per direction — reset on direction flip.
  const accumDownRef = useRef(0);
  const accumUpRef = useRef(0);
  const lastOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  // Timestamp of the last show/hide transition (flicker guard).
  const lastTransitionAtRef = useRef(0);
  // Set by resetChrome: the next scroll event only re-baselines.
  const skipNextDeltaRef = useRef(false);

  const animateTo = useCallback(
    (toValue: number) => {
      const shouldHide = toValue === 1;
      if (isHiddenRef.current === shouldHide) return;
      isHiddenRef.current = shouldHide;
      lastTransitionAtRef.current = Date.now();
      Animated.timing(hidden, {
        toValue,
        duration: ANIM_DURATION_MS,
        useNativeDriver: true,
      }).start();
    },
    [hidden],
  );

  const hideChrome = useCallback(() => animateTo(1), [animateTo]);
  const showChrome = useCallback(() => animateTo(0), [animateTo]);

  const resetChrome = useCallback(() => {
    accumDownRef.current = 0;
    accumUpRef.current = 0;
    skipNextDeltaRef.current = true;
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const delta = offsetY - lastOffsetRef.current;
      lastOffsetRef.current = offsetY;

      // Near the very top — always show, reset accumulators.
      if (offsetY < TOP_ALWAYS_SHOW_OFFSET) {
        accumDownRef.current = 0;
        accumUpRef.current = 0;
        if (isHiddenRef.current) animateTo(0);
        return;
      }

      // Screen-entry baseline swap: the first event after entering a screen
      // carries the PREVIOUS screen's offset — treat it as a re-baseline,
      // never as scroll travel (this was the auto-hide-on-entry bug).
      if (skipNextDeltaRef.current) {
        skipNextDeltaRef.current = false;
        return;
      }

      // Sub-pixel movement is finger jitter noise at very slow scroll
      // speeds — accumulating it is what made the chrome indecisive.
      if (Math.abs(delta) < 1) return;

      // Let the previous transition's animation settle before deciding
      // again (rapid retriggering = flicker).
      if (Date.now() - lastTransitionAtRef.current < TRANSITION_COOLDOWN_MS) {
        return;
      }

      if (delta > 0) {
        // Scrolling DOWN — accumulate downward, reset upward.
        accumUpRef.current = 0;
        // Clamp delta to avoid huge jumps (momentum flings).
        accumDownRef.current += delta;
        if (accumDownRef.current >= HIDE_THRESHOLD) {
          accumDownRef.current = 0;
          animateTo(1);
        }
      } else {
        // Scrolling UP — accumulate upward, reset downward.
        accumDownRef.current = 0;
        accumUpRef.current += Math.abs(delta);
        if (accumUpRef.current >= SHOW_THRESHOLD) {
          accumUpRef.current = 0;
          animateTo(0);
        }
      }
    },
    [animateTo],
  );

  // Expose drag state for momentum handling — caller can call these on
  // onMomentumScrollBegin / onScrollBeginDrag if desired.
  // Currently handleScroll alone is sufficient; these are no-ops kept for
  // interface completeness.
  void isDraggingRef;

  const value = useMemo<ScrollChromeContextValue>(
    () => ({ hidden, hideChrome, showChrome, resetChrome, handleScroll }),
    [hidden, hideChrome, showChrome, resetChrome, handleScroll],
  );

  return (
    <ScrollChromeContext.Provider value={value}>{children}</ScrollChromeContext.Provider>
  );
}

export function useScrollChromeContext(): ScrollChromeContextValue {
  const ctx = useContext(ScrollChromeContext);
  if (!ctx) {
    throw new Error("useScrollChromeContext must be used within ScrollChromeProvider");
  }
  return ctx;
}

/**
 * Hook for tab screens to wire scroll-aware chrome with zero boilerplate.
 *
 * Returns a ready-to-spread object for ScrollView / FlatList:
 *   const chrome = useScrollChrome();
 *   <ScrollView {...chrome.scrollProps} onScroll={composedHandler} />
 *
 * The `onScroll` composition: if the screen already has an onScroll, pass it
 * as `existingOnScroll` — both handlers will fire (chrome first).
 */
export function useScrollChrome(options?: {
  existingOnScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  enabled?: boolean;
}) {
  const { handleScroll, hidden, hideChrome, showChrome, resetChrome } = useScrollChromeContext();
  const enabled = options?.enabled ?? true;
  const existingOnScroll = options?.existingOnScroll;

  // FOCUS GATE (flicker fix): every tab screen stays MOUNTED in the tab
  // navigator, and all of them feed this ONE shared hidden value — without
  // the gate, a background tab's scroller emitting layout-driven events
  // (rails landing, feeds filling) fights the screen you're actually
  // touching, and the chrome flickers indecisively. Only the FOCUSED
  // screen may drive the chrome.
  //
  // On GAINING focus the chrome is also SHOWN and re-baselined: entering a
  // screen must never inherit the previous screen's hidden state or its
  // stale scroll offset (the auto-hide-on-entry bug).
  const focusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      resetChrome();
      showChrome();
      return () => {
        focusedRef.current = false;
      };
    }, [resetChrome, showChrome]),
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (enabled && focusedRef.current) handleScroll(event);
      existingOnScroll?.(event);
    },
    [enabled, handleScroll, existingOnScroll],
  );

  return {
    hidden,
    hideChrome,
    showChrome,
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}

// Re-export constants for tests / debugging if needed.
export const SCROLL_CHROME_CONSTANTS = {
  HIDE_THRESHOLD,
  SHOW_THRESHOLD,
  TOP_ALWAYS_SHOW_OFFSET,
  ANIM_DURATION_MS,
} as const;

/**
 * Bottom clearance for scroll content now that the tab bar is an ABSOLUTE
 * overlay (ChromeTabBar): the bar no longer occupies layout space, so lists
 * must pad past it while it is visible. Returns the measured bar height
 * (includes the safe-area inset) plus breathing room. 0 until measured —
 * harmless for one frame at the top of a list.
 */
export function useChromeContentBottomPad(): number {
  // Measured bar height (includes its safe-area inset) + a SMALL breathing
  // gap. The old constant stacked 49 + inset + 24 on top of a hardcoded
  // guess — users saw a huge dead band under the last card.
  const barHeight = useBottomTabBarHeight();

  return barHeight + 8;
}
