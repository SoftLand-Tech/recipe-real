import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import {
  forwardRef,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  deleteRecipeNote,
  fetchMyProfile,
  fetchRecipeNotes,
  fetchRecipePosts,
  getRecipe,
  hasToken,
  HalalRejectionError,
  OfflineError,
  postRecipeNote,
  QuickTimeUnauthorizedError,
  RecipeNoteUnauthorizedError,
  reportRecipeNote,
  submitQuickTime,
} from "@/api/client";
import { WEB_BASE_URL } from "@/config";
import { track } from "@/analytics";
import {
  getCachedRecipe,
  getNote,
  isFavorite,
  refreshPaceCalibrations,
  saveNote,
  toggleFavorite,
  upsertRecipes,
} from "@/db/database";
import type {
  CleanupFactors,
  PaceCalibration,
  Post,
  Recipe,
  RecipeNote,
  RecipeStep,
} from "@/types";
import {
  MaxContentWidth,
  Radius,
  Shadow,
  Space,
  Type,
  useThemeColors,
  type LangDir,
  type ThemeColors,
} from "@/theme";
import {
  greaseLevelLabel,
  useFmtMinutes,
  useLang,
  useLocalizedRecipe,
  useT,
  type TranslateFn,
} from "@/i18n";
import {
  Avatar,
  Button,
  Card,
  Chip,
  HeroImage,
  IconPressable,
  SectionHeader,
  StatPill,
  Toggle,
} from "@/components/ui";
import {
  bestMinutes,
  estimateStepMinutes,
  stepMinutes,
} from "@/utils/recipeTime";
import { parseIntOrNull, relativeDate } from "@/utils/format";
import {
  cancelPlannedNotifications,
  requestNotificationsPermission,
  scheduleAtNotification,
} from "@/utils/notifications";
import { shareLink } from "@/utils/share";
import { peekPostCreated } from "@/utils/postCreated";

type LoadState = "idle" | "loading" | "ready" | "error";

/** Rounds a nullable minute value, returning null when absent. */
function roundMin(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value);
}

