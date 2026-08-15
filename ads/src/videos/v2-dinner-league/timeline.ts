// Timeline built from measured VO durations (durations.json, seconds).
// frames = ceil((dur + 0.18) * 30); the END-CARD scene absorbs the remainder
// so all 40 scenes sum to exactly DURATION_IN_FRAMES (1500).
import {DURATION_IN_FRAMES, FPS} from '../../shared/theme';
import {SCENES, SceneSpec} from './scenes';
import durations from './durations.json';

const PAD_S = 0.18;
const DUR = durations as Record<string, number>;

// Fixed lengths for the SFX-only punch scenes.
const SFX_ONLY_FRAMES: Record<string, number> = {s05: 18, s21: 15, s34: 18};

export interface SceneSlot extends SceneSpec {
  start: number;
  frames: number;
}

let cursor = 0;
export const TIMELINE: SceneSlot[] = SCENES.map((scene) => {
  const frames = scene.vo
    ? Math.max(20, Math.ceil((DUR[scene.id] + PAD_S) * FPS))
    : (SFX_ONLY_FRAMES[scene.id] ?? 20);
  return {...scene, start: cursor, frames};
}).map((slot, i, arr) => {
  // last scene (end card) absorbs the remainder
  if (i === arr.length - 1) {
    const before = arr.slice(0, -1).reduce((a, s) => a + s.frames, 0);
    return {...slot, frames: DURATION_IN_FRAMES - before};
  }
  return slot;
});

// recompute starts after absorption
let c = 0;
for (const slot of TIMELINE) {
  slot.start = c;
  c += slot.frames;
}
const TOTAL = c;
if (TOTAL !== DURATION_IN_FRAMES) {
  throw new Error(`timeline sums to ${TOTAL}, expected ${DURATION_IN_FRAMES}`);
}

const byId = new Map(TIMELINE.map((s) => [s.id, s]));
export const startOf = (id: string): number => byId.get(id)?.start ?? 0;
export const framesOf = (id: string): number => byId.get(id)?.frames ?? 0;
export const endOf = (id: string): number => startOf(id) + framesOf(id);

// ---- match clock (honest, piecewise: 0:00 -> 24:00 at half-time -> 43:00 at FT) ----
const KICK_F = startOf('s05');
const HT_F = startOf('s13') + 9;
const FT_F = startOf('s34');
const HT_S = 24 * 60;
const FT_S = 43 * 60;

export const SYNC_F = startOf('s16'); // Cook Mode clock re-sync moment
export const BUG_IN_F = startOf('s02'); // scoreboard bug drops in
export const BUG_OUT_F = startOf('s38'); // bug hides for end card

export const matchSecondsAt = (f: number): number => {
  if (f <= KICK_F) return 0;
  if (f <= HT_F) return ((f - KICK_F) / (HT_F - KICK_F)) * HT_S;
  if (f <= FT_F) return HT_S + ((f - HT_F) / (FT_F - HT_F)) * (FT_S - HT_S);
  return FT_S;
};

// The recipe's fantasy clock: claims 15:00 exactly when real hits 24:00 (half-time).
export const claimsSecondsAt = (f: number): number =>
  Math.min(15 * 60, matchSecondsAt(f) * (15 / 24));

export const clockLabel = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ---- scoreline [YOU, BLOGGERS FC] ----
export const scoreAt = (f: number): [number, number] => {
  let score: [number, number] = [0, 0];
  for (const slot of TIMELINE) {
    if (slot.score && slot.start <= f) score = slot.score;
  }
  return score;
};
