import * as Crypto from "expo-crypto";

import { INSTALL_ID_KEY } from "@/config";
import { secureStore } from "@/utils/secureStore";

/**
 * Per-install anonymous ID for install counting (admin "how many people
 * have the app" stat via POST /api/installs).
 *
 * Generated once with Crypto.randomUUID() (Expo SDK v57, cryptographically
 * secure) and persisted via SecureStore. On Android SecureStore is cleared
 * on uninstall, so a reinstall correctly counts as a new install.
 * Random UUID — no device fingerprint, no PII.
 */

let cached: string | null | undefined;

export async function getOrCreateInstallId(): Promise<{
  id: string;
  isNew: boolean;
}> {
  if (cached !== undefined) return { id: cached as string, isNew: false };

  const existing = await secureStore.getItemAsync(INSTALL_ID_KEY);
  if (existing) {
    cached = existing;
    return { id: existing, isNew: false };
  }

  const fresh = Crypto.randomUUID();
  await secureStore.setItemAsync(INSTALL_ID_KEY, fresh);
  cached = fresh;
  return { id: fresh, isNew: true };
}
