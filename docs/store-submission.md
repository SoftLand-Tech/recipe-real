# RecipeReal — Third-party Android store submission & compliance runbook

**Date:** November 2026 · **Audience:** the owner (solo operator, Egypt/MENA) ·
**Product:** RecipeReal — halal-only, bilingual (EN/AR, RTL) Android recipe app,
direct APK distribution expanding to third-party stores.

> **Honesty preamble.** Nothing in this document has been submitted to any
> store, and no store has been contacted. Every fee, requirement, and portal
> flow below is **store-policy-dependent and changes without notice** — treat
> each "free" / "required" claim as *as of November 2026* and re-confirm in the
> portal at submission time. Nothing here should be read as a promise that a
> listing will be accepted.

## 0. How to read this runbook — repo work vs. your accounts

Two kinds of steps exist, and confusing them is the main way solo launches
stall:

- **[repo]** — can be done entirely in this repository / on this VPS. Code,
  routes, env vars, admin pages, docs. No third-party account needed.
- **[account]** — requires logging into **your** Google Cloud Console, EAS
  account, or a store developer portal. Nobody can do these for you from the
  codebase.

Each checklist below is tagged. Section 11 collects every **[account]** item
into one ordered list.

### Ground truth already in this repo (do not re-derive)

| Fact | Value | Source |
|---|---|---|
| Backend / API base URL | `https://recipe-real.softland.tech` | `docs/deploy.md`, `mobile/app.config.js`, `mobile/eas.json` |
| Android package | `com.recipereal.app` | `mobile/app.config.js` (`android.package`), `backend/config/recipereal.php` (`ANDROID_PACKAGE` default) |
| App scheme / deep link | `recipereal://` | `mobile/app.config.js` (`scheme`) |
| App Links (verified) | `/r`, `/p` on the API host, `autoVerify: true` | `mobile/app.config.js` `intentFilters`, `/.well-known/assetlinks.json` in `backend/routes/web.php` |
| Auth | Google-only, `expo-auth-session` + `POST /api/auth/google` (JWKS, `aud`/`iss`, nonce, ban check) | `mobile/src/app/login.tsx`, `backend/app/Http/Controllers/Api/AuthController.php` |
| OAuth redirect (store builds) | `https://recipe-real.softland.tech/auth/callback` → trampoline → `recipereal:///login` | `mobile/src/app/login.tsx` `resolveAuthRedirectUri()`, `backend/routes/web.php` |
| Account deletion (in-app) | `DELETE /api/account` → 204; cascades profiles, cook sessions, timing submissions, pace calibrations, posts/comments/notes, likes/follows; user-authored recipes remain with `owner_id` nulled; analytics anonymized and pruned at 90 days. Uploaded files are not guaranteed to be erased from storage/backups | `backend/app/Http/Controllers/Api/AccountController.php` |
| UGC moderation | Report post/comment, block/unblock, dismiss/remove, ban (token revoke), unban | `backend/routes/api.php`, `backend/app/Services/ModerationService.php` |
| Halal screening | `App\Support\HalalGate` (pork + alcohol regexes, vinegar/ham lookarounds) screens all UGC (posts, comments, notes, user recipes, bios) and AI-published imports. The base Food.com library is **not** screened by this gate — audit/curate before claiming library-wide screening | `backend/app/Support/HalalGate.php` and its callers |
| Direct APK distribution | `GET /download` streams newest `AppRelease` (version, size, **sha256**, notes); per-release download in the admin "App releases" page | `backend/routes/web.php`, `backend/app/Models/AppRelease.php` |
| OTA updates | `expo-updates`, channel `production`, `runtimeVersion.policy: fingerprint`, checks `ON_LOAD` | `mobile/app.config.js`, `mobile/eas.json` |
| Release build profiles | `production` (AAB, for stores that accept AAB), `production-apk` (arm64 APK for `/download`), and `store-apk` (universal APK for third-party stores) | `mobile/eas.json` |
| ABI | `production-apk` is `arm64-v8a` only (~30–35 MB); `store-apk` is universal (four ABIs, larger) | `mobile/plugins/arm64-only.js` |
| Permissions & cook timing | `SCHEDULE_EXACT_ALARM` + notifee/expo-notifications merges; `POST_NOTIFICATIONS` runtime prompt; legacy storage permissions blocked via `android.blockedPermissions`; **no foreground service runs** — cook timing is wall-clock based and persisted, step alarms fire even when locked or killed, the session restores from its snapshot | `mobile/app.config.js` `android.permissions`, `mobile/src/utils/cookAlarms.ts` |
| Privacy / terms pages | `/privacy`, `/terms` (terms include the community-conduct rules), `/contact` form | `backend/routes/web.php` |
| Library (listing copy may use) | **20,000+ recipes** (exact recipe/step counts are unverified — never publish precise counts or step totals); offline library; claim-vs-reality cook times | `PRODUCT.md` |

**Listing-copy rule from `PRODUCT.md`:** only one public user exists. Do not
invent testimonials, download counts, or ratings anywhere in a store listing.

