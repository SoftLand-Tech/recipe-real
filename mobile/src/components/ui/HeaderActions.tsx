import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { fetchNotifications } from "@/api/client";
import { useT } from "@/i18n";
import { Space, useThemeColors } from "@/theme";
import { IconPressable } from "./IconPressable";

function useUnreadCount(): number {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const inbox = await fetchNotifications(1);
      setUnread(inbox.unreadCount ?? 0);
    } catch {
      // Silent: badge hides on failure (stays at last value or 0).
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return unread;
}

function useHeaderData(): { unread: number } {
  const unread = useUnreadCount();
  return { unread };
}

// ---- Presentational helpers (no data fetching) -------------------------------

function BellIcon({ unread }: { unread: number }) {
  const colors = useThemeColors();
  const t = useT();
  return (
    <IconPressable
      onPress={() => router.push("/notifications")}
      accessibilityLabel={
        unread > 0
          ? `${t("notif.bellA11y")} · ${t("notif.unreadA11y", { n: unread })}`
          : t("notif.bellA11y")
      }
      hitSlop={Space.xs}
    >
      <View style={styles.bellWrap}>
        <Ionicons name="notifications-outline" size={24} color={colors.inkSecondary} />
        {unread > 0 ? (
          <View style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {unread > 99 ? "99+" : String(unread)}
            </Text>
          </View>
        ) : null}
      </View>
    </IconPressable>
  );
}

function AvatarIcon() {
  const colors = useThemeColors();
  const t = useT();
  // profile.title ("Your profile") — long-standing key, so this component
  // doesn't depend on freshly appended dictionary lines.
  const a11y = t("profile.title");
  return (
    <IconPressable
      onPress={() => router.push("/profile")}
      accessibilityLabel={a11y}
      hitSlop={Space.xs}
    >
      <Ionicons name="person-circle-outline" size={30} color={colors.inkSecondary} />
    </IconPressable>
  );
}

// ---- Public API ------------------------------------------------------------

/**
 * Hook returning the two rights nodes for PinnedHeaderBar's `rights` prop.
 * Each node is a bare IconPressable (plain icon, no circle chrome) — the bar
 * lays them out itself. Shares the same unread data as HeaderActions.
 */
export function useHeaderActionsRights(): ReactNode[] {
  const { unread } = useHeaderData();
  // Keys are stable for ScreenHeader's map.
  return [
    <BellIcon key="bell" unread={unread} />,
    <AvatarIcon key="avatar" />,
  ];
}

/**
 * The shared action cluster for the Home brand header row (after the search
 * pill). Plain icons — no circle chrome (matches PinnedHeaderBar's plain
 * rights): lighter row, standard iOS/Material look.
 */
export function HeaderActions() {
  const { unread } = useHeaderData();
  return (
    <View style={styles.row}>
      <BellIcon unread={unread} />
      <AvatarIcon />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Space.md,
    alignItems: "center",
  },
  bellWrap: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    end: -7,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0,
  },
});
