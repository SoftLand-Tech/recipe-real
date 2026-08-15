// "No Bars. Full Dinner." — RecipeReal campaign 2, ad 4 of 5.
// 1920×1080 · 30fps · 1500 frames (50s). One unbothered cook, absurd dead zones,
// one timer that never stops. Timeline is audio-first: see timeline.ts.
import {FC} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {scenes} from './scenes';
import {TIMELINE} from './timeline';
import {S01, S02, S03, S04, S05} from './act1';
import {S06, S07, S08, S09, S10, S11, S12, S13, S14} from './act2';
import {S15, S16, S17, S18, S19, S20, S21, S22} from './act3';
import {S23, S24, S25, S26, S27, S28, S29, S30, S31, S32, S33, S34} from './act4';
import {S35, S36, S37, S38, S39, S40} from './act5';
import {S41, S42, S43, S44} from './act6';

const SCENE_COMPONENTS: Record<string, FC> = {
  s01: S01, s02: S02, s03: S03, s04: S04, s05: S05,
  s06: S06, s07: S07, s08: S08, s09: S09, s10: S10, s11: S11, s12: S12, s13: S13, s14: S14,
  s15: S15, s16: S16, s17: S17, s18: S18, s19: S19, s20: S20, s21: S21, s22: S22,
  s23: S23, s24: S24, s25: S25, s26: S26, s27: S27, s28: S28, s29: S29, s30: S30,
  s31: S31, s32: S32, s33: S33, s34: S34,
  s35: S35, s36: S36, s37: S37, s38: S38, s39: S39, s40: S40,
  s41: S41, s42: S42, s43: S43, s44: S44,
};

/** Per-effect loudness — VO sits at 0.9, effects stay underneath. */
const SFX_VOLUME: Record<string, number> = {
  'blip-descend': 0.3,
  'error-womp': 0.3,
  'slam-boom': 0.35,
  'plate-set': 0.3,
  'tunnel-rumble': 0.35,
  'train-whoosh': 0.35,
  'step-ding': 0.3,
  'wind-gust': 0.3,
  bubble: 0.25,
  'spinner-strain': 0.25,
  'snap-in': 0.28,
  'ui-tick': 0.22,
  'airplane-hum': 0.28,
  sizzle: 0.3,
  'bite-crunch': 0.35,
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const NoBars: FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#171310'}}>
      {TIMELINE.map((slot, i) => {
        const scene = scenes[i];
        const Comp = SCENE_COMPONENTS[slot.id];
        const voSrc = slot.voIdx === null ? null : staticFile(`audio/v4/vo-${pad2(slot.voIdx)}.mp3`);
        const sfxSrc = scene.sfx === null ? null : staticFile(`audio/v4/sfx-${scene.sfx}.mp3`);
        return (
          <Sequence
            key={slot.id}
            from={slot.start}
            durationInFrames={slot.frames}
            premountFor={20}
            name={`${slot.id} · ${scene.vo ?? scene.sfx ?? ''}`}
          >
            <Comp />
            {voSrc !== null && <Audio src={voSrc} volume={0.9} />}
            {sfxSrc !== null && <Audio src={sfxSrc} volume={SFX_VOLUME[scene.sfx as string] ?? 0.3} />}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default NoBars;
