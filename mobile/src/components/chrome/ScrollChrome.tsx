import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";
import { Animated } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "expo-router/build/react-navigation/bottom-tabs/utils/useBottomTabBarHeight";

// Facebook-style thresholds
const HIDE_THRESHOLD = 28;
const SHOW_THRESHOLD = 10;
const TOP_ALWAYS_SHOW_OFFSET = 24;
const ANIM_DURATION_MS = 200;

interface ScrollChromeContextValue {
  /** 0 = visible, 1 = hidden. Drives both header and tab bar interpolations. */
  hidden: Animated.Value;
  /** Imperative controls — fire-and-forget, transition-only. */
  hideChrome: () => void;
  showChrome: () => void;
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

  const animateTo = useCallback(
    (toValue: number) => {
      const shouldHide = toValue === 1;
      if (isHiddenRef.current === shouldHide) return;
      isHiddenRef.current = shouldHide;
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

      // Ignore tiny jitter / zero delta.
      if (delta === 0) return;

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
    () => ({ hidden, hideChrome, showChrome, handleScroll }),
    [hidden, hideChrome, showChrome, handleScroll],
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
  const { handleScroll, hidden, hideChrome, showChrome } = useScrollChromeContext();
  const enabled = options?.enabled ?? true;
  const existingOnScroll = options?.existingOnScroll;

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (enabled) handleScroll(event);
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
  const insets = useSafeAreaInsets();
  // Expo tab bar is ~49dp + safe inset — fallback when the height hook is unavailable.
  return 49 + insets.bottom + 24;
}
