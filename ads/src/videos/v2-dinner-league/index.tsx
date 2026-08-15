// DINNER LEAGUE FINAL — RecipeReal campaign 2, ad 2 of 5.
// A weeknight dinner narrated as a live sports broadcast:
// YOU vs BLOGGERS FC ("a 15-minute recipe"), with Cook Mode's honest
// crowd-sourced clocks winning the second half. 1920x1080 @ 30fps, 1500 frames.
import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {F_SPACE} from './fonts';
import {NAVY} from './tokens';
import {TIMELINE} from './timeline';
import {ScoreBug} from './components/ScoreBug';
import {
  S01,
  S02,
  S03,
  S04,
  S05,
  S06,
  S07,
  S08,
  S09,
  S10,
  S11,
  S12,
  S13,
} from './scenes-a';
import {
  S14,
  S15,
  S16,
  S17,
  S18,
  S19,
  S20,
  S21,
  S22,
  S23,
  S24,
  S25,
  S26,
} from './scenes-b';
import {
  S27,
  S28,
  S29,
  S30,
  S31,
  S32,
  S33,
  S34,
  S35,
  S36,
  S37,
  S38,
  S39,
  S40,
} from './scenes-c';

const SCENE_COMPONENTS: Record<string, React.FC> = {
  s01: S01,
  s02: S02,
  s03: S03,
  s04: S04,
  s05: S05,
  s06: S06,
  s07: S07,
  s08: S08,
  s09: S09,
  s10: S10,
  s11: S11,
  s12: S12,
  s13: S13,
  s14: S14,
  s15: S15,
  s16: S16,
  s17: S17,
  s18: S18,
  s19: S19,
  s20: S20,
  s21: S21,
  s22: S22,
  s23: S23,
  s24: S24,
  s25: S25,
  s26: S26,
  s27: S27,
  s28: S28,
  s29: S29,
  s30: S30,
  s31: S31,
  s32: S32,
  s33: S33,
  s34: S34,
  s35: S35,
  s36: S36,
  s37: S37,
  s38: S38,
  s39: S39,
  s40: S40,
};

const SFX_VOLUME: Record<string, number> = {
  whistle: 0.35,
  'whistle-final': 0.35,
  crowd: 0.28,
  whoosh: 0.22,
  scribble: 0.2,
  horn: 0.3,
  ding: 0.24,
  tick: 0.22,
  fanfare: 0.3,
  blip: 0.2,
};

const SceneSlot: React.FC<{id: string; vo: string | null; sfx: string | null}> = ({
  id,
  vo,
  sfx,
}) => {
  const Scene = SCENE_COMPONENTS[id];
  return (
    <>
      <Scene />
      {vo ? (
        <Audio src={staticFile(`audio/v2/vo-${id}.mp3`)} volume={0.9} />
      ) : null}
      {sfx ? (
        <Audio
          src={staticFile(`audio/v2/${sfx}.mp3`)}
          volume={SFX_VOLUME[sfx] ?? 0.25}
        />
      ) : null}
    </>
  );
};

const DinnerLeague: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: NAVY, fontFamily: F_SPACE}}>
      {TIMELINE.map((slot) => (
        <Sequence
          key={slot.id}
          name={`${slot.id}${slot.speaker ? ` (${slot.speaker})` : ' (sfx)'}`}
          from={slot.start}
          durationInFrames={slot.frames}
          premountFor={12}
        >
          <SceneSlot id={slot.id} vo={slot.vo} sfx={slot.sfx} />
        </Sequence>
      ))}
      {/* persistent broadcast bug on top of everything */}
      <ScoreBug />
    </AbsoluteFill>
  );
};

export default DinnerLeague;
