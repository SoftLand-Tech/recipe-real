import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import {
  fetchMyProfileFull,
  fetchMyRecipes,
  hasToken,
  updateDisplayName,
} from "@/api/client";
import type { MyProfile, Recipe } from "@/types";
import { useLang, useLocalizedRecipe, useT, type Lang, type TranslateFn } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import {
  Avatar,
  Button,
  Card,
  GoogleLogo,
  IconPressable,
  ScreenHeader,
  SectionHeader,
  StatPill,
} from "@/components/ui";

type LoadState = "loading" | "ready" | "error";

/** Display-name validation limits (server rule: 2..40 chars). */
const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 40;

/** Localized "Member since March 2024" month + year. */
function memberSince(t: TranslateFn, lang: Lang, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  try {
    const date = new Date(then).toLocaleDateString(
      lang === "ar" ? "ar" : "en-US",
      { month: "long", year: "numeric" },
    );
    return t("profile.memberSince", { date });
  } catch {
    return "";
  }
}

/**
 * The /profile stack screen (pushed from the Community header button and the
 * Settings account section): the signed-in user's big avatar, editable
 * display name (PATCH), member-since caption, activity counters, and their
 * published recipes with an edit shortcut into the composer. Sign-out and
 * account deletion stay in Settings. Signed-out visitors get a sign-in CTA.
 */
