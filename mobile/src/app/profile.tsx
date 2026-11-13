import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import {
  deleteRecipeImport,
  fetchMyProfileFull,
  fetchMyRecipes,
  fetchPosts,
  getCookSessions,
  getPaceCalibrations,
  hasToken,
  listMyRecipeImports,
  retryRecipeImport,
  updateProfile,
  uploadAvatar,
} from "@/api/client";
import type { MyProfile, PaceCalibration, Post, Recipe, RecipeImportRecord } from "@/types";
import { AI_IMPORT_ENABLED, WEB_BASE_URL } from "@/config";
import { useLang, useLocalizedRecipe, useT } from "@/i18n";
import { Radius, Shadow, Space, Type, useThemeColors } from "@/theme";
import { bestMinutes } from "@/utils/recipeTime";
import { memberSince, relativeDate } from "@/utils/format";
import { setPostPreview } from "@/utils/postPreview";
import { shareLink } from "@/utils/share";
import {
  Avatar,
  Button,
  Card,
  GoogleLogo,
  IconPressable,
  SectionHeader,
  TimeChip,
} from "@/components/ui";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";

type LoadState = "loading" | "ready" | "error";
type ProfileTab = "recipes" | "posts";

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 500;
const SAVED_CAPTION_MS = 2400;

interface PillButtonProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: "accent" | "soft";
  onPress: () => void;
  flex?: boolean;
}

/**
 * Compact pill CTA following Android Pressable rules (static styles,
 * state-driven opacity, never a style callback function).
 */
