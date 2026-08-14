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
4. **Authorized redirect URIs** — add:
   ```
   https://auth.expo.io/@mamounhisham1/recipereal
   ```
   (the Expo auth proxy used when running in Expo Go). When you later ship a
   standalone/dev-client build, also add your app scheme, e.g.
   `recipereal://`/`https://recipe-real.softland.tech` and switch the mobile
   redirect accordingly.
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
email), and returns a Sanctum token — identical shape to password login.
Email/password auth works regardless of Google configuration.
