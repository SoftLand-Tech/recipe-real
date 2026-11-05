# RecipeReal — Screenshot capture kit

Produces store-ready screenshots of the **real 1.1.0 app UI** on a device or
emulator, one PNG per screen, normalized to exact store dimensions.

> **Never submit mockups.** `docs/screens-preview.png` is an old blue marketing
> comp, not the shipping app. Store policy (and honesty) requires real frames.

## Prerequisites

1. A device or emulator running RecipeReal 1.1.0 (installed via the release
   APK), logged into a real or clearly-test account.
2. `adb` on PATH or at `$ANDROID_HOME/platform-tools/adb`
   (this machine: `~/Android/Sdk/platform-tools/adb`).
3. ImageMagick (`magick` or `convert`) for normalization.
4. USB debugging enabled (device) — or just an emulator.

The script checks all of these and exits with a clear error before doing
anything if any is missing. It never touches the network and never modifies
the device beyond reading the screen.

## Usage

```bash
cd store/screenshots
./capture-screenshots.sh                     # 1080×1920 output (default)
./capture-screenshots.sh --size 1080x2400    # tall-phone set
./capture-screenshots.sh --fit crop          # center-crop instead of pad
./capture-screenshots.sh --serial emulator-5554
./capture-screenshots.sh --lang ar           # repeat for the Arabic set
./capture-screenshots.sh --out ../../tmp-shots
```

Run it once with the app in English (`--lang en`, the default) and once with
the app in Arabic (`--lang ar`) so each store can get localized screenshots.

## The eight screens and how to reach them manually

The app is bilingual and RTL in Arabic — tab bars mirror. English labels below;
Arabic labels in parentheses come from `mobile/src/i18n/ar.ts`.

| # | File | Screen | How to get there |
| --- | --- | --- | --- |
| 1 | `01-home.png` | Home | Bottom tab **Home** (الرئيسية). Show a recipe card with its honest-times info. |
| 2 | `02-browse.png` | Browse | Bottom tab **Browse** (استعراض). |
| 3 | `03-recipe-detail.png` | Recipe detail | From Home ("Top picks today") or Browse, tap any recipe card. Show the claim vs. "Really takes" area. |
| 4 | `04-cook-mode.png` | Cook Mode | On a recipe, tap **Start cooking** (ابدأ الطهي). Capture with a step and the stopwatch visible. |
| 5 | `05-feedback.png` | Feedback (post-cook) | Finish the cook (Finish → confirm) to reach the **"How did it feel vs. the estimate?"** prompt (كيف كانت مقارنةً بالتقدير؟). |
| 6 | `06-community.png` | Community | Bottom tab **Community** (المجتمع). |
| 7 | `07-pace.png` | Pace | Bottom tab **Settings** (الإعدادات) → the **Your Pace** row (وتيرتك). Capture whatever state is true for the account (signed-out prompt or real pace data). |
| 8 | `08-settings.png` | Settings | Bottom tab **Settings** (الإعدادات). |

The script walks you through these one at a time and waits for you to press
Enter after you navigate — nothing is captured until you say so. You can skip a
screen (`s`) or abort (`q`) at any prompt.

## What the script does to each capture

1. `adb exec-out screencap -p` → lossless PNG of the current screen.
2. The frame is fitted to the exact output size with no distortion:
   - `--fit pad` (default): scale to fit **entirely inside** the target, then
     letterbox the remainder on the app's canvas color `#FAF8F5`. Nothing is
     lost — e.g. a 1080×2400 capture becomes 864×1920 content centered between
     canvas side bars in a 1080×1920 frame.
   - `--fit crop`: scale to **cover** the target, then center-crop the
     overflow — full-bleed frames (e.g. 1080×2400 → 1080×1920 loses the top and
     bottom 240 px). Inspect the result so no important UI was cropped.
3. Every output is exactly the requested size (checked with `magick identify`
   as it saves).

## Honest-capture rules

- Real app, real screens, real data states. No compositing, no retouching.
- Enable Do Not Disturb so notifications don't land mid-capture.
- Prefer a signed-in account whose posts/profile you're happy to show publicly,
   or stay signed out where the screen allows it.
- The Pace screen is available to any signed-in user (an anonymous cook is
   queued locally and syncs after sign-in); capture the real state, don't fake
   unlocked data.
- Review every PNG (`xdg-open` / gallery) before uploading to any store.
