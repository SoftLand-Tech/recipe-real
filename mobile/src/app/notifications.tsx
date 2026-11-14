import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import {
  fetchNotifications,
  hasToken,
  markNotificationsRead,
  NotificationUnauthorizedError,
} from "@/api/client";
import type { NotificationRow, NotificationType } from "@/types";
import { useT, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";
import { Button, Card, IconPressable, ScreenFlatList, ScreenView } from "@/components/ui";

type LoadState = "loading" | "ready" | "error" | "signedout";

/**
 * Safety cap for the pull-to-refresh spinner (community.tsx pattern): it
 * must never outlive ~10s whatever the network does.
 */
const REFRESH_SPINNER_MAX_MS = 10_000;

/**
 * Compact relative timestamp ("just now", "3h ago", …) — same shape as the
 * community feed helper (duplicated for isolation, the app's convention).
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

/** Per-type icon: heart for likes, chat for comments, shield for moderation. */
function notifIcon(name: NotificationType): keyof typeof Ionicons.glyphMap {
  if (name === "comment") return "chatbubble";
  if (name === "moderation") return "shield-checkmark";
  return "heart";
}

// ---- Row ------------------------------------------------------------------------

interface RowProps {
  row: NotificationRow;
  /** Mark this row read + open its post. */
  onOpen: (row: NotificationRow) => void;
}

const NotificationRowView = memo(function NotificationRowView({
  row,
  onOpen,
}: RowProps) {
  const colors = useThemeColors();
  const t = useT();

  const unread = row.read_at == null;
  const isLike = row.type === "like";
  const isModeration = row.type === "moderation";
  // Actor may be gone (deleted account) — fall back to a generic "Someone".
  // Public payloads carry display_name only (never the account name).
  const name = row.actor != null
    ? ((row.actor.display_name ?? "").trim() || t("notif.someone"))
    : t("notif.someone");
  const snippet = (row.post?.body ?? "").trim();
  // Moderation notices carry their own server-composed message and usually
  // no actor/post (removed content unlinks). Fall back to a generic line.
  const text = isModeration
    ? (row.message ?? t("notif.moderationDefault"))
    : isLike
      ? t("notif.likedYourPost", { name })
      : snippet.length > 0
        ? t("notif.commented", { name, snippet })
        // Post deleted: no snippet to quote, keep the sentence natural.
        : t("notif.commentedYourPost", { name });
  const rel = relativeDate(t, row.created_at);

  const iconBg = isModeration
    ? colors.dangerSoft
    : isLike
      ? colors.accentSoft
      : colors.timingSoft;
  const iconColor = isModeration
    ? colors.danger
    : isLike
      ? colors.accent
      : colors.timing;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        // Subtle unread treatment: a soft surface + the accent dot.
        unreadRow: {
          backgroundColor: colors.surfaceSoft,
        },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.accent,
        },
        iconWrap: {
          width: 34,
          height: 34,
          borderRadius: Radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBg,
        },
        main: {
          flex: 1,
          gap: 2,
        },
        text: {
          ...Type.bodySm,
          color: colors.ink,
        },
        time: {
          ...Type.caption,
          color: colors.inkFaint,
        },
      }),
    [colors, iconBg],
  );

  return (
    <Card
      onPress={() => onOpen(row)}
      padding={Space.md}
      style={unread ? styles.unreadRow : null}
    >
      <View style={styles.row}>
        {unread ? <View style={styles.dot} /> : null}
        <View style={styles.iconWrap}>
          <Ionicons
            name={notifIcon(row.type)}
            size={17}
            color={iconColor}
          />
        </View>
        <View style={styles.main}>
          <Text style={styles.text} numberOfLines={2}>
            {text}
          </Text>
          {rel !== "" ? <Text style={styles.time}>{rel}</Text> : null}
        </View>
      </View>
    </Card>
  );
});

// ---- Screen ---------------------------------------------------------------------