export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { lang } = useLang();
  const lr = useLocalizedRecipe();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesHasMore, setRecipesHasMore] = useState(false);
  const [recipesPage, setRecipesPage] = useState(1);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [state, setState] = useState<LoadState>("loading");

  // Display-name editor.
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const displayName = (profile?.user.display_name ?? profile?.user.name ?? "").trim();

  /**
   * Load (or silently revalidate) everything: auth state, the full profile
   * (user + counters) and the first recipes page. `fresh` forces the loading
   * state (first load / retry); focus refreshes keep stale content on screen.
   */
  const loadAll = useCallback(
    async (fresh: boolean) => {
      const ok = await hasToken();
      setSignedIn(ok);
      if (!ok) {
        setProfile(null);
        setState("ready");
        return;
      }
      if (fresh || profile == null) setState("loading");
      try {
        const [me, page] = await Promise.all([
          fetchMyProfileFull(),
          fetchMyRecipes(1),
        ]);
        setProfile(me);
        setNameDraft(me.user.display_name ?? "");
        setRecipes(Array.isArray(page?.data) ? page.data : []);
        setRecipesPage(1);
        setRecipesHasMore(
          Number(page?.meta?.current_page ?? 1) <
            Number(page?.meta?.last_page ?? 1),
        );
        setState("ready");
      } catch (error) {
        console.warn("[RecipeReal] profile load failed:", error);
        if (profile == null) setState("error");
      }
    },
    // `profile` is intentionally read for the stale-while-revalidate decision
    // without subscribing: focus refreshes must always re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Reload on focus: guarantees fresh counters after posting / editing
  // recipes elsewhere (cheap — one authed profile + one recipes page).
  useFocusEffect(
    useCallback(() => {
      void loadAll(false);
    }, [loadAll]),
  );

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
    } catch (error) {
      console.warn("[RecipeReal] my recipes load-more failed:", error);
    } finally {
      setLoadingRecipes(false);
    }
  }, [loadingRecipes, recipesHasMore, signedIn, recipesPage]);

  const saveName = useCallback(async () => {
    const value = nameDraft.trim();
    if (savingName) return;
    if (value.length < DISPLAY_NAME_MIN || value.length > DISPLAY_NAME_MAX) {
      setNameError(t("profile.errNameLength"));
      return;
    }
    setSavingName(true);
    setNameError(null);
    setNameSaved(false);
    try {
      await updateDisplayName(value);
      // Re-fetch so any server-side normalization + the header name show.
      const me = await fetchMyProfileFull();
      setProfile(me);
      setNameDraft(me.user.display_name ?? "");
      setNameSaved(true);
    } catch (error) {
      console.warn("[RecipeReal] display name save failed:", error);
      setNameError(t("profile.errSaveName"));
    } finally {
      setSavingName(false);
    }
  }, [nameDraft, savingName, t]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        content: {
          paddingHorizontal: Space.lg,
          gap: Space.lg,
          paddingBottom: insets.bottom + Space.xxl,
        },
        section: {
          gap: Space.sm,
        },
        identityRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.lg,
        },
        identityMain: {
          flex: 1,
          gap: 2,
        },
        identityName: {
          ...Type.h2,
          color: colors.ink,
        },
        identityCaption: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        googleFallback: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        nameRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        nameInput: {
          flex: 1,
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderRadius: Radius.md,
          paddingHorizontal: Space.md,
          paddingVertical: Space.sm,
          // Comfortable 56px-min touch-and-read target (search-field parity).
          minHeight: 56,
        },
        savedCaption: {
          ...Type.caption,
          color: colors.success,
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
        },
        errorCaption: {
          ...Type.caption,
          color: colors.danger,
        },
        countsRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          gap: Space.md,
        },
        recipeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
        },
        recipeThumb: {
          width: 56,
          height: 56,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        recipeMain: {
          flex: 1,
          gap: 2,
        },
        recipeTitle: {
          // Row title at body size (17) with weight — dense list rows read
          // cleaner than card-sized titles here.
          fontSize: Type.body.fontSize,
          fontWeight: "600",
          color: colors.ink,
        },
        recipesList: {
          gap: Space.md,
        },
        muted: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        loadMore: {
          alignSelf: "flex-start",
        },
        center: {
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: 64,
          paddingHorizontal: Space.xxl,
        },
        signInCaption: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        cta: {
          marginTop: Space.sm,
        },
      }),
    [colors, insets.bottom],
  );

  const since = profile ? memberSince(t, lang, profile.user.created_at) : "";
  const nameDirty =
    nameDraft.trim() !== (profile?.user.display_name ?? "").trim();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        title={t("profile.title")}
        right={
          <IconPressable
            onPress={() => router.back()}
            hitSlop={Space.xs}
            accessibilityLabel={t("common.cancel")}
          >
            <Ionicons name="close" size={22} color={colors.ink} />
          </IconPressable>
        }
      />

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
          {/* Identity. */}
          <Card style={styles.section}>
            <View style={styles.identityRow}>
              {profile.user.avatar_url ? (
                <Avatar
                  name={displayName}
                  uri={profile.user.avatar_url}
                  size={72}
                />
              ) : (
                <View style={styles.googleFallback}>
                  <GoogleLogo size={30} />
                </View>
              )}
              <View style={styles.identityMain}>
                <Text style={styles.identityName} numberOfLines={1}>
                  {displayName}
                </Text>
                {since !== "" ? (
                  <Text style={styles.identityCaption}>{since}</Text>
                ) : null}
              </View>
            </View>
          </Card>

          {/* Display-name editor. */}
          <Card style={styles.section}>
            <TextInput
              style={styles.nameInput}
              value={nameDraft}
              onChangeText={(value) => {
                setNameDraft(value);
                setNameSaved(false);
                setNameError(null);
              }}
              placeholder={t("profile.displayNamePlaceholder")}
              placeholderTextColor={colors.inkFaint}
              maxLength={DISPLAY_NAME_MAX}
              editable={!savingName}
            />
            <Button
              title={savingName ? t("profile.savingName") : t("profile.saveName")}
              variant="primary"
              loading={savingName}
              disabled={savingName || !nameDirty}
              onPress={() => void saveName()}
            />
            {nameSaved ? (
              <Text style={styles.savedCaption}>{t("profile.nameSaved")}</Text>
            ) : null}
            {nameError != null ? (
              <Text style={styles.errorCaption}>{nameError}</Text>
            ) : null}
          </Card>

          {/* Counters. */}
          <Card>
            <View style={styles.countsRow}>
              <StatPill
                label={t("profile.statRecipes")}
                value={String(profile.counts.recipes)}
              />
              <StatPill
                label={t("profile.statPosts")}
                value={String(profile.counts.posts)}
              />
              <StatPill
                label={t("profile.statLikes")}
                value={String(profile.counts.likes_received)}
              />
              <StatPill
                label={t("profile.statNotes")}
                value={String(profile.counts.public_notes)}
              />
            </View>
          </Card>

          {/* My recipes. */}
          <View style={styles.section}>
            <SectionHeader title={t("profile.myRecipes")} />
            {recipes.length === 0 ? (
              <Card style={styles.section}>
                <Text style={styles.muted}>{t("profile.noRecipes")}</Text>
                <Button
                  title={t("settings.newRecipe")}
                  variant="ghost"
                  onPress={() => router.push("/recipe-composer")}
                />
              </Card>
            ) : (
              <View style={styles.recipesList}>
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
                            size={20}
                            color={colors.inkFaint}
                          />
                        )}
                      </View>
                      <View style={styles.recipeMain}>
                        <Text style={styles.recipeTitle} numberOfLines={2}>
                          {lr.title(recipe)}
                        </Text>
                      </View>
                      <IconPressable
                        onPress={() =>
                          router.push(`/recipe-composer?id=${recipe.id}`)
                        }
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
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
