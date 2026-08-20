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
audience, issuer), finds/creates the user (linking by `google_sub` or verified
email), and returns a Sanctum token. Google is the only auth method —
email/password auth has been removed.
