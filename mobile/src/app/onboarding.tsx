import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { usePreventRemove } from "expo-router/build/react-navigation/core";

import { updateProfile, uploadAvatar } from "@/api/client";
import { track } from "@/analytics";
import { Radius, Space, Type, useThemeColors } from "@/theme";
import { useT } from "@/i18n";
import {
  Avatar,
  Button,
  Card,
  GoogleLogo,
  ScreenScrollView,
} from "@/components/ui";

const NAME_MIN = 2;
const NAME_MAX = 40;
const BIO_MAX = 500;

type Gender = "male" | "female";

/**
 * First-sign-in onboarding (/onboarding): complete the profile details —
 * display name (REQUIRED), gender, photo and bio (all optional) — before
 * continuing into the app. Pushed by the post-auth routing in login.tsx
 * when the fresh profile has no display name typed yet; the screen cannot
 * be skipped or backed out of — only Continue (name ≥2 chars) leaves.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [bio, setBio] = useState("");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setPickedUri(result.assets[0].uri);
    } catch (err) {
      console.warn("[RecipeReal] onboarding avatar pick failed:", err);
    }
  }, []);

  const nameValid =
    name.trim().length >= NAME_MIN && name.trim().length <= NAME_MAX;
  // Only the name is required — gender, photo and bio are optional.
  const canContinue = nameValid && !saving;

  // Onboarding cannot be skipped or backed out of: the user must type a
  // display name before continuing. Swallowing the removal (no dispatch,
  // no dialog) blocks the Android back button/gesture and any
  // programmatic pop until Continue saves the profile.
  usePreventRemove(true, () => {});

  /** Leave onboarding: back to the caller, home when there is none. */
  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }, []);

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    setError(null);
    setSaving(true);
    try {
      if (pickedUri) await uploadAvatar(pickedUri);
      await updateProfile({
        display_name: name.trim(),
        gender,
        ...(bio.trim() !== "" ? { bio: bio.trim() } : {}),
      });
      track("onboarding_completed");
      leave();
    } catch (err) {
      console.warn("[RecipeReal] onboarding save failed:", err);
      setError(t("onboarding.errSave"));
    } finally {
      setSaving(false);
    }
  }, [canContinue, pickedUri, name, gender, bio, t, leave]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.canvas,
          paddingBottom: insets.bottom,
        },
        scrollContent: {
          paddingTop: insets.top + Space.lg,
          paddingBottom: Space.xxl,
          gap: Space.lg,
        },
        heading: {
          gap: Space.xs,
        },
        headline: {
          ...Type.h2,
          color: colors.ink,
          textAlign: "center",
        },
        subtitle: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        avatarWrap: {
          alignItems: "center",
          gap: Space.sm,
        },
        avatarPressable: {
          borderRadius: 999,
        },
        googleFallback: {
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: colors.surfaceSoft,
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
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 2,
          borderColor: colors.canvas,
        },
        section: {
          gap: Space.sm,
        },
        fieldLabel: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        fieldOptional: {
          ...Type.caption,
          color: colors.inkFaint,
          fontWeight: "500",
        },
        input: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.md,
          paddingHorizontal: Space.md,
        },
        bioInput: {
          minHeight: 84,
          textAlignVertical: "top",
          ...Type.bodySm,
        },
        charCount: {
          ...Type.caption,
          color: colors.inkFaint,
          alignSelf: "flex-end",
        },
        genderSegment: {
          flexDirection: "row",
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          overflow: "hidden",
        },
        genderDivider: {
          width: 1,
          backgroundColor: colors.hairline,
        },
        genderSegmentBtn: {
          flex: 1,
          alignItems: "center",
          paddingVertical: Space.md,
        },
        genderSegmentBtnActive: {
          backgroundColor: colors.accentSoft,
        },
        genderSegmentLabel: {
          ...Type.body,
          color: colors.inkSecondary,
        },
        genderSegmentLabelActive: {
          color: colors.accent,
          fontWeight: "600",
        },
        errorText: {
          ...Type.bodySm,
          color: colors.danger,
          textAlign: "center",
        },
      }),
    [colors, insets.bottom],
  );

  return (
    <View style={styles.container}>
      <ScreenScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.heading}>
          <Text style={styles.headline}>{t("onboarding.welcome")}</Text>
          <Text style={styles.subtitle}>{t("onboarding.subtitle")}</Text>
        </View>

        {/* Photo */}
        <View style={styles.avatarWrap}>
          <Pressable
            onPress={pickAvatar}
            style={styles.avatarPressable}
            hitSlop={Space.xs}
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.photoA11y")}
          >
            {pickedUri ? (
              <Avatar name={name.trim() || "?"} uri={pickedUri} size={96} />
            ) : (
              <View style={styles.googleFallback}>
                <GoogleLogo size={36} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera-outline" size={14} color={colors.canvas} />
            </View>
          </Pressable>
        </View>

        {/* Name */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>{t("onboarding.nameLabel")}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            placeholder={t("profile.displayNamePlaceholder")}
            placeholderTextColor={colors.inkFaint}
            maxLength={NAME_MAX}
            returnKeyType="done"
          />
          {!nameValid && name.length > 0 ? (
            <Text style={styles.errorText}>
              {t("onboarding.errNameLength")}
            </Text>
          ) : null}
        </Card>

        {/* Gender */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>{t("onboarding.genderLabel")}</Text>
          <View style={styles.genderSegment}>
            {(["male", "female"] as const).map((g, index) => (
              <Fragment key={g}>
                {index === 1 ? <View style={styles.genderDivider} /> : null}
                <Pressable
                  onPress={() => setGender(g)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: gender === g }}
                  accessibilityLabel={
                    g === "male" ? t("onboarding.male") : t("onboarding.female")
                  }
                  style={[
                    styles.genderSegmentBtn,
                    gender === g ? styles.genderSegmentBtnActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.genderSegmentLabel,
                      gender === g ? styles.genderSegmentLabelActive : null,
                    ]}
                  >
                    {g === "male" ? t("onboarding.male") : t("onboarding.female")}
                  </Text>
                </Pressable>
              </Fragment>
            ))}
          </View>
        </Card>

        {/* Bio (optional) */}
        <Card style={styles.section}>
          <Text style={styles.fieldLabel}>
            {t("profile.bioPlaceholder")}
            <Text style={styles.fieldOptional}>
              {` · ${t("quick.optional")}`}
            </Text>
          </Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder={t("profile.bioPlaceholder")}
            placeholderTextColor={colors.inkFaint}
            multiline
            maxLength={BIO_MAX}
          />
          <Text style={styles.charCount}>
            {bio.length}/{BIO_MAX}
          </Text>
        </Card>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          title={saving ? t("onboarding.saving") : t("onboarding.continue")}
          variant="primary"
          size="lg"
          fullWidth
          loading={saving}
          disabled={!canContinue}
          onPress={() => void handleContinue()}
        />
      </ScreenScrollView>
    </View>
  );
}
