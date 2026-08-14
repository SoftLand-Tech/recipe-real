// Deterministic timing + mixing constants for "Offline Cabin Cook".
// All beat frames are GLOBAL (composition) frames. 30fps: frame = seconds * 30.
import {interpolate, random} from 'remotion';

// ---- Scene boundaries (global frames) ----
export const HOOK_DURATION = 140; // hook scene occupies 0-140, exits 90-132
export const CABIN_FROM = 90; // 3s — cabin kitchen runs to the end
export const FINALE_FROM = 1380; // 46s — logo outro
export const FINALE_DURATION = 120;

/** Convert a global frame to a frame local to the cabin scene. */
export const cab = (globalFrame: number): number => globalFrame - CABIN_FROM;

// ---- Beats (global frames) ----
export const BEAT = {
  // Hook: 4 bars die, tallest first; the lone bar flickers then dies with the buzz.
  barDie: [15, 33, 51, 69],
  noService: 75,
  narr1: 50, // "Signal's gone. Dinner isn't."

  airplane: 180, // 6s — airplane-mode icon slides on
  cookMode: 300, // 10s — Cook Mode glows
  chops: [330, 345, 360], // 11s / 11.5s / 12s — 3 rhythmic knife chops
  panSettle: 420, // 14s — pan lands on stove
  sizzleStart: 450, // 15s — oil sizzle bed begins
  steamStart: 510, // 17s — steam wisps rise
  ringDone: [765, 825, 885, 945, 1005], // 25.5s-33.5s — a completion every 2s
  sizzleEnd: 1140, // 38s — sizzle bed ends

  wash: 1140, // 38s — warm golden wash fades in (to 46s)
  plate: 1170, // 39s — plate set down
  finalStep: 1230, // 41s — final step checks off, one last chime
  narr2: 900, // 30s — "Your recipes live in your pocket — not the cloud."
  narr3: 1320, // 44s — "RecipeReal. Cook anywhere."

  crackle: 1425, // 47.5s — one faint crackle near the end
} as const;

// ---- Mix levels ----
export const NARR_VOL = 0.71; // narration -3dB
export const SIZZLE_BASE = 0.2; // sizzle bed -14dB
export const SIZZLE_DUCK = 0.5; // extra -6dB under narration -> 0.1

// Narration windows from the generated clips (1.63s / 2.79s / 2.04s) + small pad.
export const NARRATION_WINDOWS: readonly (readonly [number, number])[] = [
  [BEAT.narr1, BEAT.narr1 + 50],
  [BEAT.narr2, BEAT.narr2 + 84],
  [BEAT.narr3, BEAT.narr3 + 62],
];

const DUCK_RAMP = 12; // frames to ramp in/out of the duck

/** 1.0 normally; SIZZLE_DUCK while narration plays (12-frame ramps). */
export const duckMultiplier = (globalFrame: number): number => {
  let m = 1;
  for (const [start, end] of NARRATION_WINDOWS) {
    const enter = interpolate(globalFrame, [start - DUCK_RAMP, start], [1, SIZZLE_DUCK], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    const exit = interpolate(globalFrame, [end, end + DUCK_RAMP], [SIZZLE_DUCK, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    m *= Math.max(enter, exit);
  }
  return m;
};

/** Deterministic smoothed noise in [0,1]: pure function of (seed, frame). */
export const noise = (seed: string, frame: number, step = 4): number => {
  const t = frame / step;
  const i = Math.floor(t);
  const frac = t - i;
  const a = random(`${seed}:${i}`);
  const b = random(`${seed}:${i + 1}`);
  const smooth = frac * frac * (3 - 2 * frac); // smoothstep between lattice values
  return a + (b - a) * smooth;
};

// ---- Timer rings (25.5s-33.5s): a completion every 2s, in sync with the sizzle ----
export const RING_CYCLE = 60; // frames between completions

/** Ring fill 0..1 within the current cycle; cabin-local frame. */
export const ringProgress = (cabinFrame: number): number => {
  const first = cab(BEAT.ringDone[0]) - RING_CYCLE;
  const last = cab(BEAT.ringDone[4]);
  if (cabinFrame <= first) return 0;
  if (cabinFrame >= last) return 1;
  return ((cabinFrame - first) % RING_CYCLE) / RING_CYCLE;
};

/** Completion flash: 1 right at a completion, decaying over 14 frames. */
export const ringFlash = (cabinFrame: number): number => {
  let flash = 0;
  for (const done of BEAT.ringDone) {
    const x = cabinFrame - cab(done);
    if (x >= 0 && x <= 14) {
      flash = Math.max(flash, 1 - x / 14);
    }
  }
  return flash;
};
