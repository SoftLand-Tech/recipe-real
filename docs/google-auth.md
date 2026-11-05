# Google sign-in — setup

Google sign-in is fully implemented (mobile + backend) but needs **one value
you must create**: a Google OAuth **Web Client ID**.

## 1. Create the Web Client ID (one-time)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or
   pick a project.
2. **APIs & Services → OAuth consent screen**: External, fill app name
   (RecipeReal) + support email. Test users are fine for beta.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   type **Web application**.
4. **Authorized redirect URIs** — add BOTH:
   ```
   https://auth.expo.io/@mamounhisham1/recipereal          # Expo Go runs
   https://recipe-real.softland.tech/auth/callback         # standalone builds
   ```
   The first is the Expo auth proxy used when running in Expo Go. The second
   is our domain trampoline (`routes/web.php` `/auth/callback`): standalone
   builds send it to Google, and the trampoline forwards the result to the
   `recipereal:///login` deep link (mobile/src/app/login.tsx handles both the
   browser-session return and the deep-linked token). Removing either URI
   breaks sign-in in the other environment.
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
