#!/usr/bin/env python3
"""
Regenerate the store-submission graphics for RecipeReal.

Outputs (idempotent — safe to re-run any time):
  store/assets/icon-512.png                 (512x512, from mobile/assets/images/icon.png)
  store/assets/feature-graphic-1024x500.png (1024x500, brand palette + logo)

Run from the repo root:  python3 store/assets/generate-assets.py
Requires: Python 3.8+ and Pillow (pip install Pillow). No network access needed.

Design notes (kept in sync with DESIGN.md / mobile/src/theme/tokens.ts):
  - Canvas  #FAF8F5  — the app's warm canvas.
  - Ink     #241D17  — primary text (PRODUCT.md app ink).
  - Accent  #E86A33  — the app terracotta; used for the "Real" emphasis word and
                       the small section-head-style pill rule only.
  - Teal    #287C78  — timing teal, reserved for time-truth content; here it
                       carries the "Honest cook times" line, which is exactly
                       that claim. It touches nothing else on the graphic.
  - No invented stats, no fake app UI, no device mockups — just the logo,
    the name, and the time-honesty tagline.

Fonts: no DejaVu ships on this machine, so the script resolves, in order:
  DejaVu Sans (if installed later) -> Bitstream Vera (the face DejaVu Sans was
  derived from, bundled with reportlab) -> Open Sans. The wordmark uses the
  brand display face Fraunces when available (see DESIGN.md), with the same
  sans fallback chain.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFont

# --- Repository locations (script may be run from repo root or store/) ------
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
if not os.path.isdir(os.path.join(ROOT, "mobile")):
    ROOT = os.getcwd()
ICON_SRC = os.path.join(ROOT, "mobile", "assets", "images", "icon.png")
LOGO_SRC = os.path.join(ROOT, "mobile", "assets", "images", "recipereallogo.png")

# --- Brand palette (must match mobile/src/theme/tokens.ts / PRODUCT.md) -----
CANVAS = "#FAF8F5"
INK = "#241D17"
INK_SECONDARY = "#756B66"
ACCENT = "#E86A33"
TIMING_TEAL = "#287C78"

# --- Font resolution --------------------------------------------------------
_FONT_DIRS = [
    "/usr/share/fonts/truetype/dejavu",
    "/usr/local/share/fonts",
    os.path.expanduser(
        "~/.local/share/uv/tools/browser-use/lib/python3.12/site-packages/reportlab/fonts"
    ),
    os.path.expanduser("~/.local/share/TelegramDesktop/tdata/fonts"),
    os.path.expanduser(
        "~/.local/share/moch-desktop-dev/hermes/skills/onetake/looks/fonts"
    ),
]

_SANS_CANDIDATES = [
    # Preferred: DejaVu per the store-kit brief...
    "DejaVuSans.ttf",
    "DejaVuSans-Bold.ttf",
    # ...then Bitstream Vera — DejaVu Sans is directly derived from Vera,
    # so it is the closest available match on this machine.
    "Vera.ttf",
    "VeraBd.ttf",
    # ...then any other clean humanist sans found in the search dirs.
    "OpenSans-Regular.ttf",
    "OpenSans-SemiBold.ttf",
    "Geist.ttf",
    "Inter.ttf",
]

_DISPLAY_CANDIDATES = [
    # Brand display face (DESIGN.md pins Fraunces 640 for display lettering).
    "Fraunces.ttf",
    "InstrumentSerif.ttf",
]


def _find_font(candidates):
    for name in candidates:
        for d in _FONT_DIRS:
            path = os.path.join(d, name)
            if os.path.isfile(path):
                return path
    return None


def _load_display(size, weight=640, opsz=144):
    """Fraunces variable font at the brand's display weight, else serif fallback."""
    path = _find_font(_DISPLAY_CANDIDATES)
    if path:
        try:
            font = ImageFont.truetype(path, size)
            try:
                # Fraunces axes order: Optical Size, Weight, Softness, Wonky.
                font.set_variation_by_axes([opsz, weight, 0, 0])
            except Exception:
                pass  # static serif fallback: accept default instance
            return font
        except Exception:
            pass
    return None


def _load_sans(size, bold=False):
    ordered = _SANS_CANDIDATES[2:] + _SANS_CANDIDATES[:2] if bold else _SANS_CANDIDATES
    for name in ordered:
        path = _find_font([name])
        if path:
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def make_icon(dst=os.path.join(HERE, "icon-512.png")):
    """512x512 app icon, resized from the 1024 source without distortion."""
    src = Image.open(ICON_SRC).convert("RGB")
    icon = src.resize((512, 512), Image.LANCZOS)
    icon.save(dst, "PNG", optimize=True)
    print(f"wrote {dst} ({icon.width}x{icon.height}, {icon.mode})")
    return dst


def make_feature_graphic(dst=os.path.join(HERE, "feature-graphic-1024x500.png")):
    """1024x500 feature graphic: logo left, wordmark + tagline right."""
    W, H = 1024, 500
    img = Image.new("RGB", (W, H), CANVAS)
    draw = ImageDraw.Draw(img)

    # -- Logo: crop to its alpha bounding box so it sits optically centered.
    logo = Image.open(LOGO_SRC).convert("RGBA")
    bbox = logo.getchannel("A").getbbox()
    logo = logo.crop(bbox)
    logo_h = 300
    logo_w = round(logo.width * logo_h / logo.height)
    logo = logo.resize((logo_w, logo_h), Image.LANCZOS)
    logo_x, logo_y = 88, (H - logo_h) // 2 - 12
    img.paste(logo, (logo_x, logo_y), logo)

    # -- Wordmark: "Recipe" in ink + "Real" in accent (DESIGN.md emphasis rule).
    tx = logo_x + logo_w + 72
    display = _load_display(104)
    if display is None:
        display = _load_sans(96, bold=True)
    part1, part2 = "Recipe", "Real"
    w1 = draw.textlength(part1, font=display)
    w2 = draw.textlength(part2, font=display)
    word_y = 132
    draw.text((tx, word_y), part1, font=display, fill=INK)
    draw.text((tx + w1, word_y), part2, font=display, fill=ACCENT)

    # -- Small accent pill rule, echoing the landing's section-head rule.
    draw.rounded_rectangle([tx + 4, word_y + 152, tx + 4 + 128, word_y + 160], 4, fill=ACCENT)

    # -- Tagline: the time-truth line, in the reserved timing teal.
    sans_tag = _load_sans(42, bold=True)
    draw.text((tx, word_y + 184), "Honest cook times.", font=sans_tag, fill=TIMING_TEAL)

    # -- Quiet factual caption in secondary ink.
    sans_cap = _load_sans(25)
    draw.text(
        (tx, word_y + 258),
        "Free on Android · English & Arabic",
        font=sans_cap,
        fill=INK_SECONDARY,
    )

    img.save(dst, "PNG", optimize=True)
    print(f"wrote {dst} ({img.width}x{img.height}, {img.mode})")
    return dst


if __name__ == "__main__":
    missing = [p for p in (ICON_SRC, LOGO_SRC) if not os.path.isfile(p)]
    if missing:
        sys.exit("Missing source image(s): " + ", ".join(missing))
    make_icon()
    make_feature_graphic()
