# DESIGN.md — RecipeReal web surfaces

Written at finish from the built landing ("The Timing Board", seed rrland01,
2026-08-28). The mobile app owns the brand tokens; this file records how the
WEB renders them and why.

## World
**The Timing Board.** RecipeReal is presented as the official timing body of
home cooking: recipes state claims, the clock states facts. The page is an
instrument board, not a food brochure. Refused category defaults: food-photo
hero with cursive headline, warm-cream brochure layout, uniform feature-card
grids.

## Color
- `--board #171310` / `--board-2 #1E1813` — the ink instrument ground (dark
  by scene: an evening kitchen, one lit board).
- `--print #FBF8F3` — all primary text on dark; `--paper #FAF7F1` is the ONE
  reversal surface (a printed timing sheet) used for the procedure + FAQ.
- **Teal #287C78 (lit #5FBDB1) is reserved for measured time** — nothing else
  may use it. Terracotta #E86A33 (deep #BF5523) is reserved for action.
- Hairlines: `#332A22` on dark, `#E4DCD2` on paper. Secondary text on dark
  `#CFC4B8`/`#A99E92`; on paper `#6E6357` (never gray-on-gray; tint from ink).

## Type
- Display: **Big Shoulders** variable (self-hosted woff2, public/fonts/),
  uppercase, weight 700–800, line-height .94–1, used for h1/h2/stat marks.
  Display scale tops at 5.6rem (craft floor: ≤6rem).
- Body: system sans, 16–18px, measure ≤62ch.
- Numerals/data: ui-monospace, `tabular-nums`, uppercase tracked labels
  (.08–.14em) — reserved for timing data and meta, never decorative.

## Grammar
- State and provenance are shown by **treatment, not hue alone**: claimed
  values are struck through in terracotta; measured values sit in teal; EST/
  MEASURED tags and dashed rules mark estimate-vs-measured provenance.
- Ghost cells (unlit segments) appear wherever a value is pending.
- One printed paper reversal per screenful (dark → paper → dark rhythm).
- The one authored motion moment: **the clock settles** — digits flip through
  provisional splits (instant swaps, no easing slides) and land on the real
  value; `prefers-reduced-motion` skips straight to the value.
- Rows, lanes, and rules carry structure; never same-size icon+heading+text
  card grids. Icons are drawn SVG, 1.75 stroke, round caps.

## SEO/AEO
JSON-LD @graph (Organization, WebSite, SoftwareApplication+Offer, FAQPage)
mirroring the visible FAQ verbatim; canonical, OG/Twitter, theme-color;
semantic landmarks; real product numbers only (20,089 recipes / 137,644 steps
/ 26,771 timed steps). Reality rows on the landing come from the same
sanity-bounded query as /api/reality with EST/MEASURED provenance.

## Surfaces in this world
- Landing `/` (full expression). Share pages `/r`, `/p` keep the warm light
  treatment (visitor context: chat-link previews) — same tokens, light mode.
- Admin panel stays Filament default chrome (operator surface, out of scope).
