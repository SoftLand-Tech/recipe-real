// SpeedrunTruth — timeline derived from measured VO durations (ffprobe, post trim+tempo).
// Scene frames = ceil((voSeconds + PAD) * 30) for VO scenes; fixed frames for the
// 4 SFX-only punch scenes; the final scene absorbs the remainder so the total is exactly 1500.
import {SCENES} from './scenes';

const FPS = 30;
const PAD = 0.18; // breathing room after each VO clip before the hard cut

// Measured durations (seconds) of public/audio/v1/vo-NN.mp3, keyed by scene id.
const VO_DURATIONS: Record<string, number> = {
  s01: 0.42966,
  s02: 1.047438,
  s03: 1.094966,
  s05: 0.849025,
  s06: 0.696372,
  s07: 1.282132,
  s08: 1.233016,
  s09: 0.911882,
  s10: 1.064762,
  s11: 1.193605,
  s13: 1.133243,
  s14: 1.183311,
  s15: 1.007166,
  s16: 1.038639,
  s17: 0.742086,
  s18: 1.078776,
  s19: 1.134467,
  s20: 0.646304,
  s21: 1.382812,
  s22: 1.27805,
  s23: 0.98381,
  s24: 1.087302,
  s25: 0.943129,
  s26: 0.796327,
  s27: 1.595601,
  s28: 0.658957,
  s29: 0.80517,
  s30: 1.540363,
  s31: 1.294286,
  s32: 0.780907,
  s33: 1.164989,
  s34: 0.903039,
  s35: 1.112245,
  s37: 1.15932,
  s38: 0.618141,
  s39: 1.343129,
  s40: 1.26059,
};

// Fixed durations for SFX-only punch scenes (no VO to size them).
const NULL_SCENE_FRAMES: Record<string, number> = {
  s04: 30, // smash headline hold
  s12: 24, // NEW ROUTE modal
  s36: 26, // cards collide VS
  // s41 (final logo hold) absorbs the remainder
};

export type SceneTiming = {
  id: string;
  start: number;
  durationInFrames: number;
};

let cursor = 0;
const timings: SceneTiming[] = [];

SCENES.forEach((scene, index) => {
  const isLast = index === SCENES.length - 1;
  let durationInFrames: number;
  if (isLast) {
    durationInFrames = 1500 - cursor; // absorb remainder → total is exactly 1500
  } else if (scene.vo === null) {
    durationInFrames = NULL_SCENE_FRAMES[scene.id];
  } else {
    durationInFrames = Math.ceil((VO_DURATIONS[scene.id] + PAD) * FPS);
  }
  timings.push({id: scene.id, start: cursor, durationInFrames});
  cursor += durationInFrames;
});

if (cursor !== 1500) {
  throw new Error(`Timeline must total 1500 frames, got ${cursor}`);
}

export const TIMELINE: SceneTiming[] = timings;

export const sceneStart = (id: string): number => {
  const t = timings.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown scene ${id}`);
  return t.start;
};

export const sceneDuration = (id: string): number => {
  const t = timings.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown scene ${id}`);
  return t.durationInFrames;
};
