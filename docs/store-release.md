# RecipeReal — third-party store release runbook

RecipeReal is distributed as a sideloaded APK (no Google Play). Besides our
own `GET /download` page, the app ships through third-party Android stores:
**APKPure, Uptodown, Samsung Galaxy Store, Xiaomi GetApps, Huawei
AppGallery, Amazon Appstore**. This runbook covers building, verifying,
signing, publishing, and updating those binaries.

Related: `docs/deploy.md` (backend), `docs/launch.md` (original EAS notes).

## Two build profiles, one app

| Profile | ABIs | Approx. size | Use for |
|---|---|---|---|
| `production-apk` | `arm64-v8a` only | ~25–30 MB compressed | Our `GET /download` sideload flow — every real phone since ~2016 is arm64. |
| `store-apk` | `armeabi-v7a` + `arm64-v8a` (the two real-world ARM ABIs; x86 emulator slices dropped) | ~35–45 MB compressed | Store uploads: covers every real phone (incl. the 32-bit tail common in MENA) at a fraction of the universal size. x86 devices are emulators/rare tablets — not a store-review surface. |

```bash
cd mobile
eas build --profile production-apk --platform android   # arm64-v8a only, ~25–30 MB
eas build --profile store-apk --platform android        # v7a+arm64, ~35–45 MB
```

> **Why `store-apk` keeps the two ARM ABIs:** the profile sets env
> `RECIPE_REAL_STORE_ABI=arm`, which `mobile/plugins/arm64-only.js` reads
> to package `armeabi-v7a` + `arm64-v8a` (the 32-bit tail is real in MENA;
> x86 slices only serve emulators). Do NOT rename this profile to anything
> starting with `production` — that would silently shrink it to
> arm64-only.
>
> **ABI overrides (env), each beating the profile heuristic:**
> `RECIPE_REAL_UNIVERSAL_ABI=1` forces all four ABIs, `RECIPE_REAL_ARM64_ONLY=1`
> forces arm64-only, `RECIPE_REAL_STORE_ABI=arm` forces v7a+arm64. Useful
> for local prebuild/gradlew runs; the `unzip -l` check below still applies.
>
> **Native-lib compression:** `useLegacyPackaging: true` in
> `app.config.js` (expo-build-properties) compresses the `.so` entries —
> that plus the ABI trim is why store APKs dropped from ~112 MB to roughly
> a third of that. Trade-off: first launch extracts the libs to disk and
> starts marginally slower; download size is the priority for a sideloaded
> app.

## Verify the APK ABIs (always, before uploading)

```bash
unzip -l RecipeReal.apk | grep lib/
```

Expected output per profile:

- `production-apk` → **only** `lib/arm64-v8a/` entries (one directory).
- `store-apk` → exactly two: `lib/armeabi-v7a/` and `lib/arm64-v8a/`.

If a `store-apk` build shows `lib/x86*/` entries or a single
`lib/arm64-v8a/`, the plugin scoping broke (profile renamed, plugin logic
changed, or env overrides set) — fix before uploading.

## Versioning (`appVersionSource: "remote"`)

`mobile/eas.json` sets `cli.appVersionSource: "remote"`, so **EAS owns
`android.versionCode`**: every remote build auto-increments it, and we
never write `android.versionCode` into `app.config.js`.

- **Display version** (`version` in `mobile/app.config.js`) is bumped
  manually once per store release — `1.0.0` → `1.1.0` for the first
  store-prep release.
- **`versionCode` only ever increases.** Never reuse or decrease it: a
  repeated code makes an update on one channel silently fail to install
  over another channel's build. Don't switch `appVersionSource` to local
  or hand-pin codes to "reset" the counter.
- Every `eas build` burns a new `versionCode` — avoid throwaway rebuilds.
  Build **once per release per profile** and reuse that exact artifact
  everywhere. A fixed build order per release (e.g. `store-apk` first,
  then `production-apk`) keeps each channel's codes monotonically
  increasing.
- Record the build's `versionCode` (EAS build detail page or
  `eas build:list`) with the release notes, and note which store got
  which build.

## Signing key custody

- The Android keystore is **EAS-managed**. Inspect it with
  `eas credentials -p android` — run this from the normal checkout; never
  accept a prompt to *generate* a new keystore, that would orphan every
  installed build.
- **One signing key for every channel**: our `GET /download` APKs and all
  six stores must be signed identically. Android only installs an update
  when the package name (`com.recipereal.app`) **and** signing certificate
  match; a different key forces users to uninstall first.
- **Never lose the keystore.** Losing it permanently breaks in-place
  updates for the installed base. Keep an offline backup (keystore file +
  alias/passwords, e.g. password manager + cold storage) and test a
  restore once.
- **Some stores re-sign uploads** (Amazon Appstore historically does).
  A re-signed build can only be updated by another build from that same
  store, so moving a user between the store build and our sideload build
  requires an uninstall/reinstall. OTA updates still work on re-signed
  builds (expo-updates does not check the APK signature); the next
  *binary* update on that channel must come from the same store.

## Artifact checks & admin upload

Run for every released APK, before it leaves the machine:

