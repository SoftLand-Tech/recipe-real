import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  cachePaceCalibrations,
  getCachedPaceCalibrations,
} from "@/db/database";
import type { PaceCalibration } from "@/types";

const NUDGE_PREF_KEY = "recipereal.nudgePref";
const LAST_OS_NOTIF_GRANTED_KEY = "recipereal.lastOsNotifGranted";
const PREP_SPEED_KEY = "recipereal.prepSpeed";
const KITCHEN_ENV_KEY = "recipereal.kitchenEnv";

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

export type PrepSpeedPref = "relaxed" | "steady" | "fast";
export type KitchenEnvPref = "focused" | "busy" | "hectic";

export interface KitchenProfile {
  prepSpeed: PrepSpeedPref;
  kitchenEnv: KitchenEnvPref;
  activeMultiplier: number;
  passiveMultiplier: number;
  cleanupMultiplier: number;
}

const PREP_SPEED_MULT: Record<PrepSpeedPref, number> = {
  relaxed: 1.2,
  steady: 1.0,
  fast: 0.85,
};

const KITCHEN_ENV_MULT: Record<KitchenEnvPref, number> = {
  focused: 1.0,
  busy: 1.15,
  hectic: 1.3,
};

const PROFILE_STEP_TYPES = ["active", "passive", "cleanup"] as const;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function isPrepSpeedPref(v: string | null): v is PrepSpeedPref {
  return v === "relaxed" || v === "steady" || v === "fast";
}

function isKitchenEnvPref(v: string | null): v is KitchenEnvPref {
  return v === "focused" || v === "busy" || v === "hectic";
}

/**
 * Derive per-step-type pace multipliers from prep speed and kitchen environment.
 */
export function computeKitchenProfile(
  prepSpeed: PrepSpeedPref = "steady",
  kitchenEnv: KitchenEnvPref = "focused",
): KitchenProfile {
  const prepMult = PREP_SPEED_MULT[prepSpeed];
  const envMult = KITCHEN_ENV_MULT[kitchenEnv];
  return {
    prepSpeed,
    kitchenEnv,
    activeMultiplier: round2(prepMult * envMult),
    passiveMultiplier: round2(envMult),
    cleanupMultiplier: round2(
      prepSpeed === "relaxed" ? 1.15 : prepSpeed === "fast" ? 0.9 : 1.0,
    ),
  };
}

/**
 * Load the persisted kitchen profile from AsyncStorage, defaulting to steady + focused.
 */
export async function getKitchenProfile(): Promise<KitchenProfile> {
  try {
    const entries = await AsyncStorage.multiGet([
      PREP_SPEED_KEY,
      KITCHEN_ENV_KEY,
    ]);
    const prepRaw = entries[0]?.[1] ?? null;
    const envRaw = entries[1]?.[1] ?? null;
    const prepSpeed: PrepSpeedPref = isPrepSpeedPref(prepRaw)
      ? prepRaw
      : "steady";
    const kitchenEnv: KitchenEnvPref = isKitchenEnvPref(envRaw)
      ? envRaw
      : "focused";
    return computeKitchenProfile(prepSpeed, kitchenEnv);
  } catch {
    return computeKitchenProfile("steady", "focused");
  }
}

let profileWriteChain: Promise<unknown> = Promise.resolve();

/**
 * Persist partial kitchen profile updates in AsyncStorage and return the full profile.
 */
export async function saveKitchenProfile(
  patch: Partial<Pick<KitchenProfile, "prepSpeed" | "kitchenEnv">>,
): Promise<KitchenProfile> {
  const run = async (): Promise<KitchenProfile> => {
    const current = await getKitchenProfile();
    const prepSpeed = patch.prepSpeed ?? current.prepSpeed;
    const kitchenEnv = patch.kitchenEnv ?? current.kitchenEnv;
    const next = computeKitchenProfile(prepSpeed, kitchenEnv);
    try {
      const pairs: [string, string][] = [];
      if (patch.prepSpeed !== undefined) {
        pairs.push([PREP_SPEED_KEY, prepSpeed]);
      }
      if (patch.kitchenEnv !== undefined) {
        pairs.push([KITCHEN_ENV_KEY, kitchenEnv]);
      }
      if (pairs.length > 0) {
        await AsyncStorage.multiSet(pairs);
      }
    } catch {
      // Non-fatal: return the computed profile even if storage fails.
    }
    return next;
  };
  const nextPromise = profileWriteChain.then(run, run);
  profileWriteChain = nextPromise.then(
    () => undefined,
    () => undefined,
  );
  return nextPromise;
}

function profileMultiplierForStepType(
  profile: KitchenProfile,
  stepType: (typeof PROFILE_STEP_TYPES)[number],
): number {
  switch (stepType) {
    case "active":
      return profile.activeMultiplier;
    case "passive":
      return profile.passiveMultiplier;
    case "cleanup":
      return profile.cleanupMultiplier;
  }
}

/**
 * Sync the kitchen profile multipliers into local pace_calibrations as a low-confidence
 * baseline without overwriting any step type already established by real cook sessions.
 */
export async function syncKitchenProfileToLocalPace(
  profile: KitchenProfile,
): Promise<void> {
  const run = async (): Promise<void> => {
    try {
      const existing = await getCachedPaceCalibrations();
      const byType = new Map<string, PaceCalibration>(
        existing.map((row) => [row.step_type, row]),
      );

      const hasNonDefaultMultiplier =
        profile.activeMultiplier !== 1 ||
        profile.passiveMultiplier !== 1 ||
        profile.cleanupMultiplier !== 1;
      const hasExistingBaseline = existing.some(
        (row) =>
          (row.step_type === "active" ||
            row.step_type === "passive" ||
            row.step_type === "cleanup") &&
          row.confidence < 0.5,
      );

      if (!hasNonDefaultMultiplier && !hasExistingBaseline) {
        return;
      }

      const nextList: PaceCalibration[] = [];
      for (const step_type of PROFILE_STEP_TYPES) {
        const prev = byType.get(step_type);
        if (prev && prev.confidence >= 0.5) {
          nextList.push(prev);
        } else {
          nextList.push({
            step_type,
            personal_avg_minutes: null,
            community_avg_minutes: null,
            multiplier: profileMultiplierForStepType(profile, step_type),
            confidence: 0.25,
          });
        }
      }

      for (const row of existing) {
        if (
          row.step_type !== "active" &&
          row.step_type !== "passive" &&
          row.step_type !== "cleanup"
        ) {
          nextList.push(row);
        }
      }

      await cachePaceCalibrations(nextList);
    } catch (error) {
      console.warn("[RecipeReal] syncKitchenProfileToLocalPace failed:", error);
    }
  };
  const nextPromise = profileWriteChain.then(run, run);
  profileWriteChain = nextPromise.then(
    () => undefined,
    () => undefined,
  );
  return nextPromise;
}