/**
 * The notification center (stack route /notifications, pushed from the
 * Community tab bell). Lists likes/comments on the signed-in user's posts,
 * newest first, 20/page. Nothing is marked read on mount — only an explicit
 * row tap (that one) or the "Mark all read" action. Tapping a row also
 * pushes the post detail screen.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();

  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  /** True when the latest load-more attempt failed (footer retry affordance). */
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  // Mirror of `items` readable inside async closures without re-creating them.
  const itemsRef = useRef<NotificationRow[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  /** Fetch one inbox page: page 1 replaces the list, later pages append. */
  const loadPage = useCallback(async (targetPage: number) => {
    if (targetPage > 1) {
      setLoadingMore(true);
      setLoadMoreFailed(false);
    }
    try {
      const result = await fetchNotifications(targetPage);
      setItems((prev) =>
        targetPage === 1
          ? result.items
          : [
              ...prev,
              ...result.items.filter((n) => !prev.some((m) => m.id === n.id)),
            ],
      );
      // Page 1 carries the authoritative unread count; later pages keep any
      // optimistic read-marking done on rows already on screen.
      if (targetPage === 1) setUnreadCount(result.unreadCount);
      setPage(targetPage);
      setHasMore(result.hasMore);
      setState("ready");
    } catch (error) {
      if (error instanceof NotificationUnauthorizedError) {
        setState("signedout");
      } else if (targetPage === 1) {
        console.warn("[RecipeReal] notifications load failed:", error);
        if (itemsRef.current.length === 0) setState("error");
      } else {
        // Load-more failure: surface a footer retry instead of silently
        // keeping hasMore=true (which would loop doomed fetches).
        console.warn("[RecipeReal] notifications load-more failed:", error);
        setLoadMoreFailed(true);
      }
    } finally {
      setLoadingMore(false);
    }
  }, []);

  // Initial load: check the token first — signed-out users get the prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await hasToken();
      if (cancelled) return;
      if (!ok) {
        setState("signedout");
        return;
      }
      await loadPage(1);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  /**
   * Row tap: mark exactly that notification read (optimistic, fire-and-forget
   * server call) and open the post when it still exists. Moderation rows
   * without a post (removed content, suspensions) show their notice text
   * instead; deleted posts get explicit feedback instead of a silent no-op.
   */
  const handleOpen = useCallback((row: NotificationRow) => {
    if (row.read_at == null) {
      const now = new Date().toISOString();
      setItems((prev) =>
        prev.map((n) => (n.id === row.id ? { ...n, read_at: now } : n)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      markNotificationsRead([row.id]).catch(() => {
        // Non-fatal: a later "mark all" or re-open retries it.
      });
    }
    if (row.post != null) {
      router.push(`/post/${row.post.id}`);
    } else if (row.type === "moderation") {
      Alert.alert(
        t("notif.moderationTitle"),
        row.message ?? t("notif.moderationDefault"),
      );
    } else {
      // The underlying post was deleted — say so instead of doing nothing.
      Alert.alert(t("community.detailLoadFailed"));
    }
  }, [t]);

  /** "Mark all read": stamp everything locally, then sync best-effort. */
  const handleMarkAll = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.read_at == null ? { ...n, read_at: now } : n)),
    );
    setUnreadCount(0);
    try {
      await markNotificationsRead();
    } catch {
      // Non-fatal: the next visit re-syncs from the server.
    } finally {
      setMarkingAll(false);
    }
  }, [unreadCount, markingAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Global safety: the spinner never outlives ~10s.
    const guard = setTimeout(() => setRefreshing(false), REFRESH_SPINNER_MAX_MS);
    try {
      await loadPage(1);
    } finally {
      clearTimeout(guard);
      setRefreshing(false);
    }
  }, [loadPage]);

  const handleEndReached = useCallback(() => {
    if (state !== "ready" || loadingMore || !hasMore) return;
    void loadPage(page + 1);
  }, [state, loadingMore, hasMore, page, loadPage]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.canvas },
        actionRow: {
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingBottom: Space.xs,
          minHeight: 40,
          alignItems: "center",
        },
        markAllText: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.accent,
        },
        listContent: {
          gap: Space.md,
          paddingBottom: insets.bottom + Space.xxl,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          padding: Space.xxl,
          // Inside the padded list already — no extra horizontal inset.
          paddingHorizontal: 0,
        },
        errorTitle: { ...Type.h3, color: colors.danger },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        emptyGlyph: { fontSize: 40, color: colors.inkFaint },
        emptyTitle: { ...Type.h3, color: colors.ink },
        emptyCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        cta: { marginTop: Space.sm },
        footer: { paddingVertical: Space.lg },
      }),
    [colors, insets.bottom],
  );

  return (
    <View style={styles.container}>
      {/* Pinned header: back chevron pops to the previous screen. */}
      <PinnedHeaderBar title={t("notif.title")} leading={<BackChevron />} />

      {/* Explicit mark-all — never done automatically on mount/focus. */}
      {state === "ready" && unreadCount > 0 ? (
        <ScreenView style={styles.actionRow}>
          <IconPressable
            onPress={() => void handleMarkAll()}
            disabled={markingAll}
            hitSlop={Space.xs}
            accessibilityLabel={t("notif.markAllRead")}
          >
            <Text style={styles.markAllText}>
              {markingAll ? "…" : t("notif.markAllRead")}
            </Text>
          </IconPressable>
        </ScreenView>
      ) : null}

      <ScreenFlatList
        data={state === "ready" ? items : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <NotificationRowView row={item} onOpen={handleOpen} />
        )}
        contentContainerStyle={styles.listContent}
        initialNumToRender={10}
        windowSize={5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : loadMoreFailed ? (
            <View style={styles.footer}>
              <Button
                title={t("common.retry")}
                variant="ghost"
                onPress={() => void loadPage(page + 1)}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          state === "loading" ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} size="small" />
            </View>
          ) : state === "signedout" ? (
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>🔔</Text>
              <Text style={styles.emptyTitle}>{t("notif.title")}</Text>
              <Text style={styles.muted}>{t("notif.signInPrompt")}</Text>
              <Button
                title={t("common.signIn")}
                onPress={() => router.push("/login")}
                style={styles.cta}
              />
            </View>
          ) : state === "error" ? (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                {t("common.somethingWentWrong")}
              </Text>
              <Text style={styles.muted}>{t("notif.loadFailed")}</Text>
              <Button
                title={t("common.retry")}
                onPress={() => void loadPage(1)}
                style={styles.cta}
              />
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyGlyph}>🔔</Text>
              <Text style={styles.emptyTitle}>{t("notif.empty")}</Text>
              <Text style={styles.emptyCaption}>{t("notif.emptyCaption")}</Text>
            </View>
          )
        }
      />
    </View>
  );
}
