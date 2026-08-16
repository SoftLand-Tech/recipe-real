import { FPS, type AdDef, type SceneDef } from "./scenes";
import durations from "./audio-durations.json";

export interface SceneSlot {
  def: SceneDef;
  /** composition frame where this scene starts */
  start: number;
  /** total scene length in frames */
  duration: number;
  /** scene-local frame where the VO begins */
  voStart: number;
  voFrames: number;
}

const measured = (p: string) => (durations as Record<string, number | undefined>)[p];

export function buildTimeline(ad: AdDef): SceneSlot[] {
  let t = 0;
  const slots: SceneSlot[] = [];
  for (const def of ad.scenes) {
    const lead = def.lead ?? 10;
    const tail = def.tail ?? 12;
    const m = measured(`audio/${ad.id}/${def.id}.mp3`);
    // word-count fallback so Studio opens before audio exists
    const voSec = m ?? def.vo.split(/\s+/).length * 0.36;
    const voFrames = Math.ceil(voSec * FPS);
    const duration = lead + voFrames + tail;
    slots.push({ def, start: t, duration, voStart: lead, voFrames });
    t += duration;
  }
  return slots;
}

export const totalFrames = (ad: AdDef) =>
  buildTimeline(ad).reduce((n, s) => n + s.duration, 0);
