import AsyncStorage from "@react-native-async-storage/async-storage";

const NUDGE_PREF_KEY = "recipereal.nudgePref";

export type NudgePref = "on" | "off";

/** Whether passive-step nudges are enabled (default on until turned off). */
export async function getNudgePref(): Promise<NudgePref> {
  try {
    const v = await AsyncStorage.getItem(NUDGE_PREF_KEY);
    return v === "off" ? "off" : "on";
  } catch {
    return "on";
  }
}

export async function setNudgePref(pref: NudgePref): Promise<void> {
  try {
    await AsyncStorage.setItem(NUDGE_PREF_KEY, pref);
  } catch {
    // Non-fatal: nudges simply keep the previous preference.
  }
}
