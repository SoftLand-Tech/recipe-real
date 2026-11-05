#!/usr/bin/env bash
#
# capture-screenshots.sh — RecipeReal store-screenshot pipeline.
#
# Walks you through the eight store screens one at a time, captures each with
# adb, and normalizes every frame to an exact store size with ImageMagick.
# Nothing is captured until you press Enter at a prompt, so you always control
# which screen is in the frame. Real app UI only — see README.md in this
# directory before using the output anywhere.
#
# Usage:
#   ./capture-screenshots.sh [options]
#
# Options:
#   --out DIR        output directory (default: ./captures, created if absent)
#   --size WxH       exact output size (default: 1080x1920; e.g. 1080x2400)
#   --fit pad|crop   how the frame reaches the exact output size:
#                    pad (default) scales to fit inside the target and
#                    letterboxes on the app canvas color #FAF8F5 (nothing
#                    lost); crop scales to cover and center-crops the overflow
#   --serial ID      adb device serial to use (default: first connected device)
#   --lang en|ar     prints navigation hints in English (default) or Arabic
#   -h, --help       show this help
#
# Exit codes: 0 success, 1 missing tool/device, 2 bad arguments, 3 capture
# failed. Requires bash, adb (PATH or $ANDROID_HOME/platform-tools), and
# ImageMagick (magick or convert). No network, no device writes.

set -euo pipefail

# ---------------------------------------------------------------- defaults ---
OUT="./captures"
SIZE="1080x1920"
FIT="pad"
SERIAL=""
LANG_HINT="en"
CANVAS="#FAF8F5"   # app canvas from mobile/src/theme/tokens.ts (padding color)

usage() { sed -n '2,26p' "$0" | sed 's/^# \?//'; exit 0; }

while [ $# -gt 0 ]; do
  case "$1" in
    --out)    [ $# -ge 2 ] || { echo "ERROR: --out needs a value" >&2; exit 2; }
              OUT="$2"; shift 2 ;;
    --size)   [ $# -ge 2 ] || { echo "ERROR: --size needs a value" >&2; exit 2; }
              SIZE="$2"; shift 2 ;;
    --fit)    [ $# -ge 2 ] || { echo "ERROR: --fit needs a value" >&2; exit 2; }
              FIT="$2"; shift 2 ;;
    --serial) [ $# -ge 2 ] || { echo "ERROR: --serial needs a value" >&2; exit 2; }
              SERIAL="$2"; shift 2 ;;
    --lang)   [ $# -ge 2 ] || { echo "ERROR: --lang needs a value" >&2; exit 2; }
              LANG_HINT="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "ERROR: unknown option: $1 (see --help)" >&2; exit 2 ;;
  esac
done

case "$SIZE" in
  [0-9]*x[0-9]*) : ;;
  *) echo "ERROR: --size must look like 1080x1920, got '$SIZE'" >&2; exit 2 ;;
esac
case "$FIT" in
  pad|crop) : ;;
  *) echo "ERROR: --fit must be 'pad' or 'crop', got '$FIT'" >&2; exit 2 ;;
esac
case "$LANG_HINT" in
  en|ar) : ;;
  *) echo "ERROR: --lang must be 'en' or 'ar', got '$LANG_HINT'" >&2; exit 2 ;;
esac

TARGET_W="${SIZE%x*}"
TARGET_H="${SIZE#*x}"

# ------------------------------------------------------------ find tools ----
find_adb() {
  if command -v adb >/dev/null 2>&1; then command -v adb; return 0; fi
  local candidate
  candidate="${ANDROID_HOME:-}/platform-tools/adb"
  if [ -n "${ANDROID_HOME:-}" ] && [ -x "$candidate" ]; then echo "$candidate"; return 0; fi
  candidate="${ANDROID_SDK_ROOT:-}/platform-tools/adb"
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -x "$candidate" ]; then echo "$candidate"; return 0; fi
  return 1
}

if ! ADB="$(find_adb)"; then
  echo "ERROR: adb not found." >&2
  echo "  Install Android platform-tools or set ANDROID_HOME to your SDK" >&2
  echo "  (this machine usually has it at ~/Android/Sdk)." >&2
  exit 1
fi

if command -v magick >/dev/null 2>&1; then
  IM=(magick)
elif command -v convert >/dev/null 2>&1; then
  IM=(convert)
else
  echo "ERROR: ImageMagick not found (need 'magick' or 'convert')." >&2
  echo "  Install ImageMagick, then re-run." >&2
  exit 1
fi

# --------------------------------------------------------- device checks ----
adb_cmd() {
  if [ -n "$SERIAL" ]; then "$ADB" -s "$SERIAL" "$@"; else "$ADB" "$@"; fi
}

