import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchRecipeNotes,
  fetchRecipePosts,
  getRecipe,
  hasToken,
  HalalRejectionError,
  postRecipeNote,
  QuickTimeUnauthorizedError,
  RecipeNoteUnauthorizedError,
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
  PostKind,
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
import {
  cancelPlannedNotifications,
  requestNotificationsPermission,
  scheduleAtNotification,
} from "@/utils/notifications";
import { shareLink } from "@/utils/share";

type LoadState = "loading" | "ready" | "error";

/** Rounds a nullable minute value, returning null when absent. */
function roundMin(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value);
}

/** Parses a digits-only field; empty (optional) fields parse to null. */
function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
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

/**
 * Compact relative timestamp for community notes ("just now", "3h ago",
 * "2d ago", …). Falls back to a local date string past a year; an unparsable
 * timestamp renders as "" (the caption row simply hides it).
 */
function relativeDate(t: TranslateFn, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("rel.now");
  if (mins < 60) return t("rel.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("rel.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("rel.daysAgo", { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("rel.weeksAgo", { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("rel.monthsAgo", { n: months });
  try {
    return new Date(then).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Display name of a note author: display_name, else the account name. */
function noteAuthorName(user: RecipeNote["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Display name of a post author: display_name, else the account name. */
function postAuthorName(user: Post["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Chip tone per post kind (try=success / fail=danger / question=amber). */
function postKindTone(kind: PostKind): "success" | "danger" | "amber" {
  if (kind === "fail") return "danger";
  if (kind === "question") return "amber";
  return "success";
}

/** i18n key of the post kind chip label (community.kindTry etc.). */
function postKindLabelKey(kind: PostKind): string {
  if (kind === "fail") return "community.kindFail";
  if (kind === "question") return "community.kindQuestion";
  return "community.kindTry";
}

/** Rows shown before "Show all" expands the recipe's community-tries list. */
const TRIES_PREVIEW_COUNT = 3;

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

/**
 * One chip of the merged notes-card tab switcher ("Your notes" / "Community").
 * Pressed feedback is the state-driven opacity dim (Android paint rules — no
 * Pressable style function; mirror Card/Button/IconPressable); the selected
 * chip takes the accent tone, the unselected one stays neutral.
 */
function NoteTabChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={Space.xs}
      style={pressed ? { opacity: 0.7 } : null}
    >
      <Chip label={label} tone={selected ? "accent" : "neutral"} size="sm" />
    </Pressable>
  );
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { dir } = useLang();
  const fmtMin = useFmtMinutes();
  const lr = useLocalizedRecipe();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);
  const [favorited, setFavorited] = useState(false);
  // Personal note (local-only): the current editor text, the last saved
  // baseline (to detect changes), and a short-lived "Saved ✓" flag.
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteJustSaved, setNoteJustSaved] = useState(false);
  // "Make public" toggle under the note editor: when on, saving the local note
  // ALSO posts it as a public community note. Persisted as the default.
  const [notePublic, setNotePublic] = useState(false);
  // Sign-in state for the owner Edit control + note compose row (read once).
  const [signedIn, setSignedIn] = useState(false);
  // Active tab of the merged notes card ("personal" = device-local note,
  // "community" = public notes list). Defaults to the personal note.
  const [notesTab, setNotesTab] = useState<"personal" | "community">(
    "personal",
  );

  // ---- Community notes (public, paginated 20/page) -----------------------------
  const [notes, setNotes] = useState<RecipeNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesHasMore, setNotesHasMore] = useState(false);
  const [notesPage, setNotesPage] = useState(1);
  const [notesError, setNotesError] = useState<string | null>(null);
  // Once-only guard for the community_notes_viewed analytics event (ref: no
  // re-render needed — see the tracking effect below).
  const notesTrackedRef = useRef(false);
  // Compose row state (signed-in users only).
  const [noteDraft, setNoteDraft] = useState("");
  const [notePosting, setNotePosting] = useState(false);
  const [notePostError, setNotePostError] = useState<string | null>(null);
  const [noteHalalTerms, setNoteHalalTerms] = useState<string[] | null>(null);
  const [noteNeedsAuth, setNoteNeedsAuth] = useState(false);

  // ---- Community tries (posts attached to this recipe) -----------------------
  // null = not loaded yet (or the load failed silently) → the section stays
  // hidden; an empty array = loaded + no posts → the empty state shows.
  const [tries, setTries] = useState<Post[] | null>(null);
  // Paginator total from the server (the true count even past the 20-row page).
  const [triesTotal, setTriesTotal] = useState(0);
  // "Show all" expands the compact 3-row preview to every loaded row.
  const [triesExpanded, setTriesExpanded] = useState(false);

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
  const quickFadeRef = useRef(new Animated.Value(0));
  // Quick-time card: ALWAYS collapsed to the trigger row on first paint; the
  // breakdown form expands inline below it on tap. `quickDone` is separate so
  // a successful submit collapses the form but keeps the one-line thanks.
  const [quickOpen, setQuickOpen] = useState(false);
  // Opacity-dim pressed state for the trigger row (Android paint rules).
  const [quickPressed, setQuickPressed] = useState(false);
  // Focuses the inline total-time input as soon as it mounts.
  const quickInputRef = useRef<TextInput | null>(null);

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

  // Cancel any scheduled plan notifications when the screen unmounts.
  useEffect(() => {
    return () => {
      cancelPlannedNotifications(planIdsRef.current).catch(() => {
        // Best-effort cleanup.
      });
    };
  }, []);

  // Hides the "Saved ✓" confirmation a few seconds after a successful save.
  const noteSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
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
        heroWrap: {
          width: "100%",
        },
        heroOverlay: {
          paddingHorizontal: Space.lg,
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
        // ★ rating line right under the hero title (white + small so it sits
        // inside the scrim). The info chip row below skips the rating — the
        // hero line is the single home for it.
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
        heroSource: {
          ...Type.caption,
          color: "rgba(255,255,255,0.85)",
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
        backGlyph: {
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: "600",
          lineHeight: 28,
          marginTop: -2,
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
        contentCard: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          marginTop: -Space.huge,
          paddingHorizontal: Space.lg,
          paddingTop: Space.xl,
          paddingBottom: Space.huge,
        },
        statGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          marginHorizontal: -Space.sm,
          marginTop: -Space.sm,
        },
        statCell: {
          width: "50%",
          paddingHorizontal: Space.sm,
          paddingTop: Space.sm,
        },
        // "Be the first!" CTA replacing the cooks-average stat when the
        // community has no data yet. Negative margins + matching padding keep
        // the label/value aligned with the neighbouring cells while painting
        // the timingSoft background out to the gutter edge (quick-time is
        // calibration data → teal, not accent).
        statCellCta: {
          marginHorizontal: -Space.sm,
          marginTop: -Space.sm,
          backgroundColor: colors.timingSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.sm,
        },
        // ONE caption line under the two big stats: the total incl. cleanup
        // and the "+ ~Xm cleanup after" note merged into a single muted line.
        statCaption: {
          ...Type.caption,
          color: colors.inkSecondary,
          marginTop: Space.sm,
        },
        // ONE compact info-chips row: reality badge, personalized pace, and
        // cleanup-factor chips share a single wrapping row — the rating lives
        // up in the hero overlay (no duplicate chip here).
        infoChipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: Space.xs,
          marginTop: Space.md,
        },
        // Source caption sitting inline at the end of the info chips row.
        realityCaption: {
          ...Type.caption,
          color: colors.inkFaint,
          flexShrink: 1,
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
        timelineCaptionRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
        },
        timelineStepCaption: {
          ...Type.caption,
          color: colors.inkFaint,
          fontWeight: "600",
        },
        timelineChipWrap: {
          marginTop: -2,
        },
        timelineDesc: {
          ...Type.body,
          color: colors.ink,
          marginTop: Space.xs,
        },
        section: {
          marginTop: Space.xxl,
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
        // ---- Notes card (merged personal + community) ----
        notesCardTitle: {
          ...Type.h3,
          color: colors.ink,
        },
        // The two tab chips sit in one row under the card title (row mirrors
        // automatically in RTL).
        notesTabsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
          marginTop: Space.sm,
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
        noteActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          marginTop: Space.sm,
        },
        noteSaved: {
          ...Type.caption,
          color: colors.success,
          fontWeight: "600",
        },
        // Persistent "Saved on this device ✓" caption shown above the note
        // input whenever a saved note exists and the field is pristine.
        noteSavedOnDevice: {
          ...Type.caption,
          color: colors.success,
          fontWeight: "600",
          marginBottom: Space.xs,
        },
        // "Make public" toggle row under the note editor.
        publicToggleRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          marginTop: Space.sm,
        },
        publicToggleText: {
          flex: 1,
          gap: 2,
        },
        publicToggleLabel: {
          ...Type.bodySm,
          color: colors.ink,
          fontWeight: "600",
        },
        publicToggleCaption: {
          ...Type.caption,
          color: colors.inkSecondary,
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
        // One compact row: avatar | (name + kind chip / 2-line snippet /
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
        triesEmptyText: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        triesEmptyCta: {
          alignSelf: "flex-start",
          marginTop: Space.xs,
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
          paddingHorizontal: Space.xxl,
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
      }),
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
    setState("loading");
    setErrorMessage(null);
    // Reset the quick-time contribution + planner state for the (new) recipe;
    // any notifications armed for the previous recipe are cancelled.
    cancelPlannedNotifications(planIdsRef.current).catch(() => {});
    planIdsRef.current = [];
    setPlanEatAt(null);
    setPlanLoading(false);
    setPlanCount(null);
    setQuickPlates("");
    setQuickHandsOn("");
    setQuickTotal("");
    setQuickCleanup("");
    setQuickSubmitting(false);
    setQuickDone(false);
    setQuickAvg(null);
    setQuickCleanupAvg(null);
    setQuickError(null);
    setQuickNeedsAuth(false);
    setQuickOpen(false);
    quickFadeRef.current.setValue(0);
    try {
      const numericId = Number(id);
      // 1. Serve the cached copy immediately (fast paint + offline support).
      let result = await getCachedRecipe(numericId);
      const servedFromCache =
        result != null && (result.recipe_steps?.length ?? 0) > 0;
      if (!servedFromCache) {
        // Not in cache OR cached copy lost its steps (damaged cache): fetch
        // live and re-cache so the step library self-heals recipe by recipe.
        try {
          const fetched = await getRecipe(id);
          if (fetched.recipe_steps?.length) {
            upsertRecipes([fetched], { withSteps: true }).catch(() => {});
          }
          result = fetched;
        } catch (error) {
          // Network failed. When a cached copy exists, show it anyway;
          // otherwise surface the original error.
          if (!result) throw error;
        }
      }
      if (requestId !== loadRequestIdRef.current) return;
      // Unreachable in practice: a null result here means the cache miss and
      // the live fetch both failed, and the catch above already rethrew. The
      // guard exists for TypeScript's benefit (narrowing is reset across the
      // try/catch) and doubles as a last-resort error surface.
      if (!result) throw new Error("No recipe data");
      setRecipe(result);
      setState("ready");
      // Fire-and-forget analytics once the recipe is successfully loaded.
      track("recipe_viewed", { recipe_id: result.id });
      // Best-effort: seed the favorite state from local storage (never blocks).
      isFavorite(numericId)
        .then(setFavorited)
        .catch(() => {});
      // 2. Revalidate in the background when we served the cached copy, so a
      // stale cache (community averages, reality, per-step minutes) never
      // pins this screen forever — the fresh copy swaps in when it lands.
      // Only the LATEST loadRecipe may commit (request-id guard).
      if (servedFromCache) {
        getRecipe(id)
          .then((fetched) => {
            if (requestId !== loadRequestIdRef.current) return;
            upsertRecipes([fetched], { withSteps: true }).catch(() => {});
            setRecipe(fetched);
          })
          .catch((error) => {
            // Offline: the cached copy stays — it's already on screen.
            console.warn("[RecipeReal] detail revalidation failed:", error);
          });
      }
    } catch (error) {
      console.warn("[RecipeReal] loadRecipe failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : t("common.loadFailedRecipe"),
      );
      setState("error");
    }
  }, [id, t]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  // Best-effort: load personalized pace multipliers after the recipe renders.
  // Only when authenticated; never blocks the recipe view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await hasToken())) return;
      try {
        const items = await refreshPaceCalibrations();
        if (!cancelled) setCalibrations(items);
      } catch (error) {
        console.warn("[RecipeReal] pace load failed:", error);
      }
    })();
    return () => {
      cancelled = true;
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

  /**
   * Post a public community note. Returns true on success. Maps failures to
   * the compose-row inline states: 401 → sign-in prompt, halal 422 → the
   * offending terms, anything else → the generic error string.
   */
  const postPublicNote = useCallback(
    async (body: string): Promise<boolean> => {
      const recipeId = Number(id);
      if (!Number.isFinite(recipeId) || body.trim() === "") return false;
      setNotePosting(true);
      setNotePostError(null);
      setNoteHalalTerms(null);
      setNoteNeedsAuth(false);
      try {
        const created = await postRecipeNote(recipeId, body.trim());
        setNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
        track("recipe_note_posted", { recipe_id: recipeId });
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
        } else {
          setNotePostError(t("detail.notePostFailed"));
        }
        return false;
      } finally {
        setNotePosting(false);
      }
    },
    [id, t],
  );

  /**
   * Saves the personal note locally, then flashes a "Saved ✓" confirmation.
   * When the "Make public" toggle is on (and there is text to share), the same
   * note is ALSO posted as a public community note — a 401 surfaces the
   * sign-in prompt on the compose row while the local save still succeeds.
   */
  const onSaveNote = useCallback(async () => {
    try {
      await saveNote(Number(id), note);
      setSavedNote(note);
      track("note_saved", { recipe_id: Number(id) });
      setNoteJustSaved(true);
      if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
      noteSavedTimerRef.current = setTimeout(() => {
        setNoteJustSaved(false);
      }, 3000);
      if (notePublic && note.trim() !== "") {
        await postPublicNote(note);
      }
    } catch {
      // Notes are best-effort; never crash the detail screen.
    }
  }, [id, note, notePublic, postPublicNote]);

  /**
   * Submit the quick-time breakdown. Total minutes are required (1..1440);
   * plates / hands-on / cleanup are optional add-ons. Success collapses the
   * form back to the trigger row and fades in a one-line "Thanks! Cooks
   * average ~Xm" caption using the server-recomputed average. A 401 shows the
   * sign-in CTA instead; any other failure shows an inline error and keeps
   * the form usable.
   */
  const onSubmitQuickTime = useCallback(async () => {
    const minutes = parseIntOrNull(quickTotal);
    if (minutes == null || minutes < 1 || minutes > 1440) return;
    const handsOn = parseIntOrNull(quickHandsOn);
    if (handsOn != null && handsOn > minutes) return; // Client-side guard.
    const recipeId = Number(id);
    if (!Number.isFinite(recipeId)) return;
    const cleanupMinutes = parseIntOrNull(quickCleanup);
    const plates = parseIntOrNull(quickPlates);
    setQuickSubmitting(true);
    setQuickError(null);
    setQuickNeedsAuth(false);
    try {
      const result = await submitQuickTime(recipeId, {
        minutes,
        ...(handsOn != null ? { hands_on_minutes: handsOn } : {}),
        ...(cleanupMinutes != null ? { cleanup_minutes: cleanupMinutes } : {}),
        ...(plates != null ? { servings: plates } : {}),
      });
      track("quick_time_submitted", { recipe_id: recipeId, minutes });
      setQuickAvg(result.community_avg_minutes);
      setQuickCleanupAvg(result.cleanup_avg_minutes);
      setQuickDone(true);
      // Collapse the form back to the compact trigger row; the faded-in
      // one-line thanks caption takes over below it.
      setQuickOpen(false);
      // Persist the server-recomputed averages into the cache immediately so
      // the favorites rail, home rails and the next detail open read the new
      // figure instead of the stale one; flag the browse list as stale so it
      // re-syncs its grid on the next focus.
      if (recipe) {
        upsertRecipes(
          [
            {
              ...recipe,
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
      quickFadeRef.current.setValue(0);
      Animated.timing(quickFadeRef.current, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.warn("[RecipeReal] quick-time submit failed:", error);
      if (error instanceof QuickTimeUnauthorizedError) {
        setQuickNeedsAuth(true);
        setQuickError(t("quick.signInRequired"));
      } else {
        setQuickError(t("quick.error"));
      }
    } finally {
      setQuickSubmitting(false);
    }
  }, [quickTotal, quickHandsOn, quickCleanup, quickPlates, id, t, recipe]);

  /**
   * Reveal the inline quick-time form inside the card and focus the required
   * total-time input. Focus waits one frame so the just-mounted TextInput
   * exists first.
   */
  const openQuick = useCallback(() => {
    setQuickOpen(true);
    requestAnimationFrame(() => quickInputRef.current?.focus());
  }, []);

  // ---- Quick-time field validation (client-side guards for the submit) ----
  const quickTotalValue = parseIntOrNull(quickTotal);
  const quickHandsOnValue = parseIntOrNull(quickHandsOn);
  const quickPlatesValue = parseIntOrNull(quickPlates);
  const quickCleanupValue = parseIntOrNull(quickCleanup);
  const quickTotalValid =
    quickTotalValue != null && quickTotalValue >= 1 && quickTotalValue <= 1440;
  const quickHandsOnExceeds =
    quickTotalValid && quickHandsOnValue != null && quickHandsOnValue > quickTotalValue;
  const quickValid =
    quickTotalValid &&
    !quickHandsOnExceeds &&
    (quickHandsOnValue == null ||
      (quickHandsOnValue >= 0 && quickHandsOnValue <= 1440)) &&
    (quickPlatesValue == null ||
      (quickPlatesValue >= 1 && quickPlatesValue <= 50)) &&
    (quickCleanupValue == null ||
      (quickCleanupValue >= 0 && quickCleanupValue <= 1440));

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
      : (community ?? (quickDone ? roundMin(quickAvg) : null));

  // "Really takes" big stat: reality copy → community consensus → publisher
  // claim fallback, so the second stat never reads empty on sparse data.
  const reallyTakes = cooksAvg ?? publisher;

  const totalInclCleanup =
    cookMinutes != null && cleanup != null ? cookMinutes + cleanup : null;

  const chips = recipe ? cleanupChips(t, recipe.cleanup_factors) : [];

  // Reality badge chip (tone + label), computed once for the gap thresholds.
  const realityChip =
    realityGap != null ? realityBadge(t, realityGap) : null;

  const steps: RecipeStep[] = recipe?.recipe_steps ?? [];

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

  // Build a step_type -> multiplier map and compute the personalized estimate.
  const paceMap = new Map<string, number>();
  for (const c of calibrations) paceMap.set(c.step_type, c.multiplier);

  /**
   * Personalized total: sum each non-cleanup step's community minutes scaled
   * by its multiplier, plus the recipe-level cleanup_avg scaled if a cleanup
   * calibration exists. Falls back to the raw community value (multiplier 1)
   * when no calibration is present.
   */
  let personalTotal: number | null = null;
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
    if (hasAny) personalTotal = Math.round(sum);
  }

  /** Adjusted minutes for a single step (null when no calibration applies). */
  function adjustedForStep(step: RecipeStep): number | null {
    if (step.community_minutes == null) return null;
    const mult = paceMap.get(step.step_type);
    if (mult == null || mult === 1) return null;
    return Math.round(step.community_minutes * mult);
  }

  // Timeline: cooking steps only — cleanup is quoted separately (you eat first).
  // The distribution below runs over THESE steps so the walked clock adds back
  // up to the recipe's stated total by construction.
  const timelineSteps = steps.filter((s) => s.step_type !== "cleanup");

  /**
   * Effective minutes used by the "When's dinner ready?" timeline: the
   * pace-adjusted value when a calibration applies, else the step's own
   * community/publisher figure, else its word-weighted share of the recipe
   * total (never a flat 3-minute guess unless the recipe has no total at all).
   */
  function minutesForStep(step: RecipeStep): number {
    return adjustedForStep(step) ?? estimateStepMinutes(step, recipe, timelineSteps);
  }
  // Anchor the clock walk once per recipe (not per render) so re-renders —
  // heart toggles, quick-time keystrokes — never shift the displayed times.
  const timelineStart = useMemo(() => Date.now(), [recipe?.id, steps.length]);
  // Walk the cooking steps into (step, minutes) pairs once; the absolute
  // clock times are stamped from the anchor below so flipping between
  // "start now" and "eating at" modes reanchors without re-walking.
  const timelineBase: { step: RecipeStep; minutes: number }[] = [];
  let totalTimelineMs = 0;
  for (const step of timelineSteps) {
    const minutes = minutesForStep(step);
    timelineBase.push({ step, minutes });
    totalTimelineMs += minutes * 60000;
  }
  // Planner anchor: eat-at mode walks BACK from the chosen eat time
  // (start = eatAt − total); now-mode anchors at the fixed load moment.
  const anchorMs =
    planEatAt != null ? planEatAt - totalTimelineMs : timelineStart;
  const timelineRows: { step: RecipeStep; at: Date; minutes: number }[] = [];
  let offsetMs = 0;
  for (const { step, minutes } of timelineBase) {
    timelineRows.push({ step, minutes, at: new Date(anchorMs + offsetMs) });
    offsetMs += minutes * 60000;
  }
  // Eat time ("Start now" target or the planner's choice) and the matching
  // "start by" moment — cleanup is intentionally excluded (you eat first).
  const eatAtMs = anchorMs + totalTimelineMs;
  const eatAt = new Date(eatAtMs);
  const startBy = new Date(anchorMs);

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

  // The note text differs from the last saved baseline -> the Save button is
  // enabled and styled as primary; otherwise ghost + disabled.
  const noteDirty = note !== savedNote;

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

  // Fire the timeline analytics event once, when the section first renders.
  const timelineTrackedRef = useRef(false);
  useEffect(() => {
    if (!ready || timelineTrackedRef.current) return;
    if (steps.length === 0) return;
    timelineTrackedRef.current = true;
    track("timeline_viewed", { recipe_id: Number(id) });
  }, [ready, steps.length, id]);

  // Best-effort: load the personal note once the recipe is ready (local-only).
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getNote(Number(id))
      .then((stored) => {
        if (cancelled) return;
        setSavedNote(stored ?? "");
        setNote(stored ?? "");
      })
      .catch(() => {
        // Notes are best-effort; never block the detail screen.
      });
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  // Sign-in state for the owner Edit control + note compose row (read once),
  // plus the persisted "Make public" note toggle default.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ok, pref] = await Promise.all([
        hasToken(),
        AsyncStorage.getItem(NOTE_PUBLIC_PREF_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      setSignedIn(ok);
      setNotePublic(pref === "on");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Community notes loading ---------------------------------------------------

  /** Reset + fetch page 1 of the public notes for the current recipe. */
  const loadNotes = useCallback(async () => {
    const recipeId = Number(id);
    if (!Number.isFinite(recipeId)) return;
    setNotesLoading(true);
    setNotesError(null);
    try {
      const page = await fetchRecipeNotes(recipeId, 1);
      setNotes(page.notes);
      setNotesHasMore(page.hasMore);
      setNotesPage(1);
    } catch (error) {
      console.warn("[RecipeReal] notes load failed:", error);
      setNotes([]);
      setNotesHasMore(false);
      setNotesError(t("detail.notesLoadFailed"));
    } finally {
      setNotesLoading(false);
    }
  }, [id, t]);

  // Load the first notes page once the recipe is ready (per recipe id).
  useEffect(() => {
    if (!ready) return;
    void loadNotes();
  }, [ready, id, loadNotes]);

  // ---- Community tries loading ---------------------------------------------------

  /**
   * Load page 1 of the community posts attached to this recipe
   * (GET /api/posts?recipe_id=). Non-blocking: fires once the recipe is
   * ready alongside the other best-effort loads, and a silent failure keeps
   * the section hidden instead of erroring an otherwise healthy screen.
   */
  useEffect(() => {
    if (!ready) return;
    const recipeId = Number(id);
    if (!Number.isFinite(recipeId)) return;
    let cancelled = false;
    setTries(null);
    setTriesTotal(0);
    setTriesExpanded(false);
    fetchRecipePosts(recipeId, 1)
      .then((page) => {
        if (cancelled) return;
        setTries(page.posts);
        setTriesTotal(page.total ?? page.posts.length);
      })
      .catch((error) => {
        // Silent failure: the section stays hidden (tries === null).
        console.warn("[RecipeReal] community tries load failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  /**
   * "Share your try" ghost button of the empty community-tries state —
   * mirrors the community tab's compose entry: signed-out users land on
   * /login, everyone else on /post-composer (which has no recipe-prefill
   * param; attaching happens via its own recipe search).
   */
  const startShareTry = useCallback(() => {
    if (signedIn === false) {
      router.push("/login");
      return;
    }
    router.push("/post-composer");
  }, [signedIn]);

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
    const recipeId = Number(id);
    if (!Number.isFinite(recipeId) || notesLoading) return;
    setNotesLoading(true);
    try {
      const page = await fetchRecipeNotes(recipeId, notesPage + 1);
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.notes.filter((n) => !seen.has(n.id))];
      });
      setNotesHasMore(page.hasMore);
      setNotesPage((p) => p + 1);
    } catch (error) {
      console.warn("[RecipeReal] notes load-more failed:", error);
    } finally {
      setNotesLoading(false);
    }
  }, [id, notesPage, notesLoading]);

  /** Send button of the compose row: post the draft, clear it on success. */
  const onSendNote = useCallback(async () => {
    const ok = await postPublicNote(noteDraft);
    if (ok) setNoteDraft("");
  }, [noteDraft, postPublicNote]);

  return (
    <View style={styles.screen}>
      <ScrollView
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
                {/* HERO — full-bleed, ignores side padding. */}
                <View style={styles.heroWrap}>
                  <HeroImage
                    uri={recipe.image_url}
                    height={380}
                    withScrim
                    rounded={0}
                  >
                  <View
                    style={[
                      styles.heroOverlay,
                      {
                        paddingBottom: Space.xl,
                        paddingTop: insets.top + Space.huge,
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
                    {recipe.aggregated_rating != null ? (
                      <Text
                        style={
                          recipe.image_url
                            ? styles.heroRating
                            : styles.heroRatingPlain
                        }
                        numberOfLines={1}
                      >
                        {recipe.review_count != null && recipe.review_count > 0
                          ? t("detail.ratingWithCount", {
                              rating: recipe.aggregated_rating.toFixed(1),
                              n: recipe.review_count,
                            })
                          : t("detail.ratingOnly", {
                              rating: recipe.aggregated_rating.toFixed(1),
                            })}
                      </Text>
                    ) : null}
                    {recipe.source_url ? (
                      <Text style={styles.heroSource} numberOfLines={1}>
                        {recipe.source_url}
                      </Text>
                    ) : null}
                  </View>
                </HeroImage>
              </View>

              {/* Floating back button over the hero. */}
              <IconPressable
                style={[
                  styles.backButton,
                  { top: insets.top + Space.sm },
                ]}
                onPress={() => router.back()}
                hitSlop={Space.sm}
              >
                <Text style={styles.backGlyph}>{dir === "rtl" ? "›" : "‹"}</Text>
              </IconPressable>

              {/* Floating favorite toggle over the hero (mirrors the back button). */}
              <IconPressable
                style={[
                  styles.favButton,
                  { top: insets.top + Space.sm },
                ]}
                onPress={onToggleFavorite}
                hitSlop={Space.sm}
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
                style={[
                  styles.shareButton,
                  { top: insets.top + Space.sm },
                ]}
                onPress={onShare}
                hitSlop={Space.sm}
                accessibilityLabel={t("detail.shareA11y")}
              >
                <Ionicons name="arrow-redo" size={18} color="#FFFFFF" />
              </IconPressable>

              {/* RISING CONTENT CARD overlapping the hero. */}
              <View style={styles.contentCard}>
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

                {/* 1. TWO BIG STATS — "Recipe says" (neutral ink) vs "Really
                    takes" (timing teal: honest times are calibration data).
                    Until a real figure exists the second cell becomes the
                    quick-time CTA ("Be the first!" — also teal). Total-incl-
                    cleanup + the cleanup note merge into ONE caption line
                    underneath. */}
                <View style={styles.statGrid}>
                  <View style={styles.statCell}>
                    <StatPill
                      label={t("detail.statClaimed")}
                      value={fmtMin(publisher ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    {reallyTakes != null ? (
                      <StatPill
                        label={t("detail.statReally")}
                        value={fmtMin(reallyTakes)}
                        tone="timing"
                      />
                    ) : (
                      <Pressable
                        style={styles.statCellCta}
                        onPress={openQuick}
                        hitSlop={Space.xs}
                      >
                        <StatPill
                          label={t("detail.statReally")}
                          value={t("detail.beTheFirst")}
                          tone="timing"
                        />
                      </Pressable>
                    )}
                  </View>
                </View>
                {cleanup != null && totalInclCleanup != null ? (
                  <Text style={styles.statCaption} numberOfLines={1}>
                    {`${t("detail.statTotalInclCleanup")} ~${fmtMin(totalInclCleanup)} · ${t("detail.cleanupAfter", { time: fmtMin(cleanup) })}`}
                  </Text>
                ) : null}

                {/* 1b. INFO CHIPS — reality badge, personalized pace and
                    cleanup factors share ONE compact wrapping row (the ★
                    rating lives in the hero overlay above, not duplicated
                    here), with the data-source caption inline at the end. */}
                {realityChip != null ||
                personalTotal != null ||
                chips.length > 0 ? (
                  <View style={styles.infoChipRow}>
                    {realityChip != null ? (
                      <Chip
                        size="sm"
                        tone={realityChip.tone}
                        label={realityChip.label}
                      />
                    ) : null}
                    {personalTotal != null ? (
                      <Chip
                        tone="accent"
                        size="sm"
                        label={t("detail.yourPace", {
                          time: fmtMin(personalTotal),
                        })}
                      />
                    ) : null}
                    {chips.map((label) => (
                      <Chip key={label} tone="neutral" label={label} size="sm" />
                    ))}
                    {reality != null && realityChip != null ? (
                      <Text style={styles.realityCaption}>
                        {reality.source === "community"
                          ? t("detail.realityFrom", { n: reality.samples })
                          : t("detail.realityEstimate")}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* 2. INGREDIENTS — structured "½ cup | brown sugar, packed"
                    rows when the parsed data lines up, plain bullets otherwise. */}
                <View style={styles.section}>
                  <SectionHeader title={t("detail.ingredients")} />
                  {ingredientLines.length > 0 ? (
                    <View style={styles.bulletList}>
                      {ingredientLines.map((ingredient, idx) => {
                        const structured = structuredAligned
                          ? structuredIngredients[idx]
                          : undefined;
                        const qty =
                          structured?.qty_display ??
                          (structured?.qty != null
                            ? String(structured.qty)
                            : null);
                        const unit = structured?.unit?.trim() || null;
                        const itemText = [
                          structured?.item?.trim(),
                          structured?.prep?.trim(),
                        ]
                          .filter(Boolean)
                          .join(", ");
                        const qtyPart = [qty, unit].filter(Boolean).join(" ");
                        const hasStructure = qtyPart !== "" && itemText !== "";
                        return (
                          <View key={`ing-${idx}`} style={styles.bulletRow}>
                            <Text style={styles.bullet}>•</Text>
                            {hasStructure ? (
                              <Text style={styles.bulletText}>
                                <Text style={styles.ingredientQty}>
                                  {qtyPart}
                                </Text>
                                {` ${itemText}`}
                              </Text>
                            ) : (
                              <Text style={styles.bulletText}>{ingredient}</Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.muted}>{t("detail.noIngredients")}</Text>
                  )}
                </View>

                {/* 3. WHEN'S DINNER READY? — start-now timeline + eat-at
                    planner: the two-way headline swaps between "Start now →
                    eating at ~X" (now-mode) and "Eating at X — start by Y"
                    (plan-mode, timeline reanchored to the chosen time). */}
                {steps.length > 0 ? (
                  <View style={styles.section}>
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
                      {timelineRows.map(({ step }) => {
                        const passive = step.step_type === "passive";
                        const adjusted = adjustedForStep(step);
                        return (
                          <View
                            key={`tl-${step.id}`}
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
                              <View style={styles.timelineCaptionRow}>
                                <Text style={styles.timelineStepCaption}>
                                  {t("detail.stepCaption", {
                                    n: step.step_number,
                                  })}
                                </Text>
                                {passive ? (
                                  <View style={styles.timelineChipWrap}>
                                    <Chip
                                      label={t("common.handsOff")}
                                      tone="success"
                                      size="sm"
                                    />
                                  </View>
                                ) : null}
                              </View>
                              {/* Full step text — this row IS the step list
                                  (no separate Steps section below). */}
                              <Text style={styles.timelineDesc}>
                                {lr.stepDescription(step)}
                              </Text>
                              {adjusted != null ? (
                                <View style={styles.timelineChipWrap}>
                                  <Chip
                                    tone="accent"
                                    size="sm"
                                    label={t("detail.adjustedForYou", {
                                      time: fmtMin(adjusted),
                                    })}
                                  />
                                </View>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}


                {/* 4. STEPS (fallback) — only for recipes without structured
                    recipe_steps: plain numbered list. Structured recipes get
                    their full steps inside the timeline above. */}
                {steps.length === 0 && lr.steps(recipe).length > 0 ? (
                  <View style={styles.section}>
                    <SectionHeader title={t("detail.steps")} />
                    <View style={styles.stepList}>
                      {lr.steps(recipe).map((step, idx) => (
                        <Card key={`plain-step-${idx}`} padding={Space.lg}>
                          <View style={styles.bulletRow}>
                            <View style={styles.stepNumber}>
                              <Text style={styles.stepNumberText}>
                                {idx + 1}
                              </Text>
                            </View>
                            <Text style={styles.bulletText}>{step}</Text>
                          </View>
                        </Card>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* QUICK-TIME CONTRIBUTION — a compact card: one trigger row
                    ("Did you make this?" + chevron) that expands the
                    breakdown form inline below it. After a successful submit
                    the form collapses back to the row with a one-line thanks
                    caption. Unauthenticated submits prompt sign-in. */}
                <View style={styles.section}>
                  <Card padding={Space.lg}>
                    <Pressable
                      onPress={
                        quickOpen ? () => setQuickOpen(false) : openQuick
                      }
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
                        style={[
                          styles.quickSuccess,
                          { opacity: quickFadeRef.current },
                        ]}
                        numberOfLines={1}
                      >
                        {t("quick.thanksBreakdown", {
                          time: fmtMin(quickAvg ?? quickTotalValue ?? 0),
                        })}
                        {quickCleanupAvg != null
                          ? ` · ${t("quick.thanksCleanup", {
                              cleanup: fmtMin(quickCleanupAvg),
                            })}`
                          : ""}
                      </Animated.Text>
                    ) : null}
                    {quickOpen ? (
                      <View style={styles.quickForm}>
                        {quickField(
                          t("quick.plates"),
                          quickPlates,
                          setQuickPlates,
                          { optional: true },
                        )}
                        {quickField(
                          t("quick.handsOn"),
                          quickHandsOn,
                          setQuickHandsOn,
                          { optional: true },
                        )}
                        {quickField(
                          t("quick.totalQ"),
                          quickTotal,
                          setQuickTotal,
                          { focusRef: true },
                        )}
                        {quickField(
                          t("quick.cleanupQ"),
                          quickCleanup,
                          setQuickCleanup,
                          { optional: true },
                        )}
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
                            <Text style={styles.quickSignIn}>
                              {t("quick.signIn")}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                </View>

                {/* 5. NOTES — the device-local personal note and the public
                    community notes share ONE card, switched by two light chips
                    in the header. Default tab: "Your notes"; each tab keeps
                    its own data flow untouched (personal save/load; community
                    list/post; the "Make public" toggle stays with the
                    personal tab exactly as before). */}
                <View style={styles.section}>
                  <Card padding={Space.lg}>
                    <Text style={styles.notesCardTitle}>
                      {t("detail.notesTitle")}
                    </Text>
                    <View style={styles.notesTabsRow}>
                      <NoteTabChip
                        label={t("detail.notesTabPersonal")}
                        selected={notesTab === "personal"}
                        onPress={() => setNotesTab("personal")}
                      />
                      <NoteTabChip
                        label={t("detail.notesTabCommunity")}
                        selected={notesTab === "community"}
                        onPress={() => setNotesTab("community")}
                      />
                    </View>

                    {notesTab === "personal" ? (
                      <>
                        {/* A saved note + a pristine field: show the persistent
                            "stored here" caption so returning users see their
                            note is kept before they even read the textarea. */}
                        {savedNote.length > 0 && !noteDirty ? (
                          <Text style={styles.noteSavedOnDevice}>
                            {t("detail.noteSavedOnDevice")}
                          </Text>
                        ) : null}
                        <TextInput
                          style={styles.noteInput}
                          value={note}
                          onChangeText={setNote}
                          placeholder={t("detail.notesPlaceholder")}
                          placeholderTextColor={colors.inkFaint}
                          multiline
                        />
                        <View style={styles.noteActions}>
                          {/* Always primary (ghost + disabled renders nearly
                              invisible); disabled only dims via opacity until
                              the note is dirty. */}
                          <Button
                            variant="primary"
                            disabled={!noteDirty}
                            title={t("detail.saveNote")}
                            onPress={onSaveNote}
                          />
                          {noteJustSaved ? (
                            <Text style={styles.noteSaved}>
                              {t("detail.saved")}
                            </Text>
                          ) : null}
                        </View>
                        {/* "Make public": when on, saving the note also posts
                            it as a community note. The choice persists as the
                            default. */}
                        <View style={styles.publicToggleRow}>
                          <View style={styles.publicToggleText}>
                            <Text style={styles.publicToggleLabel}>
                              {t("detail.notePublicToggle")}
                            </Text>
                            <Text style={styles.publicToggleCaption}>
                              {t("detail.notePublicHint")}
                            </Text>
                          </View>
                          <Toggle
                            value={notePublic}
                            onValueChange={(value) => {
                              setNotePublic(value);
                              AsyncStorage.setItem(
                                NOTE_PUBLIC_PREF_KEY,
                                value ? "on" : "off",
                              ).catch(() => {
                                // Best-effort persistence.
                              });
                            }}
                          />
                        </View>
                      </>
                    ) : (
                      <>
                        {notesError != null ? (
                          <View style={styles.notesCenter}>
                            <Text style={styles.notesMuted}>{notesError}</Text>
                            <Button
                              variant="ghost"
                              title={t("common.retry")}
                              onPress={loadNotes}
                            />
                          </View>
                        ) : notesLoading && notes.length === 0 ? (
                          <View style={styles.notesCenter}>
                            <ActivityIndicator
                              color={colors.accent}
                              size="small"
                            />
                          </View>
                        ) : notes.length === 0 ? (
                          <Text style={styles.notesMuted}>
                            {t("detail.notesEmpty")}
                          </Text>
                        ) : (
                          <View style={styles.notesList}>
                            {notes.map((item) => {
                              const author = noteAuthorName(item.user);
                              const initial =
                                author.charAt(0).toUpperCase() || "?";
                              const rel = relativeDate(t, item.created_at);
                              return (
                                <View
                                  key={`note-${item.id}`}
                                  style={styles.noteRow}
                                >
                                  <View style={styles.avatar}>
                                    {item.user.avatar_url ? (
                                      <Image
                                        source={{ uri: item.user.avatar_url }}
                                        style={styles.avatarImage}
                                        contentFit="cover"
                                        transition={0}
                                        cachePolicy="memory-disk"
                                      />
                                    ) : (
                                      <Text style={styles.avatarText}>
                                        {initial}
                                      </Text>
                                    )}
                                  </View>
                                  <View style={styles.noteInfo}>
                                    <View style={styles.noteHeadRow}>
                                      <Text style={styles.noteAuthor}>
                                        {author}
                                      </Text>
                                      {rel !== "" ? (
                                        <Text style={styles.noteDate}>{rel}</Text>
                                      ) : null}
                                    </View>
                                    <Text style={styles.noteBody}>
                                      {item.body}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })}
                            {notesHasMore ? (
                              <Button
                                variant="ghost"
                                title={t("detail.loadMoreNotes")}
                                loading={notesLoading}
                                disabled={notesLoading}
                                onPress={loadMoreNotes}
                                style={styles.notesLoadMore}
                              />
                            ) : null}
                          </View>
                        )}
                        {/* Compose row: signed-in users post a public note
                            directly; unauthenticated users see a sign-in
                            prompt instead. */}
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
                                disabled={
                                  notePosting || noteDraft.trim().length === 0
                                }
                                onPress={onSendNote}
                              />
                            </View>
                            {noteHalalTerms != null ? (
                              <Text style={styles.noteError}>
                                {noteHalalTerms.join(", ")}
                              </Text>
                            ) : null}
                            {notePostError != null && noteHalalTerms == null ? (
                              <Text style={styles.noteError}>
                                {notePostError}
                              </Text>
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
                            <Text style={styles.noteSignIn}>
                              {t("detail.notesSignIn")}
                            </Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </Card>
                </View>

                {/* 6. COMMUNITY TRIES — community posts attached to this
                    recipe (GET /api/posts?recipe_id=), loaded non-blocking
                    once the recipe is ready; a silent failure keeps the
                    section hidden. Compact vertical rows (avatar + name +
                    kind chip, 2-line body snippet, up to 3 tiny image
                    squares); at most 3 rows up front with "Show all"
                    expanding in place. Tapping a row opens the post. */}
                {tries != null ? (
                  <View style={styles.section}>
                    <SectionHeader
                      title={
                        triesTotal > 0
                          ? t("detail.communityTriesCount", { n: triesTotal })
                          : t("detail.communityTries")
                      }
                    />
                    {tries.length === 0 ? (
                      <>
                        <Text style={styles.triesEmptyText}>
                          {t("detail.triesEmpty")}
                        </Text>
                        <Button
                          variant="ghost"
                          title={t("detail.shareYourTry")}
                          onPress={startShareTry}
                          style={styles.triesEmptyCta}
                        />
                      </>
                    ) : (
                      <View style={styles.triesList}>
                        {(triesExpanded
                          ? tries
                          : tries.slice(0, TRIES_PREVIEW_COUNT)
                        ).map((item) => {
                          const author = postAuthorName(item.user);
                          return (
                            <IconPressable
                              key={`try-${item.id}`}
                              onPress={() => router.push(`/post/${item.id}`)}
                              style={styles.tryRow}
                            >
                              <Avatar
                                name={author}
                                uri={item.user.avatar_url}
                                size={32}
                              />
                              <View style={styles.tryMain}>
                                <View style={styles.tryHeadRow}>
                                  <Text
                                    style={styles.tryAuthor}
                                    numberOfLines={1}
                                  >
                                    {author}
                                  </Text>
                                  <Chip
                                    size="sm"
                                    tone={postKindTone(item.kind)}
                                    label={t(postKindLabelKey(item.kind))}
                                  />
                                </View>
                                <Text style={styles.tryBody} numberOfLines={2}>
                                  {item.body}
                                </Text>
                                {item.images.length > 0 ? (
                                  <View style={styles.tryThumbs}>
                                    {item.images
                                      .slice(0, 3)
                                      .map((uri, index) => (
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
                        })}
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
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Pinned footer: Cook Mode button stays visible regardless of scroll. */}
      {ready && (
        <View
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
            onPress={() => router.push(`/cook/${id}`)}
          />
        </View>
      )}
    </View>
  );
}
