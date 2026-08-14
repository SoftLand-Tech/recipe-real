// Full sound design — diegetic SFX only, no music. Narration -3dB (0.71);
// sizzle bed -14dB (0.2) ducking an extra -6dB under narration; one-shots 0.22-0.35.
import type {FC} from 'react';
import {Audio, Sequence, interpolate, staticFile} from 'remotion';
import {BEAT, NARR_VOL, SIZZLE_BASE, duckMultiplier} from './timing';

const clip = (name: string): string => staticFile(`audio/v5/${name}`);

// 5s sizzle clip tiled across 15s-38s via consecutive Sequences.
const SIZZLE_SEGMENTS: readonly {from: number; dur: number}[] = [
  {from: BEAT.sizzleStart, dur: 150}, // 15s
  {from: BEAT.sizzleStart + 150, dur: 150}, // 20s
  {from: BEAT.sizzleStart + 300, dur: 150}, // 25s
  {from: BEAT.sizzleStart + 450, dur: 150}, // 30s (narration 2 ducks under)
  {from: BEAT.sizzleStart + 600, dur: 90}, // 35s -> ends exactly at 38s
];

const sizzleVolumeFor =
  (from: number, dur: number) =>
  (f: number): number => {
    const fadeIn =
      from === BEAT.sizzleStart
        ? interpolate(f, [0, 18], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
        : 1;
    const fadeOut =
      dur < 150
        ? interpolate(f, [dur - 36, dur - 3], [1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1;
    return SIZZLE_BASE * fadeIn * fadeOut * duckMultiplier(from + f);
  };

const AudioTrack: FC = () => (
  <>
    {/* Narration */}
    <Sequence from={BEAT.narr1} layout="none" name="VO — Signal's gone">
      <Audio src={clip('line-1.mp3')} volume={NARR_VOL} />
    </Sequence>
    <Sequence from={BEAT.narr2} layout="none" name="VO — Pocket not cloud">
      <Audio src={clip('line-2.mp3')} volume={NARR_VOL} />
    </Sequence>
    <Sequence from={BEAT.narr3} layout="none" name="VO — RecipeReal">
      <Audio src={clip('line-3.mp3')} volume={NARR_VOL} />
    </Sequence>

    {/* Hook: bars dying */}
    {BEAT.barDie.slice(0, 3).map((at) => (
      <Sequence key={`blip-${at}`} from={at} layout="none" name={`SFX power-down blip @${at}`}>
        <Audio src={clip('sfx-blip.mp3')} volume={0.3} />
      </Sequence>
    ))}
    <Sequence from={BEAT.barDie[2]} layout="none" name="SFX static crackle">
      <Audio src={clip('sfx-static.mp3')} volume={0.22} />
    </Sequence>
    <Sequence from={BEAT.barDie[3]} layout="none" name="SFX no-signal buzz">
      <Audio src={clip('sfx-buzz.mp3')} volume={0.28} />
    </Sequence>

    {/* Pull back: airplane mode */}
    <Sequence from={BEAT.airplane} layout="none" name="SFX airplane chime">
      <Audio src={clip('sfx-airplane.mp3')} volume={0.3} />
    </Sequence>

    {/* Cook mode: 3 rhythmic chops */}
    {BEAT.chops.map((at) => (
      <Sequence key={`chop-${at}`} from={at} layout="none" name={`SFX knife chop @${at}`}>
        <Audio src={clip('sfx-chop.mp3')} volume={0.35} />
      </Sequence>
    ))}

    {/* Pan settles on the stove, then the sizzle bed runs 15s-38s */}
    <Sequence from={BEAT.panSettle} layout="none" name="SFX pan settle">
      <Audio src={clip('sfx-pan.mp3')} volume={0.32} />
    </Sequence>
    {SIZZLE_SEGMENTS.map(({from, dur}) => (
      <Sequence key={`sizzle-${from}`} from={from} durationInFrames={dur} layout="none" name={`SFX sizzle bed @${from}`}>
        <Audio src={clip('sfx-sizzle.mp3')} volume={sizzleVolumeFor(from, dur)} />
      </Sequence>
    ))}

    {/* Timer-ring completions (25.5s-33.5s) + final step chime (41s) */}
    {BEAT.ringDone.map((at) => (
      <Sequence key={`ding-${at}`} from={at} layout="none" name={`SFX step ding @${at}`}>
        <Audio src={clip('sfx-ding.mp3')} volume={0.26} />
      </Sequence>
    ))}
    <Sequence from={BEAT.finalStep} layout="none" name="SFX final chime">
      <Audio src={clip('sfx-ding.mp3')} volume={0.3} />
    </Sequence>

    {/* Golden wash: plate set down */}
    <Sequence from={BEAT.plate} layout="none" name="SFX plate set down">
      <Audio src={clip('sfx-plate.mp3')} volume={0.32} />
    </Sequence>

    {/* Outro: one faint crackle, then silence */}
    <Sequence from={BEAT.crackle} layout="none" name="SFX faint crackle">
      <Audio src={clip('sfx-crackle.mp3')} volume={0.22} />
    </Sequence>
  </>
);

export default AudioTrack;
