import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchPublicProfile, followUser, unfollowUser } from "@/api/client";
import type { MyProfile } from "@/types";
import { useT, useLang, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { Avatar, Button, Card, IconPressable, ScreenHeader } from "@/components/ui";

function memberSince(t: TranslateFn, lang: Lang, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  try {
    const date = new Date(then).toLocaleDateString(lang === "ar" ? "ar" : "en-US", { month: "long", year: "numeric" });
    return t("profile.memberSince", { date });
  } catch { return ""; }
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = id ? Number(id) : NaN;
  const colors = useThemeColors();
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(userId)) return;
    setLoading(true);
    try {
      const p = await fetchPublicProfile(userId);
      setProfile(p);
    } catch { /* ignore */ }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const toggleFollow = useCallback(async () => {
    if (!profile) return;
    setFollowBusy(true);
    try {
      if (profile.is_following) await unfollowUser(profile.user.id);
      else await followUser(profile.user.id);
      const p = await fetchPublicProfile(profile.user.id);
      setProfile(p);
    } catch { /* ignore */ }
    setFollowBusy(false);
  }, [profile]);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingHorizontal: 0, gap: Space.lg, paddingBottom: Space.xxl },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Space.md, padding: Space.xxl },
    name: { ...Type.h2, color: colors.ink },
    caption: { ...Type.bodySm, color: colors.inkSecondary },
    bio: { ...Type.bodySm, color: colors.inkSecondary, lineHeight: 20 },
    statRow: { flexDirection: "row", gap: Space.md },
    statCol: { flex: 1, alignItems: "center", gap: 2 },
    statVal: { fontSize: 18, fontWeight: "700", color: colors.ink },
    statLabel: { ...Type.caption, color: colors.inkSecondary, textAlign: "center" },
  }), [colors]);

  if (loading) return <View style={[styles.center, { backgroundColor: colors.canvas }]}><ActivityIndicator color={colors.accent} /></View>;
  if (!profile) return (
    <View style={[styles.center, { backgroundColor: colors.canvas }]}>
      <Text style={styles.caption}>{t("common.somethingWentWrong")}</Text>
      <Button title={t("common.retry")} onPress={() => void load()} />
    </View>
  );

  const displayName = (profile.user.display_name ?? profile.user.name ?? "").trim();
  const since = memberSince(t, lang, profile.user.created_at);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScreenHeader title={displayName} right={<IconPressable onPress={() => router.back()} hitSlop={Space.xs}><Ionicons name="close" size={22} color={colors.ink} /></IconPressable>} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={{ gap: Space.md, alignItems: "center" }}>
          <Avatar name={displayName} uri={profile.user.avatar_url} size={96} />
          <Text style={styles.name}>{displayName}</Text>
          {since ? <Text style={styles.caption}>{since}</Text> : null}
          {profile.user.bio ? <Text style={styles.bio}>{profile.user.bio}</Text> : null}
          {!profile.is_self ? (
            <Button
              title={profile.is_following ? t("profile.unfollow") : t("profile.follow")}
              variant={profile.is_following ? "secondary" : "primary"}
              loading={followBusy}
              onPress={() => void toggleFollow()}
            />
          ) : null}
          <View style={styles.statRow}>
            <Pressable onPress={() => router.push({ pathname: "/follow-list", params: { userId: String(profile.user.id), tab: "followers" } })} style={styles.statCol}>
              <Text style={styles.statVal}>{String(profile.counts.followers)}</Text>
              <Text style={styles.statLabel}>{t("profile.followers")}</Text>
            </Pressable>
            <Pressable onPress={() => router.push({ pathname: "/follow-list", params: { userId: String(profile.user.id), tab: "following" } })} style={styles.statCol}>
              <Text style={styles.statVal}>{String(profile.counts.following)}</Text>
              <Text style={styles.statLabel}>{t("profile.following")}</Text>
            </Pressable>
            <View style={styles.statCol}><Text style={styles.statVal}>{String(profile.counts.recipes)}</Text><Text style={styles.statLabel}>{t("profile.statRecipes")}</Text></View>
            <View style={styles.statCol}><Text style={styles.statVal}>{String(profile.counts.posts)}</Text><Text style={styles.statLabel}>{t("profile.statPosts")}</Text></View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}
