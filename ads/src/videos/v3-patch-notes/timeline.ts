// Scene timeline: frames = ceil((voDuration + PAD) * 30) per audio-first workflow.
// SFX-only punch scenes (vo === null) get fixed short lengths.
// The final scene absorbs the remainder so the total is exactly 1500 frames.
import {SCENES, type Scene} from './scenes';
import {VO_DURATIONS} from './durations';

export const FPS = 30;
export const TOTAL_FRAMES = 1500;
const PAD_SECONDS = 0.18;

/** Fixed frame lengths for the four SFX-only punch scenes. */
const NULL_SCENE_FRAMES: Record<string, number> = {
  s02: 20,
  s10: 24,
  s18: 24,
  s33: 24,
};

export interface TimelineSlot {
  scene: Scene;
  index: number;
  id: string;
  /** absolute start frame in the composition */
  start: number;
  /** duration in frames (last scene absorbs remainder) */
  frames: number;
  /** 'vo-01.mp3' style filename, null for SFX-only scenes */
  voFile: string | null;
}

const buildTimeline = (): TimelineSlot[] => {
  const slots: TimelineSlot[] = [];
  let start = 0;
  SCENES.forEach((scene, index) => {
    const isLast = index === SCENES.length - 1;
    let frames: number;
    let voFile: string | null = null;
    if (scene.vo === null) {
      frames = NULL_SCENE_FRAMES[scene.id];
    } else {
      const dur = VO_DURATIONS[scene.id];
      if (dur === undefined) {
        throw new Error(`Missing VO duration for ${scene.id}`);
      }
      frames = Math.ceil((dur + PAD_SECONDS) * FPS);
      voFile = `vo-${scene.id.slice(1)}.mp3`;
    }
    if (isLast) {
      frames = TOTAL_FRAMES - start;
    }
    if (frames <= 0) {
      throw new Error(`Non-positive frames for ${scene.id}`);
    }
    slots.push({scene, index, id: scene.id, start, frames, voFile});
    start += frames;
  });
  if (start !== TOTAL_FRAMES) {
    throw new Error(`Timeline sums to ${start}, expected ${TOTAL_FRAMES}`);
  }
  return slots;
};

export const TIMELINE: TimelineSlot[] = buildTimeline();

/** Frame (relative to scene start) at which the SFX hits, when delayed for impact sync. */
export const SFX_FRAME: Record<string, number> = {
  s08: 6,
  s11: 4,
  s17: 5,
  s25: 3,
  s26: 3,
  s27: 3,
  s28: 4,
  s29: 3,
  s36: 2,
};
