# RecipeReal — Remotion Ads

Two 16:9 (1920×1080 @ 30fps) advertisement videos for the RecipeReal MVP:

| Composition | File | Length | Angle |
|---|---|---|---|
| `ThirtyMinuteLie` | `out/ThirtyMinuteLie.mp4` | ~55s | Persona 1 (time-anxious beginner) — empathetic story, warm light palette |
| `ItLearnsYou` | `out/ItLearnsYou.mp4` | ~54s | Persona 3 (efficiency-minded cook) — energetic feature ad, warm dark palette |

## Pipeline

Single source of truth is `src/scenes.ts` (VO copy incl. audio tags, per-scene
lead/tail gaps, SFX cues). Everything else derives from it:

```bash
# 1. generate per-scene VO + SFX (idempotent; --force regenerates everything)
node scripts/generate-vo.mjs [--force] [--only=ThirtyMinuteLie]

# 2. measure every audio file → src/audio-durations.json + timing budget report
node scripts/measure-audio.mjs

# 3. render
npx remotion render ThirtyMinuteLie out/ThirtyMinuteLie.mp4
npx remotion render ItLearnsYou out/ItLearnsYou.mp4

# studio (preview/edit)
npm run dev
```

`src/timeline.ts` derives each scene's frame range from the **measured** VO
duration, so regenerating any scene's audio automatically re-times the whole
composition — no manual sync.

## Voice / SFX providers

- **Primary**: ElevenLabs (`eleven_v3`, default narrator voice — the free-tier
  key only works with that voice). Key in `.env.local`.
- **Fallback**: Deepgram Aura (`aura-asteria-en`) — used automatically when the
  ElevenLabs monthly quota (10k credits) is exhausted. Key in `.env.deepgram`.
  Both files are gitignored. `src/vo-manifest.json` records which provider
  produced each file.
- SFX fall back to Remotion's SFX library + locally synthesized sounds
  (ffmpeg) under the same quota condition.

**To swap everything back to ElevenLabs after the quota resets:**

```bash
node scripts/generate-vo.mjs --force   # retries ElevenLabs first
node scripts/measure-audio.mjs
npx remotion render ThirtyMinuteLie out/ThirtyMinuteLie.mp4
npx remotion render ItLearnsYou out/ItLearnsYou.mp4
```

## Editing copy

Edit the `vo` text (and `sfx` cues) for a scene in `src/scenes.ts`, then:

```bash
rm public/audio/<Ad>/<scene>.mp3   # or --force for all
node scripts/generate-vo.mjs
node scripts/measure-audio.mjs     # re-times everything
```

Visuals live in `src/ads/<Ad>.tsx` (one component per scene), shared design
system in `src/theme.ts`, `src/atoms.tsx`, `src/brand.tsx`, `src/ui/`.
