# RecipeReal — Store submission kit

Everything needed to submit RecipeReal 1.1.0 to third-party Android stores:
APKPure, Uptodown, Samsung Galaxy Store, Xiaomi GetApps, Huawei AppGallery,
and Amazon Appstore. Google Play is explicitly out of scope (direct/sideload
distribution remains the primary channel).

## What is in this directory

```
store/
├── README.md                        ← this checklist
├── listing-en.md                    ← English listing copy (paste-ready)
├── listing-ar.md                    ← Arabic listing copy (MSA, paste-ready)
├── assets/
│   ├── icon-512.png                 ← 512×512 PNG app icon (from mobile/assets/images/icon.png)
│   ├── feature-graphic-1024x500.png ← 1024×500 PNG, brand palette
│   └── generate-assets.py           ← regenerates both PNGs (see below)
└── screenshots/
    ├── README.md                    ← how to produce real screenshots
    └── capture-screenshots.sh       ← adb + ImageMagick capture pipeline
```

## Shared listing data (all channels)

| Field | Value |
| --- | --- |
| App name | RecipeReal |
| Package name | com.recipereal.app |
| Version | 1.1.0 |
| Category | Food & Drink |
| Price | Free (no in-app purchases live in this build) |
| Privacy policy | https://recipe-real.softland.tech/privacy |
| Account deletion | https://recipe-real.softland.tech/account/delete |
| Contact | https://recipe-real.softland.tech/contact |
| Website | https://recipe-real.softland.tech |
| Minimum Android | 7.0 (API 24) |
| Languages of the listing | English and Arabic |

## Per-channel checklists

Store consoles change their forms frequently. Treat each checklist below as the
preparation list; re-verify field labels and pixel limits in the console at
submission time. Common to every channel:

- [ ] Signed `store-apk` (universal) release for `com.recipereal.app` version `1.1.0` built and tested.
- [ ] Privacy policy URL live and reachable (`/privacy`).
- [ ] Account-deletion URL live and reachable (`/account/delete`) — it must
      exist **before** the first submission, not after.
- [ ] Icon, feature graphic, and the real screenshot set from `screenshots/`.
- [ ] Listing copy pasted from `listing-en.md` / `listing-ar.md` without edits
      beyond store field limits.

### APKPure

- [ ] Developer account registered and verified.
- [ ] Upload the `store-apk` (universal) APK — APKPure distributes the raw APK; no AAB.
- [ ] Icon 512×512 PNG (`assets/icon-512.png`) and feature graphic
      1024×500 PNG (`assets/feature-graphic-1024x500.png`).
- [ ] 2+ screenshots (1080×1920 or 1080×2400 from `screenshots/`).
- [ ] EN + AR listing copy; privacy policy URL field filled.
- [ ] Confirm "free" pricing; no ads declaration (the app has no ad SDK).

### Uptodown

- [ ] Developer account registered (they review publishers manually).
- [ ] Upload the `store-apk` (universal) APK; Uptodown repackages/downloads directly.
- [ ] Screenshots (they prefer real UI, min ~2, landscape or portrait).
- [ ] EN listing copy first; AR copy in the localized-description field if offered.
- [ ] Privacy policy URL filled; app description must not reference other stores.

### Samsung Galaxy Store

- [ ] Samsung seller account registered (commercial seller; seller agreement;
      a payout profile may be required even for free apps — confirm at signup).
- [ ] Upload APK or AAB for `com.recipereal.app`.
- [ ] IARC content-rating questionnaire completed — answer truthfully; the
      app contains food content and community posts (UGC), which may affect
      the final rating.
- [ ] Privacy policy URL **and** a support contact (URL or email) filled.
- [ ] Default-language listing EN + AR localized listing if the console offers it.
- [ ] Screenshots (their console accepts 16:9 portrait; 1080×1920 works) and
      a feature/graphic banner per their current form.

### Xiaomi GetApps

- [ ] GetApps developer account registered (via the Xiaomi developer console).
- [ ] Upload the `store-apk` (universal) APK; package name must match exactly.
- [ ] Privacy policy URL mandatory; account-deletion URL/supported path
      mandatory (data-privacy review is strict).
- [ ] EN + AR listing copy; screenshots 1080×1920.
- [ ] Content declaration: no ads, no payment features live.

### Huawei AppGallery

- [ ] Huawei developer account registered (identity verification required).
- [ ] Upload the `store-apk` (universal) APK (AppGallery also accepts AAB via
      their cloud build — use APK for simplicity).
