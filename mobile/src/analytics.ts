import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { API_BASE_URL } from "@/config";
import { getAuthToken } from "@/api/http";
import { getOrCreateInstallId } from "@/utils/installId";

/**
 * Fire-and-forget analytics event tracker — on its OWN axios instance.
 *
 * It shares the API base URL but deliberately NOT the shared instance's
 * 429 cooldown: analytics endpoints have tighter rate limits than data
 * routes, and during dev (reload-per-mount app_open events) they can trip
 * 429s — tripping the GLOBAL cooldown would freeze every data request for
 * 20s (observed as a ~14s Browse cold start). An analytics 429 must only
 * cost the event itself. Failures are swallowed: analytics must never
 * affect the user.
 */
const eventsHttp = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

// Consent cache (session-scoped): read once, overridden by
// grantAnalyticsConsent() when the user accepts on first launch. Anything
// other than the stored value 'accepted' (declined / unset / unreadable)
// keeps analytics OFF — data collection never happens without consent.
let consentCache: Promise<boolean> | null = null;

async function hasAnalyticsConsent(): Promise<boolean> {
  if (!consentCache) {
    consentCache = AsyncStorage.getItem("consent.v1")
      .then((v) => v === "accepted")
      .catch(() => false);
  }
  return consentCache;
}

/**
 * Called by FirstRunConsent when the user taps Accept: flips the cached
 * consent to true so track() events flow immediately without waiting for
 * the next cold start.
 */
export function grantAnalyticsConsent(): void {
  consentCache = Promise.resolve(true);
}

export async function track(
  name: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  // Consent gate: a user who chose "Continue without sharing" must never
  // emit events, no matter which screen calls track().
  if (!(await hasAnalyticsConsent())) return;
  try {
    await eventsHttp.post("/api/events", { name, properties: properties ?? {} });
  } catch {
    // Swallow: analytics failures must not affect the user.
  }
}

/**
 * Cold-start reporter: heartbeats the per-install ID to POST /api/installs
 * (the admin "how many people have the app" counter) and tracks app_open
 * (+ app_install on first run) with the same ID attached.
 *
 * Anonymous by design — no login required. When a bearer token exists it
 * is attached so the backend can link the install to the user; otherwise
 * the heartbeat stays anonymous. Offline first-run simply fails silently;
 * the next cold start with connectivity records it. Never throws.
 */
export async function reportAppLaunch(): Promise<void> {
  try {
    const { id: installId, isNew } = await getOrCreateInstallId();
    const platform =
      Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web"
        ? Platform.OS
        : undefined;
    const appVersion =
      typeof Constants.expoConfig?.version === "string"
        ? Constants.expoConfig.version
        : undefined;
    const baseProps = {
      ...(platform ? { platform } : {}),
      ...(appVersion ? { app_version: appVersion } : {}),
    };

    const token = await getAuthToken().catch(() => null);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Durable install counter (survives the 90-day analytics prune).
    await eventsHttp
      .post(
        "/api/installs",
        { install_id: installId, ...baseProps },
        { headers },
      )
      .catch(() => {});

    await track("app_open", { install_id: installId, ...baseProps });
    if (isNew) {
      await track("app_install", { install_id: installId, ...baseProps });
    }
  } catch {
    // Swallow: install reporting must never affect the user.
  }
}
