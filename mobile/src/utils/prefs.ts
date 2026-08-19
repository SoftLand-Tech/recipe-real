import AsyncStorage from "@react-native-async-storage/async-storage";

const NUDGE_PREF_KEY = "recipereal.nudgePref";

export type NudgePref = "on" | "off";

/**
 * Whether passive-step nudges are enabled. Defaults OFF: nudges need the
 * notification permission, which is only requested when the user actively
 * turns the toggle on — a default-on preference with no permission granted
 * silently never fired.
 */
export async function getNudgePref(): Promise<NudgePref> {
  try {
    const v = await AsyncStorage.getItem(NUDGE_PREF_KEY);
    return v === "on" ? "on" : "off";
  } catch {
    return "off";
  }
}

export async function setNudgePref(pref: NudgePref): Promise<void> {
  try {
    await AsyncStorage.setItem(NUDGE_PREF_KEY, pref);
  } catch {
    // Non-fatal: nudges simply keep the previous preference.
  }
}
