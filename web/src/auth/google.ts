/**
 * Google Identity Services loader + helpers (FOUNDATION OWNED).
 *
 * The GIS script (https://accounts.google.com/gsi/client) is injected once
 * per page; renderGoogleButton then initializes the client with a per-attempt
 * `nonce` (Google signs it INTO the returned id_token; the backend requires
 * an exact match, so injected/replayed tokens die server-side — the same
 * contract as mobile's loginWithGoogle) and renders the official button into
 * a container.
 *
 * Client ID resolution order (contract): window.__RECIPEREAL__.googleClientId
 * (injected into index.html by the Laravel /app serving route) first, then
 * VITE_GOOGLE_CLIENT_ID for `npm run dev`. The unreplaced placeholder
 * literal ('__…__') counts as "not configured".
 */

/** Runtime config injected by the Laravel /app route (see web/index.html). */
declare global {
  interface Window {
    __RECIPEREAL__?: {
      googleClientId?: string;
    };
    google?: GoogleAccounts;
  }
}

/** Minimal typings for the parts of the GIS client we drive. */
interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    nonce?: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      shape?: string;
      text?: string;
      logo_alignment?: string;
      width?: number;
      locale?: string;
    },
  ): void;
}

interface GoogleAccounts {
  accounts: { id: GoogleAccountsId };
}

const GIS_SRC = "https://accounts.google.com/gsi/client";

/** Singleton promise so concurrent callers share one script injection. */
let gisPromise: Promise<void> | null = null;

/** Inject the GIS <script> once; resolves when window.google is ready. */
export function loadGoogleScript(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("No DOM"));
      return;
    }
    // A previous manual include (or a second call racing the first) may
    // already have loaded the client.
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later retry: the failed injection is not cached.
      gisPromise = null;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * The Google OAuth client ID for this deployment. Empty string when not
 * configured (dev without VITE_GOOGLE_CLIENT_ID, or the serve-time
 * placeholder survived unreplaced) — callers show the friendly
 * "not configured" state instead of building a broken button.
 */
export function googleClientId(): string {
  const injected = window.__RECIPEREAL__?.googleClientId;
  const fromEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const value = injected && !injected.startsWith("__") ? injected : fromEnv;
  return typeof value === "string" ? value : "";
}

export interface GoogleButtonOptions {
  /** Single-use random value signed into the id_token (backend-verified). */
  nonce: string;
  /** Receives the id_token (credential) after a successful sign-in. */
  callback: (idToken: string) => void;
}

/**
 * Render the official GIS "Continue with Google" button into `container`.
 * Resolves once the button is on screen; rejects (with the loadGoogleButton
 * caller catching) when GIS can't load or no client ID is configured — the
 * LoginPage surfaces its errNotConfigured / errGeneric states from that.
 */
export async function renderGoogleButton(
  container: HTMLElement,
  options: GoogleButtonOptions,
): Promise<void> {
  const clientId = googleClientId();
  if (!clientId) {
    throw new Error("Google sign-in is not configured");
  }
  await loadGoogleScript();
  const id = window.google?.accounts?.id;
  if (!id) {
    throw new Error("Google Identity Services unavailable");
  }
  id.initialize({
    client_id: clientId,
    nonce: options.nonce,
    callback: (response) => {
      if (response.credential) {
        options.callback(response.credential);
      }
    },
  });
  id.renderButton(container, {
    theme: "outline",
    size: "large",
    shape: "pill",
    text: "continue_with",
    logo_alignment: "center",
  });
}
