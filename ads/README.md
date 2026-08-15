# RecipeReal — Ad Campaign 2 (Remotion)

Five 50-second **16:9 (1920×1080 @ 30fps, 1500 frames)** ads for Google Ads / YouTube.
Audio-first build: one VO clip per scene, timelines derived from measured audio durations.

| # | Composition ID | Title | Style |
|---|----------------|-------|-------|
| 1 | `SpeedrunTruth` | Any% Cook — The Speedrun | Gaming speedrun HUD |
| 2 | `DinnerLeague` | Dinner League Final | Sports broadcast |
| 3 | `PatchNotes` | Recipe Patch Notes v2.0 | Software / dev release |
| 4 | `NoBars` | No Bars, No Problem | Offline location montage |
| 5 | `BetterWay` | There's Got To Be A Better Way | Infomercial parody |

## Layout

- `src/videos/vN-*/` — one self-contained folder per composition (scene table, timeline, components).
- `src/shared/theme.ts` — brand palette + canvas constants. Type system: Bebas Neue + Space Grotesk.
- `public/audio/vN/` — per-scene VO (`vo-XX.mp3`) + SFX, referenced via `staticFile('audio/vN/...')`.
- `out-stills/vN/` — per-scene preview stills (quality gate before rendering).

## Commands

```bash
npx remotion studio src/index.ts            # preview

# per-scene stills (quality gate)
npx remotion still src/index.ts <CompId> out-stills/vN/scene-01.png --frame=<N>

# render one video
npx remotion render src/index.ts SpeedrunTruth out/v1-speedrun.mp4
npx remotion render src/index.ts DinnerLeague out/v2-dinner-league.mp4
npx remotion render src/index.ts PatchNotes  out/v3-patch-notes.mp4
npx remotion render src/index.ts NoBars      out/v4-no-bars.mp4
npx remotion render src/index.ts BetterWay   out/v5-better-way.mp4

npm run typecheck                           # whole project
npx tsc -p tsconfig.v1.json                 # one video in isolation (v1–v5)
```

## Gotchas learned from campaign 1 (Remotion 4.0.512)

- `random()` from 'remotion' takes exactly ONE argument — `random('seed', frame)` throws at render
  time and tsc does NOT catch it. Use `random(\`seed-${frame}\`)`.
- Never index a timeline array inside `.map()` without checking both arrays have equal length —
  `undefined` in an `interpolate()` input range throws "inputRange must contain only numbers".
- Render bugs only surface at render time: always generate stills and render before declaring done.
