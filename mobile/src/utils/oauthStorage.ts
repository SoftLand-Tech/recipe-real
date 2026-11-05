import { OAUTH_FLOW_KEY } from "@/config";
import { secureStore } from "@/utils/secureStore";

/**
 * The single-use OAuth material generated per sign-in attempt. `state` is
 * Google's CSRF echo; `nonce` is signed INTO the id_token (implicit flow);
 * `codeVerifier` is the PKCE half paired with the code_challenge in the
 * auth URL (standalone authorization-code flow only).
 */
export interface FlowSecret {
  nonce: string;
  state: string;
  codeVerifier?: string;
}

/**
 * Persist this attempt's OAuth flow material BEFORE opening Google. Kept in
 * SecureStore (not memory) so a cold-start deep-link completion — the OS
 * killed the app behind Google's consent screen — still finds matching
 * material to verify against.
 */
export async function saveFlowSecret(secret: FlowSecret): Promise<void> {
  await secureStore.setItemAsync(OAUTH_FLOW_KEY, JSON.stringify(secret));
}

/**
 * Read the stored flow material WITHOUT consuming it. Callers must verify
 * the incoming `state` with a length-independent comparison FIRST and only
 * then clearFlowSecret() — a forged/replayed callback must never burn the
 * secret that the genuine callback still needs.
 */
export async function readFlowSecret(): Promise<FlowSecret | null> {
  const raw = await secureStore.getItemAsync(OAUTH_FLOW_KEY);
  return raw ? (JSON.parse(raw) as FlowSecret) : null;
}

/** Consume (single-use) the flow material so a callback can never replay. */
export async function clearFlowSecret(): Promise<void> {
  await secureStore.deleteItemAsync(OAUTH_FLOW_KEY);
}
