import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import {
  createRecipeImport,
  hasToken,
  isRateLimitedError,
  type RecipeImportMediaInput,
} from "@/api/client";
import { BackChevron, PinnedHeaderBar } from "@/components/chrome";
import { Button, Card, IconPressable, SectionHeader } from "@/components/ui";
import { AI_IMPORT_ENABLED } from "@/config";
import { useT } from "@/i18n";
import { Radius, Space, Type, useThemeColors } from "@/theme";

interface PickedMedia extends RecipeImportMediaInput {
  type: "image" | "video";
}

export default function RecipeImportScreen() {
  const colors = useThemeColors();
  const t = useT();
  const [authed, setAuthed] = useState<boolean | null>(null);
  // Mobile accepts videos only (admin can still use URLs + images).
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Hidden behind the AI_IMPORT_ENABLED kill-switch: bounce deep links
      // back to profile. The screen file stays so an OTA update can
      // restore the flow with no native changes.
      if (!AI_IMPORT_ENABLED) router.replace("/profile");
      let cancelled = false;
      void hasToken().then((value) => {
        if (!cancelled) setAuthed(value);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.canvas },
        content: {
          paddingHorizontal: Space.lg,
          paddingTop: Space.md,
          paddingBottom: Space.mega,
          gap: Space.lg,
          maxWidth: 720,
          width: "100%",
          alignSelf: "center",
        },
        section: { gap: Space.sm },
        label: { ...Type.bodySm, color: colors.inkSecondary, fontWeight: "600" },
        hint: { ...Type.bodySm, color: colors.inkSecondary },
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
        mediaList: { gap: Space.sm },
        mediaRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          padding: Space.sm,
          borderRadius: Radius.md,
          backgroundColor: colors.surfaceSoft,
        },
        thumbnail: {
          width: 56,
          height: 56,
          borderRadius: Radius.sm,
          backgroundColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
        mediaName: { ...Type.bodySm, color: colors.ink, flex: 1 },
        mediaType: { ...Type.caption, color: colors.inkFaint },
        warning: {
          ...Type.bodySm,
          color: colors.danger,
          backgroundColor: colors.dangerSoft,
          borderRadius: Radius.md,
          padding: Space.md,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.md,
          padding: Space.xxl,
          backgroundColor: colors.canvas,
        },
        muted: { ...Type.body, color: colors.inkSecondary, textAlign: "center" },
      }),
    [colors],
  );

  const pickMedia = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result.canceled) return;

      const video = result.assets.find((asset) => asset.type === "video");
      if (!video) {
        setError(t("import.videoRequired"));
        return;
      }
      setMedia([
        {
          uri: video.uri,
          type: "video",
          mimeType: video.mimeType,
          fileName: video.fileName,
        },
      ]);
      setError(null);
    } catch {
      setError(t("import.pickFailed"));
    }
  }, [t]);

  const removeMedia = useCallback((index: number) => {
    setMedia((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const startImport = useCallback(async () => {
    if (starting) return;
    const video = media[0];
    if (!video || video.type !== "video") {
      setError(t("import.videoRequired"));
      return;
    }

    setStarting(true);
    setError(null);
    try {
      await createRecipeImport({ primary: video });

      // Hand off to Profile → AI imports, which polls the server list and
      // survives timeouts, navigation, and app restarts.
      router.replace("/profile");
    } catch (caught) {
      setError(
        isRateLimitedError(caught)
          ? t("import.rateLimited")
          : caught instanceof Error ? caught.message : t("import.failed"),
      );
    } finally {
      setStarting(false);
    }
  }, [media, starting, t]);

  if (authed === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Kill-switch guard: never render the flow while hidden (deep links land
  // here even with the Stack.Screen unregistered — the redirect above
  // bounces them out).
  if (!AI_IMPORT_ENABLED) {
    return <View style={styles.screen} />;
  }

  if (!authed) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t("import.signInRequired")}</Text>
        <Button title={t("common.signIn")} onPress={() => router.push("/login")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
    >
      <PinnedHeaderBar title={t("stack.aiImport")} leading={<BackChevron />} />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.section}>
          <SectionHeader title={t("import.title")} subtitle={t("import.subtitleVideo")} />
        </Card>

        <Card style={styles.section}>
          <SectionHeader title={t("import.video")} subtitle={t("import.videoHint")} />
          <Button
            title={t("import.chooseMedia")}
            variant="secondary"
            icon="videocam-outline"
            onPress={() => void pickMedia()}
          />
          {media.length > 0 ? (
            <View style={styles.mediaList}>
              {media.map((item, index) => (
                <View key={item.uri} style={styles.mediaRow}>
                  <View style={styles.thumbnail}>
                    <Ionicons
                      name="videocam-outline"
                      size={24}
                      color={colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mediaName} numberOfLines={1}>
                      {item.fileName || t("import.video")}
                    </Text>
                  </View>
                  <IconPressable
                    onPress={() => removeMedia(index)}
                    accessibilityLabel={t("import.remove")}
                  >
                    <Ionicons name="close" size={22} color={colors.inkSecondary} />
                  </IconPressable>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        {error ? <Text style={styles.warning}>{error}</Text> : null}

        <Button
          title={starting ? t("import.processing") : t("import.start")}
          loading={starting}
          loadingLabel={t("import.processing")}
          fullWidth
          icon="sparkles-outline"
          onPress={() => void startImport()}
          disabled={starting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
