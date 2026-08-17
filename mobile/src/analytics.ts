import axios from "axios";

import { API_BASE_URL } from "@/config";

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

export async function track(
  name: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await eventsHttp.post("/api/events", { name, properties: properties ?? {} });
  } catch {
    // Swallow: analytics failures must not affect the user.
  }
}