```bash
sha256sum RecipeReal.apk | tee RecipeReal-<version>.sha256   # archive next to the APK
ls -lh RecipeReal.apk                                        # size sanity (see table above)
curl -I https://recipe-real.softland.tech/download           # after upload: 200 + Content-Length
```

The binary intended for the sideload flow is uploaded on the admin
panel's **App releases** page (Filament → App releases). It lands in the
`app_releases` table; `GET /download` streams the newest release to the
app and the landing-page badges, and each release's file is also served
from `GET /admin/app-releases/{release}/download`.

Keep the exact APK + its sha256 for **every** release — including store
builds that never go through the admin panel. Stores occasionally ask
"what exactly did you ship?" months later; the checksum is the proof.

## OTA updates vs store binaries

- `expo-updates` (`eas update`) ships **JS + assets only** — it can never
  change native code, permissions, or the app icon. Both profiles publish
  to the same `channel: "production"`, but OTA delivery is gated by the
  **runtimeVersion fingerprint**, not the channel alone: verify that the
  `production-apk` and `store-apk` builds report the same fingerprint
  before assuming one update reaches both. If the ABI list is part of the
  fingerprint and they differ, publish per runtime version (or use the same
  ABI for both profiles).
- `runtimeVersion.policy` is `"fingerprint"` in `app.config.js`: an OTA
  bundle only downloads onto binaries whose native fingerprint matches.
  **Any native change** (new native module, Expo SDK bump, permission,
  native config) produces a new fingerprint — old binaries stop matching
  and the change **requires a new APK** on every channel, stores included.
  A re-signed store build still receives OTA updates: the fingerprint, not
  the APK signature, decides compatibility.
- Stores review the binary they were handed; OTA lets us hotfix JS without
  re-uploading to six consoles. Still ship a store build for every
  meaningful release so the listings stay current.

## Enable OTA code signing (recommended before public launch)

`expo-updates` can require every OTA manifest to be cryptographically
signed; on-device, bundles whose signature does not verify are rejected.
Without it, anyone who compromises the update pipeline could push arbitrary
JS to every installed binary. **No signing key exists yet** —
`mobile/app.config.js` is deliberately not wired for it; do this once
before public launch and ship it in the next **APK** release (it changes the
native config, so the runtimeVersion fingerprint changes and OTA alone can
never deliver it).

1. **Generate the key pair** (one-time; keep both outputs out of git):
   ```bash
   npx expo-updates codesigning:generate \
     --key-output ./updates-codesign/keys \
     --certificate-output ./updates-codesign/certificates
   ```
   Verify the exact flags/options against the Expo SDK 57 docs
   (docs.expo.dev → EAS Update → Code Signing) before running.
2. **Point the app config at the certificate** (only after step 1) in
   `mobile/app.config.js`:
   ```js
   updates: {
     // ...existing url/checkAutomatically/fallbackToCacheTimeout stay...
     codeSigningCertificate: "./updates-codesign/certificates/certificate.pem",
     codeSigningMetadata: { keyid: "main", alg: "es256" },
   }
   ```
   (`alg: "es256"` = ES256, the JWS algorithm Expo generates for new key
   pairs.)
3. **Store the private key in EAS secrets** — EAS Build and `eas update`
   read it from the build/publish environment, never from the repo:
   ```bash
   eas secret:create --scope project --name EXPO_UPDATES_PRIVATE_KEY \
     --value "$(cat ./updates-codesign/keys/<generated-private-key-file>)"
   ```
   If the generated key is password-protected, also store
   `EXPO_UPDATES_PRIVATE_KEY_PASSWORD`. Confirm the exact variable names
   in the same Expo guide.
4. **Verify:** publish a trivial update (`eas update --branch
   production`) to a device on the newest binary and confirm it installs;
   then confirm an unsigned/tampered manifest is rejected.
5. **Custody:** the private key *is* update trust — back it up with the
   same discipline as the Android keystore (§ Signing key custody). Losing
   it means you cannot sign further updates; rotating means a new key pair,
   a new certificate + `keyid`, and another APK to deliver it.

## Pre-upload checklist

- [ ] `python3 -m json.tool mobile/eas.json` passes (all profiles intact).
- [ ] Display `version` in `mobile/app.config.js` bumped for this release.
- [ ] Built from a clean `main` — no local experiments in the artifact.
- [ ] `unzip -l RecipeReal.apk | grep lib/` shows the expected ABIs
      (all four for `store-apk`, only arm64-v8a for `production-apk`).
- [ ] `sha256sum` recorded; APK + checksum archived per release.
- [ ] If it's the `/download` release: uploaded on admin **App releases**;
      `curl -I https://recipe-real.softland.tech/download` shows it;
      fresh-install and update-over-previous both tested on a real device.
- [ ] After uploading: `cd backend && php artisan recipereal:store-check`
      passes every required check (it also warns about the two things it
      cannot verify: the Google OAuth consent-screen status and Android
      Developer Verification).
- [ ] The **same** APK file (one `versionCode`) uploaded to all stores;
      versionCode + build URL noted per store.
- [ ] Store listing ready: EN + AR title/description, screenshots,
      privacy policy URL, package `com.recipereal.app`.
- [ ] Post-publish smoke test: arm64 phone, and for `store-apk` also a
      32-bit or x86 emulator.
