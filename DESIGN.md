---
name: RecipeReal
description: Real recipes, real results — the warm kitchen table landing for the halal-only honest-cook-times Android app.
colors:
  cream: "#FAF6EF"
  cream-deep: "#F5EEE2"
  white: "#FFFFFF"
  ink: "#26211B"
  muted: "#6E6558"
  faint: "#988D7E"
  orange: "#F26B1D"
  orange-deep: "#CE5710"
  orange-soft: "#FDEBDD"
  teal: "#287C78"
  dark: "#232936"
  dark-2: "#1D222C"
  dark-muted: "#AEB5C2"
  hair: "#EFE5D6"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.55rem, 5vw, 4.1rem)"
    fontWeight: 640
    lineHeight: 1.07
    letterSpacing: "-0.012em"
    fontVariation: "\"opsz\" 40"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.85rem, 3.3vw, 2.65rem)"
    fontWeight: 640
    lineHeight: 1.14
    letterSpacing: "-0.01em"
    fontVariation: "\"opsz\" 30"
  display-cta:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)"
    fontWeight: 640
    lineHeight: 1.14
    letterSpacing: "-0.01em"
  title:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17.5px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "0.1em"
rounded:
  sm: "12px"
  md: "14px"
  card: "18px"
  quote: "20px"
  pill: "999px"
spacing:
  gutter: "28px"
  inset: "14px"
  band: "64px"
  head-gap: "52px"
  section: "86px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
    typography: "700 15.5px 'DM Sans'"
  button-primary-hover:
    backgroundColor: "{colors.orange-deep}"
  button-ghost:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
    typography: "700 15.5px 'DM Sans'"
  button-ghost-hover:
    textColor: "{colors.orange-deep}"
  button-dark:
    backgroundColor: "{colors.dark}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "12px 24px"
    typography: "700 14.5px 'DM Sans'"
  nav-cta:
    backgroundColor: "{colors.orange}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "11px 22px"
    typography: "700 14px 'DM Sans'"
  recipe-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
  quote-card:
    backgroundColor: "{colors.white}"
    textColor: "#4E463B"
    rounded: "{rounded.quote}"
    padding: "28px 26px"
  store-badge:
    backgroundColor: "#0E1117"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 20px 10px 16px"
  email-pill:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "7px"
---

# Design System: RecipeReal

Written at finish from the built landing surface (`/` → `backend/resources/views/welcome.blade.php`, "Warm Kitchen Table", seed key rrland02, owner-pinned comp). Every value below is read from that shipped code.

## Overview

**Creative North Star: "The Warm Kitchen Table"**

RecipeReal presents itself as the confident kitchen companion. The page is a warm cream table set for dinner: vivid orange is the action, a serif voice makes the promise ("Real Recipes. Real Results."), and soft-shadow rounded cards hold the evidence. This world deliberately replaces the category-default dark brochure — both the old dark "Timing Board" landing and the generic dark SaaS pattern it refused. Warmth is not decoration here; it is the product's argument (honest times for family cooks) rendered as atmosphere.

The page runs on trust economics as much as color: the popular-recipes grid renders real database rows in production, the download badges adapt to whether an APK build actually exists, and the only numbers on the page are audited ones (the 20,089-recipe library). App screens appear only inside phone mockups that replicate the real app's mechanisms; the single animated moment is the hero quietly settling in on load.

**Scope.** This file documents the landing `/` only. The share pages (`/r`, `/p`) and `/privacy` keep their own existing light treatment, and the admin panel stays Filament default — all out of scope here.

**Key Characteristics:**
- Full-width band rhythm: cream → white → cream → white → one dark slate band → white → one orange CTA band → dark footer.
- Orange #F26B1D is action and emphasis only; teal #287C78 appears solely as measured "Really takes" time inside app-screen mockups.
- Fraunces (weight 640, optical sizing) leads; DM Sans does everything else.
- Pill geometry everywhere interactive (999px); cards are 18–20px rounded with 1px hairline borders and whispered ink shadows.
- Honest data by construction: DB-backed recipe grid with an empty-DB fallback, release-aware download badges, placeholder quotes explicitly labeled.
- One authored motion moment: the staggered hero rise, guarded by `prefers-reduced-motion`.

## Colors

A warm, food-adjacent palette: cream and ink do the everyday work, one vivid orange carries every call to action, one reserved teal marks measured truth, and a cool slate trio powers the single dark band.