- [ ] Privacy policy URL mandatory; fill their data-safety/privacy form:
      declare community content (posts, comments), account data, and the
      deletion path (`/account/delete` and in-app Settings → Danger zone).
- [ ] Content rating questionnaire (expected Everyone, declare UGC).
- [ ] EN + AR listing copy and screenshots (their form asks for at least 3–5).

### Amazon Appstore

- [ ] Amazon developer account registered.
- [ ] Upload the `store-apk` (universal) APK (Amazon accepts APK; AAB support
      exists — APK is fine).
- [ ] App icon 512×512 and screenshots (Amazon asks for at least 3).
- [ ] EN listing copy; AR via localized listings if enabled for the marketplace.
- [ ] Content rating questionnaire (their own "content survey").
- [ ] Amazon runs their own compatibility tests — expect a first-review delay.

## Required assets and screenshot sizes

| Asset | Size | File |
| --- | --- | --- |
| App icon | 512×512 PNG | `assets/icon-512.png` |
| Feature graphic | 1024×500 PNG | `assets/feature-graphic-1024x500.png` |
| Phone screenshots | 1080×1920 PNG (min set of 8) | `screenshots/` output |
| Tall-phone screenshots | 1080×2400 PNG (optional second set) | `screenshots/` output (`--size 1080x2400`) |

A few consoles want a smaller icon preview (e.g. 192×192 or Samsung's legacy
sizes); generate any derivative from `assets/icon-512.png` at submission time
rather than keeping duplicates here.

## Regenerating the icon and feature graphic

Both PNGs are produced by one committed script (Python 3.8+ with Pillow,
no network, no installs beyond Pillow):

```bash
python3 store/assets/generate-assets.py
```

- `icon-512.png` is a LANCZOS resize of `mobile/assets/images/icon.png`
  (1024×1024 → 512×512, no distortion, RGB).
- `feature-graphic-1024x500.png` composites `mobile/assets/images/recipereallogo.png`
  on the brand canvas with the palette from `mobile/src/theme/tokens.ts`:
  canvas `#FAF8F5`, ink `#241D17`, accent `#E86A33`, timing teal `#287C78`
  (teal is used only for the time-truth line, per DESIGN.md's reservation rule).
- Fonts: this machine ships **no DejaVu**, so the script resolves DejaVu first
  (if installed later), then Bitstream Vera — the typeface DejaVu Sans derives
  from — then Open Sans. The wordmark uses the brand face Fraunces (weight 640,
  optical size 144, per DESIGN.md) when available.

## ⚠️ Screenshots must be REAL app UI

`docs/screens-preview.png` is an **old blue marketing mockup** from an earlier
design. It is NOT the current app and must never be submitted as a screenshot.
Every screenshot on every store must be captured from the running 1.1.0 app —
use `screenshots/capture-screenshots.sh`, which refuses to run without a
connected device precisely so nobody is tempted to fake frames. Also keep the
captured frames honest: signed into a real (or clearly test) account, no
Photoshop, no invented numbers on screen.

## Copy rules for anyone editing the listings

- Positioning decision (2026-11-05): **do not lead with halal**. For this
  audience it is table stakes, not a selling point. Keep the listing on honest
  cook times, offline, community, EN/AR, free tier, Premium planned. The
  in-app content filter is not mentioned in store copy.
- The library figure is "~20,089 recipes"; use "20,000+ recipes" **only** as a
  statement of library size. Do not quote step counts until production is
  verified — PRODUCT.md and the code comments disagree.
- No testimonials, user counts, ratings, rankings, or benchmark claims anywhere.
- Arabic copy is MSA and must stay claim-identical to the English listing.

## Known caveats before submitting

1. **"What's new" for 1.1.0** lists the verified feature set of the build, not a
   code-level delta — no changelog exists in the repo. Replace with the real
   release notes if the owner has them.
2. **Contact**: the public contact is the `/contact` form; the privacy page
   publishes `mamounprogrammer@gmail.com`. If a console demands an email
   address (Samsung and Amazon usually do), use that address.
3. **Account deletion URL** (`/account/delete`) is live in this repo
   (2026-11-05, page + request form + tests); curl the production URL before
   submitting anywhere.
4. **Premium wording**: checkout is not live in 1.1.0, so the listings say
   "free … Premium planned" without prices. Revisit if IAP ships.
