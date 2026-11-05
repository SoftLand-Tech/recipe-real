# Google sign-in — setup

Google sign-in is fully implemented (mobile + backend).

## Current client (2026-11-05)

| Fact | Value |
|---|---|
| Cloud project | `recipereal` (number 546591490861), owner mamounprogrammer@gmail.com |
| OAuth client | "RecipeReal Web" — Web application |
| Client ID | `546591490861-c6gqi2a7q2ueqfrl4lu0khs3qbfjercq.apps.googleusercontent.com` |
| Consent screen | **In production** (published 2026-11-05); app name RecipeReal; support email mamounprogrammer@gmail.com; home https://recipe-real.softland.tech; privacy /privacy; terms /terms; authorized domain softland.tech |
| JS origin | `https://recipe-real.softland.tech` |
| Redirect URIs | `https://recipe-real.softland.tech/auth/callback` (app), `https://recipe-real.softland.tech/admin/auth/google/callback` (admin panel), `https://auth.expo.io/@mamounhisham1/recipereal` (Expo Go) |

### Legacy client (transition)

The OLD project's client ID (`412318680966-oo5cbharsvo1jo4fvi6824taqq6n6du5.apps.googleusercontent.com`)
is baked into every distributed 1.0.2 APK. The backend accepts id_tokens for
**both** clients during the transition: set `GOOGLE_LEGACY_CLIENT_ID` in
production env alongside `GOOGLE_CLIENT_ID` (see
`GoogleIdTokenService::acceptedClientIds()`). Remove the legacy var once no
1.0.2-era installs remain in the wild. Covered by
`tests/Feature/GoogleClientTransitionTest.php`.

## History: how the client was created

1. Google Cloud Console → project `recipereal`.
2. Google Auth Platform → Branding: app name RecipeReal, support email,
   home/privacy/terms URLs, authorized domain `softland.tech`.
3. Audience: User type **External** → **Publish app** → In production.
4. Clients → Create client → **Web application** →
   "RecipeReal Web" with the JS origin + three redirect URIs above.
5. Copy the **Client ID** (`...apps.googleusercontent.com`).

## 2. Configure

- **Mobile** — `mobile/app.json` → `expo.extra.googleWebClientId` = the ID
  (then reload the app).
- **Backend (production)** — add to `/var/www/recipe-real/backend/.env`:
  ```
  GOOGLE_CLIENT_ID=<same web client id>
  ```
  then `ssh root@qufran.com 'cd /var/www/recipe-real && ./deploy.sh'`.

## 2b. Publish the consent screen before any store release

The client ID is only half of sign-in. The OAuth consent screen's
**publishing status** must be **In production** before you distribute outside
your test circle: while it is **Testing**, Google blocks every account that is
not on the test-user list ("Access blocked"), so users installing from
APKPure/Uptodown/Samsung/etc. could not sign in at all.

1. Google Cloud Console -> APIs & Services -> OAuth consent screen.
2. User type **External**; Publishing status -> **Publish app**.
3. Authorized domains: `recipe-real.softland.tech`.
4. Scopes: `openid`, `email`, `profile` (non-sensitive; most projects do not
   need Google's verification review for these).
5. Privacy policy: `https://recipe-real.softland.tech/privacy`;
   terms: `https://recipe-real.softland.tech/terms`.
6. Authorized redirect URI must still include
   `https://recipe-real.softland.tech/auth/callback` for standalone builds
   (and the Expo Go proxy URI if you still use Expo Go).
7. Create a dedicated review Google account and put its credentials in each
   store's review notes; reviewers otherwise cannot exercise the signed-in
   flows.

The service is Google-only, so a Testing-mode consent screen is a hard
blocker, not a warning.

## 3. Verify

- `curl -s -X POST https://recipe-real.softland.tech/api/auth/google \
    -H 'Content-Type: application/json' -d '{"id_token":"x"}'`
  should now say **"Invalid or expired Google credentials."** (not
  "not configured").
- In the app: Pace tab → **Sign in** → **Continue with Google**.

## How it works

Mobile runs the Google flow via the Expo auth proxy (works in Expo Go with
just the Web Client ID) and sends the `id_token` to `POST /api/auth/google`.
The backend verifies the token against Google's JWKS (signature, expiry,
audience, issuer, plus a per-attempt nonce), finds/creates the user by
`google_sub` only (a different Google identity that reuses an existing email is
refused, never linked), and returns a Sanctum token. Google is the only auth
method — email/password auth has been removed.