### Primary
- **Vivid Orange** (#F26B1D): the action color. Buttons, active nav state and its underline pill, heading emphasis words, drawn icon strokes on tint, star icons, section head rules, the CTA band ground, dashed flow arrows, selection highlight, and the focus ring. Nothing else.
- **Ember Orange** (#CE5710): hover/pressed and "louder text" register — button hovers, step numbers, "See all"/"View all" links, active app tab in mockups.
- **Soft Apricot** (#FDEBDD): the tint that makes orange icons readable — feature icon circles, the play-dot, Cook Mode step chips inside mockups.

### Secondary
- **Timing Teal** (#287C78): reserved. It renders exactly one kind of content: the measured "Really takes" value inside the phone mockups (the hero home-screen card and the claim-vs-reality card in the dark band). It never styles buttons, links, or landing chrome.

### Neutral
- **Warm Cream** (#FAF6EF): the table itself — nav, hero, and how-it-works bands; also the browser theme-color.
- **Deep Cream** (#F5EEE2): secondary cream surface (app search field in mockups).
- **Plate White** (#FFFFFF): content strips (features, recipes, community), cards, ghost buttons, body ground.
- **Table Ink** (#26211B): all primary text, the dark button ground, ghost-button text.
- **Warm Gray** (#6E6558): secondary text — ledes, card copy, input placeholders.
- **Faint Khaki** (#988D7E): tertiary text — mockup captions, inactive tab labels.
- **Hairline Cream** (#EFE5D6): 1px card borders, dividers, band edges (the features strip's top/bottom rules, vertical column dividers).
- **Slate Night** (#232936): the one dark band (app showcase), dark button ground.
- **Deep Slate** (#1D222C): footer ground.
- **Slate Muted** (#AEB5C2): secondary text on the dark band and footer.

Inside the phone mockups the app's own native palette shows through (app ink #241D17, screen #FDFBF7, field tint #F3EDE3) — those are app tokens depicted, not landing tokens. Note the landing ships the comp's brighter action orange #F26B1D rather than the app's terracotta #E86A33.

### Named Rules
**The Orange Is Action Rule.** Orange appears only where the page asks for action or draws emphasis — never as body text and never as a large surface, with the single deliberate exception of the CTA band. Its scarcity is what makes "Get the App" impossible to miss.

**The Teal Is Time Rule.** #287C78 is reserved for measured time ("Really takes") inside app screens. If teal shows up anywhere else, the reservation is broken.

**The Cream Sets the Table Rule.** Cream hosts welcome and explanation (nav, hero, how-it-works); white hosts content (features, recipes, quotes); exactly one dark band and one orange band exist per page. Don't add a second dark or orange full-bleed surface.

## Typography

**Display Font:** Fraunces (self-hosted variable woff2, weight range 100–900, `font-display: swap`, preloaded), falling back to Georgia, serif.
**Body Font:** DM Sans (self-hosted variable woff2, same loading treatment), falling back to the system sans stack.

**Character:** A warm serif voice making confident promises, backed by a friendly geometric sans doing the practical work. Fraunces is used with optical sizing turned up (`"opsz" 40` on h1, `"opsz" 30` on h2) at weight 640 — large but controlled display scale, never shouting.

### Hierarchy
- **Display** (Fraunces 640, `clamp(2.55rem, 5vw, 4.1rem)`, line-height 1.07, letter-spacing −0.012em, balanced wrapping): h1 only — the hero promise, with orange emphasis words.
- **Headline** (Fraunces 640, `clamp(1.85rem, 3.3vw, 2.65rem)`, line-height 1.14): h2 section heads; the CTA band overrides size to `clamp(1.9rem, 3.6vw, 2.8rem)`.
- **Title** (DM Sans 800, 17.5px, −0.005em): feature and step headings; card titles run slightly smaller (15.5–19px) at the same 800 weight.
- **Body** (DM Sans 400, 16.5px, line-height 1.65): the page default; ledes at 17.5px in Warm Gray, capped near 27.5em measure.
- **Label** (DM Sans 700–800, 13–14.5px): nav links (14.5px/600), buttons (15.5px/700), and uppercase tracked tags — footer column heads (13px/800, +0.1em), mockup captions (10px/800, +0.12em), badge eyebrows (10.5px/600, +0.06em).
- **Data** (ui-monospace stack, `tabular-nums`): the Cook Mode stopwatch readout inside mockups only (34px/700).

### Named Rules
**The Serif Voice, Working Sans Rule.** Fraunces renders h1 and h2 — nothing smaller, nothing else. Every button, card, link, label, and paragraph is DM Sans.

**The One Orange Word Rule.** A display heading may carry orange emphasis spans (`.o`), typically one word or pair ("**Real** Recipes. **Real** Results."). The emphasis is part of the voice; it never spreads to whole headings.

## Layout

A single centered column of full-width bands on a 1160px container (`.wrap`, 28px side gutters; the recipes band widens to 1240px). Vertical rhythm is generous: standard sections get 86px block padding, the features strip 64px, the CTA band 74px; centered section heads hold a 640px measure with 52px below. The hero is a two-column grid (1.02fr / 0.98fr) — text left, art right — where the pasta photo bleeds off the top and right edges (absolute, top −48px, one giant 180px bottom-left corner; at ≥1180px its right edge computes to the viewport bleed `calc(-1 * ((100vw - 1104px) / 2))`), with the iPhone mockup floating in front.

The band map, top to bottom: nav (cream, sticky, 66px) → hero (cream) → features strip (white, 1px hairline top and bottom, four hairline-divided columns) → how-it-works (cream, five steps) → popular recipes (white, five cards) → app showcase (Slate Night dark, two-column) → community quotes (white, three cards) → CTA band (orange) → footer (Deep Slate, five columns: 1.4fr 1fr 1fr 1fr 0.9fr).

Responsive behavior — each breakpoint is one observed `@media` step, no framework grid:
- **1180px**: nav compacts (tighter gaps, smaller CTA pill) so six links plus the pill stay on one line; below 1180px the hero photo stops bleeding.
- **1080px**: recipe grid 5 → 3 columns.
- **1020px**: steps 5 → 3; dashed connector arrows hide.
- **980px**: features 4 → 2; app-showcase stacks and the three mini-phones become a horizontal scroll-snap row (hidden scrollbar); CTA edge photos hide.
- **940px**: hero stacks — text above, art below at a fixed 700px stage; footer 5 → 2 columns.
- **900px**: quote cards become a scroll-snap carousel (`min(320px, 84vw)` cards) with dots.
- **860px**: nav text links hide (logo + pill remain).
- **700px**: recipe grid 3 → 2.
- **640px**: recipes head stacks; steps 3 → 2.
- **520px**: features → 1 column, dividers drop.
- **480px**: CTA form stacks into a 24px-radius column; footer → 1 column.
- **430px**: steps → 1 column.
- **420px**: iPhone mockup scales 0.8 → 0.68; hero stage drops to 560px.

## Elevation & Depth

Depth is hybrid: hairline borders define surfaces at rest, and soft ink shadows whisper lift. Every shadow is ink-based (`rgba(38,33,27,…)`), heavily negative-spread, and low-alpha — never gray, never harsh. State deepens shadows rather than introducing them: cards lift 4px on hover with a slightly stronger shadow. Two shadows carry their own hue by intent: the orange button casts an orange glow (`rgba(242,107,29,.55)`) and the CTA email pill casts burnt umber (`rgba(112,40,0,.5)`). The phone mockups are the deepest objects on the page, as physical devices should be.

### Shadow Vocabulary
- **Card rest** (`0 12px 28px -22px rgba(38,33,27,.4)`): recipe cards, mockup cards.
- **Card hover** (`0 22px 40px -24px rgba(38,33,27,.5)`): with `translateY(-4px)`.
- **Quote card** (`0 18px 40px -30px rgba(38,33,27,.45)`).
- **Step icon coin** (`0 14px 30px -18px rgba(38,33,27,.35)` plus `inset 0 0 0 1px #F3E7D6` ring).
- **Primary button glow** (`0 10px 22px -10px rgba(242,107,29,.55)`); nav variant slightly smaller.
- **Ghost button** (`0 6px 16px -10px rgba(38,33,27,.25)`).
- **Hero iPhone** (`0 60px 120px -38px rgba(38,33,27,.5)` with `inset 0 0 0 2px #000` bezel).
- **Mini-phones** (`0 34px 70px -28px rgba(0,0,0,.8)` with inset bezel ring).
- **CTA email pill** (`0 20px 44px -20px rgba(112,40,0,.5)`).

### Named Rules
**The Whispered Shadow Rule.** Shadows are soft, ink-tinted, and negative-spread — a murmur of lift, not a drop. Only two elements may tint a shadow with their own hue: the orange button and the CTA form. Hover deepens existing shadows; it never introduces a first one.

## Shapes

The form language is rounded and soft at every scale. Anything interactive is a full pill (border-radius 999px): buttons, chips, the nav active underline (a 16×3px pill), the section-head rule (54×5px), scrollbar-sized dots, progress bars, and the email form container. Cards round at 18px (recipe cards, mockup feature cards) to 20px (quote cards); store badges at 12px; mockup search fields at 14px. Borders are 1px hairlines in Hairline Cream on light surfaces and slate tones (#39404E, #2C3342) on dark ones. One signature geometry: the hero photo's single giant corner (border-radius `0 0 0 180px`), the gesture that makes the photograph feel placed on the table rather than boxed. Device chrome is depicted literally (54px/44px radii on the hero phone, 32px/26px on mini-phones). Icons are hand-drawn inline SVG — 1.8–2.4 stroke, round caps and joins — never emoji, never an icon font. Four-point spark SVGs in orange are the page's only ornament.

### Named Rules
**The Pill Rule.** Every clickable thing is a 999px pill. Cards are 18–20px. Nothing user-facing ships square; the only sharp edges are photo edges inside their clipping containers.

## Components

### Buttons
- **Shape:** full pill (999px), inline-flex, 14px 28px padding, DM Sans 700 15.5px.
- **Primary** (`.btn-accent`): Vivid Orange ground, white text, orange glow shadow; hover deepens to Ember Orange; press nudges `translateY(1px)`.
- **Ghost** (`.btn-ghost`): white ground, ink text, 1px #E8DFD2 border; may carry a play-dot (26px Soft Apricot circle, Ember play triangle); hover turns border orange and text Ember.
- **Dark** (`.btn-dark`): Slate Night ground, white text; hover #2E3545. Used inside the orange CTA band and as its form submit.
- **Focus:** every focusable element gets `outline: 2.5px solid #F26B1D; outline-offset: 3px; border-radius: 4px` via `:focus-visible`.
- **Nav CTA:** the primary pill at reduced size (11px 22px, 14px type).

### Navigation
Sticky cream bar (66px) with 1px translucent hairline underneath. Brand = 34px logo mark + DM Sans 800 23px wordmark with "Real" in orange (`.em` treated, not a different font). Links: 14.5px/600 Warm Gray, hover to ink; the active page link sits in Ember Orange over a 16×3px orange pill underline. Collapses per the breakpoint ladder above; no hamburger exists — mobile keeps brand + pill only.

### Cards / Containers
- **Recipe card:** white, 1px Hairline Cream border, 18px radius, card-rest shadow; 4/3 photo, one-line ellipsed DM Sans 800 15.5px title, meta row (clock + minutes in Warm Gray 13px/700; star in orange + rating in ink). Whole card is a link — to `/r/{id}` in production, to the APK download in the fallback state. Hover lifts 4px and deepens the shadow.
- **Quote card:** white, hairline border, 20px radius, 28px 26px padding; five orange stars, 15px #4E463B quote, 42px avatar coin + name/role.
- **Mockup cards** (inside phones): white on the app's #FDFBF7 screen, hairline borders, 12–18px radii — depictions, not landing components.

### Inputs / Fields
One input exists: the CTA email pill — a white 999px container (7px padding) holding a borderless input (transparent ground, orange caret, Warm Gray placeholder) and a dark submit pill. Below 480px it stacks into a 24px-radius column with centered text. Focus stays on the input itself; the container never grows a border.

### Phone mockups (signature components)
The page's proof-of-product. The hero carries a full iPhone home screen designed at the app's native 390px viewport and transform-scaled (0.8; 0.68 under 420px): dark #101013 bezel, 54px radius, #FDFBF7 screen — status bar, search field, featured recipe with its "Really takes" figure, "Quick tonight" rail, tab bar. The dark band carries three mini-phones fanned with ±5° rotation: Cook Mode stopwatch (mono tabular clock, progress bar, Pause/Skip pills), the claim-vs-reality card (claimed time struck through in orange, "Really takes 74m" in teal), and a community "try" (pace chart with one hot orange bar). These are illustrative app screens, not live UI, and each carries a descriptive `role="img"` label.

### Store badges
Dark download badges (#0E1117, 1px #39404E border, 12px radius) with a drawn Android robot or Apple mark, an uppercase 10.5px eyebrow ("Download on the"), and a 16.5px bold label ("Android APK" / "App Store"). Hover lightens border and ground. The iOS badge permanently wears `.soon` (0.62 opacity + "· soon" appended). Whether the Android badge is a live link or an inert badge is data-driven (see Do's).

### How-it-works steps
Five centered steps on cream: a 78px white "coin" circle (soft shadow + inset #F3E7D6 ring) holding a 32px drawn icon, a numbered heading with the numeral in Ember Orange, and a 13.8px caption capped at 21em. Dashed orange SVG arrows (dotted line + chevron, 34×12 data-URI) connect steps on desktop only.

### Feature strip
Four hairline-divided columns on white, each: a 62px Soft Apricot circle with an Ember drawn icon, an 800-weight title, and 14.5px Warm Gray copy. The quietest band on the page — no cards, no shadows.

### CTA band
Full-bleed Vivid Orange, white Fraunces headline, #FFE3CE subcopy, and the email pill. Food photographs sit only at the edges (340px wide, masked to transparent toward center, 0.9 opacity, hidden below 980px) so the center stays clean. The form's wiring is placeholder: there is no email backend — submit routes to the APK download.

### Footer
Deep Slate five-column grid: brand + line, three link columns (13px/800 uppercase white heads, 14px Slate Muted links, hover white), and 36px circular social coins (#2A3140 ground, hover to orange with white icon). A 1px #2C3342 rule caps the legal row.

### Testimonials
Three quote cards in a grid that becomes a scroll-snap carousel with orange active dots below 900px (dots driven by an IntersectionObserver — the page's only JS behavior beyond CSS). The three quotes currently shipping are template copy from the owner's comp, and the card set carries the caption "Early preview quotes — real cook stories arrive with the community." That labeling is part of the component: placeholder quotes must stay labeled.

## Do's and Don'ts

### Do:
- **Do** reserve teal #287C78 for measured "Really takes" time inside app-screen mockups — nowhere else.
- **Do** render the popular-recipes grid from the database on production (top-rated, image-backed, claim time > 0, cached 15 minutes, five cards, links to `/r/{id}`), keeping the static dish set only as the empty-DB fallback (fresh dev DBs), where cards link to the APK download.
- **Do** make download badges release-aware (`@isset($latestRelease)`): a live link with version/size metadata when a build exists, an inert badge ("First public build landing shortly") when not; iOS stays "· soon".
- **Do** use only real numbers. The library figure (20,089 recipes) is audited; the JSON-LD, meta description, and "View all recipes" tooltip all repeat it.
- **Do** keep structured data mirroring visible content: JSON-LD `@graph` with Organization, WebSite, and SoftwareApplication (+ free Offer, version from the latest release). There is no FAQ section, so there is no FAQPage node.
- **Do** draw every icon as inline SVG (1.8–2.4 stroke, round caps) and keep photographs provenance-tracked rasters under `/img/landing/`.
- **Do** keep the hero rise as the only authored animation: opacity/translateY 16px, 0.7s `cubic-bezier(.16,1,.3,1)`, staggered 0.08–0.32s, fully guarded by `prefers-reduced-motion` (which also disables smooth scrolling).
- **Do** label template testimonials as early-preview quotes until real ones replace them.
- **Do** depict only real app mechanisms in mockups; the comp's skill-level selector and XP points were dropped for the app's actual claim/reality and Cook Mode screens.

### Don't:
- **Don't** use orange for body text, decorative borders, or a second full-bleed surface — the single CTA band is the entire allowance.
- **Don't** place teal anywhere but a measured-time value, and don't reuse it for links, buttons, or success states (mockup success uses the app's green #3D8B5A).
- **Don't** invent numbers: no user counts, no download counts, no benchmark claims — one public user exists.
- **Don't** add emoji or an icon font; icons are drawn SVG only.
- **Don't** introduce a second display face or push Fraunces below h2; buttons and labels stay DM Sans. (Fraunces is the owner-pinned comp lettering; the pairing is a commitment, not a candidate.)
- **Don't** let photography cover the CTA band's center or return above 980px — masked edges only.
- **Don't** add a second dark or orange band; the one-dark-one-orange rhythm is the page's signature.
- **Don't** strip the placeholder labels from mock data (fallback dishes, early-preview quotes) — they are what keep the surface honest while real data arrives.