---

## 1. Preflight checklist

Work top-to-bottom; the OAuth consent screen (§2) is the long pole.

- [ ] **[repo]** Release APK built and signed: `eas build --profile store-apk --platform android` (universal APK for stores) and `eas build --profile production-apk --platform android` (arm64 APK for `/download`); EAS signs with the managed keystore — see §6.
- [ ] **[repo]** `versionCode` is known and higher than every previously distributed build (EAS assigns it because `eas.json` sets `appVersionSource: "remote"` — record the number from the EAS build page; see §6.3).
- [ ] **[repo]** `version` (versionName, `mobile/app.config.js`) bumped if this is a new release (currently `1.1.0`).
- [ ] **[repo]** `cd backend && php artisan recipereal:store-check` passes every required check (routes, OAuth config, release metadata; the OAuth-consent and Android-Verification rows are manual warnings).
- [ ] **[repo]** Privacy URL live: `https://recipe-real.softland.tech/privacy` returns 200.
- [ ] **[repo]** Account-deletion URL live: `https://recipe-real.softland.tech/account/delete` returns 200 (the page + request form are in this repo as of 2026-11-05; the in-app flow `DELETE /api/account` is verified in code).
- [ ] **[repo]** Terms URL live (`/terms` — also hosts the community-conduct rules; see §5).
- [ ] **[account]** Google OAuth consent screen **publishing status = "In production"** (§2 — the highest-risk blocker).
- [ ] **[repo]** Store assets prepared (§9): icon 512×512, feature graphic 1024×500, EN+AR screenshots, EN+AR descriptions.
- [ ] **[repo]** Package name confirmed `com.recipereal.app` in the built APK and matching `ANDROID_PACKAGE` on the VPS if set.
- [ ] **[repo]** Clean-device test (§1.1).
- [ ] **[repo]** Reviewer script dry-run (§3) — including the graceful signed-out Cook Mode completion (the finished cook is queued locally and the done screen asks for sign-in; **confirm it is in the release build before submitting**).

### 1.1 Clean-device test **[repo]**

On a factory-reset device or clean emulator profile (no Expo Go, no prior
RecipeReal data — `allowBackup` is false so there is no backup restore to
accidentally save you):

1. Install the APK from `/download` (not `adb install` of a local artifact) —
   proves the real download path serves the right bytes.
2. Launch **signed out**: browse the library, search (EN and AR), open a
   recipe, see claim vs. reality.
3. Run **Cook Mode** end-to-end: stopwatch, step alarms (grant the notification
   prompt; also test with the "Alarms & reminders" special access **denied** —
   Android 14+ denies `SCHEDULE_EXACT_ALARM` by default and the app must
   degrade gracefully, see §4).
4. Background the app mid-session (and lock the screen), then return — the
   session restores from its snapshot; cook timing is wall-clock based and
   persisted, and step alarms fire even when the screen is locked.
5. Switch the phone language to Arabic: RTL layout, Arabic recipe titles,
   no clipped or LTR-leaking strings.
6. Airplane-mode cook session: the offline library must work with no signal.
7. Reach the feedback/"how did that go?" log step and the save action while
   signed out → the sign-in prompt must be graceful (no dead end).
8. Sign in with a real Google account (this is what §2 gates).
9. Post, comment, report, block; then Settings → delete the test account and
   confirm sign-in no longer works (token revoked).

---

## 2. Google OAuth consent screen — the highest-risk blocker

The app has **exactly one auth method: Google**. If Google sign-in breaks, a
store build is a dead fish in reviewer hands. The most common failure is not
code — it is the consent screen sitting in **Testing** status, which limits
sign-in to explicitly listed test users (up to 100). Every real user and every
reviewer outside that list gets an `access_denied` error at the consent
screen.

### 2.1 What the code requires the console to contain

From `mobile/src/app/login.tsx` and `backend/routes/web.php`:

