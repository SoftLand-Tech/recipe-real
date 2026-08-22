# RecipeReal — 60s 16:9 Ad

Remotion project for the RecipeReal app promo. Style follows the reference ad's
motion language: hard cuts between shots (motion always mid-flight at the cut),
dark warm stage with light app UI floating on it, breathing glow accents,
Ken Burns full-bleed moments, overshoot chip pops, staggered card fly-ins,
and a count-up stat burst.

## Timeline (30fps, 1920×1080, 1800 frames = 60s)

| Shot | Frames | Time | Content |
|------|--------|------|---------|
| 1 · Logo glow | 0–126 | 0:00–0:04 | Breathing terracotta glow, logo pops with ripple rings, wordmark |
| 2 · Library 20k | 126–540 | 0:04–0:18 | Three.js ring of 26 real recipe cards rotating in 3D + tilted browse phone + floating cards |
| 3 · Cooking mode | 540–1020 | 0:18–0:34 | Full-bleed biryani Ken Burns → cook-screen close-up: stopwatch, teal ring, step advance (active→passive), alarm chip |
| 4 · Community | 1020–1380 | 0:34–0:46 | Staggered post-card fly-in, avatar cluster pop, live like-counter, community phone |
| 5 · Stat + CTA | 1380–1800 | 0:46–1:00 | 20,000+ count-up with glow burst and sparks → logo, store badges, CTA |

## Commands

```bash
npm run dev                        # Remotion Studio preview
npx remotion render RecipeRealAd out/recipereal-ad.mp4   # final render
```

## Notes

- Palette mirrors `mobile/src/theme/tokens.ts` (terracotta `#E86A33`, timing teal `#287C78`, cream `#FAF8F5`, warm dark stage `#171310`).
- Food photos in `public/food/` are real recipes from the Food.com dataset (see `recipes-dataset/`).
- All animation is `useCurrentFrame()` + `interpolate()` — no CSS transitions; particles use a seeded PRNG so renders are deterministic.
- 3D content (recipe ring) uses `@remotion/three` + React Three Fiber; textures load via drei's `useTexture` inside `<Suspense>`.
- No audio track yet — add VO/music as `<Audio>` sequences if wanted.