/** Formats a Date as a short local clock string, e.g. "7:04 PM". */
function formatClock(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    // Intl unavailable: manual 12-hour fallback so the clock never crashes.
    const hours = date.getHours();
    const h = hours % 12 || 12;
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m} ${hours < 12 ? "AM" : "PM"}`;
  }
}

/** AsyncStorage key persisting the "Make public" note toggle default. */
const NOTE_PUBLIC_PREF_KEY = "recipereal.notePublicDefault";

/**
 * AsyncStorage key flagged by the detail screen right after a successful
 * quick-time submit; the browse list checks it on focus and re-syncs its
 * server-driven grid once, so the list and detail stop disagreeing.
 */
const QUICK_TIME_STALE_KEY = "recipereal.quickTimeStale";

/** Display name of a note author: display_name, else the account name. */
function noteAuthorName(user: RecipeNote["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Display name of a post author: display_name, else the account name. */
function postAuthorName(user: Post["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Publisher hostname ("food.com") for the hero's tiny attribution line. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Rows shown before "Show all" expands the recipe's community list. */
const TRIES_PREVIEW_COUNT = 3;

/** Skeleton rows of the timeline placeholder while cached steps are absent. */
const TIMELINE_PLACEHOLDER_ROWS = 3;

/**
 * Cap on scheduled planner notifications (one per step boundary): the OS
 * keeps a limited pool of pending notifications, so only the NEXT steps get
 * nudges when a plan is armed.
 */
const MAX_PLAN_STEPS = 10;

/** Stepper granularity of the eat-at planner, in minutes. */
const PLAN_STEP_MINUTES = 15;

/**
 * Build the cleanup-burden chip labels from the factors object. Each entry is
 * only included when its underlying value is non-null.
 */
function cleanupChips(
  t: TranslateFn,
  factors: CleanupFactors | undefined,
): string[] {
  if (!factors) return [];
  const chips: string[] = [];
  if (factors.dish_count != null) {
    chips.push(t("detail.dishes", { n: Math.round(factors.dish_count) }));
  }
  if (factors.grease_level) {
    chips.push(greaseLevelLabel(t, factors.grease_level));
  }
  if (factors.dishwasher_safe != null) {
    chips.push(
      factors.dishwasher_safe
        ? t("detail.dishwasherSafe")
        : t("detail.handWash"),
    );
  }
  return chips;
}

/**
 * Reality badge label for the gap thresholds: ≥ +20% slower than claimed,
 * ≤ −20% faster, otherwise the claim checks out. The chip always renders in
 * timing teal (bg timingSoft / fg timing) — reality checks are calibration
 * data. Called only when `reality.gap_pct != null`.
 */
function realityBadge(
  t: TranslateFn,
  gapPct: number,
): { tone: "timing"; label: string } {
  if (gapPct >= 20) {
    return {
      tone: "timing",
      label: t("detail.realitySlower", { pct: Math.round(gapPct) }),
    };
  }
  if (gapPct <= -20) {
    return {
      tone: "timing",
      label: t("detail.realityFaster", { pct: Math.round(Math.abs(gapPct)) }),
    };
  }
  return { tone: "timing", label: t("detail.realityAccurate") };
}

/** One entry of the backend `ingredients_structured` JSON column. */
interface StructuredIngredient {
  raw?: string | null;
  qty?: number | string | null;
  qty_display?: string | null;
  unit?: string | null;
  item?: string | null;
  prep?: string | null;
}

/**
 * Parse `ingredients_structured` defensively. The API ships it as an object
 * (`{"v":1,"items":[…]}`), but it may also arrive as a raw JSON string or be
 * absent entirely (the SQLite cache doesn't persist it) — every failure mode
 * returns [] so the plain-text bullets remain the fallback.
 */
function parseStructuredIngredients(value: unknown): StructuredIngredient[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (parsed == null || typeof parsed !== "object") return [];
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (entry): entry is StructuredIngredient =>
      entry != null && typeof entry === "object",
  );
}

function createDetailStyles(colors: ThemeColors, dir: LangDir) {
  return StyleSheet.create({
        screen: {
          flex: 1,
          position: "relative",
          backgroundColor: colors.canvas,
        },
        scroll: {
          flex: 1,
        },
        content: {
          paddingHorizontal: 0,
        },
        columnWrap: {
          width: "100%",
          maxWidth: MaxContentWidth,
          alignSelf: "center",
        },
        // ---- Hero (full-bleed photo section) + flat padded body ----
        heroWrap: {
          width: "100%",
        },
        heroOverlay: {
          paddingHorizontal: 0,
        },
        heroTitle: {
          ...Type.h1,
          // Over a photo scrim — always white, never the theme surface color.
          color: "#FFFFFF",
          textShadowColor: "rgba(0,0,0,0.55)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 6,
        },
        // No-photo heroes skip the scrim entirely, so the same texts flip to
        // ink on the tinted fallback card.
        heroTitlePlain: {
          ...Type.h1,
          color: colors.ink,
        },
        // ★ rating · publisher meta line right under the hero title.
        heroRating: {
          ...Type.caption,
          color: "#FFFFFF",
          fontWeight: "600",
          marginTop: Space.xs,
          textShadowColor: "rgba(0,0,0,0.55)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        },
        heroRatingPlain: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
          marginTop: Space.xs,
        },
        backButton: {
          position: "absolute",
          // Physical left/right don't flip in RTL — pick the side per dir so
          // back stays at the reading-start edge, favorite at the far edge.
          ...(dir === "rtl" ? { right: Space.lg } : { left: Space.lg }),
          width: 38,
          height: 38,
          borderRadius: Radius.pill,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        },
        favButton: {
          position: "absolute",
          ...(dir === "rtl" ? { left: Space.lg } : { right: Space.lg }),
          width: 38,
          height: 38,
          borderRadius: Radius.pill,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        },
        // Floating share button over the hero — inset one button width from
        // the favorite (RTL-aware like the other floating buttons).
        shareButton: {
          position: "absolute",
          ...(dir === "rtl" ? { left: Space.lg + 46 } : { right: Space.lg + 46 }),
          width: 38,
          height: 38,
          borderRadius: Radius.pill,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        },
        // Padded flat document body under the hero (no overlapping card).
        pagePad: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.lg,
          paddingBottom: Space.lg,
        },
        // ONE bordered fact piece: the two time StatPills + reality badge.
        factBox: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: Space.sm,
          padding: Space.md,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          backgroundColor: colors.surface,
        },
        // ---- Quick-time contribution (compact card with an inline form) ----
        // Trigger row: icon + "Did you make this?" + chevron. Tapping the
        // row expands the breakdown form inline below it.
        quickTriggerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        quickTriggerLabel: {
          ...Type.body,
          color: colors.ink,
          fontWeight: "600",
          flex: 1,
        },
        // One-column breakdown form: label above each numeric input.
        quickForm: {
          gap: Space.sm,
          marginTop: Space.md,
        },
        quickField: {
          gap: Space.xs,
        },
        quickFieldLabel: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        quickFieldOptional: {
          ...Type.caption,
          color: colors.inkFaint,
          fontWeight: "500",
        },
        quickInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.md,
          paddingHorizontal: Space.md,
        },
        quickError: {
          ...Type.caption,
          color: colors.danger,
          marginTop: Space.xs,
        },
        quickSuccess: {
          ...Type.bodySm,
          color: colors.success,
          fontWeight: "600",
          marginTop: Space.xs,
        },
        quickSignIn: {
          ...Type.caption,
          color: colors.accent,
          fontWeight: "700",
          marginTop: Space.xs,
          paddingVertical: Space.xs,
          alignSelf: "flex-start",
        },
        // Timeline headline ("Start now → eating at…") — timing teal: the
        // whole "when's dinner" block is calibration data.
        timelineHeadline: {
          ...Type.h3,
          color: colors.timing,
        },
        // ---- Start-time planner (eat-at mode) ----
        planRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: Space.sm,
          marginTop: Space.sm,
        },
        planLabel: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        planTime: {
          ...Type.title,
          color: colors.ink,
          fontWeight: "700",
          fontVariant: ["tabular-nums"] as ("tabular-nums")[],
        },
        // Circular ±15m stepper buttons (static style only — Android paint
        // rules; IconPressable adds the pressed feedback).
        planStepBtn: {
          width: 34,
          height: 34,
          borderRadius: Radius.pill,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
        planSetRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: Space.sm,
          marginTop: Space.xs,
        },
        planSetCaption: {
          ...Type.caption,
          color: colors.success,
          fontWeight: "600",
          flexShrink: 1,
        },
        timelineList: {
          gap: Space.xs,
          marginTop: Space.md,
        },
        timelineRow: {
          flexDirection: "row",
          // Top-aligned: rows carry full step text now (the timeline IS the
          // step list), so the clock/duration anchor to the first line.
          alignItems: "flex-start",
          gap: Space.sm,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.sm,
          borderRadius: Radius.md,
        },
        timelineRowPassive: {
          backgroundColor: colors.successSoft,
        },
        timelineDot: {
          width: 8,
          height: 8,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        },
        timelineDotPassive: {
          backgroundColor: colors.success,
        },
        timelineInfo: {
          flex: 1,
        },
        // Bold step number leading the step text ("1. Boil the water…").
        timelineStepNum: {
          fontWeight: "700",
          color: colors.inkSecondary,
        },
        // ONE small meta line under the step text: hands-off and/or the
        // personalized adjusted time, plain muted text (no chips).
        timelineMeta: {
          ...Type.caption,
          color: colors.inkSecondary,
          marginTop: Space.xs,
        },
        timelineDesc: {
          ...Type.body,
          color: colors.ink,
        },
        // ---- Timeline placeholder (light cache row, steps still loading) ----
        // Compact inline stand-in: a small spinner plus text-free skeleton
        // rows shaped like the timeline rows they replace.
        timelinePending: {
          alignItems: "center",
          gap: Space.xs,
          marginTop: Space.md,
        },
        timelineSkelRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.sm,
          borderRadius: Radius.md,
          alignSelf: "stretch",
        },
        timelineSkelDot: {
          width: 8,
          height: 8,
          borderRadius: Radius.pill,
          backgroundColor: colors.hairline,
        },
        timelineSkelLine: {
          flex: 1,
          height: 14,
          borderRadius: Radius.pill,
          backgroundColor: colors.surfaceSoft,
        },
        section: {
          marginTop: Space.xl,
        },
        bulletList: {
          gap: Space.xs,
        },
        bulletRow: {
          flexDirection: "row",
          gap: Space.sm,
          alignItems: "flex-start",
        },
        bullet: {
          fontSize: Type.body.fontSize,
          color: colors.accent,
          lineHeight: 22,
          fontWeight: "700",
        },
        bulletText: {
          flex: 1,
          ...Type.body,
          color: colors.ink,
        },
        // Bold "½ cup" quantity prefix on structured ingredient rows.
        ingredientQty: {
          fontWeight: "700",
          color: colors.ink,
        },
        stepList: {
          gap: Space.md,
        },
        stepNumber: {
          width: 26,
          height: 26,
          borderRadius: Radius.pill,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        stepNumberText: {
          color: colors.accent,
          fontSize: 13,
          fontWeight: "700",
        },
        // ---- Notes card (personal + community behind a joined segment) ----
        // Same segmented-control pattern as onboarding: one bordered track,
        // hairline divider, active segment fills accentSoft.
        notesSegment: {
          flexDirection: "row",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          overflow: "hidden",
          // Breathing room between the segmented header and the tab content.
          marginBottom: Space.md,
        },
        notesSegmentDivider: {
          width: 1,
          backgroundColor: colors.hairline,
        },
        notesSegmentBtn: {
          flex: 1,
          alignItems: "center",
          paddingVertical: Space.md,
        },
        notesSegmentBtnActive: {
          backgroundColor: colors.accentSoft,
        },
        notesSegmentLabel: {
          ...Type.body,
          color: colors.inkSecondary,
        },
        notesSegmentLabelActive: {
          color: colors.accent,
          fontWeight: "600",
        },
        // Saved note row: text + "Edit" hint, tap to open the editor.
        noteViewRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Space.sm,
          paddingVertical: Space.xs,
        },
        noteViewText: {
          flex: 1,
          ...Type.body,
          color: colors.ink,
        },
        noteEditHint: {
          ...Type.caption,
          color: colors.accent,
          fontWeight: "600",
          marginTop: Space.xs,
        },
        // "Add a note" row styled as an EMPTY INPUT FIELD (soft fill +
        // hairline border + placeholder-colored label) — reads as tappable
        // even to someone who has never seen it.
        noteAddRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.md,
          paddingHorizontal: Space.md,
        },
        noteAddPlaceholder: {
          ...Type.body,
          color: colors.inkFaint,
        },
        noteInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          padding: Space.md,
          minHeight: 90,
          textAlignVertical: "top",
        },
        // Editor actions: Save (left) + saved ✓ + "Make public" toggle INLINE
        // at the row's end (wraps on narrow screens / long Arabic labels).
        noteActions: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: Space.md,
          marginTop: Space.sm,
        },
        noteSaved: {
          ...Type.caption,
          color: colors.success,
          fontWeight: "600",
        },
        publicToggleInline: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
          marginLeft: "auto",
          flexShrink: 1,
        },
        publicToggleLabel: {
          ...Type.bodySm,
          color: colors.ink,
          fontWeight: "600",
          flexShrink: 1,
        },
        // ---- Community notes ----
        notesList: {
          gap: Space.md,
        },
        noteRow: {
          flexDirection: "row",
          gap: Space.sm,
          alignItems: "flex-start",
        },
        avatar: {
          width: 34,
          height: 34,
          borderRadius: Radius.pill,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        avatarText: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.accent,
        },
        avatarImage: {
          width: "100%",
          height: "100%",
        },
        noteInfo: {
          flex: 1,
          gap: Space.xs,
        },
        noteHeadRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          flexWrap: "wrap",
        },
        noteAuthor: {
          ...Type.bodySm,
          color: colors.ink,
          fontWeight: "700",
        },
        noteDate: {
          ...Type.caption,
          color: colors.inkFaint,
        },
        noteBody: {
          ...Type.bodySm,
          color: colors.ink,
        },
        // Small per-note action (Delete for the owner, Report for others),
        // pushed to the head row's trailing edge.
        noteAction: {
          marginLeft: "auto",
        },
        // Transient delete/report confirmation line under the notes list.
        noteFlash: {
          ...Type.caption,
          color: colors.success,
        },
        // Compose row (signed-in): single-line input + send button.
        noteCompose: {
          gap: Space.xs,
          marginTop: Space.md,
        },
        noteComposeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        noteComposeInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.md,
          paddingHorizontal: Space.md,
          flex: 1,
        },
        noteError: {
          ...Type.caption,
          color: colors.danger,
        },
        noteSignIn: {
          ...Type.caption,
          color: colors.accent,
          fontWeight: "700",
        },
        notesLoadMore: {
          alignSelf: "center",
          marginTop: Space.xs,
        },
        notesMuted: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        notesCenter: {
          paddingVertical: Space.lg,
          alignItems: "center",
        },
        // ---- Community tries (posts attached to this recipe) ----
        triesList: {
          gap: Space.md,
        },
        // One compact row: avatar | (name / 2-line snippet /
        // up to 3 tiny image squares). Static style only — IconPressable
        // adds the pressed opacity feedback (Android paint rules).
        tryRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: Space.sm,
        },
        tryMain: {
          flex: 1,
          gap: Space.xs,
        },
        tryHeadRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        tryAuthor: {
          ...Type.bodySm,
          color: colors.ink,
          fontWeight: "700",
          flex: 1,
        },
        tryBody: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        // Tiny image preview: up to 3 small squares (NOT the full
        // PostImageGrid — too heavy inline on this page).
        tryThumbs: {
          flexDirection: "row",
          gap: Space.xs,
          marginTop: Space.xs,
        },
        tryThumb: {
          width: 44,
          height: 44,
          borderRadius: Radius.sm,
          backgroundColor: colors.hairline,
          overflow: "hidden",
        },
        // Shared empty state (community notes + tries): soft icon circle +
        // one muted line (+ optional CTA), centered and quiet.
        emptyBlock: {
          alignItems: "center",
          gap: Space.sm,
          paddingVertical: Space.lg,
        },
        emptyIconWrap: {
          width: 48,
          height: 48,
          borderRadius: Radius.pill,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        emptyText: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        triesShowAll: {
          alignSelf: "flex-start",
          marginTop: Space.xs,
        },
        // Owner "Edit" ghost button above the stat grid.
        ownerEditBtn: {
          alignSelf: "flex-start",
          marginBottom: Space.sm,
        },
        cookFooter: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          paddingHorizontal: Space.lg,
          paddingTop: Space.sm,
          ...Shadow.floating,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: Space.mega,
          paddingHorizontal: Space.lg,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
        },
        retry: {
          marginTop: Space.sm,
          paddingHorizontal: Space.xl,
          paddingVertical: Space.md,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        },
        errorHomeBtn: {
          marginTop: Space.xs,
          paddingVertical: Space.sm,
          paddingHorizontal: Space.lg,
        },
        errorHomeText: {
          ...Type.body,
          fontWeight: "600",
          color: colors.inkSecondary,
        },
        retryText: {
          // Literal white on the accent pill — surface goes dark in dark mode.
          color: "#FFFFFF",
          fontWeight: "700",
        },
      });
}

type DetailStyles = ReturnType<typeof createDetailStyles>;

interface IngredientRowProps {
  ingredient: string;
  structured?: StructuredIngredient;
  styles: DetailStyles;
}

const IngredientRow = memo(function IngredientRow({
  ingredient,
  structured,
  styles,
}: IngredientRowProps) {
  const qty =
    structured?.qty_display ??
    (structured?.qty != null ? String(structured.qty) : null);
  const unit = structured?.unit?.trim() || null;
  const itemText = [structured?.item?.trim(), structured?.prep?.trim()]
    .filter(Boolean)
    .join(", ");
  const qtyPart = [qty, unit].filter(Boolean).join(" ");
  const hasStructure = qtyPart !== "" && itemText !== "";
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet}>•</Text>
      {hasStructure ? (
        <Text style={styles.bulletText}>
          <Text style={styles.ingredientQty}>{qtyPart}</Text>
          {` ${itemText}`}
        </Text>
      ) : (
        <Text style={styles.bulletText}>{ingredient}</Text>
      )}
    </View>
  );
});

interface TimelineStepRowProps {
  step: RecipeStep;
  adjusted: number | null;
  description: string;
  styles: DetailStyles;
}

const TimelineStepRow = memo(function TimelineStepRow({
  step,
  adjusted,
  description,
  styles,
}: TimelineStepRowProps) {
  const t = useT();
  const fmtMin = useFmtMinutes();
  const passive = step.step_type === "passive";
  return (
    <View
      style={[
        styles.timelineRow,
        passive && styles.timelineRowPassive,
      ]}
    >
      <View
        style={[
          styles.timelineDot,
          passive && styles.timelineDotPassive,
        ]}
      />
      <View style={styles.timelineInfo}>
        {/* Full step text — this row IS the step list (no separate Steps
            section below). The step number leads the text; hands-off +
            adjusted notes fold into ONE small meta line. */}
        <Text style={styles.timelineDesc}>
          <Text style={styles.timelineStepNum}>
            {`${t("detail.stepCaption", {
              n: step.step_number,
            })} `}
          </Text>
          {description}
        </Text>
        {passive || adjusted != null ? (
          <Text style={styles.timelineMeta}>
            {[
              passive ? t("common.handsOff") : null,
              adjusted != null
                ? t("detail.adjustedForYou", {
                    time: fmtMin(adjusted),
                  })
                : null,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

interface NoteRowProps {
  item: RecipeNote;
  mine: boolean;
  reported: boolean;
  onDelete: (note: RecipeNote) => void;
  onReport: (note: RecipeNote) => void;
  inkFaintColor: string;
  successColor: string;
  styles: DetailStyles;
}

const NoteRow = memo(function NoteRow({
  item,
  mine,
  reported,
  onDelete,
  onReport,
  inkFaintColor,
  successColor,
  styles,
}: NoteRowProps) {
  const t = useT();
  const author = noteAuthorName(item.user);
  const initial = author.charAt(0).toUpperCase() || "?";
  const rel = relativeDate(t, item.created_at);
  const handleDelete = useCallback(() => onDelete(item), [onDelete, item]);
  const handleReport = useCallback(() => onReport(item), [onReport, item]);

  return (
    <View style={styles.noteRow}>
      <View style={styles.avatar}>
        {item.user.avatar_url ? (
          <Image
            source={{ uri: item.user.avatar_url }}
            style={styles.avatarImage}
            contentFit="cover"
            transition={0}
            cachePolicy="memory-disk"
            recyclingKey={item.user.avatar_url}
          />
        ) : (
          <Text style={styles.avatarText}>{initial}</Text>
        )}
      </View>
      <View style={styles.noteInfo}>
        <View style={styles.noteHeadRow}>
          <Text style={styles.noteAuthor}>{author}</Text>
          {rel !== "" ? <Text style={styles.noteDate}>{rel}</Text> : null}
          {mine ? (
            <IconPressable
              onPress={handleDelete}
              hitSlop={Space.xs}
              style={styles.noteAction}
              accessibilityLabel={t("common.delete")}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={inkFaintColor}
              />
            </IconPressable>
          ) : (
            <IconPressable
              onPress={handleReport}
              hitSlop={Space.xs}
              style={styles.noteAction}
              accessibilityLabel={t("community.reportAction")}
            >
              <Ionicons
                name={reported ? "checkmark" : "flag-outline"}
                size={16}
                color={reported ? successColor : inkFaintColor}
              />
            </IconPressable>
          )}
        </View>
        <Text style={styles.noteBody}>{item.body}</Text>
      </View>
    </View>
  );
});

interface TryRowProps {
  item: Post;
  styles: DetailStyles;
}

const TryRow = memo(function TryRow({ item, styles }: TryRowProps) {
  const author = postAuthorName(item.user);
  const handlePress = useCallback(() => {
    router.push(`/post/${item.id}`);
  }, [item.id]);

  return (
    <IconPressable onPress={handlePress} style={styles.tryRow}>
      <Avatar name={author} uri={item.user.avatar_url} size={32} />
      <View style={styles.tryMain}>
        <Text style={styles.tryAuthor} numberOfLines={1}>
          {author}
        </Text>
        <Text style={styles.tryBody} numberOfLines={2}>
          {item.body}
        </Text>
        {item.images.length > 0 ? (
          <View style={styles.tryThumbs}>
            {item.images.slice(0, 3).map((uri, index) => (
              <Image
                key={`try-${item.id}-img-${index}`}
                source={{ uri }}
                style={styles.tryThumb}
                contentFit="cover"
                transition={0}
                cachePolicy="memory-disk"
                recyclingKey={uri}
              />
            ))}
          </View>
        ) : null}
      </View>
    </IconPressable>
  );
});

interface QuickTimeCardHandle {
  open: () => void;
}

interface QuickTimeCardProps {
  recipe: Recipe;
  numericId: number;
  onSubmitted: (communityAvgMinutes: number | null) => void;
  colors: ThemeColors;
  styles: DetailStyles;
}

const QuickTimeCard = memo(
  forwardRef<QuickTimeCardHandle, QuickTimeCardProps>(function QuickTimeCard(
    { recipe, numericId, onSubmitted, colors, styles },
    ref,
  ) {
    const t = useT();
    const fmtMin = useFmtMinutes();
    const recipeRef = useRef(recipe);
    useEffect(() => {
      recipeRef.current = recipe;
    }, [recipe]);

    // Quick-time contribution: honest-breakdown form ("did you make this?"):
    // plates made, hands-on minutes, total minutes (required) and cleanup
    // minutes. Rendered for everyone; an unauthenticated submit surfaces the
    // sign-in CTA (the 401 is mapped to QuickTimeUnauthorizedError in the client).
    const [quickPlates, setQuickPlates] = useState("");
    const [quickHandsOn, setQuickHandsOn] = useState("");
    const [quickTotal, setQuickTotal] = useState("");
    const [quickCleanup, setQuickCleanup] = useState("");
    const [quickSubmitting, setQuickSubmitting] = useState(false);
    const [quickDone, setQuickDone] = useState(false);
    const [quickAvg, setQuickAvg] = useState<number | null>(null);
    const [quickCleanupAvg, setQuickCleanupAvg] = useState<number | null>(null);
    const [quickError, setQuickError] = useState<string | null>(null);
    const [quickNeedsAuth, setQuickNeedsAuth] = useState(false);
    // Fade-in for the "Thanks! …" success line (native-driven opacity).
    const [quickFade] = useState(() => new Animated.Value(0));
    // Quick-time card: ALWAYS collapsed to the trigger row on first paint; the
    // breakdown form expands inline below it on tap. `quickDone` is separate so
    // a successful submit collapses the form but keeps the one-line thanks.
    const [quickOpen, setQuickOpen] = useState(false);
    // Opacity-dim pressed state for the trigger row (Android paint rules).
    const [quickPressed, setQuickPressed] = useState(false);
    // Focuses the inline total-time input as soon as it mounts.
    const quickInputRef = useRef<TextInput | null>(null);

    /**
     * Reveal the inline quick-time form inside the card and focus the required
     * total-time input. Focus waits one frame so the just-mounted TextInput
     * exists first.
     */
    const openQuick = useCallback(() => {
      setQuickOpen(true);
      requestAnimationFrame(() => quickInputRef.current?.focus());
    }, []);

    useImperativeHandle(ref, () => ({ open: openQuick }), [openQuick]);

    const onSubmitQuickTime = useCallback(async () => {
      const minutes = parseIntOrNull(quickTotal);
      if (minutes == null || minutes < 1 || minutes > 1440) return;
      const handsOn = parseIntOrNull(quickHandsOn);
      if (handsOn != null && handsOn > minutes) return; // Client-side guard.
      if (!Number.isFinite(numericId)) return;
      const cleanupMinutes = parseIntOrNull(quickCleanup);
      const plates = parseIntOrNull(quickPlates);
      setQuickSubmitting(true);
      setQuickError(null);
      setQuickNeedsAuth(false);
      try {
        const result = await submitQuickTime(numericId, {
          minutes,
          ...(handsOn != null ? { hands_on_minutes: handsOn } : {}),
          ...(cleanupMinutes != null ? { cleanup_minutes: cleanupMinutes } : {}),
          ...(plates != null ? { servings: plates } : {}),
        });
        track("quick_time_submitted", { recipe_id: numericId, minutes });
        setQuickAvg(result.community_avg_minutes);
        setQuickCleanupAvg(result.cleanup_avg_minutes);
        setQuickDone(true);
        setQuickOpen(false);
        onSubmitted(result.community_avg_minutes);
        const currentRecipe = recipeRef.current;
        if (currentRecipe) {
          upsertRecipes(
            [
              {
                ...currentRecipe,
                community_avg_minutes: result.community_avg_minutes,
                cleanup_avg_minutes: result.cleanup_avg_minutes,
              },
            ],
            { withSteps: false },
          ).catch(() => {});
        }
        AsyncStorage.setItem(QUICK_TIME_STALE_KEY, String(Date.now())).catch(
          () => {},
        );
        quickFade.setValue(0);
        Animated.timing(quickFade, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.warn("[RecipeReal] quick-time submit failed:", error);
        if (error instanceof QuickTimeUnauthorizedError) {
          setQuickNeedsAuth(true);
          setQuickError(t("quick.signInRequired"));
        } else if (error instanceof OfflineError) {
          setQuickError(error.message);
        } else {
          setQuickError(t("quick.error"));
        }
      } finally {
        setQuickSubmitting(false);
      }
    }, [
      quickTotal,
      quickHandsOn,
      quickCleanup,
      quickPlates,
      numericId,
      onSubmitted,
      quickFade,
      t,
    ]);

    // ---- Quick-time field validation (client-side guards for the submit) ----
    const quickTotalValue = parseIntOrNull(quickTotal);
    const quickHandsOnValue = parseIntOrNull(quickHandsOn);
    const quickPlatesValue = parseIntOrNull(quickPlates);
    const quickCleanupValue = parseIntOrNull(quickCleanup);
    const quickTotalValid =
      quickTotalValue != null &&
      quickTotalValue >= 1 &&
      quickTotalValue <= 1440;
    const quickHandsOnExceeds =
      quickTotalValid &&
      quickHandsOnValue != null &&
      quickHandsOnValue > quickTotalValue;
    const quickValid =
      quickTotalValid &&
      !quickHandsOnExceeds &&
      (quickHandsOnValue == null ||
        (quickHandsOnValue >= 0 && quickHandsOnValue <= 1440)) &&
      (quickPlatesValue == null ||
        (quickPlatesValue >= 1 && quickPlatesValue <= 50)) &&
      (quickCleanupValue == null ||
        (quickCleanupValue >= 0 && quickCleanupValue <= 1440));

    /**
     * Renders one labeled numeric field of the quick-time form. Called as a
     * function (not a nested component) so React never remounts the inputs —
     * a component defined in render would recreate the TextInput each keystroke
     * and drop keyboard focus.
     */
    const quickField = (
      label: string,
      value: string,
      onChange: (text: string) => void,
      opts: { optional?: boolean; focusRef?: boolean } = {},
    ) => (
      <View style={styles.quickField}>
        <Text style={styles.quickFieldLabel}>
          {label}
          {opts.optional ? (
            <Text style={styles.quickFieldOptional}>
              {` · ${t("quick.optional")}`}
            </Text>
          ) : null}
        </Text>
        <TextInput
          {...(opts.focusRef ? { ref: quickInputRef } : {})}
          style={styles.quickInput}
          value={value}
          onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
          placeholderTextColor={colors.inkFaint}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    );

    return (
      <View style={styles.section}>
        <Card padding={Space.lg}>
          <Pressable
            onPress={quickOpen ? () => setQuickOpen(false) : openQuick}
            onPressIn={() => setQuickPressed(true)}
            onPressOut={() => setQuickPressed(false)}
            accessibilityRole="button"
            accessibilityState={{ expanded: quickOpen }}
            hitSlop={Space.xs}
            style={[
              styles.quickTriggerRow,
              quickPressed ? { opacity: 0.7 } : null,
            ]}
          >
            <Ionicons
              name="stopwatch-outline"
              size={20}
              color={colors.accent}
            />
            <Text style={styles.quickTriggerLabel} numberOfLines={1}>
              {t("quick.didYouMake")}
            </Text>
            <Ionicons
              name={quickOpen ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.inkFaint}
            />
          </Pressable>
          {quickDone && !quickOpen ? (
            <Animated.Text
              style={[styles.quickSuccess, { opacity: quickFade }]}
              numberOfLines={1}
            >
              {quickAvg != null
                ? t("quick.thanksBreakdown", { time: fmtMin(quickAvg) })
                : // No server average (offline / sparse data): thank the
                  // user WITHOUT dressing their own input up as an average.
                  t("quick.thanksOwnTime")}
              {quickCleanupAvg != null
                ? ` · ${t("quick.thanksCleanup", {
                    cleanup: fmtMin(quickCleanupAvg),
                  })}`
                : ""}
            </Animated.Text>
          ) : null}
          {quickOpen ? (
            <View style={styles.quickForm}>
              {quickField(t("quick.plates"), quickPlates, setQuickPlates, {
                optional: true,
              })}
              {quickField(t("quick.handsOn"), quickHandsOn, setQuickHandsOn, {
                optional: true,
              })}
              {quickField(t("quick.totalQ"), quickTotal, setQuickTotal, {
                focusRef: true,
              })}
              {quickField(t("quick.cleanupQ"), quickCleanup, setQuickCleanup, {
                optional: true,
              })}
              {quickHandsOnExceeds ? (
                <Text style={styles.quickError}>
                  {t("quick.handsOnTooLong")}
                </Text>
              ) : null}
              <Button
                title={t("quick.submit")}
                variant="primary"
                fullWidth
                disabled={!quickValid}
                loading={quickSubmitting}
                onPress={onSubmitQuickTime}
              />
              {quickError != null ? (
                <Text style={styles.quickError}>{quickError}</Text>
              ) : null}
              {quickNeedsAuth ? (
                <Pressable
                  onPress={() => router.push("/login")}
                  hitSlop={Space.sm}
                  style={styles.quickSignIn}
                >
                  <Text style={styles.quickSignIn}>{t("quick.signIn")}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </Card>
      </View>
    );
  }),
);

interface NotesSectionProps {
  numericId: number;
  signedIn: boolean;
  myUserId: number | null;
  initialNote: { recipeId: number; text: string } | null;
  initialNotePublic: boolean;
  notes: RecipeNote[];
  notesLoading: boolean;
  notesHasMore: boolean;
  notesError: string | null;
  onRetryNotes: () => void;
  onLoadMoreNotes: () => void;
  onNoteCreated: (created: RecipeNote) => void;
  onNoteDeleted: (noteId: number) => void;
  colors: ThemeColors;
  styles: DetailStyles;
}

const NotesSection = memo(function NotesSection({
  numericId,
  signedIn,
  myUserId,
  initialNote,
  initialNotePublic,
  notes,
  notesLoading,
  notesHasMore,
  notesError,
  onRetryNotes,
  onLoadMoreNotes,
  onNoteCreated,
  onNoteDeleted,
  colors,
  styles,
}: NotesSectionProps) {
  const t = useT();

  // Personal note (local-only): derived from async SQLite seed until edited/saved.
  const [noteOverride, setNoteOverride] = useState<string | null>(null);
  const [savedNoteOverride, setSavedNoteOverride] = useState<string | null>(
    null,
  );
  const seededNote =
    initialNote && initialNote.recipeId === numericId ? initialNote.text : "";
  const note = noteOverride ?? seededNote;
  const savedNote = savedNoteOverride ?? seededNote;
  const [noteJustSaved, setNoteJustSaved] = useState(false);
  /** Set when the local note save fails — surfaced inline (never silent). */
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);
  // "Make public" toggle under the note editor: when on, saving the local note
  // ALSO posts it as a public community note. Persisted as the default.
  const [notePublicOverride, setNotePublicOverride] = useState<boolean | null>(
    null,
  );
  const notePublic = notePublicOverride ?? initialNotePublic;
  // Active tab of the merged notes card ("personal" = device-local note,
  // "community" = public notes list). Defaults to the personal note.
  const [notesTab, setNotesTab] = useState<"personal" | "community">(
    "personal",
  );
  // The personal-note editor is COLLAPSED by default: without this flag the
  // tab shows either the saved note (tap to edit) or an "Add a note" row —
  // the textarea/save/toggle stack only mounts while editing.
  const [noteEditing, setNoteEditing] = useState(false);

  // Compose row state (signed-in users only).
  const [noteDraft, setNoteDraft] = useState("");
  const [notePosting, setNotePosting] = useState(false);
  const [notePostError, setNotePostError] = useState<string | null>(null);
  const [noteHalalTerms, setNoteHalalTerms] = useState<string[] | null>(null);
  const [noteNeedsAuth, setNoteNeedsAuth] = useState(false);
  // Note ids already reported this visit — the icon flips to a ✓ and the
  // action no-ops (same per-item reported state as the community feed).
  const [reportedNoteIds, setReportedNoteIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const reportedNoteIdsRef = useRef(reportedNoteIds);
  useEffect(() => {
    reportedNoteIdsRef.current = reportedNoteIds;
  }, [reportedNoteIds]);

  // Hides the "Saved ✓" confirmation a few seconds after a successful save.
  const noteSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
    };
  }, []);

  // Community-note action toast: one transient line under the list
  // ("Note deleted" / "Reported — thank you"), same hide pattern as above.
  const [noteFlash, setNoteFlash] = useState<string | null>(null);
  const noteFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (noteFlashTimerRef.current) clearTimeout(noteFlashTimerRef.current);
    };
  }, []);

  /**
   * Post a public community note. Returns true on success. Maps failures to
   * the compose-row inline states: 401 → sign-in prompt, halal 422 → the
   * offending terms, anything else → the generic error string.
   */
  const postPublicNote = useCallback(
    async (body: string): Promise<boolean> => {
      if (!Number.isFinite(numericId) || body.trim() === "") return false;
      setNotePosting(true);
      setNotePostError(null);
      setNoteHalalTerms(null);
      setNoteNeedsAuth(false);
      try {
        const created = await postRecipeNote(numericId, body.trim());
        onNoteCreated(created);
        track("recipe_note_posted", { recipe_id: numericId });
        return true;
      } catch (error) {
        console.warn("[RecipeReal] note post failed:", error);
        if (error instanceof RecipeNoteUnauthorizedError) {
          setNoteNeedsAuth(true);
        } else if (error instanceof HalalRejectionError) {
          setNoteHalalTerms(error.terms);
          setNotePostError(
            t("detail.noteHalalBlocked", { terms: error.terms.join(", ") }),
          );
        } else if (error instanceof OfflineError) {
          setNotePostError(error.message);
        } else {
          setNotePostError(t("detail.notePostFailed"));
        }
        return false;
      } finally {
        setNotePosting(false);
      }
    },
    [numericId, onNoteCreated, t],
  );

  /** Flash the transient confirmation line under the notes list (3s). */
  const showNoteFlash = useCallback((message: string) => {
    setNoteFlash(message);
    if (noteFlashTimerRef.current) clearTimeout(noteFlashTimerRef.current);
    noteFlashTimerRef.current = setTimeout(() => setNoteFlash(null), 3000);
  }, []);

  /**
   * Delete the signed-in user's OWN community note: confirm → API → remove
   * from local state + toast. Failures are logged and leave the note (and
   * state) untouched.
   */
  const onDeleteNote = useCallback(
    (targetNote: RecipeNote) => {
      Alert.alert(
        t("notes.deleteConfirmTitle"),
        t("notes.deleteConfirmBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteRecipeNote(numericId, targetNote.id);
                  onNoteDeleted(targetNote.id);
                  setReportedNoteIds((prev) => {
                    const next = new Set(prev);
                    next.delete(targetNote.id);
                    return next;
                  });
                  showNoteFlash(t("notes.deleted"));
                  track("recipe_note_deleted", { recipe_id: numericId });
                } catch (error) {
                  console.warn("[RecipeReal] note delete failed:", error);
                }
              })();
            },
          },
        ],
      );
    },
    [numericId, onNoteDeleted, showNoteFlash, t],
  );

  /**
   * Report ANOTHER user's community note: confirm → API → mark reported.
   * Mirrors the post screen's report confirm flow; idempotent server-side.
   */
  const onReportNote = useCallback(
    (targetNote: RecipeNote) => {
      if (reportedNoteIdsRef.current.has(targetNote.id)) return;
      Alert.alert(
        t("notes.reportConfirmTitle"),
        t("notes.reportConfirmBody"),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("community.reportAction"),
            onPress: () => {
              void (async () => {
                try {
                  await reportRecipeNote(numericId, targetNote.id);
                  setReportedNoteIds((prev) => new Set(prev).add(targetNote.id));
                  showNoteFlash(t("notes.reported"));
                  track("recipe_note_reported", { recipe_id: numericId });
                } catch (error) {
                  console.warn("[RecipeReal] note report failed:", error);
                }
              })();
            },
          },
        ],
      );
    },
    [numericId, showNoteFlash, t],
  );

  /**
   * Saves the personal note locally, then flashes a "Saved ✓" confirmation.
   * When "Make public" is on (or was just flipped on — see the toggle
   * handler) and there is text to share, the same note is ALSO posted as a
   * public community note — a 401 surfaces the sign-in prompt on the compose
   * row while the local save still succeeds.
   */
  const onSaveNote = useCallback(
    async (forcePublic?: boolean) => {
      try {
        await saveNote(numericId, note);
        setSavedNoteOverride(note);
        setNoteSaveError(null);
        track("note_saved", { recipe_id: numericId });
        setNoteJustSaved(true);
        if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
        noteSavedTimerRef.current = setTimeout(() => {
          setNoteJustSaved(false);
        }, 3000);
        if ((forcePublic ?? notePublic) && note.trim() !== "") {
          await postPublicNote(note);
        }
      } catch {
        // Local save failed — surface it instead of failing silently.
        setNoteSaveError(t("detail.noteSaveFailed"));
      }
    },
    [numericId, note, notePublic, postPublicNote, t],
  );

  /**
   * Flipping "Make public" on with text present publishes IMMEDIATELY (no
   * separate Save needed); with no text the toggle is disabled — there is
   * nothing to make public.
   */
  const onToggleNotePublic = useCallback(
    (value: boolean) => {
      if (value && note.trim() === "") return;
      setNotePublicOverride(value);
      AsyncStorage.setItem(NOTE_PUBLIC_PREF_KEY, value ? "on" : "off").catch(
        () => {
          // Best-effort persistence.
        },
      );
      if (value) {
        void onSaveNote(true);
      }
    },
    [note, onSaveNote],
  );

  /** Send button of the compose row: post the draft, clear it on success. */
  const onSendNote = useCallback(async () => {
    const ok = await postPublicNote(noteDraft);
    if (ok) setNoteDraft("");
  }, [noteDraft, postPublicNote]);

  const noteDirty = note !== savedNote;

  return (
    <View style={styles.section}>
      <Card padding={Space.lg}>
        <View style={styles.notesSegment}>
          {(["personal", "community"] as const).map((tab, index) => (
            <Fragment key={tab}>
              {index === 1 ? <View style={styles.notesSegmentDivider} /> : null}
              <Pressable
                onPress={() => setNotesTab(tab)}
                accessibilityRole="button"
                accessibilityState={{ selected: notesTab === tab }}
                style={[
                  styles.notesSegmentBtn,
                  notesTab === tab ? styles.notesSegmentBtnActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.notesSegmentLabel,
                    notesTab === tab ? styles.notesSegmentLabelActive : null,
                  ]}
                >
                  {tab === "personal"
                    ? t("detail.notesTabPersonal")
                    : t("detail.notesTabCommunity")}
                </Text>
              </Pressable>
            </Fragment>
          ))}
        </View>

        {notesTab === "personal" ? (
          noteEditing ? (
            <>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(text) => {
                  setNoteOverride(text);
                  if (noteSaveError) setNoteSaveError(null);
                }}
                placeholder={t("detail.notesPlaceholder")}
                placeholderTextColor={colors.inkFaint}
                multiline
                autoFocus
              />
              <View style={styles.noteActions}>
                <Button
                  variant="primary"
                  disabled={!noteDirty}
                  title={t("detail.saveNote")}
                  onPress={onSaveNote}
                />
                {noteJustSaved ? (
                  <Text style={styles.noteSaved}>{t("detail.saved")}</Text>
                ) : null}
                <View style={styles.publicToggleInline}>
                  <Text style={styles.publicToggleLabel} numberOfLines={1}>
                    {t("detail.notePublicToggle")}
                  </Text>
                  <Toggle
                    value={notePublic}
                    disabled={note.trim() === ""}
                    onValueChange={onToggleNotePublic}
                  />
                </View>
              </View>
              {noteSaveError ? (
                <Text style={styles.noteError}>{noteSaveError}</Text>
              ) : null}
            </>
          ) : savedNote.length > 0 ? (
            <Pressable
              onPress={() => {
                setNoteOverride(savedNote);
                setNoteEditing(true);
              }}
              hitSlop={Space.xs}
              accessibilityRole="button"
              style={styles.noteViewRow}
            >
              <Text style={styles.noteViewText}>{savedNote}</Text>
              <Text style={styles.noteEditHint}>{t("detail.editNote")}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                setNoteOverride("");
                setNoteEditing(true);
              }}
              hitSlop={Space.xs}
              accessibilityRole="button"
              style={styles.noteAddRow}
            >
              <Ionicons
                name="pencil-outline"
                size={16}
                color={colors.inkFaint}
              />
              <Text style={styles.noteAddPlaceholder}>
                {t("detail.addNote")}
              </Text>
            </Pressable>
          )
        ) : (
          <>
            {notesError != null ? (
              <View style={styles.notesCenter}>
                <Text style={styles.notesMuted}>{notesError}</Text>
                <Button
                  variant="ghost"
                  title={t("common.retry")}
                  onPress={onRetryNotes}
                />
              </View>
            ) : notesLoading && notes.length === 0 ? (
              <View style={styles.notesCenter}>
                <ActivityIndicator color={colors.accent} size="small" />
              </View>
            ) : notes.length === 0 ? (
              <View style={styles.emptyBlock}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons
                    name="chatbox-ellipses-outline"
                    size={22}
                    color={colors.accent}
                  />
                </View>
                <Text style={styles.emptyText}>{t("detail.notesEmpty")}</Text>
              </View>
            ) : (
              <View style={styles.notesList}>
                {notes.map((item) => (
                  <NoteRow
                    key={`note-${item.id}`}
                    item={item}
                    mine={myUserId != null && item.user.id === myUserId}
                    reported={reportedNoteIds.has(item.id)}
                    onDelete={onDeleteNote}
                    onReport={onReportNote}
                    inkFaintColor={colors.inkFaint}
                    successColor={colors.success}
                    styles={styles}
                  />
                ))}
                {noteFlash != null ? (
                  <Text style={styles.noteFlash}>{noteFlash}</Text>
                ) : null}
                {notesHasMore ? (
                  <Button
                    variant="ghost"
                    title={t("detail.loadMoreNotes")}
                    loading={notesLoading}
                    disabled={notesLoading}
                    onPress={onLoadMoreNotes}
                    style={styles.notesLoadMore}
                  />
                ) : null}
              </View>
            )}
            {signedIn ? (
              <View style={styles.noteCompose}>
                <View style={styles.noteComposeRow}>
                  <TextInput
                    style={styles.noteComposeInput}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder={t("detail.noteComposePlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    maxLength={1000}
                    editable={!notePosting}
                  />
                  <Button
                    variant="primary"
                    title={t("detail.noteSend")}
                    loading={notePosting}
                    disabled={notePosting || noteDraft.trim().length === 0}
                    onPress={onSendNote}
                  />
                </View>
                {noteHalalTerms != null ? (
                  <Text style={styles.noteError}>
                    {noteHalalTerms.join(", ")}
                  </Text>
                ) : null}
                {notePostError != null && noteHalalTerms == null ? (
                  <Text style={styles.noteError}>{notePostError}</Text>
                ) : null}
                {noteNeedsAuth ? (
                  <Pressable
                    onPress={() => router.push("/login")}
                    hitSlop={Space.sm}
                  >
                    <Text style={styles.noteSignIn}>
                      {t("detail.notesSignIn")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={() => router.push("/login")}
                hitSlop={Space.sm}
                style={styles.noteCompose}
              >
                <Text style={styles.noteSignIn}>{t("detail.notesSignIn")}</Text>
              </Pressable>
            )}
          </>
        )}
      </Card>
    </View>
  );
});

interface TriesSectionProps {
  tries: Post[];
  triesTotal: number;
  onShareTry: () => void;
  accentColor: string;
  styles: DetailStyles;
}

const TriesSection = memo(function TriesSection({
  tries,
  triesTotal,
  onShareTry,
  accentColor,
  styles,
}: TriesSectionProps) {
  const t = useT();
  const [triesExpanded, setTriesExpanded] = useState(false);

  const visibleTries = triesExpanded
    ? tries
    : tries.slice(0, TRIES_PREVIEW_COUNT);

  return (
    <View style={styles.section}>
      <Card padding={Space.lg}>
        <SectionHeader
          title={
            triesTotal > 0
              ? t("detail.communityTriesCount", { n: triesTotal })
              : t("detail.communityTries")
          }
        />
        {tries.length === 0 ? (
          <View style={styles.emptyBlock}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="images-outline" size={22} color={accentColor} />
            </View>
            <Text style={styles.emptyText}>{t("detail.triesEmpty")}</Text>
            <Button
              variant="ghost"
              title={t("detail.shareYourTry")}
              onPress={onShareTry}
            />
          </View>
        ) : (
          <View style={styles.triesList}>
            {visibleTries.map((item) => (
              <TryRow key={`try-${item.id}`} item={item} styles={styles} />
            ))}
            {!triesExpanded && tries.length > TRIES_PREVIEW_COUNT ? (
              <Button
                variant="ghost"
                title={t("detail.showAllTries")}
                onPress={() => setTriesExpanded(true)}
                style={styles.triesShowAll}
              />
            ) : null}
          </View>
        )}
      </Card>
    </View>
  );
});

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const validRecipeId = Number.isFinite(numericId);
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { dir } = useLang();
  const fmtMin = useFmtMinutes();
  const lr = useLocalizedRecipe();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // True while the screen paints a LIGHT cached row (no structured
  // recipe_steps) and the fresh copy is still loading: the timeline section
  // shows its compact inline placeholder and Cook Mode stays disabled until
  // steps land (or the fetch settles without any).
  const [stepsPending, setStepsPending] = useState(false);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [initialNote, setInitialNote] = useState<{
    recipeId: number;
    text: string;
  } | null>(null);
  const [initialNotePublic, setInitialNotePublic] = useState(false);
  // Sign-in state for the owner Edit control + note compose row (read once).
  const [signedIn, setSignedIn] = useState(false);

  // ---- Community notes (public, paginated 20/page) -----------------------------
  const [notes, setNotes] = useState<RecipeNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesHasMore, setNotesHasMore] = useState(false);
  const [notesPage, setNotesPage] = useState(1);
  const [notesError, setNotesError] = useState<string | null>(null);
  // Once-only guard for the community_notes_viewed analytics event (ref: no
  // re-render needed — see the tracking effect below).
  const notesTrackedRef = useRef(false);
  // Signed-in user's id: routes each community note to Delete (own) vs
  // Report (others). Null until the profile resolves (or when signed out).
  const [myUserId, setMyUserId] = useState<number | null>(null);

  // ---- Community tries (posts attached to this recipe) -----------------------
  // null = not loaded yet (or the load failed silently) → the section stays
  // hidden; an empty array = loaded + no posts → the empty state shows.
  const [tries, setTries] = useState<Post[] | null>(null);
  // Paginator total from the server (the true count even past the 20-row page).
  const [triesTotal, setTriesTotal] = useState(0);

  // Server-recomputed average returned right after a quick-time submission on
  // this device (undefined until submitted; lets FactBox update without owning
  // form keystroke state).
  const [quickSubmittedAvg, setQuickSubmittedAvg] = useState<
    number | null | undefined
  >(undefined);
  const quickCardRef = useRef<QuickTimeCardHandle | null>(null);

  // ---- Start-time planner (eat-at mode) --------------------------------------
  // Target eat time as a ms epoch; null = "start now" mode (the timeline
  // anchors at the per-recipe load moment). Any stepper press enters plan
  // mode and REANCHORS the timeline so dinner lands at the chosen time.
  const [planEatAt, setPlanEatAt] = useState<number | null>(null);
  // "Notify me" scheduling: spinner while arming, scheduled-step count after.
  const [planLoading, setPlanLoading] = useState(false);
  const [planCount, setPlanCount] = useState<number | null>(null);
  // Ids of the currently scheduled plan notifications (kept in a ref: no
  // re-renders; used to replace/cancel the plan and cleared on unmount).
  const planIdsRef = useRef<(string | null)[]>([]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cancel any scheduled plan notifications when the screen unmounts.
  useEffect(() => {
    return () => {
      cancelPlannedNotifications(planIdsRef.current).catch(() => {
        // Best-effort cleanup.
      });
    };
  }, []);

  const styles = useMemo(
    () => createDetailStyles(colors, dir),
    [colors, dir],
  );

  // Monotonic load id: only the LATEST loadRecipe may commit state, so a
  // background revalidation or a retry can never clobber a newer recipe.
  const loadRequestIdRef = useRef(0);

  /**
   * Error-state escape hatch: dismiss the whole stack back to the home tab
   * (falls back to a replace when there is nothing to dismiss).
   */
  const goHome = useCallback(() => {
    if (router.canDismiss()) {
      router.dismissTo("/");
    } else {
      router.replace("/");
    }
  }, []);

  const loadRecipe = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setErrorMessage(null);
    setRecipe((prev) => (prev && prev.id === numericId ? prev : null));
    timelineTrackedRef.current = false;
    notesTrackedRef.current = false;
    // Reset planner + quick-time override + note seed for the (new) recipe;
    // any notifications armed for the previous recipe are cancelled.
    cancelPlannedNotifications(planIdsRef.current).catch(() => {});
    planIdsRef.current = [];
    setPlanEatAt(null);
    setPlanLoading(false);
    setPlanCount(null);
    setQuickSubmittedAvg(undefined);
    setInitialNote(null);
    setStepsPending(false);

    let networkResolved = false;
    let paintedFromCache = false;
    let viewedTracked = false;
    const markViewed = (recipeId: number) => {
      if (viewedTracked) return;
      viewedTracked = true;
      track("recipe_viewed", { recipe_id: recipeId });
    };

    // Fire local SQLite reads (cached recipe, favorite flag, personal note)
    // and the live network fetch CONCURRENTLY so there is no 3-stage
    // waterfall. Only transition into full-screen "loading" if cache misses
    // AND network has not resolved yet (zero spinner flash for cached hits).
    if (validRecipeId) {
      isFavorite(numericId)
        .then((fav) => {
          if (requestId === loadRequestIdRef.current) setFavorited(fav);
        })
        .catch(() => {
          // Favorites are best-effort; never crash the detail screen.
        });

      getNote(numericId)
        .then((stored) => {
          if (requestId === loadRequestIdRef.current) {
            setInitialNote({ recipeId: numericId, text: stored ?? "" });
          }
        })
        .catch(() => {
          // Notes are best-effort; never block the detail screen.
        });
    }

    const cachePromise = (
      validRecipeId
        ? getCachedRecipe(numericId).catch(() => null)
        : Promise.resolve(null)
    ).then((result) => {
      if (requestId !== loadRequestIdRef.current) return;
      if (networkResolved) return;
      if (result != null) {
        paintedFromCache = true;
        setRecipe(result);
        setState("ready");
        setStepsPending((result.recipe_steps?.length ?? 0) === 0);
        markViewed(result.id);
      } else {
        setState("loading");
      }
    });

    try {
      const fetched = await getRecipe(id);
      networkResolved = true;
      if (fetched.recipe_steps?.length) {
        upsertRecipes([fetched], { withSteps: true }).catch(() => {});
      }
      if (requestId !== loadRequestIdRef.current) return;
      setRecipe(fetched);
      setStepsPending(false);
      setState("ready");
      markViewed(fetched.id);
    } catch (error) {
      await cachePromise;
      if (requestId !== loadRequestIdRef.current) return;
      if (paintedFromCache) {
        // Offline: the cached copy stays on screen; the placeholder makes
        // way for the plain-text steps when the row carries any.
        setStepsPending(false);
        console.warn("[RecipeReal] detail revalidation failed:", error);
        return;
      }
      console.warn("[RecipeReal] loadRecipe failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : t("common.loadFailedRecipe"),
      );
      setState("error");
    }
  }, [id, numericId, validRecipeId, t]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  // Best-effort: load personalized pace multipliers after navigation push
  // transitions complete. Only when authenticated; never blocks the recipe view.
  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        if (cancelled || !(await hasToken())) return;
        try {
          const items = await refreshPaceCalibrations();
          if (!cancelled) setCalibrations(items);
        } catch (error) {
          console.warn("[RecipeReal] pace load failed:", error);
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  /** Toggles the favorite state; storage failures are silently ignored. */
  const onToggleFavorite = useCallback(async () => {
    try {
      // Full recipe: hearting may happen before any cache write of this row
      // (deep-linked detail), and the db layer upserts it so the FK holds.
      const now = await toggleFavorite(recipe ?? Number(id));
      setFavorited(now);
      track("favorite_toggled", {
        recipe_id: Number(id),
        favorited: now,
      });
    } catch {
      // Favorites are best-effort; never crash the detail screen.
    }
  }, [id, recipe]);

  /**
   * Opens the system share sheet with the recipe's PUBLIC WEB PAGE
   * (https://recipe-real.softland.tech/r/{id} — a real https link with an
   * OpenGraph preview, so WhatsApp and friends render a rich card) and the
   * localized title as the message. Tracked once per press; dismissing the
   * sheet is not an error.
   */
  const onShare = useCallback(async () => {
    if (!recipe) return;
    track("recipe_shared", { recipe_id: recipe.id });
    try {
      await shareLink(`${WEB_BASE_URL}/r/${recipe.id}`, lr.title(recipe));
    } catch {
      // The user dismissed the sheet (or the platform errored) — best-effort.
    }
  }, [recipe, lr]);

  const openQuick = useCallback(() => {
    quickCardRef.current?.open();
  }, []);

  const handleQuickTimeSubmitted = useCallback(
    (communityAvgMinutes: number | null) => {
      setQuickSubmittedAvg(communityAvgMinutes);
    },
    [],
  );

  const publisher = roundMin(recipe?.publisher_time_minutes);
  const community = roundMin(recipe?.community_avg_minutes);
  const cleanupAvg = roundMin(recipe?.cleanup_avg_minutes);
  const cleanupEstimate = roundMin(recipe?.cleanup_estimate_minutes);
  // Prefer the model-based cleanup estimate, fall back to community average.
  const cleanup = cleanupEstimate ?? cleanupAvg;
  // Best-known cook time feeding the "Total incl. cleanup" stat: the same
  // single display figure every card and the "Really takes" cell lead with
  // (reality → community consensus → publisher claim).
  const cookMinutes = roundMin(recipe ? bestMinutes(recipe) : null);
  // Reality-check block (server-maintained best-known real time vs. claim).
  const reality = recipe?.reality ?? null;
  const realityGap = reality?.gap_pct ?? null;
  // "Cooks average" cell: the maintained reality copy when present, else the
  // community consensus, or — once THIS device submits a quick time — the
  // server-recomputed average it returns.
  const cooksAvg =
    reality != null
      ? roundMin(reality.minutes)
      : (community ??
        (quickSubmittedAvg !== undefined
          ? roundMin(quickSubmittedAvg)
          : null));

  // "Really takes" big stat: reality copy → community consensus → publisher
  // claim fallback, so the second stat never reads empty on sparse data.
  const reallyTakes = cooksAvg ?? publisher;

  const totalInclCleanup =
    cookMinutes != null && cleanup != null ? cookMinutes + cleanup : null;

  const chips = recipe ? cleanupChips(t, recipe.cleanup_factors) : [];

  // Reality badge chip (tone + label), computed once for the gap thresholds.
  const realityChip =
    realityGap != null ? realityBadge(t, realityGap) : null;

  // Memoized so the timeline memo below (and any other consumer) gets a
  // stable identity — the `?? []` fallback would otherwise allocate a fresh
  // array every render and defeat downstream memoization.
  const steps: RecipeStep[] = useMemo(() => recipe?.recipe_steps ?? [], [recipe]);

  // Localized ingredient text list, paired by index with the structured rows.
  const ingredientLines = recipe ? lr.ingredients(recipe) : [];
  const structuredIngredients = useMemo(
    () =>
      parseStructuredIngredients(
        (recipe as { ingredients_structured?: unknown } | null)
          ?.ingredients_structured,
      ),
    [recipe],
  );
  // Use the structured rows only when they line up 1:1 with the (possibly
  // localized) text list — otherwise plain bullets stay the fallback.
  const structuredAligned =
    ingredientLines.length > 0 &&
    structuredIngredients.length === ingredientLines.length;

  // Anchor the clock walk once per recipe (not per render) so re-renders —
  // heart toggles, quick-time keystrokes — never shift the displayed times.
  const timelineStart = useMemo(() => Date.now(), [recipe?.id, steps.length]);

  /**
   * Everything derived from the pace calibrations + the step list: the
   * multiplier map, the personalized total and the walked timeline. Computed
   * in ONE memo so quick-time keystrokes / heart toggles (unrelated state)
   * never re-walk the steps or rebuild the map on every render.
   */
  const {
    personalTotal,
    adjustedForStep,
    timelineRows,
    eatAtMs,
    eatAt,
    startBy,
  } = useMemo(() => {
    // Build a step_type -> multiplier map.
    const paceMap = new Map<string, number>();
    for (const c of calibrations) paceMap.set(c.step_type, c.multiplier);

    /**
     * Personalized total: sum each non-cleanup step's community minutes scaled
     * by its multiplier, plus the recipe-level cleanup_avg scaled if a cleanup
     * calibration exists. Falls back to the raw community value (multiplier 1)
     * when no calibration is present.
     */
    let personalizedTotal: number | null = null;
    if (calibrations.length > 0 && recipe) {
      let sum = 0;
      let hasAny = false;
      for (const step of steps) {
        if (step.step_type === "cleanup") continue;
        // Per-step publisher fallback: a missing community figure alone must
        // not drop the step from the personalized estimate.
        const stepM = stepMinutes(step);
        if (stepM == null) continue;
        const mult = paceMap.get(step.step_type) ?? 1;
        sum += stepM * mult;
        hasAny = true;
      }
      if (recipe.cleanup_avg_minutes != null) {
        const cleanupMult = paceMap.get("cleanup");
        sum += recipe.cleanup_avg_minutes * (cleanupMult ?? 1);
        hasAny = true;
      }
      if (hasAny) personalizedTotal = Math.round(sum);
    }

    /** Adjusted minutes for a single step (null when no calibration applies). */
    const adjustFor = (step: RecipeStep): number | null => {
      if (step.community_minutes == null) return null;
      const mult = paceMap.get(step.step_type);
      if (mult == null || mult === 1) return null;
      return Math.round(step.community_minutes * mult);
    };

    // Timeline: cooking steps only — cleanup is quoted separately (you eat
    // first). The distribution runs over THESE steps so the walked clock adds
    // back up to the recipe's stated total by construction.
    const timelineSteps = steps.filter((s) => s.step_type !== "cleanup");

    /**
     * Effective minutes used by the "When's dinner ready?" timeline: the
     * pace-adjusted value when a calibration applies, else the step's own
     * community/publisher figure, else its word-weighted share of the recipe
     * total (never a flat 3-minute guess unless the recipe has no total).
     */
    const minutesForStep = (step: RecipeStep): number =>
      adjustFor(step) ?? estimateStepMinutes(step, recipe, timelineSteps);

    // Walk the cooking steps into (step, minutes) pairs; the absolute clock
    // times are stamped from the anchor below so flipping between "start now"
    // and "eating at" modes reanchors without re-walking.
    const base: { step: RecipeStep; minutes: number }[] = [];
    let totalMs = 0;
    for (const step of timelineSteps) {
      const minutes = minutesForStep(step);
      base.push({ step, minutes });
      totalMs += minutes * 60000;
    }
    // Planner anchor: eat-at mode walks BACK from the chosen eat time
    // (start = eatAt − total); now-mode anchors at the fixed load moment.
    const anchor =
      planEatAt != null ? planEatAt - totalMs : timelineStart;
    const rows: { step: RecipeStep; at: Date; minutes: number }[] = [];
    let offset = 0;
    for (const { step, minutes } of base) {
      rows.push({ step, minutes, at: new Date(anchor + offset) });
      offset += minutes * 60000;
    }
    // Eat time ("Start now" target or the planner's choice) and the matching
    // "start by" moment — cleanup is intentionally excluded (you eat first).
    return {
      personalTotal: personalizedTotal,
      adjustedForStep: adjustFor,
      timelineRows: rows,
      eatAtMs: anchor + totalMs,
      eatAt: new Date(anchor + totalMs),
      startBy: new Date(anchor),
    };
  }, [calibrations, recipe, steps, planEatAt, timelineStart]);

  /**
   * Shift the target eat time by ±15-minute steps, entering eat-at mode (the
   * timeline reanchors on the next render via the planEatAt state).
   */
  const shiftEatAt = useCallback(
    (deltaMinutes: number) => {
      setPlanEatAt(eatAtMs + deltaMinutes * 60_000);
    },
    [eatAtMs],
  );

  // ---- Start-time planner: step-boundary notifications ----------------------

  /**
   * Arm the plan: schedule a local notification at each of the next step
   * boundaries (capped at MAX_PLAN_STEPS; cleanup steps are already excluded
   * from the timeline). Any previously armed plan is replaced first.
   * Permission is requested via the existing helper — a denial leaves the
   * planner usable but schedules nothing. Success shows the "We'll nudge
   * you…" caption plus a Cancel button; boundaries already in the past (or
   * beyond the ~3h clamp) are skipped by scheduleAtNotification itself.
   */
  const onNotifyMe = useCallback(async () => {
    if (!recipe || planLoading) return;
    setPlanLoading(true);
    try {
      // Replace any previous plan first so re-pressing reschedules cleanly.
      const previous = planIdsRef.current;
      planIdsRef.current = [];
      await cancelPlannedNotifications(previous);
      if (!(await requestNotificationsPermission())) return;
      const title = lr.title(recipe);
      const ids: string[] = [];
      for (const row of timelineRows.slice(0, MAX_PLAN_STEPS)) {
        const base = t("detail.planStepBody", {
          n: row.step.step_number,
          time: formatClock(row.at),
        });
        // First 40 chars of the localized step description as a reminder.
        const snippet = lr.stepDescription(row.step).slice(0, 40).trim();
        const id = await scheduleAtNotification(
          title,
          snippet ? `${base} — ${snippet}` : base,
          row.at,
          { kind: "plan", recipeId: String(recipe.id) },
        );
        if (id) ids.push(id);
      }
      planIdsRef.current = ids;
      if (ids.length > 0) {
        setPlanCount(ids.length);
        track("plan_notifications_set", {
          recipe_id: recipe.id,
          steps: ids.length,
        });
      }
    } catch (error) {
      // Scheduling is best-effort; never crash the detail screen.
      console.warn("[RecipeReal] plan notifications failed:", error);
    } finally {
      setPlanLoading(false);
    }
  }, [recipe, planLoading, timelineRows, t, lr]);

  /** Clear every scheduled plan notification and hide the success state. */
  const onCancelPlan = useCallback(async () => {
    const ids = planIdsRef.current;
    planIdsRef.current = [];
    setPlanCount(null);
    await cancelPlannedNotifications(ids);
  }, []);

  const ready = state === "ready" && recipe;

  // Fire the timeline analytics event once, when the section first renders.
  const timelineTrackedRef = useRef(false);
  useEffect(() => {
    if (!ready || timelineTrackedRef.current) return;
    if (steps.length === 0) return;
    timelineTrackedRef.current = true;
    track("timeline_viewed", { recipe_id: Number(id) });
  }, [ready, steps.length, id]);

  // Sign-in state for the owner Edit control + note compose row (read once),
  // plus the persisted "Make public" note toggle default. Profile fetch is
  // deferred after push interactions and gated on hasToken().
  useEffect(() => {
    let cancelled = false;
    let profileTask: ReturnType<typeof InteractionManager.runAfterInteractions> | null =
      null;
    (async () => {
      const [ok, pref] = await Promise.all([
        hasToken(),
        AsyncStorage.getItem(NOTE_PUBLIC_PREF_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      setSignedIn(ok);
      setInitialNotePublic(pref === "on");
      if (!ok) return;
      profileTask = InteractionManager.runAfterInteractions(() => {
        void (async () => {
          if (cancelled || !(await hasToken())) return;
          try {
            const me = await fetchMyProfile();
            if (!cancelled) setMyUserId(me.id);
          } catch {
            // Non-fatal: notes just show the Report action to everyone.
          }
        })();
      });
    })();
    return () => {
      cancelled = true;
      profileTask?.cancel();
    };
  }, []);

  // ---- Community notes loading ---------------------------------------------------
  const notesLoadedForIdRef = useRef<number | null>(null);
  const notesRequestIdRef = useRef(0);

  /** Reset + fetch page 1 of the public notes for the current recipe. */
  const loadNotes = useCallback(async () => {
    if (!validRecipeId) return;
    const reqId = ++notesRequestIdRef.current;
    notesLoadedForIdRef.current = numericId;
    setNotesLoading(true);
    setNotesError(null);
    try {
      const page = await fetchRecipeNotes(numericId, 1);
      if (!mountedRef.current || reqId !== notesRequestIdRef.current) return;
      setNotes(page.notes);
      setNotesHasMore(page.hasMore);
      setNotesPage(1);
    } catch (error) {
      if (!mountedRef.current || reqId !== notesRequestIdRef.current) return;
      console.warn("[RecipeReal] notes load failed:", error);
      setNotes([]);
      setNotesHasMore(false);
      setNotesError(t("detail.notesLoadFailed"));
    } finally {
      if (mountedRef.current && reqId === notesRequestIdRef.current) {
        setNotesLoading(false);
      }
    }
  }, [validRecipeId, numericId, t]);

  // Load page 1 immediately keyed on numericId (not gated on `ready`),
  // guarded so initial mount fires at most once per recipe id.
  useEffect(() => {
    if (!validRecipeId) return;
    if (notesLoadedForIdRef.current === numericId) return;
    void loadNotes();
  }, [validRecipeId, numericId, loadNotes]);

  // ---- Community tries loading ---------------------------------------------------
  const triesLoadedForIdRef = useRef<number | null>(null);
  const triesRequestIdRef = useRef(0);

  /**
   * Load page 1 of the community posts attached to this recipe
   * (GET /api/posts?recipe_id=). Non-blocking and un-gated from `ready`:
   * fires once per numericId on mount alongside getRecipe, and a silent
   * failure keeps the section hidden instead of erroring an otherwise
   * healthy screen.
   */
  useEffect(() => {
    if (!validRecipeId) return;
    if (triesLoadedForIdRef.current === numericId) return;
    triesLoadedForIdRef.current = numericId;
    const reqId = ++triesRequestIdRef.current;
    setTries(null);
    setTriesTotal(0);
    fetchRecipePosts(numericId, 1)
      .then((page) => {
        if (!mountedRef.current || reqId !== triesRequestIdRef.current) return;
        setTries(page.posts);
        setTriesTotal(page.total ?? page.posts.length);
      })
      .catch((error) => {
        // Silent failure: the section stays hidden (tries === null).
        console.warn("[RecipeReal] community tries load failed:", error);
      });
  }, [validRecipeId, numericId]);

  /**
   * A just-published try for THIS recipe ("Share your try" → composer →
   * back): prepend it without waiting for a remount. Peek, don't consume —
   * the community tab still needs the marker for its pin + banner. Guarded
   * per post id so repeated focuses don't double-prepend.
   */
  const appliedTryRef = useRef<number | null>(null);
  useFocusEffect(
    useCallback(() => {
      const created = peekPostCreated();
      const rid = Number(id);
      if (
        created == null ||
        !Number.isFinite(rid) ||
        created.recipe?.id !== rid ||
        appliedTryRef.current === created.id
      ) {
        return;
      }
      appliedTryRef.current = created.id;
      setTries((prev) =>
        prev ? [created, ...prev.filter((p) => p.id !== created.id)] : prev,
      );
      setTriesTotal((n) => n + 1);
    }, [id]),
  );

  /**
   * "Share your try" ghost button of the empty community-tries state —
   * signed-out users land on /login; everyone else on /post-composer with
   * THIS recipe pre-attached (recipeId + display title params).
   */
  const startShareTry = useCallback(() => {
    if (signedIn === false) {
      router.push("/login");
      return;
    }
    // Prefill the composer with THIS recipe so the try post is attached
    // automatically (title passed for instant display; id is the source of
    // truth for recipe_id).
    router.push({
      pathname: "/post-composer",
      params: {
        recipeId: String(recipe?.id ?? ""),
        recipeTitle: recipe ? lr.title(recipe) : "",
      },
    });
  }, [signedIn, recipe, lr]);

  // Fire the community-notes analytics event once per screen entry, after the
  // section has actually rendered with content (or a definitive empty list).
  // A ref (not state) guards the once-only semantics without re-rendering.
  useEffect(() => {
    if (!ready || notesLoading || notesTrackedRef.current) return;
    notesTrackedRef.current = true;
    track("community_notes_viewed", { recipe_id: Number(id) });
  }, [ready, notesLoading, id]);

  /** Fetch the next notes page and append (deduped by id). */
  const loadMoreNotes = useCallback(async () => {
    if (!validRecipeId || notesLoading) return;
    const reqId = ++notesRequestIdRef.current;
    setNotesLoading(true);
    try {
      const page = await fetchRecipeNotes(numericId, notesPage + 1);
      if (!mountedRef.current || reqId !== notesRequestIdRef.current) return;
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.notes.filter((n) => !seen.has(n.id))];
      });
      setNotesHasMore(page.hasMore);
      setNotesPage((p) => p + 1);
    } catch (error) {
      if (mountedRef.current && reqId === notesRequestIdRef.current) {
        console.warn("[RecipeReal] notes load-more failed:", error);
      }
    } finally {
      if (mountedRef.current && reqId === notesRequestIdRef.current) {
        setNotesLoading(false);
      }
    }
  }, [validRecipeId, numericId, notesPage, notesLoading]);

  const handleNoteCreated = useCallback((created: RecipeNote) => {
    setNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
  }, []);

  const handleNoteDeleted = useCallback((noteId: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  // Tiny attribution line under the hero title — hostname only, never the
  // full raw URL (long scraper URLs read as noise).
  const sourceHost = recipe?.source_url ? hostOf(recipe.source_url) : null;
  // ★ rating meta line (joined with the hostname into ONE caption).
  const ratingText =
    recipe?.aggregated_rating != null
      ? recipe.review_count != null && recipe.review_count > 0
        ? t("detail.ratingWithCount", {
            rating: recipe.aggregated_rating.toFixed(1),
            n: recipe.review_count,
          })
        : t("detail.ratingOnly", {
            rating: recipe.aggregated_rating.toFixed(1),
          })
      : null;

  return (
    // Single avoidance mechanism: KeyboardAwareScrollView scrolls the
    // focused field above the keyboard (a KeyboardAvoidingView wrapper
    // double-counted it as a scrollable empty band). The pinned Cook-Mode
    // footer rides the keyboard via KeyboardStickyView instead.
    <View style={styles.screen}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
      >
        {/* Centered, max-width column so the screen reads cleanly on tablets. */}
        <View style={styles.columnWrap}>
          {state === "loading" && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.muted}>{t("common.loadingRecipe")}</Text>
            </View>
          )}

          {state === "error" && (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                {t("common.somethingWentWrong")}
              </Text>
              <Text style={styles.muted}>
                {errorMessage ?? t("common.couldNotLoadRecipe")}
              </Text>
              <IconPressable style={styles.retry} onPress={loadRecipe}>
                <Text style={styles.retryText}>{t("common.retry")}</Text>
              </IconPressable>
              {/* Escape hatch: never leave the user stranded on a dead detail
                  screen — one tap back to the home tab. */}
              <IconPressable style={styles.errorHomeBtn} onPress={goHome}>
                <Text style={styles.errorHomeText}>{t("common.goHome")}</Text>
              </IconPressable>
            </View>
          )}

          {ready && (
            <>
              {/* HERO — full-bleed photo section (restored: the flat in-flow
                  photo felt weaker). Title + rating + publisher live over the
                  scrim; floating dark-circle buttons over the photo; the body
                  below stays a flat padded document. */}
              <View style={styles.heroWrap}>
                <HeroImage
                  uri={recipe.image_url}
                  height={300}
                  withScrim
                  rounded={0}
                >
                  <View
                    style={[
                      styles.heroOverlay,
                      {
                        paddingBottom: Space.lg,
                        paddingTop: insets.top + Space.xl,
                      },
                    ]}
                  >
                    <Text
                      style={
                        recipe.image_url
                          ? styles.heroTitle
                          : styles.heroTitlePlain
                      }
                      numberOfLines={3}
                    >
                      {lr.title(recipe)}
                    </Text>
                    {ratingText != null || sourceHost != null ? (
                      <Text
                        style={
                          recipe.image_url
                            ? styles.heroRating
                            : styles.heroRatingPlain
                        }
                        numberOfLines={1}
                      >
                        {[ratingText, sourceHost].filter(Boolean).join("  ·  ")}
                      </Text>
                    ) : null}
                  </View>
                </HeroImage>
              </View>

              {/* Floating back button over the hero. */}
              <IconPressable
                style={[styles.backButton, { top: insets.top + Space.sm }]}
                onPress={() => router.back()}
                hitSlop={Space.sm}
                accessibilityLabel={t("detail.backA11y")}
              >
                <Ionicons
                  name={dir === "rtl" ? "chevron-forward" : "chevron-back"}
                  size={24}
                  color="#FFFFFF"
                />
              </IconPressable>

              {/* Floating favorite toggle over the hero (mirrors the back button). */}
              <IconPressable
                style={[styles.favButton, { top: insets.top + Space.sm }]}
                onPress={onToggleFavorite}
                hitSlop={Space.sm}
                accessibilityLabel={
                  favorited
                    ? t("detail.favoriteRemoveA11y")
                    : t("detail.favoriteAddA11y")
                }
              >
                <Ionicons
                  name={favorited ? "heart" : "heart-outline"}
                  size={20}
                  color={favorited ? "#E8384F" : "#FFFFFF"}
                />
              </IconPressable>

              {/* Floating share button over the hero (beside the favorite):
                  opens the system sheet with the public web page URL. */}
              <IconPressable
                style={[styles.shareButton, { top: insets.top + Space.sm }]}
                onPress={onShare}
                hitSlop={Space.sm}
                accessibilityLabel={t("detail.shareA11y")}
              >
                <Ionicons name="arrow-redo" size={18} color="#FFFFFF" />
              </IconPressable>

              {/* Flat padded body — no overlapping card. */}
              <View style={styles.pagePad}>
                {/* FACT BOX — ONE bordered piece: "Recipe says" (neutral) vs
                    "Really takes" (timing teal — the honest-time brand pair),
                    plus the single reality badge. Nothing else: cleanup
                    caption, pace chip and cleanup-factor chips moved out
                    (Pace tab + cook flow own those); until a real figure
                    exists the teal cell is the quick-time CTA ("Be the
                    first!"). */}
                <View style={styles.factBox}>
                  <StatPill
                    label={t("detail.statClaimed")}
                    value={fmtMin(publisher ?? 0)}
                  />
                  <Pressable
                    onPress={reallyTakes == null ? openQuick : undefined}
                    hitSlop={Space.xs}
                    accessibilityRole={reallyTakes == null ? "button" : undefined}
                  >
                    <StatPill
                      label={t("detail.statReally")}
                      value={
                        reallyTakes != null
                          ? fmtMin(reallyTakes)
                          : t("detail.beTheFirst")
                      }
                      tone="timing"
                    />
                  </Pressable>
                  {realityChip != null ? (
                    <Chip size="sm" tone={realityChip.tone} label={realityChip.label} />
                  ) : null}
                </View>

                {/* 0. OWNER CONTROLS — user-submitted recipe + signed in: a
                    small ghost "Edit" button jumps to the composer prefilled
                    with this recipe (?id=). */}
                {recipe.source_type === "user" && signedIn ? (
                  <Button
                    variant="ghost"
                    title={t("detail.editRecipe")}
                    onPress={() => router.push(`/recipe-composer?id=${recipe.id}`)}
                    style={styles.ownerEditBtn}
                  />
                ) : null}

                {/* 2. INGREDIENTS — card section: structured "½ cup | brown
                    sugar, packed" rows when the parsed data lines up, plain
                    bullets otherwise. */}
                <View style={styles.section}>
                  <Card padding={Space.lg}>
                    <SectionHeader title={t("detail.ingredients")} />
                    {ingredientLines.length > 0 ? (
                      <View style={styles.bulletList}>
                        {ingredientLines.map((ingredient, idx) => (
                          <IngredientRow
                            key={`ing-${idx}`}
                            ingredient={ingredient}
                            structured={
                              structuredAligned
                                ? structuredIngredients[idx]
                                : undefined
                            }
                            styles={styles}
                          />
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.muted}>
                        {t("detail.noIngredients")}
                      </Text>
                    )}
                  </Card>
                </View>

                {/* 3. WHEN'S DINNER READY? — start-now timeline + eat-at
                    planner: the two-way headline swaps between "Start now →
                    eating at ~X" (now-mode) and "Eating at X — start by Y"
                    (plan-mode, timeline reanchored to the chosen time). */}
                {steps.length > 0 ? (
                  <View style={styles.section}>
                    <Card padding={Space.lg}>
                    <SectionHeader title={t("detail.timelineTitle")} />
                    <Text style={styles.timelineHeadline} numberOfLines={1}>
                      {planEatAt != null
                        ? t("detail.eatAtPlan", {
                            time: formatClock(eatAt),
                            start: formatClock(startBy),
                          })
                        : t("detail.startNow", { time: formatClock(eatAt) })}
                    </Text>

                    {/* Compact planner row: eat-at label + time display +
                        ±15m steppers + "Notify me" (schedules a nudge at each
                        of the next step boundaries). */}
                    <View style={styles.planRow}>
                      <Text style={styles.planLabel}>{t("detail.eatAt")}</Text>
                      <Text style={styles.planTime}>{formatClock(eatAt)}</Text>
                      <IconPressable
                        style={styles.planStepBtn}
                        onPress={() => shiftEatAt(-PLAN_STEP_MINUTES)}
                        hitSlop={Space.xs}
                      >
                        <Ionicons
                          name="remove"
                          size={20}
                          color={colors.inkSecondary}
                        />
                      </IconPressable>
                      <IconPressable
                        style={styles.planStepBtn}
                        onPress={() => shiftEatAt(PLAN_STEP_MINUTES)}
                        hitSlop={Space.xs}
                      >
                        <Ionicons
                          name="add"
                          size={20}
                          color={colors.inkSecondary}
                        />
                      </IconPressable>
                      <Button
                        title={t("detail.notifyMe")}
                        variant="secondary"
                        loading={planLoading}
                        onPress={onNotifyMe}
                      />
                    </View>
                    {planCount != null ? (
                      <View style={styles.planSetRow}>
                        <Text style={styles.planSetCaption}>
                          {t("detail.planSet", { n: planCount })}
                        </Text>
                        <Button
                          variant="ghost"
                          title={t("detail.cancelPlan")}
                          onPress={onCancelPlan}
                        />
                      </View>
                    ) : null}
                    <View style={styles.timelineList}>
                      {timelineRows.map(({ step }) => (
                        <TimelineStepRow
                          key={`tl-${step.id}`}
                          step={step}
                          adjusted={adjustedForStep(step)}
                          description={lr.stepDescription(step)}
                          styles={styles}
                        />
                      ))}
                    </View>
                    </Card>
                  </View>
                ) : stepsPending ? (
                  // Light cached row: the fresh copy (with structured steps)
                  // is still loading — hold the section's place with a
                  // compact, text-free placeholder instead of nothing.
                  <View style={styles.section}>
                    <Card padding={Space.lg}>
                      <SectionHeader title={t("detail.timelineTitle")} />
                      <View style={styles.timelinePending}>
                        <ActivityIndicator size="small" color={colors.timing} />
                        {Array.from({ length: TIMELINE_PLACEHOLDER_ROWS }, (_, i) => (
                          <View key={`tl-skel-${i}`} style={styles.timelineSkelRow}>
                            <View style={styles.timelineSkelDot} />
                            <View style={styles.timelineSkelLine} />
                          </View>
                        ))}
                      </View>
                    </Card>
                  </View>
                ) : null}


                {/* 4. STEPS (fallback) — only for recipes without structured
                    recipe_steps: plain numbered list. Structured recipes get
                    their full steps inside the timeline above. Suppressed
                    while the placeholder holds (the pending copy carries the
                    same steps the timeline will render). */}
                {steps.length === 0 &&
                !stepsPending &&
                lr.steps(recipe).length > 0 ? (
                  <View style={styles.section}>
                    <Card padding={Space.lg}>
                      <SectionHeader title={t("detail.steps")} />
                      <View style={styles.stepList}>
                        {lr.steps(recipe).map((step, idx) => (
                          <View key={`plain-step-${idx}`} style={styles.bulletRow}>
                            <View style={styles.stepNumber}>
                              <Text style={styles.stepNumberText}>
                                {idx + 1}
                              </Text>
                            </View>
                            <Text style={styles.bulletText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                    </Card>
                  </View>
                ) : null}

                {/* QUICK-TIME CONTRIBUTION — card section: "Did you make
                    this?" + chevron expands the breakdown form inline. After
                    a successful submit the form collapses back to the row
                    with a one-line thanks caption. Unauthenticated submits
                    prompt sign-in. */}
                <QuickTimeCard
                  key={`quick-${numericId}`}
                  ref={quickCardRef}
                  recipe={recipe}
                  numericId={numericId}
                  onSubmitted={handleQuickTimeSubmitted}
                  colors={colors}
                  styles={styles}
                />

                {/* 5. NOTES — one CARD with a joined two-segment control as
                    its header ("Your note" | "Community" — same segmented
                    pattern as onboarding). Personal tab is COLLAPSED by
                    default: saved note (tap to edit) or an "Add a note" row;
                    the textarea/save/make-public stack only mounts while
                    editing. Community tab keeps its list + compose row. */}
                <NotesSection
                  key={`notes-${numericId}`}
                  numericId={numericId}
                  signedIn={signedIn}
                  myUserId={myUserId}
                  initialNote={initialNote}
                  initialNotePublic={initialNotePublic}
                  notes={notes}
                  notesLoading={notesLoading}
                  notesHasMore={notesHasMore}
                  notesError={notesError}
                  onRetryNotes={loadNotes}
                  onLoadMoreNotes={loadMoreNotes}
                  onNoteCreated={handleNoteCreated}
                  onNoteDeleted={handleNoteDeleted}
                  colors={colors}
                  styles={styles}
                />

                {/* 6. COMMUNITY POSTS — community posts attached to this
                    recipe (GET /api/posts?recipe_id=), loaded non-blocking
                    alongside the recipe; a silent failure keeps the section
                    hidden. Compact vertical rows (avatar + name, 2-line body
                    snippet, up to 3 tiny image squares); at most 3 rows up
                    front with "Show all" expanding in place. Tapping a row
                    opens the post. */}
                {tries != null ? (
                  <TriesSection
                    key={`tries-${numericId}`}
                    tries={tries}
                    triesTotal={triesTotal}
                    onShareTry={startShareTry}
                    accentColor={colors.accent}
                    styles={styles}
                  />
                ) : null}
              </View>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Pinned footer: Cook Mode button stays visible regardless of scroll.
          Disabled (dimmed, no-press) while the loaded recipe has no
          structured steps yet — Cook Mode walks the step list.
          KeyboardStickyView = the footer lifts above the keyboard while
          typing in the note composer below it. */}
      {ready && (
        <KeyboardStickyView
          style={[
            styles.cookFooter,
            { paddingBottom: insets.bottom + Space.sm },
          ]}
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            title={t("detail.startCookMode")}
            disabled={steps.length === 0}
            onPress={() => router.push(`/cook/${id}`)}
          />
        </KeyboardStickyView>
      )}
    </View>
  );
}