DEVICES="$(adb_cmd devices 2>/dev/null | awk 'NR>1 && $2=="device" {print $1}')"
if [ -z "$DEVICES" ]; then
  echo "ERROR: no connected Android device found." >&2
  echo "  - Plug in a phone with USB debugging enabled (and authorize this" >&2
  echo "    computer), or start an emulator." >&2
  echo "  - Check with: $ADB devices" >&2
  echo "  - If several devices are attached, pick one with --serial <id>." >&2
  exit 1
fi
if [ -z "$SERIAL" ] && [ "$(echo "$DEVICES" | wc -l)" -gt 1 ]; then
  echo "ERROR: several devices are connected:" >&2
  echo "$DEVICES" | sed 's/^/    /' >&2
  echo "  Choose one and re-run with --serial <id>." >&2
  exit 1
fi

SCREEN_INFO="$(adb_cmd shell wm size 2>/dev/null | tail -n1 || true)"
echo "Device:        ${SERIAL:-$(echo "$DEVICES" | head -n1)}"
echo "Screen size:   ${SCREEN_INFO:-unknown}"
echo "Output:        $OUT (${TARGET_W}x${TARGET_H}, fit=$FIT)"
echo

# --------------------------------------------------------------- screens ----
# name|English navigation hint|Arabic navigation hint (labels from mobile/src/i18n/*)
SCREENS=(
  "01-home|Bottom tab: Home. Show a recipe card with its time info.|تبويب الأسفل: الرئيسية."
  "02-browse|Bottom tab: Browse.|تبويب الأسفل: استعراض."
  "03-recipe-detail|From Home (Top picks today) or Browse, tap any recipe card; show the claim next to 'Really takes'.|من الرئيسية أو استعراض، اضغط أي وصفة وأظهر الوقت المعلن مقابل «الوقت الحقيقي»."
  "04-cook-mode|On a recipe, tap 'Start cooking'; show one step with the stopwatch visible.|من الوصفة اضغط «ابدأ الطهي» وأظهر خطوة وساعة الإيقاف."
  "05-feedback|Finish the cook (Finish, then confirm) to reach 'How did it feel vs. the estimate?'.|أنهِ الطهي للوصول إلى سؤال «كيف كانت مقارنةً بالتقدير؟»."
  "06-community|Bottom tab: Community.|تبويب الأسفل: المجتمع."
  "07-pace|Bottom tab Settings, then the 'Your Pace' row. Capture the true state (the signed-out prompt is fine).|من الإعدادات اضغط صف «وتيرتك» وأظهر الحالة الحقيقية."
  "08-settings|Bottom tab: Settings.|تبويب الأسفل: الإعدادات."
)

TMP_PNG="$(mktemp --suffix=.png 2>/dev/null || mktemp)"
trap 'rm -f "$TMP_PNG"' EXIT

mkdir -p -- "$OUT"

capture_one() {
  local entry="$1" name hint idx
  name="${entry%%|*}"; entry="${entry#*|}"
  case "$LANG_HINT" in
    ar) hint="${entry#*|}" ;;
    *)  hint="${entry%%|*}" ;;
  esac
  idx="${name%%-*}"

  echo "--------------------------------------------------------------"
  echo "[$idx/8] ${name#*-}"
  echo "  Navigate to: $hint"
  printf "  Press Enter to capture, 's' to skip, 'q' to quit: "
  local reply
  read -r reply || reply="q"
  case "$reply" in
    q|Q) echo "Quitting."; exit 0 ;;
    s|S) echo "  Skipped $name."; return 0 ;;
  esac

  if ! adb_cmd exec-out screencap -p > "$TMP_PNG"; then
    echo "  ERROR: screencap failed on the device." >&2
    exit 3
  fi
  if [ ! -s "$TMP_PNG" ]; then
    echo "  ERROR: empty screenshot (device refused or disconnected)." >&2
    exit 3
  fi

  # Fit the frame to the exact target without distortion:
  #   pad  — scale to fit ENTIRELY inside the target, then letterbox on the
  #          app canvas color (no content lost);
  #   crop — scale to COVER the target, then center-crop the overflow.
  local dst="$OUT/$name.png"
  if [ "$FIT" = "pad" ]; then
    "${IM[@]}" "$TMP_PNG" -resize "${TARGET_W}x${TARGET_H}" \
      -background "$CANVAS" -gravity center \
      -extent "${TARGET_W}x${TARGET_H}" "$dst"
  else
    "${IM[@]}" "$TMP_PNG" -resize "${TARGET_W}x${TARGET_H}^" \
      -gravity center -extent "${TARGET_W}x${TARGET_H}" "$dst"
  fi
  echo "  Saved $dst ($("${IM[@]}" identify -format '%wx%h' "$dst"))"
}

for s in "${SCREENS[@]}"; do
  capture_one "$s"
done

echo
echo "Done. Review every PNG before uploading — real UI only, no mockups."
