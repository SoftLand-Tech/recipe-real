import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import {
  deleteRecipeImport,
  fetchMyProfileFull,
  fetchMyRecipes,
  hasToken,
  listMyRecipeImports,
  retryRecipeImport,
  updateProfile,
  uploadAvatar,
} from "@/api/client";
import type { MyProfile, Recipe, RecipeImportRecord } from "@/types";
import { AI_IMPORT_ENABLED } from "@/config";
import { useLang, useLocalizedRecipe, useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { bestMinutes } from "@/utils/recipeTime";
import { memberSince } from "@/utils/format";
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

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 40;
const BIO_MAX = 500;
const SAVED_CAPTION_MS = 2400;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { lang, dir } = useLang();
  const lr = useLocalizedRecipe();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesHasMore, setRecipesHasMore] = useState(false);
  const [recipesPage, setRecipesPage] = useState(1);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [imports, setImports] = useState<RecipeImportRecord[]>([]);
  const [importActionId, setImportActionId] = useState<number | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [pickedAvatarUri, setPickedAvatarUri] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Ref mirror of `profile` so loadAll (stable across renders) always reads
  // the latest value instead of a stale closure snapshot.
  const profileRef = useRef<MyProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const displayName = (profile?.user.display_name ?? profile?.user.name ?? "").trim();

  const loadAll = useCallback(async (fresh: boolean) => {
    const ok = await hasToken();
    setSignedIn(ok);
    if (!ok) {
      setProfile(null);
      setState("ready");
      return;
    }
    if (fresh || profileRef.current == null) setState("loading");
    try {
      const [me, page] = await Promise.all([fetchMyProfileFull(), fetchMyRecipes(1)]);
      setProfile(me);
      if (!isEditingRef.current) {
        setEditName(me.user.display_name ?? "");
        setEditBio(me.user.bio ?? "");
      }
      setRecipes(Array.isArray(page?.data) ? page.data : []);
      setRecipesPage(1);
      setRecipesHasMore(
        Number(page?.meta?.current_page ?? 1) < Number(page?.meta?.last_page ?? 1),
      );
      setState("ready");
    } catch (err) {
      console.warn("[RecipeReal] profile load failed:", err);
      if (profileRef.current == null) setState("error");
    }
  }, []);

  // Ref mirror of `isEditing` for the same reason — loadAll stays referentially
  // stable so focus refreshes never resurrect stale state. Initialized with a
  // literal (not the state value) so the ref is never seeded from a hook arg.
  const isEditingRef = useRef(false);
  useEffect(() => {
    // Standard latest-ref mirror (same shape as cook mode's statusRef); the
    // immutability rule can't tell it apart from a render-phase write.
    // eslint-disable-next-line react-hooks/immutability
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useFocusEffect(useCallback(() => { void loadAll(false); }, [loadAll]));

  const loadImports = useCallback(async () => {
    try {
      const rows = await listMyRecipeImports();
      setImports(rows.filter((row) => row.status !== "published"));
    } catch (err) {
      console.warn("[RecipeReal] imports load failed:", err);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadImports(); }, [loadImports]));

  const hasActiveImport = imports.some(
    (row) => row.status === "queued" || row.status === "processing",
  );

  useEffect(() => {
    if (!hasActiveImport || signedIn !== true) return;
    const timer = setInterval(() => { void loadImports(); }, 8000);
    return () => clearInterval(timer);
  }, [hasActiveImport, signedIn, loadImports]);

  const retryImport = useCallback(async (id: number) => {
    setImportActionId(id);
    try {
      await retryRecipeImport(id);
      await loadImports();
    } catch (err) {
      console.warn("[RecipeReal] import retry failed:", err);
    } finally {
      setImportActionId(null);
    }
  }, [loadImports]);

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

  const loadMoreRecipes = useCallback(async () => {
    if (loadingRecipes || !recipesHasMore || signedIn !== true) return;
    setLoadingRecipes(true);
    try {
      const page = await fetchMyRecipes(recipesPage + 1);
      setRecipes((prev) => [
        ...prev,
        ...(Array.isArray(page?.data) ? page.data.filter((r) => !prev.some((q) => q.id === r.id)) : []),
      ]);
      setRecipesPage((p) => p + 1);
      setRecipesHasMore(
        Number(page?.meta?.current_page ?? recipesPage + 1) < Number(page?.meta?.last_page ?? recipesPage + 1),
      );
    } catch (err) {
      console.warn("[RecipeReal] my recipes load-more failed:", err);
    } finally {
      setLoadingRecipes(false);
    }
  }, [loadingRecipes, recipesHasMore, signedIn, recipesPage]);

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
    if (!profile) { setIsEditing(false); return; }
    setEditName(profile.user.display_name ?? "");
    setEditBio(profile.user.bio ?? "");
    setPickedAvatarUri(null);
    setRemoveAvatar(false);
    setError(null);
    setIsEditing(false);
  }, [profile]);

  const pickAvatar = useCallback(async () => {
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
        content: { paddingHorizontal: 0, gap: Space.lg, paddingBottom: Space.xxl },
        section: { gap: Space.sm },
        groupCaption: {
          ...Type.caption,
          color: colors.inkFaint,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: Space.xs,
          // Content is full-bleed; captions are text and must not touch
          // the screen edge.
          marginHorizontal: Space.lg,
        },
        identityRow: { flexDirection: "row", alignItems: "center", gap: Space.lg },
        identityMain: { flex: 1, gap: 4 },
        identityName: { ...Type.h2, color: colors.ink, flexShrink: 1 },
        identityCaption: { ...Type.bodySm, color: colors.inkSecondary },
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
        fieldLabel: { ...Type.caption, color: colors.inkSecondary, fontWeight: "600" },
        bioText: { ...Type.bodySm, color: colors.inkSecondary, lineHeight: 20 },
        bioMuted: { ...Type.bodySm, color: colors.inkFaint, fontStyle: "italic" },
        bioInput: {
          ...Type.bodySm,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          minHeight: 84,
          textAlignVertical: "top",
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        savedCaption: { ...Type.caption, color: colors.success },
        errorCaption: { ...Type.caption, color: colors.danger },
        errorTitle: { ...Type.h3, color: colors.danger },
        divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginVertical: Space.lg },
        countsRow: { flexDirection: "row", gap: Space.sm },
        statCol: { flex: 1, alignItems: "center", gap: Space.xs },
        statValue: { fontSize: 20, fontWeight: "700", color: colors.ink, fontVariant: ["tabular-nums"] as ("tabular-nums")[] },
        statLabel: { ...Type.caption, color: colors.inkSecondary, textAlign: "center" },
        followRow: { flexDirection: "row", gap: Space.sm, marginTop: Space.sm },
        googleFallback: {
          width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSoft, alignItems: "center", justifyContent: "center",
        },
        avatarWrap: { position: "relative" },
        avatarBadge: {
          position: "absolute", bottom: -2, end: -2, width: 28, height: 28, borderRadius: 14,
          backgroundColor: colors.ink, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface,
        },
        editActions: { flexDirection: "row", gap: Space.sm, marginTop: Space.sm },
        paceRow: {
          flexDirection: "row", alignItems: "center", gap: Space.md, minHeight: 52, paddingHorizontal: Space.lg, paddingVertical: Space.sm,
        },
        paceLabel: { flex: 1, ...Type.body, fontWeight: "600", color: colors.ink },
        recipeRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
        recipeThumb: {
          width: 56, height: 56, borderRadius: Radius.md, backgroundColor: colors.surfaceSoft,
          alignItems: "center", justifyContent: "center", overflow: "hidden",
        },
        recipeMain: { flex: 1, gap: 2 },
        recipeTitle: { ...Type.title, color: colors.ink },
        recipeChips: { flexDirection: "row", gap: Space.xs, marginTop: 2 },
        recipesList: { gap: Space.md },
        muted: { ...Type.bodySm, color: colors.inkSecondary },
        loadMore: { alignSelf: "flex-start" },
        center: { alignItems: "center", justifyContent: "center", gap: Space.sm, paddingVertical: 64, paddingHorizontal: Space.xxl },
        signInCaption: { ...Type.body, color: colors.inkSecondary, textAlign: "center" },
        cta: { marginTop: Space.sm },
      }),
    [colors],
  );

  const since = profile ? memberSince(t, lang, profile.user.created_at) : "";
  const previewAvatarUri = removeAvatar ? null : (pickedAvatarUri ?? profile?.user.avatar_url ?? null);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <PinnedHeaderBar
        title={t("profile.title")}
        leading={<BackChevron />}
        rights={
          signedIn === true && isEditing
            ? [
                <IconPressable key="close" onPress={cancelEdit} hitSlop={Space.xs} accessibilityLabel={t("common.cancel")}>
                  <Ionicons name="close" size={22} color={colors.ink} />
                </IconPressable>,
              ]
            : signedIn === true
              ? [
                  <IconPressable key="edit" onPress={enterEdit} hitSlop={Space.xs} accessibilityLabel={t("profile.editProfile")}>
                    <Ionicons name="create-outline" size={20} color={colors.ink} />
                  </IconPressable>,
                ]
              : []
        }
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {signedIn === false ? (
          <Card style={styles.center}>
            <Text style={styles.signInCaption}>{t("profile.signInPrompt")}</Text>
            <Button title={t("common.signIn")} onPress={() => router.push("/login")} style={styles.cta} />
          </Card>
        ) : state === "error" && profile == null ? (
          <Card style={styles.center}>
            <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
            <Text style={styles.signInCaption}>{t("profile.loadFailed")}</Text>
            <Button title={t("common.retry")} onPress={() => void loadAll(true)} style={styles.cta} />
          </Card>
        ) : profile == null ? (
          <View style={styles.center}><ActivityIndicator color={colors.accent} size="small" /></View>
        ) : (
          <>
            <Card style={styles.section}>
              <View style={styles.identityRow}>
                {isEditing ? (
                  <Pressable
                    onPress={pickAvatar}
                    style={styles.avatarWrap}
                    hitSlop={Space.xs}
                    accessibilityRole="button"
                    accessibilityLabel={t("profile.tapToChangePhoto")}
                  >
                    {previewAvatarUri ? <Avatar name={editName.trim() || displayName} uri={previewAvatarUri} size={84} /> : (
                      <View style={styles.googleFallback}><GoogleLogo size={36} /></View>
                    )}
                    <View style={styles.avatarBadge}>
                      <Ionicons name="camera-outline" size={14} color={colors.surface} />
                    </View>
                  </Pressable>
                ) : previewAvatarUri ? (
                  <Avatar name={displayName} uri={previewAvatarUri} size={84} />
                ) : (
                  <View style={styles.googleFallback}><GoogleLogo size={36} /></View>
                )}
                <View style={styles.identityMain}>
                  {isEditing ? (
                    <>
                      <Text style={styles.fieldLabel}>{t("profile.displayNamePlaceholder")}</Text>
                      <TextInput
                        style={styles.nameInput}
                        value={editName}
                        onChangeText={(v) => { setEditName(v); setError(null); }}
                        placeholder={t("profile.displayNamePlaceholder")}
                        placeholderTextColor={colors.inkFaint}
                        maxLength={DISPLAY_NAME_MAX}
                        returnKeyType="done"
                      />
                    </>
                  ) : (
                    <>
                      <Text style={styles.identityName} numberOfLines={1}>{displayName}</Text>
                      {since ? <Text style={styles.identityCaption}>{since}</Text> : null}
                    </>
                  )}
                </View>
              </View>

              {isEditing ? (
                <View style={{ gap: Space.xs }}>
                  <Text style={styles.fieldLabel}>{t("profile.bioPlaceholder")}</Text>
                  <TextInput
                    style={styles.bioInput}
                    value={editBio}
                    onChangeText={(v) => { setEditBio(v); setError(null); }}
                    placeholder={t("profile.bioPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    multiline
                    maxLength={BIO_MAX}
                  />
                  <Text style={styles.identityCaption}>{editBio.length}/{BIO_MAX}</Text>
                  {(profile.user.avatar_url || pickedAvatarUri) && !removeAvatar ? (
                    <Pressable
                      onPress={() => { setPickedAvatarUri(null); setRemoveAvatar(true); }}
                      style={{ flexDirection: "row", alignItems: "center", gap: Space.xs, alignSelf: "flex-start" }}
                      hitSlop={Space.xs}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                      <Text style={{ ...Type.caption, color: colors.danger }}>{t("profile.removePhoto")}</Text>
                    </Pressable>
                  ) : removeAvatar ? (
                    <Pressable onPress={() => setRemoveAvatar(false)} hitSlop={Space.xs} style={{ alignSelf: "flex-start" }}>
                      <Text style={{ ...Type.caption, color: colors.accent }}>{t("profile.changePhoto")}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <>
                  {profile.user.bio?.trim() ? (
                    <Text style={styles.bioText}>{profile.user.bio}</Text>
                  ) : (
                    <Text style={styles.bioMuted}>{t("profile.bioPlaceholder")}</Text>
                  )}
                </>
              )}

              {isEditing ? (
                <>
                  {error ? <Text style={styles.errorCaption}>{error}</Text> : null}
                  <View style={styles.editActions}>
                    <View style={{ flex: 1 }}>
                      <Button title={t("common.cancel")} variant="ghost" onPress={cancelEdit} disabled={saving} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button title={saving ? t("profile.savingName") : t("profile.saveName")} onPress={() => void handleSave()} loading={saving} disabled={saving} />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {saved ? <Text style={styles.savedCaption}>{t("profile.nameSaved")}</Text> : null}
                  {error ? <Text style={styles.errorCaption}>{error}</Text> : null}
                </>
              )}

              <View style={styles.divider} />

              <View style={styles.countsRow}>
                {(
                  [
                    [t("profile.statRecipes"), profile.counts.recipes],
                    [t("profile.statPosts"), profile.counts.posts],
                    [t("profile.statLikes"), profile.counts.likes_received],
                    [t("profile.statNotes"), profile.counts.public_notes],
                  ] as const
                ).map(([label, value], idx) => (
                  <View key={`stat-${idx}`} style={styles.statCol}>
                    <Text style={styles.statValue} numberOfLines={1}>{String(value)}</Text>
                    <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.followRow}>
                <Pressable onPress={() => router.push({ pathname: "/follow-list", params: { userId: String(profile.user.id), tab: "followers" } })} style={styles.statCol}>
                  <Text style={styles.statValue}>{String(profile.counts.followers)}</Text>
                  <Text style={styles.statLabel}>{t("profile.followers")}</Text>
                </Pressable>
                <Pressable onPress={() => router.push({ pathname: "/follow-list", params: { userId: String(profile.user.id), tab: "following" } })} style={styles.statCol}>
                  <Text style={styles.statValue}>{String(profile.counts.following)}</Text>
                  <Text style={styles.statLabel}>{t("profile.following")}</Text>
                </Pressable>
              </View>
            </Card>

            <View>
              <Text style={styles.groupCaption}>{t("profile.activityGroup")}</Text>
              <Card padding={0} onPress={() => router.push("/pace")}>
                <View style={styles.paceRow}>
                  <Ionicons name="stopwatch-outline" size={20} color={colors.inkSecondary} />
                  <Text style={styles.paceLabel}>{t("tabs.pace")}</Text>
                  <Ionicons name={dir === "rtl" ? "chevron-back" : "chevron-forward"} size={18} color={colors.inkFaint} />
                </View>
              </Card>
            </View>

            {signedIn === true && AI_IMPORT_ENABLED && imports.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title={t("import.trackTitle")} subtitle={t("import.trackSubtitle")} />
              <View style={styles.section}>
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
                            size={20}
                            color={row.status === "failed" ? colors.danger : colors.accent}
                          />
                        </View>
                        <View style={styles.recipeMain}>
                          <Text style={styles.recipeTitle} numberOfLines={2}>{label}</Text>
                          <Text style={styles.muted} numberOfLines={2}>{statusText}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Space.sm, marginTop: Space.sm }}>
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
            </View>
            ) : null}

            <View style={styles.section}>
              <SectionHeader title={recipes.length > 0 ? t("profile.myRecipesCount", { n: recipes.length }) : t("profile.myRecipes")} />
              {recipes.length === 0 ? (
                <Card style={styles.section}>
                  <Text style={styles.muted}>{t("profile.noRecipes")}</Text>
                  <Button title={t("settings.newRecipe")} variant="ghost" onPress={() => router.push("/recipe-composer")} />
                  {AI_IMPORT_ENABLED ? (
                    <Button title={t("import.start")} variant="secondary" icon="sparkles-outline" onPress={() => router.push("/recipe-import")} />
                  ) : null}
                </Card>
              ) : (
                <View style={styles.section}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Space.sm }}>
                    <Button title={t("settings.newRecipe")} variant="ghost" onPress={() => router.push("/recipe-composer")} />
                    {AI_IMPORT_ENABLED ? (
                      <Button title={t("import.start")} variant="secondary" icon="sparkles-outline" onPress={() => router.push("/recipe-import")} />
                    ) : null}
                  </View>
                  <View style={styles.recipesList}>
                  {recipes.map((recipe) => (
                    <Card key={`mine-${recipe.id}`} padding={Space.md} onPress={() => router.push(`/recipe/${recipe.id}`)}>
                      <View style={styles.recipeRow}>
                        <View style={styles.recipeThumb}>
                          {recipe.image_url ? (
                            <Image source={{ uri: recipe.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} cachePolicy="memory-disk" recyclingKey={recipe.image_url} />
                          ) : (
                            <Ionicons name="restaurant-outline" size={20} color={colors.inkFaint} />
                          )}
                        </View>
                        <View style={styles.recipeMain}>
                          <Text style={styles.recipeTitle} numberOfLines={2}>{lr.title(recipe)}</Text>
                          <View style={styles.recipeChips}><TimeChip minutes={bestMinutes(recipe)} /></View>
                        </View>
                        <IconPressable onPress={() => router.push(`/recipe-composer?id=${recipe.id}`)} hitSlop={Space.xs} accessibilityLabel={t("detail.editRecipe")}>
                          <Ionicons name="create-outline" size={20} color={colors.accent} />
                        </IconPressable>
                      </View>
                    </Card>
                  ))}
                  {recipesHasMore ? (
                    <Button title={t("detail.loadMoreNotes")} variant="ghost" loading={loadingRecipes} disabled={loadingRecipes} onPress={() => void loadMoreRecipes()} style={styles.loadMore} />
                  ) : null}
                  </View>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
