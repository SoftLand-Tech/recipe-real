import { http } from "@/api/client";

/**
 * Fire-and-forget analytics event tracker.
 *
 * Posts `{ name, properties }` to `/api/events` using the shared axios instance
 * (which attaches the bearer token when present). Analytics must NEVER break the
 * UX, so every failure is swallowed.
 */
export async function track(
  name: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    await http.post("/api/events", { name, properties: properties ?? {} });
  } catch {
    // Swallow: analytics failures must not affect the user.
  }
}