function ActionPill({ label, icon, tone = "soft", onPress, flex = false }: PillButtonProps) {
  const colors = useThemeColors();
  const [pressed, setPressed] = useState(false);
  const isAccent = tone === "accent";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        pill: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.xs,
          borderRadius: Radius.pill,
          paddingVertical: Space.sm + 2,
          paddingHorizontal: Space.md,
          minHeight: 40,
          backgroundColor: isAccent ? colors.accent : colors.surfaceSoft,
          borderWidth: isAccent ? 0 : 1,
          borderColor: colors.hairline,
          ...(flex ? { flexGrow: 1, flexBasis: 0 } : null),
        },
        pressed: { opacity: 0.72 },
        label: {
          ...Type.bodySm,
          fontWeight: "700",
          color: isAccent ? "#FFFFFF" : colors.ink,
        },
      }),
    [colors, isAccent, flex],
  );

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.pill, pressed ? styles.pressed : null]}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={isAccent ? "#FFFFFF" : colors.ink}
        />
      ) : null}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { lang, dir } = useLang();
  const lr = useLocalizedRecipe();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("recipes");

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesHasMore, setRecipesHasMore] = useState(false);
  const [recipesPage, setRecipesPage] = useState(1);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [paceMultiplier, setPaceMultiplier] = useState<number | null>(null);
  const [finishedCooks, setFinishedCooks] = useState<number | null>(null);

  const [imports, setImports] = useState<RecipeImportRecord[]>([]);
  const [importActionId, setImportActionId] = useState<number | null>(null);

  const [state, setState] = useState<LoadState>("loading");
  const [refreshing, setRefreshing] = useState(false);

  // Edit profile modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [pickedAvatarUri, setPickedAvatarUri] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Web fallback confirmation (Share sheet is unavailable on web).
  const [linkCopied, setLinkCopied] = useState(false);

  // Stat & tab pressed states (avoid Pressable style callbacks)
  const [pressedStat, setPressedStat] = useState<string | null>(null);
  const [pressedTab, setPressedTab] = useState<ProfileTab | null>(null);

  const profileRef = useRef<MyProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const displayName = (profile?.user.display_name ?? profile?.user.name ?? "").trim();

  const loadPaceSummary = useCallback(async () => {
    try {
      const [calibrations, sessions] = await Promise.all([
        getPaceCalibrations().catch(() => [] as PaceCalibration[]),
        getCookSessions({ maxPages: 1, perPage: 1 }).catch(() => null),
      ]);
      if (Array.isArray(calibrations) && calibrations.length > 0) {
        const avg =
          calibrations.reduce((acc, c) => acc + c.multiplier, 0) /
          calibrations.length;
        setPaceMultiplier(Number.isFinite(avg) ? avg : null);
      } else {
        setPaceMultiplier(null);
      }
      if (sessions != null) {
        setFinishedCooks(sessions.meta?.total ?? sessions.data?.length ?? 0);
      }
    } catch {
      // Non-fatal: pace summary degrades quietly.
    }
  }, []);

  const loadAll = useCallback(async (fresh: boolean) => {
    const ok = await hasToken();
    setSignedIn(ok);
    if (!ok) {
      setProfile(null);
      setRecipes([]);
      setPosts([]);
      setState("ready");
      return;
    }
    if (fresh || profileRef.current == null) setState("loading");
    try {
      const [me, recipePage] = await Promise.all([
        fetchMyProfileFull(),
        fetchMyRecipes(1),
      ]);
      setProfile(me);
      if (!isEditingRef.current) {
        setEditName(me.user.display_name ?? "");
        setEditBio(me.user.bio ?? "");
      }
      setRecipes(Array.isArray(recipePage?.data) ? recipePage.data : []);
      setRecipesPage(1);
      setRecipesHasMore(
        Number(recipePage?.meta?.current_page ?? 1) <
          Number(recipePage?.meta?.last_page ?? 1),
      );
      setState("ready");

      // Fetch posts + pace summary in parallel without blocking initial hero paint
      void fetchPosts({ user_id: me.user.id, page: 1 })
        .then((postsRes) => {
          setPosts(postsRes.posts);
          setPostsPage(1);
          setPostsHasMore(postsRes.hasMore);
        })
        .catch(() => {});

      void loadPaceSummary();
    } catch (err) {
      console.warn("[RecipeReal] profile load failed:", err);
      if (profileRef.current == null) setState("error");
    }
  }, [loadPaceSummary]);

  useFocusEffect(
    useCallback(() => {
      void loadAll(false);
    }, [loadAll]),
  );

  const loadImports = useCallback(async () => {
    try {
      const rows = await listMyRecipeImports();
      setImports(rows.filter((row) => row.status !== "published"));
    } catch (err) {
      console.warn("[RecipeReal] imports load failed:", err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (AI_IMPORT_ENABLED) void loadImports();
    }, [loadImports]),
  );

  const hasActiveImport = imports.some(
    (row) => row.status === "queued" || row.status === "processing",
  );

  useEffect(() => {
    if (!AI_IMPORT_ENABLED || !hasActiveImport || signedIn !== true) return;
    const timer = setInterval(() => {
      void loadImports();
    }, 8000);
    return () => clearInterval(timer);
  }, [hasActiveImport, signedIn, loadImports]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadAll(false),
        AI_IMPORT_ENABLED ? loadImports() : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [loadAll, loadImports]);

  const retryImport = useCallback(
    async (id: number) => {
      setImportActionId(id);
      try {
        await retryRecipeImport(id);
        await loadImports();
      } catch (err) {
        console.warn("[RecipeReal] import retry failed:", err);
      } finally {
        setImportActionId(null);
      }
    },
    [loadImports],
  );

  const dismissImport = useCallback(async (id: number) => {
    setImportActionId(id);
    try {
      await deleteRecipeImport(id);
      setImports((prev) => prev.filter((row) => row.id !== id));
    } catch (err) {
      console.warn("[RecipeReal] import dismiss failed:", err);
    } finally {
      setImportActionId(null);
    }
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), SAVED_CAPTION_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    if (!linkCopied) return;
    const timer = setTimeout(() => setLinkCopied(false), SAVED_CAPTION_MS);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  const loadMoreRecipes = useCallback(async () => {
    if (loadingRecipes || !recipesHasMore || signedIn !== true) return;
    setLoadingRecipes(true);
    try {
      const page = await fetchMyRecipes(recipesPage + 1);
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
    } catch (err) {
      console.warn("[RecipeReal] my recipes load-more failed:", err);
    } finally {
      setLoadingRecipes(false);
    }
  }, [loadingRecipes, recipesHasMore, signedIn, recipesPage]);

  const loadMorePosts = useCallback(async () => {
    if (loadingPosts || !postsHasMore || !profile || signedIn !== true) return;
    setLoadingPosts(true);
    try {
      const res = await fetchPosts({
        user_id: profile.user.id,
        page: postsPage + 1,
      });
      setPosts((prev) => [
        ...prev,
        ...res.posts.filter((p) => !prev.some((q) => q.id === p.id)),
      ]);
      setPostsPage((p) => p + 1);
      setPostsHasMore(res.hasMore);
    } catch (err) {
      console.warn("[RecipeReal] my posts load-more failed:", err);
    } finally {
      setLoadingPosts(false);
    }
  }, [loadingPosts, postsHasMore, profile, signedIn, postsPage]);

  const handleQuickAvatarChange = useCallback(async () => {
    if (avatarUploading || !profile) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setAvatarUploading(true);
      setError(null);
      await uploadAvatar(result.assets[0].uri);
      const me = await fetchMyProfileFull();
      setProfile(me);
      setSaved(true);
    } catch (err) {
      console.warn("[RecipeReal] direct avatar upload failed:", err);
      setError(t("profile.errUploadAvatar"));
    } finally {
      setAvatarUploading(false);
    }
  }, [avatarUploading, profile, t]);

  /**
   * Opens the system share sheet with a link to this profile. We share the
   * public https URL (https://recipe-real.softland.tech/u/{id}): on devices
   * with the app installed it opens the app via Android App Links, everyone
   * else lands on the web profile page with a download banner — unlike the
   * old recipereal:// deep link, which was a dead end for recipients without
   * the app. On web the RN Share sheet doesn't exist: copy the link to the
   * clipboard instead and confirm with a caption.
   */
  const handleShareProfile = useCallback(async () => {
    const me = profileRef.current;
    if (!me) return;
    const url = `${WEB_BASE_URL}/u/${me.user.id}`;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
      } catch (err) {
        console.warn("[RecipeReal] profile link copy failed:", err);
        setError(t("profile.errCopyLink"));
      }
      return;
    }
    try {
      await shareLink(url, t("profile.shareMessage"));
    } catch {
      // The user dismissed the sheet (or the platform errored) — best-effort.
    }
  }, [t]);

  const enterEdit = useCallback(() => {
    if (!profile) return;
    setEditName(profile.user.display_name ?? "");
    setEditBio(profile.user.bio ?? "");
    setPickedAvatarUri(null);
    setRemoveAvatar(false);
    setError(null);
    setSaved(false);
    setIsEditing(true);
  }, [profile]);

  const cancelEdit = useCallback(() => {
    if (!profile) {
      setIsEditing(false);
      return;
    }
    setEditName(profile.user.display_name ?? "");
    setEditBio(profile.user.bio ?? "");
    setPickedAvatarUri(null);
    setRemoveAvatar(false);
    setError(null);
    setIsEditing(false);
  }, [profile]);

  const pickAvatarInModal = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      setPickedAvatarUri(result.assets[0].uri);
      setRemoveAvatar(false);
    } catch (err) {
      console.warn("[RecipeReal] avatar pick failed:", err);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || !profile) return;
    const nameVal = editName.trim();
    if (nameVal.length < DISPLAY_NAME_MIN || nameVal.length > DISPLAY_NAME_MAX) {
      setError(t("profile.errNameLength"));
      return;
    }
    if (editBio.length > BIO_MAX) {
      setError(t("profile.errBioLong"));
      return;
    }
    setSaving(true);
    setError(null);
    let avatarUploadFailed = false;
    try {
      if (pickedAvatarUri) {
        try {
          await uploadAvatar(pickedAvatarUri);
        } catch (uploadErr) {
          avatarUploadFailed = true;
          throw uploadErr;
        }
      } else if (removeAvatar) {
        await updateProfile({ avatar_url: null });
      }
      const patch: Record<string, string | null> = {};
      if (nameVal !== (profile.user.display_name ?? "")) patch.display_name = nameVal;
      const bioVal = editBio.trim();
      const currentBio = (profile.user.bio ?? "").trim();
      if (bioVal !== currentBio) patch.bio = bioVal === "" ? null : bioVal;
      if (Object.keys(patch).length > 0) await updateProfile(patch);
      const me = await fetchMyProfileFull();
      setProfile(me);
      setEditName(me.user.display_name ?? "");
      setEditBio(me.user.bio ?? "");
      setPickedAvatarUri(null);
      setRemoveAvatar(false);
      setIsEditing(false);
      setSaved(true);
    } catch (err) {
      console.warn("[RecipeReal] profile save failed:", err);
      setError(
        avatarUploadFailed
          ? t("profile.errUploadAvatar")
          : t("profile.errSaveName"),
      );
    } finally {
      setSaving(false);
    }
  }, [saving, profile, editName, editBio, pickedAvatarUri, removeAvatar, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.canvas },
        scroll: { flex: 1 },
        content: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.md,
          gap: Space.md,
          paddingBottom: Space.xxl,
        },
        heroCard: { gap: Space.md },
        heroTopRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.lg,
        },
        avatarWrap: { position: "relative" },
        avatarUploadingOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 42,
          backgroundColor: colors.scrim,
          alignItems: "center",
          justifyContent: "center",
        },
        avatarBadge: {
          position: "absolute",
          bottom: -2,
          end: -2,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.surface,
        },
        googleFallback: {
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
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
        statValue: {
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
        identityName: { ...Type.h2, color: colors.ink },
        bioText: { ...Type.bodySm, color: colors.inkSecondary, lineHeight: 20, marginTop: 2 },
        metaRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: Space.sm,
          marginTop: 2,
        },
        privateEmailBadge: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.pill,
          paddingHorizontal: Space.sm,
          paddingVertical: 3,
          maxWidth: "100%",
        },
        privateEmailText: {
          ...Type.caption,
          color: colors.inkSecondary,
          flexShrink: 1,
        },
        memberSinceRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        },
        identityCaption: { ...Type.caption, color: colors.inkFaint },
        actionsRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.sm,
          marginTop: Space.xs,
        },
        savedCaption: { ...Type.caption, color: colors.success, fontWeight: "600" },
        errorCaption: { ...Type.caption, color: colors.danger },
        errorTitle: { ...Type.h3, color: colors.danger },
        // Studio cards
        studioStack: { gap: Space.sm },
        paceRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          padding: Space.md,
        },
        iconCoin: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
        },
        paceMain: { flex: 1, gap: 2 },
        paceTitle: { ...Type.title, fontSize: 15, color: colors.ink },
        paceSub: { ...Type.caption, color: colors.inkSecondary },
        quickLinksRow: {
          flexDirection: "row",
          gap: Space.sm,
        },
        quickTile: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          padding: Space.md,
        },
        quickTileLabel: {
          ...Type.bodySm,
          fontWeight: "600",
          color: colors.ink,
          flex: 1,
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
        // Recipe & Post rows
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
        recipeChips: { flexDirection: "row", alignItems: "center", gap: Space.xs },
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
        muted: { ...Type.bodySm, color: colors.inkSecondary, textAlign: "center" },
        loadMore: { alignSelf: "center", marginTop: Space.xs },
        center: {
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: 64,
          paddingHorizontal: Space.xxl,
        },
        signInCaption: { ...Type.body, color: colors.inkSecondary, textAlign: "center" },
        cta: { marginTop: Space.sm },
        // Modal styles
        modalOverlay: {
          flex: 1,
          backgroundColor: colors.scrim,
          justifyContent: "center",
          padding: Space.lg,
        },
        modalCard: {
          backgroundColor: colors.surface,
          borderRadius: Radius.xl,
          padding: Space.xl,
          maxHeight: "88%",
          width: "100%",
          maxWidth: 460,
          alignSelf: "center",
          ...Shadow.floating,
        },
        modalHeader: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: Space.md,
        },
        modalTitle: { ...Type.h3, color: colors.ink },
        modalAvatarCenter: {
          alignItems: "center",
          gap: Space.sm,
          marginBottom: Space.md,
        },
        fieldLabel: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
          marginBottom: 4,
        },
        nameInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        bioInput: {
          ...Type.bodySm,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          minHeight: 88,
          textAlignVertical: "top",
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        editActions: {
          flexDirection: "row",
          gap: Space.sm,
          marginTop: Space.lg,
        },
        pressedDim: { opacity: 0.65 },
      }),
    [colors],
  );

  const since = profile ? memberSince(t, lang, profile.user.created_at) : "";
  const modalPreviewAvatarUri = removeAvatar
    ? null
    : (pickedAvatarUri ?? profile?.user.avatar_url ?? null);

  const paceSubtitle = useMemo(() => {
    const cooksStr =
      finishedCooks != null
        ? finishedCooks === 1
          ? t("pace.cooksOne", { n: finishedCooks })
          : t("pace.cooksMany", { n: finishedCooks })
        : null;
    if (paceMultiplier != null && cooksStr) {
      return t("profile.paceSummary", {
        x: paceMultiplier.toFixed(1),
        cooks: cooksStr,
      });
    }
    if (cooksStr && finishedCooks != null && finishedCooks > 0) return cooksStr;
    return t("profile.paceTapHint");
  }, [paceMultiplier, finishedCooks, t]);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <PinnedHeaderBar
        title={displayName || t("stack.profile")}
        leading={<BackChevron />}
        rights={
          signedIn === true
            ? [
                profile != null ? (
                  <IconPressable
                    key="share"
                    onPress={() => void handleShareProfile()}
                    hitSlop={Space.xs}
                    accessibilityLabel={t("profile.shareA11y")}
                  >
                    <Ionicons
                      name="arrow-redo-outline"
                      size={22}
                      color={colors.ink}
                    />
                  </IconPressable>
                ) : null,
                <IconPressable
                  key="settings"
                  onPress={() => router.push("/settings")}
                  hitSlop={Space.xs}
                  accessibilityLabel={t("tabs.settings")}
                >
                  <Ionicons name="settings-outline" size={22} color={colors.ink} />
                </IconPressable>,
              ]
            : []
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          signedIn === true ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.accent}
              colors={[colors.accent]}
              progressBackgroundColor={colors.surface}
            />
          ) : undefined
        }
      >
        {signedIn === false ? (
          <Card style={styles.center}>
            <Text style={styles.signInCaption}>{t("profile.signInPrompt")}</Text>
            <Button
              title={t("common.signIn")}
              onPress={() => router.push("/login")}
              style={styles.cta}
            />
          </Card>
        ) : state === "error" && profile == null ? (
          <Card style={styles.center}>
            <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
            <Text style={styles.signInCaption}>{t("profile.loadFailed")}</Text>
            <Button
              title={t("common.retry")}
              onPress={() => void loadAll(true)}
              style={styles.cta}
            />
          </Card>
        ) : profile == null ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} size="small" />
          </View>
        ) : (
          <>
            {/* Instagram/Facebook-style Personal Hero */}
            <Card style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <Pressable
                  onPress={() => void handleQuickAvatarChange()}
                  onPressIn={() => setPressedStat("avatar")}
                  onPressOut={() => setPressedStat(null)}
                  disabled={avatarUploading}
                  hitSlop={Space.xs}
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.tapToChangePhoto")}
                  style={[
                    styles.avatarWrap,
                    pressedStat === "avatar" ? styles.pressedDim : null,
                  ]}
                >
                  {profile.user.avatar_url ? (
                    <Avatar name={displayName} uri={profile.user.avatar_url} size={84} />
                  ) : (
                    <View style={styles.googleFallback}>
                      <GoogleLogo size={36} />
                    </View>
                  )}
                  {avatarUploading ? (
                    <View style={styles.avatarUploadingOverlay}>
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    </View>
                  ) : null}
                  <View style={styles.avatarBadge}>
                    <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                  </View>
                </Pressable>

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
                    <Text style={styles.statValue} numberOfLines={1}>
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
                    <Text style={styles.statValue} numberOfLines={1}>
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
                        params: { userId: String(profile.user.id), tab: "followers" },
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
                    <Text style={styles.statValue} numberOfLines={1}>
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
                        params: { userId: String(profile.user.id), tab: "following" },
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
                    <Text style={styles.statValue} numberOfLines={1}>
                      {String(profile.counts.following)}
                    </Text>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {t("profile.following")}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.identityBlock}>
                <Text style={styles.identityName} numberOfLines={2}>
                  {displayName}
                </Text>
                {profile.user.bio?.trim() ? (
                  <Text style={styles.bioText}>{profile.user.bio}</Text>
                ) : null}

                <View style={styles.metaRow}>
                  {profile.user.email ? (
                    <View
                      style={styles.privateEmailBadge}
                      accessibilityLabel={t("profile.privateEmailA11y")}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={12}
                        color={colors.inkSecondary}
                      />
                      <Text style={styles.privateEmailText} numberOfLines={1}>
                        {profile.user.email}
                      </Text>
                    </View>
                  ) : null}
                  {since ? (
                    <View style={styles.memberSinceRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={12}
                        color={colors.inkFaint}
                      />
                      <Text style={styles.identityCaption}>{since}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {saved ? <Text style={styles.savedCaption}>{t("profile.nameSaved")}</Text> : null}
              {linkCopied ? (
                <Text style={styles.savedCaption}>{t("profile.linkCopied")}</Text>
              ) : null}
              {error && !isEditing ? (
                <Text style={styles.errorCaption}>{error}</Text>
              ) : null}

              <View style={styles.actionsRow}>
                <ActionPill
                  label={t("profile.editProfile")}
                  icon="create-outline"
                  onPress={enterEdit}
                  flex
                />
                <ActionPill
                  label={t("settings.newRecipe")}
                  icon="add-outline"
                  tone="accent"
                  onPress={() => router.push("/recipe-composer")}
                  flex
                />
                <ActionPill
                  label={t("profile.newPost")}
                  icon="add-outline"
                  onPress={() => router.push("/post-composer")}
                />
              </View>
            </Card>

            {/* Personal Creator Studio Cards (ONLY on My Profile) */}
            <View style={styles.studioStack}>
              <Card padding={0} onPress={() => router.push("/pace")}>
                <View style={styles.paceRow}>
                  <View
                    style={[
                      styles.iconCoin,
                      { backgroundColor: colors.timingSoft },
                    ]}
                  >
                    <Ionicons
                      name="stopwatch-outline"
                      size={20}
                      color={colors.timing}
                    />
                  </View>
                  <View style={styles.paceMain}>
                    <Text style={styles.paceTitle}>{t("tabs.pace")}</Text>
                    <Text style={styles.paceSub} numberOfLines={1}>
                      {paceSubtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name={dir === "rtl" ? "chevron-back" : "chevron-forward"}
                    size={18}
                    color={colors.inkFaint}
                  />
                </View>
              </Card>

              <View style={styles.quickLinksRow}>
                <Card
                  padding={0}
                  onPress={() => router.push("/favorites")}
                  style={{ flex: 1 }}
                >
                  <View style={styles.quickTile}>
                    <View
                      style={[
                        styles.iconCoin,
                        { backgroundColor: colors.accentSoft, width: 34, height: 34, borderRadius: 17 },
                      ]}
                    >
                      <Ionicons
                        name="heart-outline"
                        size={17}
                        color={colors.accent}
                      />
                    </View>
                    <Text style={styles.quickTileLabel} numberOfLines={1}>
                      {t("tabs.favorites")}
                    </Text>
                    <Ionicons
                      name={dir === "rtl" ? "chevron-back" : "chevron-forward"}
                      size={16}
                      color={colors.inkFaint}
                    />
                  </View>
                </Card>

                {AI_IMPORT_ENABLED ? (
                  <Card
                    padding={0}
                    onPress={() => router.push("/recipe-import")}
                    style={{ flex: 1 }}
                  >
                    <View style={styles.quickTile}>
                      <View
                        style={[
                          styles.iconCoin,
                          { backgroundColor: colors.amberSoft, width: 34, height: 34, borderRadius: 17 },
                        ]}
                      >
                        <Ionicons
                          name="sparkles-outline"
                          size={17}
                          color={colors.amber}
                        />
                      </View>
                      <Text style={styles.quickTileLabel} numberOfLines={1}>
                        {t("import.start")}
                      </Text>
                      <Ionicons
                        name={dir === "rtl" ? "chevron-back" : "chevron-forward"}
                        size={16}
                        color={colors.inkFaint}
                      />
                    </View>
                  </Card>
                ) : null}
              </View>
            </View>

            {/* Active AI Imports */}
            {AI_IMPORT_ENABLED && imports.length > 0 ? (
              <View style={styles.listStack}>
                <SectionHeader
                  title={t("import.trackTitle")}
                  subtitle={t("import.trackSubtitle")}
                />
                {imports.map((row) => {
                  const label =
                    row.draft?.title?.trim() ||
                    row.source_url ||
                    t(row.source_kind === "video" ? "import.video" : "import.image");
                  const statusText =
                    row.status === "ready"
                      ? t("import.ready")
                      : row.status === "failed"
                        ? (row.error?.message || t("import.importFailed"))
                        : row.status === "processing"
                          ? t("import.extracting", { n: row.progress })
                          : t("import.queued");
                  const busy = importActionId === row.id;
                  return (
                    <Card key={`import-${row.id}`} padding={Space.md}>
                      <View style={styles.recipeRow}>
                        <View style={styles.recipeThumb}>
                          <Ionicons
                            name={
                              row.status === "ready"
                                ? "checkmark-circle-outline"
                                : row.status === "failed"
                                  ? "alert-circle-outline"
                                  : "sync-outline"
                            }
                            size={22}
                            color={row.status === "failed" ? colors.danger : colors.accent}
                          />
                        </View>
                        <View style={styles.recipeMain}>
                          <Text style={styles.recipeTitle} numberOfLines={2}>
                            {label}
                          </Text>
                          <Text style={styles.muted} numberOfLines={2}>
                            {statusText}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: Space.sm,
                          marginTop: Space.sm,
                        }}
                      >
                        {row.status === "ready" ? (
                          <Button
                            title={t("import.resume")}
                            variant="secondary"
                            icon="arrow-forward-outline"
                            onPress={() => router.push(`/recipe-composer?importId=${row.id}`)}
                          />
                        ) : null}
                        {row.status === "failed" ? (
                          <Button
                            title={t("import.retry")}
                            variant="secondary"
                            icon="refresh-outline"
                            loading={busy}
                            disabled={busy}
                            onPress={() => void retryImport(row.id)}
                          />
                        ) : null}
                        {row.status === "failed" || row.status === "ready" ? (
                          <Button
                            title={t("import.dismiss")}
                            variant="ghost"
                            loading={busy}
                            disabled={busy}
                            onPress={() => void dismissImport(row.id)}
                          />
                        ) : null}
                      </View>
                    </Card>
                  );
                })}
              </View>
            ) : null}

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
                  color={activeTab === "recipes" ? colors.accent : colors.inkSecondary}
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
                  color={activeTab === "posts" ? colors.accent : colors.inkSecondary}
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
                      { backgroundColor: colors.accentSoft, width: 48, height: 48, borderRadius: 24 },
                    ]}
                  >
                    <Ionicons
                      name="restaurant-outline"
                      size={22}
                      color={colors.accent}
                    />
                  </View>
                  <Text style={styles.muted}>{t("profile.noRecipes")}</Text>
                  <Button
                    title={t("settings.newRecipe")}
                    icon="add-outline"
                    onPress={() => router.push("/recipe-composer")}
                    style={styles.cta}
                  />
                </Card>
              ) : (
                <View style={styles.listStack}>
                  {recipes.map((recipe) => (
                    <Card
                      key={`mine-${recipe.id}`}
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
                          <View style={styles.recipeChips}>
                            <TimeChip minutes={bestMinutes(recipe)} />
                          </View>
                        </View>
                        <IconPressable
                          onPress={() => router.push(`/recipe-composer?id=${recipe.id}`)}
                          hitSlop={Space.xs}
                          accessibilityLabel={t("detail.editRecipe")}
                        >
                          <Ionicons
                            name="create-outline"
                            size={20}
                            color={colors.accent}
                          />
                        </IconPressable>
                      </View>
                    </Card>
                  ))}
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
                    { backgroundColor: colors.surfaceSoft, width: 48, height: 48, borderRadius: 24 },
                  ]}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={22}
                    color={colors.inkSecondary}
                  />
                </View>
                <Text style={styles.muted}>{t("profile.noPostsMine")}</Text>
                <Button
                  title={t("community.compose")}
                  icon="add-outline"
                  onPress={() => router.push("/post-composer")}
                  style={styles.cta}
                />
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
                      key={`my-post-${post.id}`}
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
          </>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditing}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={cancelEdit}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("profile.editProfile")}</Text>
              <IconPressable
                onPress={cancelEdit}
                hitSlop={Space.xs}
                accessibilityLabel={t("common.cancel")}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </IconPressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalAvatarCenter}>
                <Pressable
                  onPress={() => void pickAvatarInModal()}
                  hitSlop={Space.xs}
                  accessibilityRole="button"
                  accessibilityLabel={t("profile.tapToChangePhoto")}
                  style={styles.avatarWrap}
                >
                  {modalPreviewAvatarUri ? (
                    <Avatar
                      name={editName.trim() || displayName}
                      uri={modalPreviewAvatarUri}
                      size={84}
                    />
                  ) : (
                    <View style={styles.googleFallback}>
                      <GoogleLogo size={36} />
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
                  </View>
                </Pressable>

                {(profile?.user.avatar_url || pickedAvatarUri) && !removeAvatar ? (
                  <Pressable
                    onPress={() => {
                      setPickedAvatarUri(null);
                      setRemoveAvatar(true);
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: Space.xs }}
                    hitSlop={Space.xs}
                  >
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    <Text style={{ ...Type.caption, color: colors.danger }}>
                      {t("profile.removePhoto")}
                    </Text>
                  </Pressable>
                ) : removeAvatar ? (
                  <Pressable
                    onPress={() => setRemoveAvatar(false)}
                    hitSlop={Space.xs}
                  >
                    <Text style={{ ...Type.caption, color: colors.accent }}>
                      {t("profile.changePhoto")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={{ gap: Space.md }}>
                <View>
                  <Text style={styles.fieldLabel}>
                    {t("profile.displayNamePlaceholder")}
                  </Text>
                  <TextInput
                    style={styles.nameInput}
                    value={editName}
                    onChangeText={(v) => {
                      setEditName(v);
                      setError(null);
                    }}
                    placeholder={t("profile.displayNamePlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    maxLength={DISPLAY_NAME_MAX}
                    returnKeyType="done"
                  />
                </View>

                <View>
                  <Text style={styles.fieldLabel}>
                    {t("profile.bioPlaceholder")}
                  </Text>
                  <TextInput
                    style={styles.bioInput}
                    value={editBio}
                    onChangeText={(v) => {
                      setEditBio(v);
                      setError(null);
                    }}
                    placeholder={t("profile.bioPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    multiline
                    maxLength={BIO_MAX}
                  />
                  <Text style={[styles.identityCaption, { marginTop: 4 }]}>
                    {editBio.length}/{BIO_MAX}
                  </Text>
                </View>

                {error ? <Text style={styles.errorCaption}>{error}</Text> : null}
              </View>

              <View style={styles.editActions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t("common.cancel")}
                    variant="ghost"
                    onPress={cancelEdit}
                    disabled={saving}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={saving ? t("profile.savingName") : t("profile.saveName")}
                    onPress={() => void handleSave()}
                    loading={saving}
                    disabled={saving}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
