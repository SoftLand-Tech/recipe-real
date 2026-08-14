# RecipeReal — Ad Compositions (Remotion)

Five 50-second vertical ads: **1080×1920 @ 30fps (1500 frames)**, audio = ElevenLabs narration + SFX, no music.

| # | Composition ID | Title | Style |
|---|----------------|-------|-------|
| 1 | `FifteenMinuteLie` | The 15-Minute Lie | Kinetic typography |
| 2 | `CookModeDemo` | Cook Mode Walkthrough | Product demo |
| 3 | `CrowdVsBlogger` | Crowd vs. Blogger | Data-viz |
| 4 | `ThreeCooks` | One Recipe, Three Cooks | Character sketch |
| 5 | `OfflineCabin` | Offline Cabin Cook | Atmospheric cinematic |

## Layout

- `src/videos/vN-*/` — one folder per composition (self-contained).
- `src/shared/theme.ts` — RecipeReal brand palette (mirrors `mobile/src/theme/tokens.ts`).
- `public/audio/vN/` — narration + SFX assets, referenced via `staticFile('audio/vN/...')`.

## Commands

```bash
npx remotion studio src/index.ts        # preview all compositions

# render one video (user runs these — agents do not render)
npx remotion render src/index.ts FifteenMinuteLie out/v1-fifteen-minute-lie.mp4
npx remotion render src/index.ts CookModeDemo     out/v2-cook-mode.mp4
npx remotion render src/index.ts CrowdVsBlogger   out/v3-crowd-vs-blogger.mp4
npx remotion render src/index.ts ThreeCooks       out/v4-three-cooks.mp4
npx remotion render src/index.ts OfflineCabin     out/v5-offline-cabin.mp4

npm run typecheck                       # whole project
npx tsc -p tsconfig.v1.json             # one video in isolation (v1–v5)
```
