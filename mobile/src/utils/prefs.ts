import AsyncStorage from "@react-native-async-storage/async-storage";

const NUDGE_PREF_KEY = "recipereal.nudgePref";
const LAST_OS_NOTIF_GRANTED_KEY = "recipereal.lastOsNotifGranted";

export type NudgePref = "on" | "off";

/**
 * Raw persisted nudge preference without defaulting null to "off".
 * Returns null when no preference has been saved yet.
 */
export async function getRawNudgePref(): Promise<NudgePref | null> {
  try {
    const v = await AsyncStorage.getItem(NUDGE_PREF_KEY);
    if (v === "on" || v === "off") return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * Whether passive-step nudges are enabled. Defaults OFF until OS notification
 * permission is granted or the user turns the toggle on.
 */
export async function getNudgePref(): Promise<NudgePref> {
  return (await getRawNudgePref()) === "on" ? "on" : "off";
}

export async function setNudgePref(pref: NudgePref): Promise<void> {
  try {
    await AsyncStorage.setItem(NUDGE_PREF_KEY, pref);
  } catch {
    // Non-fatal: nudges simply keep the previous preference.
  }
}

/**
 * Last observed OS notification permission state, or null when never recorded.
 * Used to detect denied -> granted transitions (e.g. enabled in OS Settings).
 */
export async function getLastOsNotifGranted(): Promise<boolean | null> {
  try {
    const v = await AsyncStorage.getItem(LAST_OS_NOTIF_GRANTED_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
    return null;
  } catch {
    return null;
  }
}

export async function setLastOsNotifGranted(granted: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LAST_OS_NOTIF_GRANTED_KEY,
      granted ? "true" : "false",
    );
  } catch {
    // Non-fatal.
  }
}
