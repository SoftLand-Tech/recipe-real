import { useCallback, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { fetchNotifications, getAuthEpoch, hasToken } from "@/api/client";
import { useT } from "@/i18n";
import { Space, useThemeColors } from "@/theme";
import { IconPressable } from "./IconPressable";

const UNREAD_COOLDOWN_MS = 20_000;

let sharedUnread = 0;
let lastFetchedAt = 0;
let lastAuthEpoch = -1;
let refreshInFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setSharedUnread(next: number): void {
  if (sharedUnread === next) return;
  sharedUnread = next;
  for (const listener of listeners) {
    listener();
  }
}

function subscribeUnread(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getUnreadSnapshot(): number {
  return sharedUnread;
}

async function refreshSharedUnread(): Promise<void> {
  const epoch = getAuthEpoch();
  if (!(await hasToken())) {
    lastAuthEpoch = epoch;
    lastFetchedAt = 0;
    refreshInFlight = null;
    setSharedUnread(0);
    return;
  }
  if (epoch !== lastAuthEpoch) {
    lastFetchedAt = 0;
    refreshInFlight = null;
  }
  if (
    epoch === lastAuthEpoch &&
    Date.now() - lastFetchedAt < UNREAD_COOLDOWN_MS
  ) {
    return;
  }
  if (!refreshInFlight) {
    let run: Promise<void> | null = null;
    run = (async () => {
      try {
        const inbox = await fetchNotifications(1);
        if (getAuthEpoch() !== epoch) return;
        lastAuthEpoch = epoch;
        lastFetchedAt = Date.now();
        setSharedUnread(inbox.unreadCount ?? 0);
      } catch {
        // Silent: badge hides on failure (stays at last value or 0).
      } finally {
        if (refreshInFlight === run) {
          refreshInFlight = null;
        }
      }
    })();
    refreshInFlight = run;
  }
  await refreshInFlight;
}

function useUnreadCount(): number {
  const unread = useSyncExternalStore(
    subscribeUnread,
    getUnreadSnapshot,
    getUnreadSnapshot,
  );

  useFocusEffect(
    useCallback(() => {
      void refreshSharedUnread();
    }, []),
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
      onPress={() => {
        lastFetchedAt = 0;
        router.push("/notifications");
      }}
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
      onPress={() => {
        lastFetchedAt = 0;
        router.push("/profile");
      }}
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
  return useMemo(
    () => [
      <BellIcon key="bell" unread={unread} />,
      <AvatarIcon key="avatar" />,
    ],
    [unread],
  );
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
