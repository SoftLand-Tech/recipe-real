import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  blockUser,
  fetchPosts,
  fetchPublicProfile,
  fetchUserRecipes,
  followUser,
  hasToken,
  PostUnauthorizedError,
  reportPost,
  unfollowUser,
} from "@/api/client";
import { markFeedMutation } from "@/utils/feedMutation";
import { patchMirroredFollow } from "@/utils/communityMirror";
import { setPostPreview } from "@/utils/postPreview";
import { bestMinutes } from "@/utils/recipeTime";
import { relativeDate } from "@/utils/format";
import type { MyProfile, Post, Recipe } from "@/types";
import { useLang, useLocalizedRecipe, useT } from "@/i18n";
import { Radius, Shadow, Space, Type, useThemeColors } from "@/theme";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";
import {
  ActionSheet,
  Avatar,
  Button,
  Card,
  IconPressable,
  TimeChip,
} from "@/components/ui";

type VisitorTab = "recipes" | "posts";
type ModerationSheet = null | "menu" | "report" | "block" | "blocked";

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = id ? Number(id) : NaN;
  const colors = useThemeColors();
  const t = useT();
  const { lang, dir } = useLang();
  const lr = useLocalizedRecipe();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const [activeTab, setActiveTab] = useState<VisitorTab>("recipes");

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesPage, setRecipesPage] = useState(1);
  const [recipesHasMore, setRecipesHasMore] = useState(false);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [sheet, setSheet] = useState<ModerationSheet>(null);
  const [reportedUser, setReportedUser] = useState(false);

  // State-driven pressed indicators (Android Pressable rules: no style callbacks)
  const [pressedStat, setPressedStat] = useState<string | null>(null);
  const [pressedTab, setPressedTab] = useState<VisitorTab | null>(null);
  const [followPressed, setFollowPressed] = useState(false);
  const [selfCtaPressed, setSelfCtaPressed] = useState(false);

  const profileRef = useRef<MyProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const load = useCallback(async (silent = false) => {
    if (!Number.isFinite(userId)) {
      setLoading(false);
      return;
    }
    if (!silent && profileRef.current == null) setLoading(true);
    try {
      const [ok, p, recipePage, postRes] = await Promise.all([
        hasToken(),
        fetchPublicProfile(userId),
        fetchUserRecipes(userId, 1).catch(() => null),
        fetchPosts({ user_id: userId, page: 1 }).catch(() => null),
      ]);
      setSignedIn(ok);
      setProfile(p);
      if (recipePage) {
        setRecipes(Array.isArray(recipePage.data) ? recipePage.data : []);
        setRecipesPage(1);
        setRecipesHasMore(
          Number(recipePage.meta?.current_page ?? 1) <
            Number(recipePage.meta?.last_page ?? 1),
        );
      }
      if (postRes) {
        setPosts(postRes.posts);
        setPostsPage(1);
        setPostsHasMore(postRes.hasMore);
      }
    } catch {
      // Handled by !profile error state
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void load(profileRef.current != null);
    }, [load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const loadMoreRecipes = useCallback(async () => {
    if (loadingRecipes || !recipesHasMore || !Number.isFinite(userId)) return;
    setLoadingRecipes(true);
    try {
      const page = await fetchUserRecipes(userId, recipesPage + 1);
      setRecipes((prev) => [
        ...prev,
        ...(Array.isArray(page?.data)
          ? page.data.filter((r) => !prev.some((q) => q.id === r.id))
          : []),
      ]);
      setRecipesPage((p) => p + 1);
      setRecipesHasMore(
        Number(page?.meta?.current_page ?? recipesPage + 1) <
          Number(page?.meta?.last_page ?? recipesPage + 1),
      );
    } catch {
      // Non-fatal
    } finally {
      setLoadingRecipes(false);
    }
  }, [loadingRecipes, recipesHasMore, userId, recipesPage]);

  const loadMorePosts = useCallback(async () => {
    if (loadingPosts || !postsHasMore || !Number.isFinite(userId)) return;
    setLoadingPosts(true);
    try {
      const res = await fetchPosts({ user_id: userId, page: postsPage + 1 });
      setPosts((prev) => [
        ...prev,
        ...res.posts.filter((p) => !prev.some((q) => q.id === p.id)),
      ]);
      setPostsPage((p) => p + 1);
      setPostsHasMore(res.hasMore);
    } catch {
      // Non-fatal
    } finally {
      setLoadingPosts(false);
    }
  }, [loadingPosts, postsHasMore, userId, postsPage]);

  /**
   * Optimistic follow/unfollow: flip locally, fire the request, reconcile
   * with the server's follower count on success, roll back on failure.
   */
  const toggleFollow = useCallback(async () => {
    if (!profile || followBusy) return;
    if (signedIn === false) {
      router.push("/login");
      return;
    }
    const prev = profile;
    const nextFollowing = !profile.is_following;
    setFollowBusy(true);
    setProfile({
      ...profile,
      is_following: nextFollowing,
      counts: {
        ...profile.counts,
        followers: Math.max(
          0,
          profile.counts.followers + (nextFollowing ? 1 : -1),
        ),
      },
    });
    try {
      if (nextFollowing) await followUser(profile.user.id);
      else await unfollowUser(profile.user.id);
      const p = await fetchPublicProfile(profile.user.id);
      setProfile(p);
      const reconciled = p.is_following ?? nextFollowing;
      markFeedMutation({
        type: "follow",
        userId: profile.user.id,
        following: reconciled,
      });
      void patchMirroredFollow(profile.user.id, reconciled);
    } catch {
      setProfile(prev);
    } finally {
      setFollowBusy(false);
    }
  }, [profile, followBusy, signedIn]);

  const handleReportUser = useCallback(async () => {
    if (!profile) return;
    const ok = await hasToken();
    if (!ok) {
      router.push("/login");
      return;
    }
    try {
      if (posts.length > 0) {
        await reportPost(posts[0].id, "Reported from user profile");
      }
      setReportedUser(true);
    } catch (err) {
      if (err instanceof PostUnauthorizedError) {
        router.push("/login");
      } else {
        Alert.alert(t("community.reportFailed"));
      }
    }
  }, [profile, posts, t]);

  const handleBlockUser = useCallback(async () => {
    if (!profile) return;
    const ok = await hasToken();
    if (!ok) {
      router.push("/login");
      return;
    }
    try {
      await blockUser(profile.user.id);
      setSheet("blocked");
    } catch (err) {
      if (err instanceof PostUnauthorizedError) {
        router.push("/login");
      } else {
        Alert.alert(t("community.blockFailed"));
      }
    }
  }, [profile, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.canvas },
        content: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.md,
          gap: Space.md,
          paddingBottom: Space.xxl,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.md,
          padding: Space.xxl,
        },
        selfBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingVertical: Space.sm,
          paddingHorizontal: Space.md,
        },
        selfBannerText: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.ink,
          flex: 1,
        },
        selfBannerCta: {
          backgroundColor: colors.accentSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.md,
          paddingVertical: Space.xs + 2,
        },
        selfBannerCtaText: {
          ...Type.caption,
          fontWeight: "700",
          color: colors.accentPress,
        },
        reportedBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        reportedText: { ...Type.caption, color: colors.inkSecondary, fontWeight: "600" },
        heroCard: { gap: Space.md },
        heroTopRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.lg,
        },
        statsGrid: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        statCol: {
          flex: 1,
          alignItems: "center",
          gap: 2,
          paddingVertical: Space.xs,
        },
        statVal: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.ink,
          fontVariant: ["tabular-nums"] as ("tabular-nums")[],
        },
        statLabel: {
          ...Type.caption,
          fontSize: 11,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        identityBlock: { gap: 4 },
        name: { ...Type.h2, color: colors.ink },
        sinceRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        },
        caption: { ...Type.bodySm, color: colors.inkSecondary },
        sinceText: { ...Type.caption, color: colors.inkFaint },
        bio: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          lineHeight: 20,
          marginTop: 2,
        },
        followBtnPrimary: {
          alignSelf: "stretch",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.xs,
          minHeight: 46,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
          paddingHorizontal: Space.xl,
          paddingVertical: Space.sm,
        },
        followBtnFollowing: {
          alignSelf: "stretch",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.xs,
          minHeight: 46,
          borderRadius: Radius.pill,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          paddingHorizontal: Space.xl,
          paddingVertical: Space.sm,
        },
        followBtnLabelPrimary: {
          ...Type.body,
          fontWeight: "700",
          color: "#FFFFFF",
        },
        followBtnLabelFollowing: {
          ...Type.body,
          fontWeight: "700",
          color: colors.ink,
        },
        // Segmented tabs
        segmentWrap: {
          flexDirection: "row",
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          padding: 3,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        segmentTab: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.xs,
          paddingVertical: Space.sm,
          borderRadius: Radius.pill,
        },
        segmentTabActive: {
          backgroundColor: colors.surface,
          ...Shadow.card,
        },
        segmentLabel: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.inkSecondary,
        },
        segmentLabelActive: {
          color: colors.ink,
          fontWeight: "700",
        },
        segmentCount: {
          ...Type.caption,
          color: colors.inkFaint,
          fontVariant: ["tabular-nums"] as ("tabular-nums")[],
        },
        segmentCountActive: {
          color: colors.accent,
          fontWeight: "700",
        },
        // Lists
        listStack: { gap: Space.sm },
        recipeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        recipeThumb: {
          width: 64,
          height: 64,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        recipeMain: { flex: 1, gap: 4 },
        recipeTitle: { ...Type.title, fontSize: 15, color: colors.ink },
        recipeMetaRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: Space.xs,
        },
        ratingBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          backgroundColor: colors.amberSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: 3,
        },
        ratingText: {
          ...Type.caption,
          fontWeight: "700",
          color: colors.stepTones.active.fg,
        },
        postCardInner: { gap: Space.sm },
        postTopRow: { flexDirection: "row", gap: Space.md },
        postThumbWrap: {
          width: 72,
          height: 72,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
          overflow: "hidden",
          position: "relative",
        },
        multiPhotoTag: {
          position: "absolute",
          bottom: 4,
          end: 4,
          backgroundColor: "rgba(0,0,0,0.65)",
          borderRadius: Radius.sm,
          paddingHorizontal: 5,
          paddingVertical: 1,
        },
        multiPhotoText: { fontSize: 10, fontWeight: "700", color: "#FFFFFF" },
        postBodyCol: { flex: 1, gap: 4 },
        postBody: { ...Type.bodySm, color: colors.ink, lineHeight: 20 },
        postMetaTime: { ...Type.caption, color: colors.inkFaint },
        postFooterRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: Space.sm,
          paddingTop: Space.xs,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.hairline,
        },
        postRecipeBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.accentSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: 3,
          flexShrink: 1,
        },
        postRecipeBadgeText: {
          ...Type.caption,
          color: colors.accentPress,
          fontWeight: "600",
          flexShrink: 1,
        },
        postStatsRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          marginStart: "auto",
        },
        postStatItem: { flexDirection: "row", alignItems: "center", gap: 4 },
        postStatText: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontVariant: ["tabular-nums"] as ("tabular-nums")[],
        },
        emptyCard: {
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: Space.xxl,
          paddingHorizontal: Space.xl,
        },
        iconCoin: {
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
        },
        muted: { ...Type.bodySm, color: colors.inkSecondary, textAlign: "center" },
        loadMore: { alignSelf: "center", marginTop: Space.xs },
        pressedDim: { opacity: 0.72 },
      }),
    [colors],
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <PinnedHeaderBar title={t("stack.profile")} leading={<BackChevron />} />
        <View style={styles.center}>
          <Text style={styles.caption}>{t("common.somethingWentWrong")}</Text>
          <Button title={t("common.retry")} onPress={() => void load()} />
        </View>
      </View>
    );
  }

  const displayName = (profile.user.display_name ?? profile.user.name ?? "").trim();

  const cookingSince = (() => {
    const then = Date.parse(profile.user.created_at);
    if (!Number.isFinite(then)) return "";
    try {
      const date = new Date(then).toLocaleDateString(
        lang === "ar" ? "ar" : "en-US",
        { month: "long", year: "numeric" },
      );
      return t("profile.cookingSince", { date });
    } catch {
      return "";
    }
  })();

  const isFollowing = signedIn !== false && Boolean(profile.is_following);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <PinnedHeaderBar
        title={displayName}
        leading={<BackChevron />}
        rights={
          !profile.is_self
            ? [
                <IconPressable
                  key="more"
                  onPress={() => setSheet("menu")}
                  hitSlop={Space.xs}
                  accessibilityLabel={t("profile.userActions")}
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={22}
                    color={colors.ink}
                  />
                </IconPressable>,
              ]
            : []
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Subtle self-preview banner when visiting own public profile */}
        {profile.is_self ? (
          <Card padding={0}>
            <View style={styles.selfBanner}>
              <Ionicons
                name="person-circle-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={styles.selfBannerText} numberOfLines={1}>
                {t("profile.thisIsYou")}
              </Text>
              <Pressable
                onPress={() => router.push("/profile")}
                onPressIn={() => setSelfCtaPressed(true)}
                onPressOut={() => setSelfCtaPressed(false)}
                accessibilityRole="button"
                style={[
                  styles.selfBannerCta,
                  selfCtaPressed ? styles.pressedDim : null,
                ]}
              >
                <Text style={styles.selfBannerCtaText}>
                  {t("profile.openMyProfile")}
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : null}

        {reportedUser ? (
          <View style={styles.reportedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.reportedText}>{t("community.reported")}</Text>
          </View>
        ) : null}

        {/* Social Visitor Hero */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Avatar
              name={displayName}
              uri={profile.user.avatar_url}
              size={84}
            />

            <View style={styles.statsGrid}>
              <Pressable
                onPress={() => setActiveTab("recipes")}
                onPressIn={() => setPressedStat("recipes")}
                onPressOut={() => setPressedStat(null)}
                accessibilityRole="button"
                style={[
                  styles.statCol,
                  pressedStat === "recipes" ? styles.pressedDim : null,
                ]}
              >
                <Text style={styles.statVal} numberOfLines={1}>
                  {String(profile.counts.recipes)}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {t("profile.statRecipes")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab("posts")}
                onPressIn={() => setPressedStat("posts")}
                onPressOut={() => setPressedStat(null)}
                accessibilityRole="button"
                style={[
                  styles.statCol,
                  pressedStat === "posts" ? styles.pressedDim : null,
                ]}
              >
                <Text style={styles.statVal} numberOfLines={1}>
                  {String(profile.counts.posts)}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {t("profile.statPosts")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/follow-list",
                    params: {
                      userId: String(profile.user.id),
                      tab: "followers",
                    },
                  })
                }
                onPressIn={() => setPressedStat("followers")}
                onPressOut={() => setPressedStat(null)}
                accessibilityRole="button"
                accessibilityLabel={t("profile.viewFollowers")}
                style={[
                  styles.statCol,
                  pressedStat === "followers" ? styles.pressedDim : null,
                ]}
              >
                <Text style={styles.statVal} numberOfLines={1}>
                  {String(profile.counts.followers)}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {t("profile.followers")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/follow-list",
                    params: {
                      userId: String(profile.user.id),
                      tab: "following",
                    },
                  })
                }
                onPressIn={() => setPressedStat("following")}
                onPressOut={() => setPressedStat(null)}
                accessibilityRole="button"
                accessibilityLabel={t("profile.viewFollowing")}
                style={[
                  styles.statCol,
                  pressedStat === "following" ? styles.pressedDim : null,
                ]}
              >
                <Text style={styles.statVal} numberOfLines={1}>
                  {String(profile.counts.following)}
                </Text>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {t("profile.following")}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.identityBlock}>
            <Text style={styles.name} numberOfLines={2}>
              {displayName}
            </Text>
            {cookingSince ? (
              <View style={styles.sinceRow}>
                <Ionicons
                  name="flame-outline"
                  size={13}
                  color={colors.inkFaint}
                />
                <Text style={styles.sinceText}>{cookingSince}</Text>
              </View>
            ) : null}
            {profile.user.bio?.trim() ? (
              <Text style={styles.bio}>{profile.user.bio}</Text>
            ) : null}
          </View>

          {!profile.is_self ? (
            <Pressable
              onPress={() => void toggleFollow()}
              onPressIn={() => setFollowPressed(true)}
              onPressOut={() => setFollowPressed(false)}
              disabled={followBusy}
              accessibilityRole="button"
              accessibilityLabel={
                isFollowing ? t("profile.unfollow") : t("profile.follow")
              }
              style={[
                isFollowing
                  ? styles.followBtnFollowing
                  : styles.followBtnPrimary,
                followBusy || followPressed ? styles.pressedDim : null,
              ]}
            >
              {followBusy ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowing ? colors.ink : "#FFFFFF"}
                />
              ) : (
                <>
                  <Ionicons
                    name={isFollowing ? "checkmark-circle" : "person-add-outline"}
                    size={18}
                    color={isFollowing ? colors.accent : "#FFFFFF"}
                  />
                  <Text
                    style={
                      isFollowing
                        ? styles.followBtnLabelFollowing
                        : styles.followBtnLabelPrimary
                    }
                  >
                    {isFollowing
                      ? t("profile.followingBtn")
                      : t("profile.follow")}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </Card>

        {/* Segmented Tabs: Recipes | Posts */}
        <View style={styles.segmentWrap}>
          <Pressable
            onPress={() => setActiveTab("recipes")}
            onPressIn={() => setPressedTab("recipes")}
            onPressOut={() => setPressedTab(null)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "recipes" }}
            style={[
              styles.segmentTab,
              activeTab === "recipes" ? styles.segmentTabActive : null,
              pressedTab === "recipes" && activeTab !== "recipes"
                ? styles.pressedDim
                : null,
            ]}
          >
            <Ionicons
              name="restaurant-outline"
              size={15}
              color={
                activeTab === "recipes" ? colors.accent : colors.inkSecondary
              }
            />
            <Text
              style={[
                styles.segmentLabel,
                activeTab === "recipes" ? styles.segmentLabelActive : null,
              ]}
              numberOfLines={1}
            >
              {t("profile.statRecipes")}
            </Text>
            <Text
              style={[
                styles.segmentCount,
                activeTab === "recipes" ? styles.segmentCountActive : null,
              ]}
            >
              {String(profile.counts.recipes)}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("posts")}
            onPressIn={() => setPressedTab("posts")}
            onPressOut={() => setPressedTab(null)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "posts" }}
            style={[
              styles.segmentTab,
              activeTab === "posts" ? styles.segmentTabActive : null,
              pressedTab === "posts" && activeTab !== "posts"
                ? styles.pressedDim
                : null,
            ]}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={15}
              color={
                activeTab === "posts" ? colors.accent : colors.inkSecondary
              }
            />
            <Text
              style={[
                styles.segmentLabel,
                activeTab === "posts" ? styles.segmentLabelActive : null,
              ]}
              numberOfLines={1}
            >
              {t("profile.statPosts")}
            </Text>
            <Text
              style={[
                styles.segmentCount,
                activeTab === "posts" ? styles.segmentCountActive : null,
              ]}
            >
              {String(profile.counts.posts)}
            </Text>
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === "recipes" ? (
          recipes.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View
                style={[
                  styles.iconCoin,
                  { backgroundColor: colors.surfaceSoft },
                ]}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={22}
                  color={colors.inkSecondary}
                />
              </View>
              <Text style={styles.muted}>{t("profile.noUserRecipes")}</Text>
            </Card>
          ) : (
            <View style={styles.listStack}>
              {recipes.map((recipe) => {
                const mins = bestMinutes(recipe);
                const hasRating =
                  recipe.aggregated_rating != null &&
                  Number.isFinite(recipe.aggregated_rating) &&
                  recipe.aggregated_rating > 0;
                return (
                  <Card
                    key={`user-recipe-${recipe.id}`}
                    padding={Space.md}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                  >
                    <View style={styles.recipeRow}>
                      <View style={styles.recipeThumb}>
                        {recipe.image_url ? (
                          <Image
                            source={{ uri: recipe.image_url }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={0}
                            cachePolicy="memory-disk"
                            recyclingKey={recipe.image_url}
                          />
                        ) : (
                          <Ionicons
                            name="restaurant-outline"
                            size={22}
                            color={colors.inkFaint}
                          />
                        )}
                      </View>
                      <View style={styles.recipeMain}>
                        <Text style={styles.recipeTitle} numberOfLines={2}>
                          {lr.title(recipe)}
                        </Text>
                        <View style={styles.recipeMetaRow}>
                          <TimeChip minutes={mins} />
                          {hasRating ? (
                            <View style={styles.ratingBadge}>
                              <Ionicons
                                name="star"
                                size={11}
                                color={colors.amber}
                              />
                              <Text style={styles.ratingText}>
                                {Number(recipe.aggregated_rating).toFixed(1)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons
                        name={dir === "rtl" ? "chevron-back" : "chevron-forward"}
                        size={18}
                        color={colors.inkFaint}
                      />
                    </View>
                  </Card>
                );
              })}
              {recipesHasMore ? (
                <Button
                  title={t("detail.loadMoreNotes")}
                  variant="ghost"
                  loading={loadingRecipes}
                  disabled={loadingRecipes}
                  onPress={() => void loadMoreRecipes()}
                  style={styles.loadMore}
                />
              ) : null}
            </View>
          )
        ) : posts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View
              style={[
                styles.iconCoin,
                { backgroundColor: colors.surfaceSoft },
              ]}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={22}
                color={colors.inkSecondary}
              />
            </View>
            <Text style={styles.muted}>{t("profile.noUserPosts")}</Text>
          </Card>
        ) : (
          <View style={styles.listStack}>
            {posts.map((post) => {
              const thumb = post.images[0] ?? post.image_url ?? null;
              const attachedTitle = post.recipe
                ? lang === "ar"
                  ? (post.recipe.title_ar ?? post.recipe.title)
                  : (post.recipe.title ?? post.recipe.title_ar)
                : null;
              return (
                <Card
                  key={`user-post-${post.id}`}
                  padding={Space.md}
                  onPress={() => {
                    setPostPreview(post);
                    router.push(`/post/${post.id}`);
                  }}
                >
                  <View style={styles.postCardInner}>
                    <View style={styles.postTopRow}>
                      {thumb ? (
                        <View style={styles.postThumbWrap}>
                          <Image
                            source={{ uri: thumb }}
                            style={StyleSheet.absoluteFill}
                            contentFit="cover"
                            transition={0}
                            cachePolicy="memory-disk"
                            recyclingKey={thumb}
                          />
                          {post.images.length > 1 ? (
                            <View style={styles.multiPhotoTag}>
                              <Text style={styles.multiPhotoText}>
                                +{post.images.length - 1}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      <View style={styles.postBodyCol}>
                        <Text style={styles.postBody} numberOfLines={3}>
                          {post.body}
                        </Text>
                        <Text style={styles.postMetaTime}>
                          {relativeDate(t, post.created_at)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.postFooterRow}>
                      {attachedTitle ? (
                        <View style={styles.postRecipeBadge}>
                          <Ionicons
                            name="restaurant-outline"
                            size={12}
                            color={colors.accentPress}
                          />
                          <Text
                            style={styles.postRecipeBadgeText}
                            numberOfLines={1}
                          >
                            {attachedTitle}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.postStatsRow}>
                        <View style={styles.postStatItem}>
                          <Ionicons
                            name={post.liked_by_me ? "heart" : "heart-outline"}
                            size={14}
                            color={
                              post.liked_by_me
                                ? colors.accent
                                : colors.inkSecondary
                            }
                          />
                          <Text style={styles.postStatText}>
                            {String(post.likes_count)}
                          </Text>
                        </View>
                        <View style={styles.postStatItem}>
                          <Ionicons
                            name="chatbubble-outline"
                            size={14}
                            color={colors.inkSecondary}
                          />
                          <Text style={styles.postStatText}>
                            {String(post.comments_count)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}
            {postsHasMore ? (
              <Button
                title={t("detail.loadMoreNotes")}
                variant="ghost"
                loading={loadingPosts}
                disabled={loadingPosts}
                onPress={() => void loadMorePosts()}
                style={styles.loadMore}
              />
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Moderation ActionSheets */}
      {sheet === "menu" ? (
        <ActionSheet
          key="menu"
          visible
          onClose={() => setSheet(null)}
          title={t("profile.userActions")}
          actions={[
            {
              key: "report",
              label: t("profile.reportUser"),
              icon: "flag-outline",
              onPress: () => setSheet("report"),
            },
            {
              key: "block",
              label: t("community.blockUser"),
              icon: "ban-outline",
              tone: "destructive",
              onPress: () => setSheet("block"),
            },
          ]}
        />
      ) : null}

      {sheet === "report" ? (
        <ActionSheet
          key="report"
          visible
          onClose={() => setSheet(null)}
          title={t("profile.reportUser")}
          message={t("community.reportConfirm")}
          actions={[
            {
              key: "confirm",
              label: t("profile.reportUser"),
              icon: "flag-outline",
              onPress: () => {
                void handleReportUser();
              },
            },
          ]}
        />
      ) : null}

      {sheet === "block" ? (
        <ActionSheet
          key="block"
          visible
          onClose={() => setSheet(null)}
          title={t("community.blockUser")}
          message={t("community.blockConfirm", { name: displayName })}
          actions={[
            {
              key: "confirm",
              label: t("community.blockBtn"),
              icon: "ban-outline",
              tone: "destructive",
              onPress: () => {
                void handleBlockUser();
              },
            },
          ]}
        />
      ) : null}

      {sheet === "blocked" ? (
        <ActionSheet
          key="blocked"
          visible
          onClose={() => {
            setSheet(null);
            router.back();
          }}
          title={t("community.blocked")}
          message={t("profile.blockedMessage", { name: displayName })}
          actions={[
            {
              key: "ok",
              label: t("common.ok"),
              icon: "checkmark-outline",
              onPress: () => router.back(),
            },
          ]}
        />
      ) : null}
    </View>
  );
}