| Console entry | Value | Why |
|---|---|---|
| User type | **External** | Personal Google accounts sign in; no Workspace org covers them |
| Publishing status | **In production** | Testing mode restricts sign-in to listed test users |
| App name / support email | RecipeReal / owner's email | Shown on the consent screen |
| Authorized domain | `recipe-real.softland.tech` | Required for the app-home and policy links on the consent screen |
| Scopes | `openid`, `userinfo.email`, `userinfo.profile` (the Google provider's three non-sensitive scopes) | What `expo-auth-session`'s Google provider requests; all **non-sensitive** |
| Privacy policy link | `https://recipe-real.softland.tech/privacy` | Required on the consent screen |
| Terms link | `https://recipe-real.softland.tech/terms` | Recommended |
| Authorized redirect URI 1 | `https://recipe-real.softland.tech/auth/callback` | **The store-build path** — `resolveAuthRedirectUri()` sends exactly this for standalone builds; the trampoline forwards to `recipereal:///login` |
| Authorized redirect URI 2 | `https://auth.expo.io/@mamounhisham1/recipereal` | Expo Go proxy — pinned literal in `login.tsx`; keep registered while anyone still runs the app in Expo Go |
| Authorized redirect URI 3 | `https://recipe-real.softland.tech/admin/auth/google/callback` | Admin-panel Google login uses the same OAuth client |
| Authorized redirect URI 4 (optional) | the web dev origin (e.g. `http://localhost:8081/login`) | Web preview sign-in; remove when web is not being developed |

**Verify the redirect URIs byte-for-byte against the table.** A trailing
slash, wrong scheme, or typo produces Google's `redirect_uri_mismatch` error
page in the middle of the reviewer's first sign-in.

### 2.2 Console steps **[account]**

1. [Google Cloud Console](https://console.cloud.google.com/) → the project
   that owns client `412318680966-…apps.googleusercontent.com` (already baked
   into `mobile/app.config.js` `extra.googleWebClientId`).
2. **APIs & Services → OAuth consent screen**: confirm External; app name,
   logo, support email; add authorized domain `recipe-real.softland.tech`; add
   the privacy + terms links; confirm the three scopes above are the *only*
   ones listed.
3. **Publish → Push to production.** With only non-sensitive scopes, full
   Google verification (security assessment, verified badge) is **usually not
   required** — publishing alone is enough. If the console nonetheless prompts
   for verification, follow it; do not ship while status is Testing.
4. **APIs & Services → Credentials** → the Web application client → re-check
   every redirect URI against §2.1.
5. Keep the same client ID in backend env (`GOOGLE_CLIENT_ID` on the VPS) —
   `AuthController` validates `aud` against it.

### 2.3 Post-change verification **[repo]**

```bash
# Backend still configured (must say invalid credentials, not "not configured"):
curl -s -X POST https://recipe-real.softland.tech/api/auth/google \
  -H 'Content-Type: application/json' -d '{"id_token":"x"}'
```

Then, on a clean device, sign in with a Google account which was **never** a
listed test user (this is what proves production status). A brand-new
throwaway account is ideal — which is also exactly what §3's reviewer account
is for.

---

## 3. Reviewer access — the exact script to paste in "review notes"

Store reviewers (and their automated scanners) get a bare APK with no context.
Two rules make review painless:

1. **The app is fully usable signed out** — browsing, search, Cook Mode, and
   the offline library need no account. Reviewers can verify most of the app
   without credentials.
2. **Never ship a hidden auth bypass, backdoor account, or debug login.**
   Besides being detectable (stores decompile and network-scan), a bypass key
   floating in a store build is a standing security hole. The legitimate
   mechanism is a **dedicated test Google account whose credentials you put in
   the portal's review-notes field** (that field is private to the store's
   review team).

**[account]** Create a dedicated test Google account, sign into the app with
it once, complete onboarding, and keep it exclusively for reviews. Rotate it
if a portal ever leaks it.

### 3.1 Review script to paste (edit the credentials line)

> **Test account:** `<test-account-email>` / `<password>` (Google sign-in).
> Sign-in is Google-only; there is no other login method. The app is fully
> usable **without** signing in:
> 1. Launch the app signed out. Browse or search the 20,000+ recipe library
>    (English and Arabic; switch language in Settings).
> 2. Open any recipe — see the published cook time next to "Really takes"
>    (measured by real cooks).
> 3. Tap **Cook** → Cook Mode: full-screen guided steps with a live stopwatch.
>    Step through 2–3 steps; allow notifications when prompted — each step can
>    fire an alarm even if you background the app or lock the screen (timing
>    is persisted; the session restores when you return; no persistent
>    foreground notification is used). Pause/resume works.
> 4. Finish (or abandon) the session → the "how did that go?" feedback step
>    appears.
> 5. Saving while signed out shows a sign-in prompt; the finished cook is
>    queued on the device and syncs after you sign in.
> 6. Sign in with the test account above: Continue with Google → browser →
>    back to the app.
> 7. Community tab: posts, likes, comments. Every post/comment has **Report**;
>    every author has **Block**.
> 8. Account deletion: Settings → **Delete account** (immediate, confirmed
>    via dialog) — also available on the web at
>    https://recipe-real.softland.tech/account/delete.
> Offline: enable airplane mode — the downloaded library and Cook Mode still
> work.

Adapt step 8's web URL only after confirming it is live (§1). Keep the script
factual; never promise features that are not in the build.

---

## 4. Permissions rationale — what the app asks for and why

Declared in `mobile/app.config.js` `android.permissions` plus whatever the
notification libraries merge in. Several stores ask you to justify every
permission in the merged manifest.

| Permission | Why it exists | Where it is used |
|---|---|---|
| `POST_NOTIFICATIONS` (Android 13+, runtime) | Step alarms and community notifications (likes, comments, moderation notices) | `mobile/src/utils/cookAlarms.ts`, `mobile/src/utils/notifications.ts` (notifee); requested at first Cook Mode start, not at launch |
| `SCHEDULE_EXACT_ALARM` | **Per-step cooking alarms** must fire at the exact second a step ends — an "±15 min" inexact alarm is useless when the stove is on | `cookAlarms.ts`; Android 14+ denies it by default and the app **degrades gracefully** (falls back, surfaces "Alarms & reminders" settings guidance via `exactAlarmDenied`) |
| Photos — photo library only (`expo-image-picker` config plugin) | Choosing an avatar or attaching recipe/post images | The app requests **only photo-library access** (the `photosPermission` string); camera and microphone are explicitly disabled in the plugin config, and `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` are blocked via `android.blockedPermissions` |
| `INTERNET` (typical SDK merge) | API calls to the RecipeReal backend | Standard library merge — verify the actual list per build |

**No foreground service is requested or run.** An earlier design held the
cook session open with a notifee foreground service; that was dropped rather
than fight Android 14+ FGS policy (shortService type with a ~3-minute cap,
missing typed permission — it could not hold a 30–60 min cook anyway). Cook
timing is **wall-clock based and persisted**: step alarms fire even when the
screen is locked or the app is killed, and the session restores from its
snapshot when you return. **Denying the notification permission degrades
Cook Mode to silent timing** — the session still runs and restores, but step
alarms cannot alert.

**Merged notifee permissions — one-line justifications (store forms):**

- `ACCESS_NOTIFICATION_POLICY` — DND-access-adjacent policy access so step
  alarms can use alarm priority (notifee merge).
- `VIBRATE` — vibration for step alarms so they are noticed on time
  (notifee merge).
- `WAKE_LOCK` — wake the device at a step-alarm moment so it fires on time
  (notifee merge; `expo-keep-awake` also uses it while the cook screen is
  open).
- `RECEIVE_BOOT_COMPLETED` — boot receiver reschedules pending step alarms
  after a reboot (notifee merge).

**Not requested — say so in store forms:** no location, no contacts, no SMS,
no camera or microphone access (explicitly disabled in the
`expo-image-picker` plugin config), no call state, no storage-wide access
(`READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` blocked via
`android.blockedPermissions`).

**[repo] Verify the merged manifest before answering any store form:** after
the EAS build finishes, download the APK and dump its permission list (e.g.
`aapt dump permissions RecipeReal-<version>.apk` from any local Android SDK
build-tools, or any APK inspector). Answer permission questions from that
output, never from memory — library upgrades silently add permissions, and
mismatches are a common rejection reason.

---

## 5. UGC and moderation evidence (for the stores' UGC policy forms)

The app has community features (posts/"tries", comments, follows), so most
stores will route you through a **user-generated content policy** form. The
honest answers — all implemented and citable:

| Store question | RecipeReal answer | Evidence in repo |
|---|---|---|
| Report mechanism? | Yes — every post and comment has an idempotent **Report** action | `POST /api/posts/{post}/report`, `POST /api/posts/{post}/comments/{comment}/report` (`backend/routes/api.php`) |
| Block users? | Yes — block/unblock from a user's profile | `backend/routes/api.php` (community group) |
| Moderator takedowns? | Yes — dismiss reports or remove content; the author always gets an inbox notice with the reason | `ModerationService::removePost/removeComment/dismissPostReports/dismissCommentReports` |
| Ban abusive accounts? | Yes — suspension stamps `banned_at`, **revokes every API token** (immediate sign-out on all devices), notifies the user; bans block new tokens at sign-in | `ModerationService::banUser/unbanUser`; banned check in `AuthController::google` |
| Content filtering at submission? | Yes — all free-text UGC (posts, comments, notes, user recipes, bios) is screened server-side for pork/alcohol terms and rejected with the offending terms listed; AI-imported recipes are screened at publish time. The base Food.com library is **not** screened by HalalGate — audit/curate before claiming library-wide screening | `backend/app/Support/HalalGate.php` + callers; `RecipePublisher` |
| Community guidelines published? | Yes — conduct rules (no unlawful content, nothing promoting haram, no abuse) are part of the public terms page | `/terms` (`terms4_d` in `backend/lang/en/site.php`). If a store demands a *dedicated* guidelines URL, link `/terms` and quote the section; splitting out a standalone page is a small backend change (out of scope for this doc) |
| Account deletion? | Yes — in-app (Settings → Delete account → `DELETE /api/account` → 204) plus the web URL and request form | `AccountController`; cascades profiles, cook sessions, timing submissions, calibrations, posts/comments/notes, likes/follows; user recipes stay with `owner_id` nulled; analytics are anonymized (`user_id` nulled) and pruned after 90 days; uploaded files may persist in storage/backups |
| Privacy policy? | Yes | `https://recipe-real.softland.tech/privacy` |

**[repo] Evidence pack (optional but cheap):** take admin-panel screenshots of
the reports queue and the moderation actions before submitting — some portals
ask for proof screenshots of report/block UI. Screenshots of the *app's*
report menu likewise.

---

## 6. Signing and distribution

### 6.1 Keystore custody — the one asset you cannot ever lose **[account]**

EAS signs production builds with a **managed keystore** it generated. Facts to
keep in mind:

- The EAS project currently lives under a **borrowed account** (slug
  `vibe-labs`, owner `vibelabs0s-team` — see the pinned-proxy comments in
  `mobile/src/app/login.tsx`, which also mention a planned post-Sep-1 account
  revert). Wherever the project ends up, **the keystore must follow the app,
  not the account**. Plan the account revert *before* more stores hold builds
  signed by this key.
- **Back it up now:** `cd mobile && eas credentials` → copy the Android
  keystore, its alias, and passwords into a password manager **and** an
  offline copy (encrypted USB / printed). If the keystore is lost, no store
  build can ever be updated in place again — every installed copy would need a
  package rename to receive updates.
- Anyone with the keystore can sign an update for your users. Two-person rule
  on where it lives, even solo: password manager + offline copy, nothing else.

### 6.2 Same key across stores

All stores that accept your APK unmodified (APKPure, Uptodown, Samsung, Xiaomi
— confirm per portal) get the **same EAS-signed artifact**, so their listings
are binary-identical and users can move between them with normal in-place
updates.

Stores that **re-sign submissions** — Amazon Appstore and Huawei AppGallery
have historically done this; **confirm in each portal at submission time** —
produce builds with a different signature. Two consequences:

1. **No cross-store updates:** an Amazon-signed build will not install over an
   EAS-signed one (Android refuses signature mismatch). Users must uninstall
   first. Acceptable, but mention it in release notes if you advertise
   multiple stores.
2. **App Links break on re-signed builds:** `https://` deep links
   (`/r`, `/p`) verify against the SHA-256 fingerprints in
   `/.well-known/assetlinks.json`. The route already serves a
   **comma-separated list** from the `APP_LINKS_SHA256` env — after a store
   re-signs, fetch the new fingerprint from that store's portal and **append
   it** to `APP_LINKS_SHA256` on the VPS, then redeploy. Until then those
   builds fall back to the browser/disambiguation dialog instead of opening
   the app.

### 6.3 versionCode monotonicity

- `mobile/eas.json` sets `appVersionSource: "remote"`: EAS assigns and
  auto-increments the Android `versionCode` per build. After each build,
  **record the number** from the EAS build page — it is the single source of
  truth.
- Every upload to every store must have a versionCode **strictly greater**
  than every previously distributed build (including the sideloaded
  `/download` releases). Never reset, never reuse.
- If you ever prefer controlling it in-repo (set `android.versionCode` in
  `app.config.js`), first switch `appVersionSource` to `"local"` — mixing
  the two silently desyncs. Not recommended mid-launch.
- `version` (currently `"1.1.0"`) is the human versionName; bump it per release;
  stores display it, Android compares versionCode.

### 6.4 OTA vs. APK

- `expo-updates` (channel `production`, fingerprint runtime version) can
  push **JS/asset-only** fixes without touching any store. With
  `runtimeVersion.policy: "fingerprint"`, an OTA is deliverable only while
  the native fingerprint is unchanged — if any native dependency or config
  changes, the OTA silently targets nothing and you must cut an APK.
- Anything else — permissions, native modules, `versionCode`, the package's
  manifest — requires a **full APK through every store** plus `/download`.
- Policy note: some stores (notably Amazon) restrict self-updating code
  outside their store. JS-only OTA is the generally accepted middle ground,
  but **confirm each store's self-update policy in the portal at submission
  time** and be conservative on Amazon: ship APK updates through Amazon there.

### 6.5 /download + AppRelease + checksums **[repo]**

The admin "App releases" page stores every APK (`version`, size, **sha256**,
notes); `GET /download` streams the newest; the landing adapts its badges.
Release ritual:

1. `cd mobile && eas build --profile production-apk --platform android` for `/download`; build `--profile store-apk` for the universal store artifact.
2. Download the APK; note the EAS-assigned versionCode (§6.3).
3. Upload through the admin "App releases" page — **verify the recorded
   sha256** matches a locally computed one (`sha256sum` on the file) so
   `/download` and every store receive identical bytes.
4. Publish the sha256 next to the `/download` link (release notes) so anyone
   can verify a mirror or a scraped copy.
5. Upload the **same file** to each store (unless the store re-signs — §6.2).
6. After stores approve, optionally set `PLAY_STORE_URL` on the VPS to your
   primary store listing so share pages (`/r`, `/p`) banner Android-browser
   visitors to it (`backend/config/recipereal.php`). Leave empty to keep
   pointing them at `/download`.

---

## 7. Android Developer Verification (OS-level — new, do not confuse with Play)

Separate from any store: Google's **Android Developer Verification** program
gates *sideloaded and third-party* apps on certified Android devices.

- **Enforcement began 30 September 2026** in **Brazil, Indonesia, Singapore,
  and Thailand**: on certified devices there, apps signed by *unregistered*
  developers are restricted (users face a more involved install flow or
  refusal).
- **Global expansion is expected through 2027.** Egypt/MENA is not in the
  first wave today, but your audience's devices will eventually enforce it —
  and store reviewers worldwide may already be on enforcing devices.
- **Register the package before the global wave hits:** a free
  **limited-distribution** developer registration exists for students and
  hobbyists (~20 devices) with an **advanced install flow** for slightly
  wider reach; full registration removes the cap. Program details, regional
  timing, and tiers are still evolving — **confirm the current tiers and the
  registration portal at submission time** via the Android developer help hub
  ([support.google.com/googleplay/android-developer](https://support.google.com/googleplay/android-developer) — search "Android
  Developer Verification").
- Registration is per developer + package name (`com.recipereal.app`). Do it
  **[account]** once, early, so the 2027 expansion never retroactively breaks
  your installed base. Budget an hour for identity verification.

---

## 8. Per-store checklists

Recommended order: **APKPure → Uptodown → Samsung → Xiaomi → Huawei → Amazon**
(free, highest MENA reach first). Aptoide is now paid; F-Droid and APKMirror
are not options (below). For every store: **confirm current fees and
requirements in the portal at submission time** — every line below is policy
as of November 2026 and portals change quietly.

### 8.1 APKPure — first, free, fastest

- Portal: [https://apkpure.com/submit-apk](https://apkpure.com/submit-apk) ·
  Account: free developer registration · Fee: none known.
- [ ] Register; verify email **[account]**.
- [ ] Search APKPure for "RecipeReal" / `com.recipereal.app` first — if a
      scraped listing already exists, use their claim/verify flow instead of a
      duplicate (§10.3).
- [ ] Upload the EAS `store-apk` (universal) build; APKPure does not re-sign
      (confirm at upload) — same signature as the other store builds.
- [ ] Fill listing (§9). EN+AR description is accepted; screenshots EN set.
- [ ] Review notes: paste §3 script + test account.
- [ ] Expect automated scanning (virus/malware heuristics); a clean
      permission set (§4) passes easily.

### 8.2 Uptodown — free, big MENA traffic

- Portal: [https://en.uptodown.com/developers-console](https://en.uptodown.com/developers-console)
  (Developers Console) · Account: free · Fee: none known.
- [ ] Register a developer account **[account]**.
- [ ] Check for an existing scraped listing; claim if present.
- [ ] Upload the same APK; Uptodown keeps developer signatures (confirm).
- [ ] Listing EN (+AR where the console supports localized listings).
- [ ] Review notes: §3 script + test account.

### 8.3 Samsung Galaxy Store — free, no annual fee, verification-heavy

- Portal: [https://seller.samsungapps.com](https://seller.samsungapps.com) ·
  Account: free; **commercial-seller verification** required (D-U-N-S number
  or the portal's alternative verification path for your region — **confirm
  which alternative documents Egypt accepts at signup**).
- [ ] Register as a seller; complete identity/business verification
      **[account]** — this is the slow step; start it in parallel with §2.
- [ ] Upload the same `store-apk` APK (Samsung does not re-sign — confirm).
- [ ] Content rating + UGC answers per §5; Samsung reviews UGC apps more
      strictly than APKPure.
- [ ] Listing: EN+AR assets supported per-store-language; category
      Food & Drink.
- [ ] Review notes: §3 script + test account.

### 8.4 Xiaomi GetApps — large installed base, requirements vary

- Portal: Xiaomi developer console ([https://global.developer.mi.com/](https://global.developer.mi.com/)) ·
  Fee: none known.
- [ ] **Check the current individual vs. business account requirements in the
      portal at submission time** — Xiaomi has at times required business
      licenses for individual developers and account-review queues are slow.
- [ ] Register **[account]**; expect ID verification.
- [ ] Upload the same `store-apk` APK; confirm whether GetApps re-signs
      (policy has varied; if re-signed, follow §6.2 including the assetlinks
      fingerprint).
- [ ] Review notes: §3 script + test account.

### 8.5 Huawei AppGallery — free, identity verification, no Google services

- Portal: [https://developer.huawei.com](https://developer.huawei.com) ·
  Account: free; individual identity verification (ID/passport) **[account]**.
- **Device reality:** Huawei devices have no Google Play services. RecipeReal
  is well-positioned: Google sign-in runs in the **system browser**
  (`WebBrowser.openAuthSessionAsync`), not through Google Play services, and
  OTA uses Expo's own servers — nothing requires GMS. Verify sign-in once on a
  real Huawei device if possible.
- [ ] Complete identity verification.
- [ ] Upload the `store-apk` APK through AppGallery Connect.
- [ ] **Confirm AppGallery's current signing policy** — Huawei has re-signed
      submissions; if so, that build cannot cross-update with the others and
      needs its fingerprint in `APP_LINKS_SHA256` (§6.2).
- [ ] Review notes: §3 script + test account; mention the app works without
      Google services.

### 8.6 Amazon Appstore — free developer account, Fire OS quirks

- Portal: [https://developer.amazon.com/apps-and-games](https://developer.amazon.com/apps-and-games) ·
  Account: free **[account]**.
- [ ] Register the developer account.
- [ ] Upload the `store-apk` APK through the Amazon developer portal.
- [ ] **ABI:** use the universal `store-apk` build. The `production-apk`
      profile is `arm64-v8a`-only and would refuse to install on 32-bit Fire
      tablets; `store-apk` includes all four ABIs, so it covers the Fire fleet.
- [ ] Amazon **re-signs submissions** (historically; confirm) → §6.2
      consequences (no cross-store updates; add fingerprint to
      `APP_LINKS_SHA256`).
- [ ] Amazon runs its own crash/testing pipeline on Fire devices; expect an
      automated test report before approval.
- [ ] Review notes: §3 script + test account.

### 8.7 Aptoide — now paid

- Portal: [https://connect.aptoide.com/](https://connect.aptoide.com/) ·
  Aptoide Connect moved to a **paid subscription (~US$69/year)**. Only worth
  it if Aptoide analytics/reach matter to you; otherwise skip. **Confirm the
  current price in the portal at signup** — treat the figure as approximate.

### 8.8 F-Droid — NOT eligible

- [https://f-droid.org](https://f-droid.org) distributes **free and
  open-source apps only**, built reproducibly from source. RecipeReal is
  closed-source (private repo, proprietary backend) — **not eligible**. The
  largest community repository (IzzyOnDroid) has the same open-source
  requirement. Do not spend time here.

### 8.9 APKMirror — no developer uploads

- [https://www.apkmirror.com](https://www.apkmirror.com) is a curated mirror
  (historically of Play Store releases) with **no developer submission
  channel** for direct-distribution apps — **do not plan around it**. If a
  RecipeReal copy ever appears there scraped from another store, use their
  takedown/claim contact. Confirm current policy if it matters.

---

## 9. Store listing fields and asset specs

Prepare once, reuse everywhere. The committed `store/` folder holds the EN/AR
listing copy, the 512 icon, the feature graphic, and the screenshot capture
script. Generated screenshots belong in a local output directory (they bloat
the repo); `store/screenshots/capture-screenshots.sh` writes there and the
output folder should stay untracked.

### 9.1 Assets

| Asset | Spec | Notes |
|---|---|---|
| App icon | **512×512** PNG (32-bit) | From `mobile/assets/images/icon.png`; do not bake rounded corners — stores mask |
| Feature graphic | **1024×500** PNG/JPG | The Play-standard banner most stores also accept; claim-vs-reality visual; no text smaller than ~40px |
| Phone screenshots | 1080×1920 PNG, **at least 4–8** | Recipe list → recipe detail (claim vs reality) → Cook Mode → feedback → community → settings. One **AR set** and one **EN set** for stores that take localized media |
| Short description | ≤ 80 chars (EN) + AR | e.g. EN: "Honest cook times for real kitchens — measured in Cook Mode. Offline, EN/AR." + AR equivalent |
| Full description | ~500–1000 chars, EN + AR | Lead with the mechanism (claim vs measured reality), offline library, bilingual. **Owner's positioning (2026-11-05): do not lead with halal** — it is table stakes for the audience, not a selling point. Keep the content filter as an internal policy, not store copy. Use "20,000+ recipes" only; do not use precise step counts until production is verified. **No invented testimonials, ratings, or download counts** |
| Category | Food & Drink | Some portals: "Lifestyle → Food & Drink" |
| Contact email | Owner support address | Same one as the consent screen support email and `/contact` page |
| Privacy policy URL | `https://recipe-real.softland.tech/privacy` | |
| Account deletion URL | `https://recipe-real.softland.tech/account/delete` | Verify live (§1) |
| Terms URL | `https://recipe-real.softland.tech/terms` | Where asked |
| Website | `https://recipe-real.softland.tech` | |

### 9.2 Data-safety-style answers (honest, reusable)

| Question | Answer |
|---|---|
| Data collected | Email + name + avatar (via Google sign-in); optional gender (profile field only); user-generated content you write (posts, comments, tries); **images you upload** (avatar, recipe/post attachments); cook-session measurements tied to your account; **install identifier** — a long-lived on-device counter, linked to your account while signed in, surviving account deletion as an unlinked counter |
| Data used for | Account, showing your content, calibrating *your* cook-time estimates, app improvement |
| Data shared | Not sold; no ad networks; no third-party analytics SDKs — analytics go to our own backend |
| Local data | Offline recipe library (SQLite) and settings stay on-device; `allowBackup` is false |
| Retention/deletion | Full account deletion in-app or via the web request form; analytics events are anonymized on deletion and pruned after 90 days. Community recipes you authored remain with the author link removed; uploaded files may persist in storage/backups (disclose this if the form asks for detail). The install identifier survives deletion as an unlinked counter |
| Security | All traffic over HTTPS; Google ID tokens verified server-side (signature, audience, nonce) |
| Permissions | See §4 table — notifications + exact alarms (cooking); photo-library access only, camera/microphone disabled, legacy storage permissions blocked; **no foreground service** |

Do **not** claim "no data collected" — Google-auth email alone makes that
false, and stores cross-check the APK.

---

## 10. Post-publish operations

### 10.1 Update cadence

- **OTA (`eas update --branch production`)**: JS/asset fixes only; arrives on
  next app launch (`checkAutomatically: ON_LOAD`). No store review. First
  choice for bug fixes and copy changes.
- **APK release**: monthly-ish, or immediately for native/permission changes.
  Every APK: bump versionName, note the EAS versionCode (§6.3), upload to
  **every** store + `/download`, publish sha256. Keep a small changelog note
  per release in the AppRelease `notes` field.
- Keep all stores within one version of each other where possible; lagging
  stores accumulate one-star "outdated" reviews.

### 10.2 OTA vs. APK decision

| Change | Ship via |
|---|---|
| Text, layout, colors, logic bugs, recipe data | OTA |
| New JS feature | OTA (+ staged rollout via expo-updates branches if cautious) |
| New/changed native dependency, permission, target SDK | APK (OTA cannot — fingerprint changes) |
| versionCode / package changes | APK, all stores |

### 10.3 Claim scraped listings

Third-party stores and mirror sites scrape popular APKs without asking.
**Monthly, cheap check:** search "RecipeReal" and `com.recipereal.app` on
APKPure, Uptodown, Aptoide, APKMirror, and a web search. If a listing you did
not create exists: use the store's claim/developer-verification flow (you can
prove ownership via the signing key and the `/download` domain), or request
takedown at mirrors. A stale scraped copy serving an old version is your worst
review magnet.

### 10.4 Monitoring

- Each portal has a reviews/comments feed — check weekly, respond in the
  user's language (EN or AR). A solo operator answering Arabic reviews fast is
  a genuine differentiator in MENA listings.
- Watch crash reports where the store provides them (Amazon does; APKPure/
  Uptodown less so). Your own backend funnel: `php artisan recipereal:stats`
  on the VPS (`docs/deploy.md`).
- After any store re-signs a build (§6.2), verify deep links (`/r`, `/p`)
  still open the app on that store's build; if not, add the fingerprint to
  `APP_LINKS_SHA256` and redeploy.

---

## 11. What the owner must do manually (**[account]** — nothing below can be done from the repo)

Ordered; parallelize where noted.

1. **Publish the Google OAuth consent screen to production** (§2) — highest
   priority; everything else gates on it.
2. **Register for Android Developer Verification** with
   `com.recipereal.app` (§7) — before the 2027 global wave.
3. **Create the dedicated review Google account**, sign in once, keep
   credentials for review notes (§3).
4. **Secure the EAS keystore**: `eas credentials` → back up keystore +
   passwords (password manager + offline). Decide the account-revert plan if
   the borrowed EAS account situation changes (§6.1).
5. **Run the EAS build + login** (`eas login`), then
   `eas build --profile store-apk --platform android` for stores and
   `eas build --profile production-apk --platform android` for `/download`.
   Download each APK, record its versionCode and sha256 (§6.3, §6.5).
6. **Create store developer accounts** in order: APKPure, Uptodown, Samsung
   (start verification early), Xiaomi, Huawei, Amazon (§8). Have ID documents
   ready for Samsung/Huawei/Xiaomi verification.
7. **Upload** the same APK + listing assets (§9) to each store; paste the
   review script + test account into each review-notes field.
8. **Keep the keystore safe forever** — the app's entire update history across
   every channel depends on it.
9. **Post-publish**: monitor reviews weekly, claim scraped listings monthly,
   keep every store current (§10).

---

## Appendix — uncertainty register (things to re-confirm, not trust)

| Claim in this doc | Confidence | Re-confirm where |
|---|---|---|
| All store fees ("free") except Aptoide (~US$69/yr) | Medium — policy-drift prone | Each portal at signup |
| Samsung seller verification options (D-U-N-S or alternative) for Egypt | Medium | Seller Portal registration flow |
| Xiaomi GetApps individual/business requirements | Low — intentionally left open | global.developer.mi.com console |
| Amazon/Huawei re-signing policy | Medium (historically yes) | Each portal at upload; then update `APP_LINKS_SHA256` |
| APKPure/Uptodown/Samsung/Xiaomi not re-signing | Medium | Each portal at upload |
| Aptoide Connect price (~US$69/yr) | Low–Medium | Aptoide portal |
| APKMirror "no developer uploads" | Medium | Their FAQ if it ever matters |
| Android Developer Verification tiers (free 20-device limited account, advanced install flow) and 2027 expansion schedule | Medium — the program is young | Android developer help hub at registration |
| Google consent: non-sensitive scopes publish without full verification | High, but not guaranteed | Console publish flow |
| Fire OS compatibility | Resolved for store uploads by the universal `store-apk` profile; verify on a real Fire device | Amazon's device list + a real Fire device |
| `/account/delete` web page live | Verified in this repo (page + request form + tests, 2026-11-05); still curl the production URL before filling store forms | Production browser |
| Graceful signed-out Cook Mode completion | Implemented 2026-11-05 (finished cook queued locally; done screen asks for sign-in) | Release build before submitting |
| Exact versionCode EAS assigns to the next build | Unknown until built | EAS build page after each build |

*Nothing above has been submitted, published, or communicated to any store.
This runbook was written from the repository state of November 2026; code
references cite the files this doc was written from.*
