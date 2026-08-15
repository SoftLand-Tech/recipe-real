// "There's Got To Be A Better Way" — RecipeReal campaign 2, ad v5.
// 41 scenes / 1500 frames @ 30fps. Acts 1-3 in B/W film melodrama,
// then a record scratch snaps to full-color modern infomercial energy.
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import type {FC} from 'react';
import {SCENES} from './scenes';
import {TIMELINE} from './timeline';
import './fonts';
import {
  Scene01,
  Scene02,
  Scene03,
  Scene04,
  Scene05,
  Scene06,
  Scene07,
  Scene08,
  Scene09,
  Scene10,
  Scene11,
  Scene12,
  Scene13,
  Scene14,
  Scene15,
  Scene16,
} from './act1';
import {
  Scene17,
  Scene18,
  Scene19,
  Scene20,
  Scene21,
  Scene22,
  Scene23,
  Scene24,
  Scene25,
  Scene26,
  Scene27,
  Scene28,
} from './act4';
import {Scene29,
  Scene30,
  Scene31,
  Scene32,
  Scene33,
  Scene34,
  Scene35,
} from './act5';
import {Scene36, Scene37, Scene38, Scene39, Scene40, Scene41} from './act6';

const REGISTRY: Record<string, FC> = {
  s01: Scene01,
  s02: Scene02,
  s03: Scene03,
  s04: Scene04,
  s05: Scene05,
  s06: Scene06,
  s07: Scene07,
  s08: Scene08,
  s09: Scene09,
  s10: Scene10,
  s11: Scene11,
  s12: Scene12,
  s13: Scene13,
  s14: Scene14,
  s15: Scene15,
  s16: Scene16,
  s17: Scene17,
  s18: Scene18,
  s19: Scene19,
  s20: Scene20,
  s21: Scene21,
  s22: Scene22,
  s23: Scene23,
  s24: Scene24,
  s25: Scene25,
  s26: Scene26,
  s27: Scene27,
  s28: Scene28,
  s29: Scene29,
  s30: Scene30,
  s31: Scene31,
  s32: Scene32,
  s33: Scene33,
  s34: Scene34,
  s35: Scene35,
  s36: Scene36,
  s37: Scene37,
  s38: Scene38,
  s39: Scene39,
  s40: Scene40,
  s41: Scene41,
};

const BetterWay: FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      {TIMELINE.map((slot, i) => {
        const Scene = REGISTRY[slot.id];
        const scene = SCENES[i];
        return (
          <Sequence
            key={slot.id}
            from={slot.start}
            durationInFrames={slot.frames}
            name={`${slot.id} · ${scene.vo ?? scene.sfx ?? 'beat'}`}
          >
            <Scene />
          </Sequence>
        );
      })}
      {/* Audio pass: VO and SFX live in unbounded sequences so their tails
          ring out naturally instead of being cut at scene boundaries. */}
      {TIMELINE.map((slot, i) => {
        const scene = SCENES[i];
        return (
          <Sequence key={`${slot.id}-audio`} from={slot.start} layout="none">
            {scene.vo ? (
              <Audio src={staticFile(`audio/v5/vo-${slot.id.replace('s', '')}.mp3`)} volume={0.9} />
            ) : null}
            {scene.sfx ? (
              <Audio src={staticFile(`audio/v5/sfx-${scene.sfx}.mp3`)} volume={0.3} />
            ) : null}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default BetterWay;
