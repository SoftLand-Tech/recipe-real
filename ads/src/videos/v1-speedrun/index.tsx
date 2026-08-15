// SpeedrunTruth — RecipeReal campaign 2, ad 1.
// A weeknight dinner framed as a video-game speedrun: blog recipe times are
// "cheated runs"; RecipeReal is the legitimately-timed route verified by 10,000
// home cooks. Ends on an honest 43:12 personal best.
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {Fragment} from 'react';
import {SCENES} from './scenes';
import {TIMELINE} from './timeline';
import {Backdrop} from './ui';
import {S01, S02, S03, S04, S05} from './act1';
import {S06, S07, S08, S09, S10, S11} from './act2';
import {S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23} from './act3';
import {S24, S25, S26, S27, S28, S29, S30, S31, S32, S33} from './act4';
import {S34, S35, S36, S37, S38, S39, S40, S41} from './act56';

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
  s41: S41,
};

const SFX_VOLUME: Record<string, number> = {
  buzzer: 0.35,
  fanfare: 0.35,
  stamp: 0.3,
  drop: 0.25,
  chime: 0.25,
  pop: 0.25,
  whoosh: 0.25,
  blip: 0.2,
  tick: 0.2,
};

const SpeedrunTruth: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#101418'}}>
      <Backdrop />

      {SCENES.map((scene, index) => {
        const timing = TIMELINE[index];
        const Component = SCENE_COMPONENTS[scene.id];
        if (!Component) throw new Error(`No component for scene ${scene.id}`);
        return (
          <Sequence
            key={scene.id}
            name={`${scene.id} (${scene.vo ?? scene.sfx ?? 'silent'})`}
            from={timing.start}
            durationInFrames={timing.durationInFrames}
            premountFor={15}
          >
            <Component />
          </Sequence>
        );
      })}

      {/* Voiceover + SFX live outside scene sequences so premounting never
          advances audio. SFX tails may run a few frames past a hard cut. */}
      {SCENES.map((scene, index) => {
        const timing = TIMELINE[index];
        const tail = Math.min(24, 1500 - timing.start - timing.durationInFrames);
        return (
          <Fragment key={`${scene.id}-audio`}>
            {scene.vo ? (
              <Sequence
                key={`${scene.id}-vo`}
                name={`${scene.id}-vo`}
                from={timing.start}
                durationInFrames={timing.durationInFrames}
                layout="none"
              >
                <Audio src={staticFile(`audio/v1/vo-${scene.id.slice(1)}.mp3`)} volume={0.9} />
              </Sequence>
            ) : null}
            {scene.sfx ? (
              <Sequence
                key={`${scene.id}-sfx`}
                name={`${scene.id}-sfx`}
                from={timing.start}
                durationInFrames={timing.durationInFrames + tail}
                layout="none"
              >
                <Audio
                  src={staticFile(`audio/v1/sfx-${scene.sfx}.mp3`)}
                  volume={SFX_VOLUME[scene.sfx] ?? 0.25}
                  loop={scene.sfx === 'tick'}
                />
              </Sequence>
            ) : null}
          </Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

export default SpeedrunTruth;
