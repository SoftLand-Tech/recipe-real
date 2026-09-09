import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  createPostComment,
  fetchPostComments,
  HalalRejectionError,
  OfflineError,
  PostUnauthorizedError,
} from "@/api/client";
import type { PostComment } from "@/types";
import { useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { Avatar } from "@/components/ui/Avatar";
import { IconPressable } from "@/components/ui/IconPressable";

const SCREEN_H = Dimensions.get("window").height;
const TRAVEL_RATIO = 1.15;
const EXIT_MS = 180;
const ENTER_MS = 200;

function relativeDate(t: ReturnType<typeof useT>, iso: string): string {
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

function authorName(user: PostComment["user"]): string {
  return (user.display_name ?? user.name ?? "").trim();
}

interface Props {
  postId: number | null;
  visible: boolean;
  onClose: () => void;
  /** Current user's avatar for composer */
  myAvatar?: string | null;
  myName?: string | null;
  /** Called after a successful comment post to bump count in feed */
  onCommented?: (postId: number) => void;
}

export function CommentsSheet({ postId, visible, onClose, myAvatar, myName, onCommented }: Props) {
  const colors = useThemeColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<PostComment[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [halalTerms, setHalalTerms] = useState<string[] | null>(null);

  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_H)).current;
  const travelRef = useRef(SCREEN_H * TRAVEL_RATIO);
  const startedRef = useRef(false);
  const closingRef = useRef(false);

  const resetAnim = useCallback(() => {
    startedRef.current = false;
    closingRef.current = false;
    scrimOpacity.setValue(0);
    sheetY.setValue(SCREEN_H);
  }, [scrimOpacity, sheetY]);

  useEffect(() => {
    if (!visible) return;
    resetAnim();
    // Defer entry to next frame so layout measures first
    requestAnimationFrame(() => {
      if (startedRef.current) return;
      startedRef.current = true;
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: ENTER_MS, useNativeDriver: true }),
        Animated.spring(sheetY, { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }),
      ]).start();
    });
  }, [visible, resetAnim, scrimOpacity, sheetY]);

  const dismiss = useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.parallel([
        Animated.timing(sheetY, {
          toValue: travelRef.current,
          duration: EXIT_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scrimOpacity, { toValue: 0, duration: EXIT_MS, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return;
        onClose();
        after?.();
      });
    },
    [onClose, scrimOpacity, sheetY],
  );

  const handleLayout = useCallback(
    (e: any) => {
      travelRef.current = e.nativeEvent.layout.height * TRAVEL_RATIO;
    },
    [],
  );

  // Fetch comments when sheet opens
  useEffect(() => {
    if (!visible || postId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setComments([]);
    setPage(1);
    setHasMore(false);
    fetchPostComments(postId, 1)
      .then((res) => {
        if (cancelled) return;
        setComments(res.comments);
        setHasMore(res.hasMore);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled) setError(t("community.commentsLoadFailed"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, postId, t]);

  const loadMore = useCallback(async () => {
    if (!postId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPostComments(postId, page + 1);
      setComments((prev) => [...prev, ...res.comments.filter((c) => !prev.some((p) => p.id === c.id))]);
      setPage((p) => p + 1);
      setHasMore(res.hasMore);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  }, [postId, page, hasMore, loadingMore]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || posting || postId == null) return;
    setPosting(true);
    setHalalTerms(null);
    try {
      const created = await createPostComment(postId, body);
      setComments((prev) => [...prev, created]);
      setDraft("");
      onCommented?.(postId);
    } catch (e) {
      // The draft is kept on every failure (cleared only on success above):
      // offline (not queued — the queue is cook-sessions-only) shows the
      // retry message verbatim.
      if (e instanceof HalalRejectionError) setHalalTerms(e.terms);
      else if (e instanceof PostUnauthorizedError) setError(t("community.signInPrompt"));
      else if (e instanceof OfflineError) setError(e.message);
      else setError(t("community.commentFailed"));
    } finally {
      setPosting(false);
    }
  }, [draft, posting, postId, t, onCommented]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: "flex-end" },
        fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: Radius.lg,
          borderTopRightRadius: Radius.lg,
          maxHeight: SCREEN_H * 0.9,
          minHeight: SCREEN_H * 0.5,
        },
        grabberWrap: { alignItems: "center", paddingTop: Space.sm, paddingBottom: Space.xs },
        grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.hairline },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Space.lg,
          paddingVertical: Space.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.hairline,
        },
        headerTitle: { ...Type.title, fontWeight: "700", color: colors.ink },
        headerClose: {
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        listContent: { paddingHorizontal: Space.lg, paddingVertical: Space.md, gap: Space.md },
        center: { alignItems: "center", justifyContent: "center", paddingVertical: 32, gap: Space.sm },
        muted: { ...Type.body, color: colors.inkSecondary, textAlign: "center" },
        errorText: { ...Type.bodySm, color: colors.danger, textAlign: "center" },
        commentRow: { flexDirection: "row", gap: Space.sm, alignItems: "flex-start" },
        commentBubble: {
          flex: 1,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.xs + 2,
        },
        commentAuthor: { ...Type.bodySm, fontWeight: "700", color: colors.ink },
        commentBody: { ...Type.bodySm, color: colors.ink, marginTop: 1 },
        commentMeta: { ...Type.caption, color: colors.inkFaint, marginTop: 4, marginStart: Space.sm },
        composerRow: {
          flexDirection: "row",
          alignItems: "flex-end",
          gap: Space.sm,
          paddingHorizontal: Space.lg,
          paddingTop: Space.sm,
          paddingBottom: Math.max(insets.bottom, Space.sm),
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
          backgroundColor: colors.surface,
        },
        composerPill: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: Space.xs,
          minHeight: 40,
        },
        composerInput: {
          flex: 1,
          ...Type.bodySm,
          color: colors.ink,
          paddingHorizontal: Space.xs,
          paddingVertical: Space.xs,
          maxHeight: 100,
        },
        sendBtn: {
          width: 32,
          height: 32,
          borderRadius: 16,
          alignItems: "center",
          justifyContent: "center",
        },
      }),
    [colors, insets.bottom],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => dismiss()}>
      <View style={styles.overlay}>
        <Pressable onPress={() => dismiss()} style={styles.fill}>
          <Animated.View style={[styles.fill, { backgroundColor: colors.scrim, opacity: scrimOpacity }]} />
        </Pressable>

        <Animated.View onLayout={handleLayout} style={[styles.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={styles.grabberWrap}>
            <View style={styles.grabber} />
          </View>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t("community.commentsTitle")}</Text>
            <IconPressable onPress={() => dismiss()} hitSlop={Space.xs} style={styles.headerClose}>
              <Ionicons name="close" size={18} color={colors.inkSecondary} />
            </IconPressable>
          </View>

          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <FlatList
              data={comments}
              keyExtractor={(c) => String(c.id)}
              contentContainerStyle={styles.listContent}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListEmptyComponent={
                loading ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : error ? (
                  <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : (
                  <View style={styles.center}>
                    <Text style={styles.muted}>{t("community.commentsEmpty")}</Text>
                  </View>
                )
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={colors.accent} size="small" />
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Avatar name={authorName(item.user)} uri={item.user.avatar_url} size={32} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={styles.commentBubble}>
                      <Text style={styles.commentAuthor} numberOfLines={1}>
                        {authorName(item.user)}
                      </Text>
                      <Text style={styles.commentBody}>{item.body}</Text>
                    </View>
                    <Text style={styles.commentMeta}>{relativeDate(t, item.created_at)}</Text>
                  </View>
                </View>
              )}
            />

            <View style={styles.composerRow}>
              <Avatar name={myName ?? "?"} uri={myAvatar} size={32} />
              <View style={styles.composerPill}>
                <TextInput
                  style={styles.composerInput}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t("community.commentPlaceholder")}
                  placeholderTextColor={colors.inkFaint}
                  multiline
                  maxLength={1000}
                  editable={!posting}
                />
                <IconPressable
                  onPress={() => void send()}
                  disabled={posting || draft.trim().length === 0}
                  hitSlop={Space.xs}
                  style={styles.sendBtn}
                >
                  {posting ? (
                    <ActivityIndicator size="small" color={colors.inkFaint} />
                  ) : (
                    <Ionicons name="send" size={18} color={draft.trim().length === 0 ? colors.inkFaint : colors.accent} />
                  )}
                </IconPressable>
              </View>
            </View>
            {halalTerms ? (
              <Text style={[styles.errorText, { paddingHorizontal: Space.lg, paddingBottom: Space.xs }]}>
                {t("community.halalBlocked", { terms: halalTerms.join(", ") })}
              </Text>
            ) : null}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}
