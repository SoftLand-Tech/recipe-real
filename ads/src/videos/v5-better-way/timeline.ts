// AUTO-GENERATED from measured VO durations (public/audio/v5/vo-NN.mp3, ffprobe).
// frames = ceil((dur + 0.18s pad) * 30fps), clamped to [20, 60].
// Null-VO punch scenes get fixed 20-frame beats. Final scene absorbs the
// remainder so the composition sums to exactly DURATION_IN_FRAMES (1500).
import {SCENES} from "./scenes";
import {FPS, DURATION_IN_FRAMES} from "../../shared/theme";

export const VO_DURATIONS: Record<string, number> = {
  s01: 1.215737,
  s03: 1.157370,
  s04: 1.288798,
  s05: 1.233107,
  s07: 1.544558,
  s08: 1.272653,
  s10: 1.547551,
  s11: 1.545896,
  s13: 1.154898,
  s15: 1.354150,
  s17: 1.089977,
  s18: 1.605873,
  s20: 1.343537,
  s22: 1.761678,
  s24: 1.718685,
  s25: 1.347800,
  s27: 1.477460,
  s29: 0.822834,
  s31: 1.809274,
  s32: 0.495147,
  s33: 0.256054,
  s35: 1.415601,
  s36: 1.348980,
  s38: 1.716939,
};

const NULL_FRAMES: Record<string, number> = {
  s02: 20, s06: 20, s09: 20, s12: 20, s14: 20, s16: 20, s19: 20, s21: 20,
  s23: 20, s26: 20, s28: 20, s30: 20, s34: 20, s37: 22, s39: 22, s40: 24,
};

const PAD_SECONDS = 0.18;

const framesFor = (id: string): number => {
  const d = VO_DURATIONS[id];
  if (d === undefined) return NULL_FRAMES[id];
  return Math.min(60, Math.max(20, Math.ceil((d + PAD_SECONDS) * FPS)));
};

export type SceneSlot = {
  id: string;
  start: number;
  frames: number;
};

export const TIMELINE: SceneSlot[] = (() => {
  const slots: SceneSlot[] = [];
  let start = 0;
  for (const s of SCENES) {
    const frames = framesFor(s.id);
    slots.push({id: s.id, start, frames});
    start += frames;
  }
  // End-card scene (s41) absorbs the remainder so the total is exact.
  const sumWithoutLast = slots.slice(0, -1).reduce((a, s) => a + s.frames, 0);
  slots[slots.length - 1].frames = DURATION_IN_FRAMES - sumWithoutLast;
  return slots;
})();

export const TOTAL_FRAMES = TIMELINE.reduce((a, s) => a + s.frames, 0);
if (TOTAL_FRAMES !== DURATION_IN_FRAMES) {
  throw new Error("Timeline must sum to " + DURATION_IN_FRAMES + ", got " + TOTAL_FRAMES);
}
