import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { fetchFollowers, fetchFollowing } from "@/api/client";
import type { PublicProfile } from "@/types";
import { useLang, useT } from "@/i18n";
import { Space, Type, useThemeColors } from "@/theme";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";
import { Avatar, Button, Card } from "@/components/ui";

type ListTab = "followers" | "following";

export default function FollowListScreen() {
  const { userId: userIdRaw, tab } = useLocalSearchParams<{ userId?: string; tab?: string }>();
  const userId = userIdRaw ? Number(userIdRaw) : NaN;
  const initialTab: ListTab = tab === "following" ? "following" : "followers";
  const [active, setActive] = useState<ListTab>(initialTab);
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Set when a load fails — the error state is distinct from "empty list". */
  const [loadFailed, setLoadFailed] = useState(false);
  const colors = useThemeColors();
  const t = useT();
  const { dir } = useLang();

  // Monotonic request id: only the LATEST load may commit, so a slow
  // followers response can never populate the following tab (or vice versa).
  const requestIdRef = useRef(0);

  const load = useCallback(async (nextPage: number, replace: boolean) => {
    if (!Number.isFinite(userId)) return;
    const requestId = ++requestIdRef.current;
    if (replace) setLoading(true); else setLoadingMore(true);
    setLoadFailed(false);
    try {
      const res = active === "followers" ? await fetchFollowers(userId, nextPage) : await fetchFollowing(userId, nextPage);
      if (requestId !== requestIdRef.current) return;
      setUsers((prev) => (replace ? res.users : [...prev, ...res.users.filter((u) => !prev.some((p) => p.id === u.id))]));
      setPage(nextPage);
      setHasMore(res.hasMore);
    } catch {
      if (requestId !== requestIdRef.current) return;
      // Surface the failure instead of rendering it as an empty list.
      setLoadFailed(true);
      setHasMore(false);
    }
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    setLoadingMore(false);
  }, [userId, active]);

  useEffect(() => { setUsers([]); setPage(1); void load(1, true); }, [load]);
  useEffect(() => { setActive(initialTab); }, [initialTab]);

  const switchTab = useCallback((next: ListTab) => {
    if (next === active) return;
    setActive(next);
    setUsers([]);
  }, [active]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    tabs: { flexDirection: "row", gap: Space.sm, paddingHorizontal: Space.lg, paddingVertical: Space.sm },
    tab: { flex: 1, alignItems: "center", paddingVertical: Space.sm, borderRadius: 999, backgroundColor: colors.surfaceSoft },
    tabActive: { backgroundColor: colors.accent },
    tabText: { ...Type.bodySm, fontWeight: "600", color: colors.inkSecondary },
    tabTextActive: { color: "#fff" },
    row: { flexDirection: "row", alignItems: "center", gap: Space.md, padding: Space.md },
    name: { ...Type.title, color: colors.ink, flex: 1 },
    muted: { ...Type.bodySm, color: colors.inkSecondary, textAlign: "center" as const },
    center: { padding: Space.xxl, alignItems: "center" as const, gap: Space.md },
  }), [colors]);

  return (
    <View style={styles.container}>
      <PinnedHeaderBar
        title={active === "followers" ? t("profile.followersTitle") : t("profile.followingTitle")}
        leading={<BackChevron />}
      />
      <View style={styles.tabs}>
        <Pressable
          onPress={() => switchTab("followers")}
          style={[styles.tab, active === "followers" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === "followers" }}
        >
          <Text style={[styles.tabText, active === "followers" && styles.tabTextActive]}>{t("profile.followers")}</Text>
        </Pressable>
        <Pressable
          onPress={() => switchTab("following")}
          style={[styles.tab, active === "following" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === "following" }}
        >
          <Text style={[styles.tabText, active === "following" && styles.tabTextActive]}>{t("profile.following")}</Text>
        </Pressable>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.accent} /></View> : loadFailed ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{t("followList.loadFailed")}</Text>
          <Button title={t("common.retry")} onPress={() => void load(1, true)} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => String(u.id)}
          contentContainerStyle={{ paddingHorizontal: Space.lg, paddingBottom: Space.xxl, gap: Space.sm }}
          renderItem={({ item }) => (
            <Card padding={0} onPress={() => router.push(`/user/${item.id}`)}>
              <View style={styles.row}>
                <Avatar name={item.display_name ?? item.name} uri={item.avatar_url} size={44} />
                <Text style={styles.name} numberOfLines={1}>{(item.display_name ?? item.name ?? "").trim() || "?"}</Text>
                {/* Direction-aware chevron: flips with the layout in RTL. */}
                <Ionicons name={dir === "rtl" ? "chevron-back" : "chevron-forward"} size={18} color={colors.inkFaint} />
              </View>
            </Card>
          )}
          onEndReached={() => { if (hasMore && !loadingMore && !loadFailed) void load(page + 1, false); }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.accent} /> : null}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.muted}>{active === "followers" ? t("profile.noFollowers") : t("profile.noFollowing")}</Text></View>}
        />
      )}
    </View>
  );
}
