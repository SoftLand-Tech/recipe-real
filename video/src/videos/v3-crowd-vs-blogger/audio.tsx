import {Audio, Sequence, staticFile} from 'remotion';
import {at, FPS} from '../../shared/theme';

/**
 * Narration is one MP3 (29.63s). It is played as trimmed segments so each
 * sentence lands on its scene beat. Times below were measured from the file
 * with silence detection; trimBefore/trimAfter are frames inside the file.
 */
const NARRATION_SRC = staticFile('audio/v3/narration.mp3');
export const NARRATION_VOLUME = 0.71;

type NarrationSegment = {
  from: number;
  trimBefore: number;
  trimAfter: number;
};

const NARRATION_SEGMENTS: NarrationSegment[] = [
  // "Every recipe you've ever cooked took longer than it promised." (hook)
  {from: at(0.0), trimBefore: at(0.0), trimAfter: at(3.15)},
  // "We checked a thousand of them." (odometer)
  {from: at(3.35), trimBefore: at(3.47), trimAfter: at(5.1)},
  // "Bloggers say twenty minutes. Real cooks? Thirty-eight." (bar race)
  {from: at(8.6), trimBefore: at(5.7), trimAfter: at(9.7)},
  // "Underestimated — every single time." (hatched gap)
  {from: at(13.3), trimBefore: at(10.3), trimAfter: at(13.1)},
  // "But when thousands of cooks report real times, the guesswork disappears."
  {from: at(18.4), trimBefore: at(14.35), trimAfter: at(18.65)},
  // "Every step calibrated." (push-in + steps)
  {from: at(30.4), trimBefore: at(19.28), trimAfter: at(20.8)},
  // "Every minute accounted for." (running total)
  {from: at(34.0), trimBefore: at(21.38), trimAfter: at(22.95)},
  // "Even cleanup." (cleanup bar docks)
  {from: at(39.3), trimBefore: at(23.28), trimAfter: at(24.28)},
  // "This is what honest cooking data looks like." (outro)
  {from: at(42.9), trimBefore: at(25.23), trimAfter: at(27.53)},
  // "RecipeReal." (logo)
  {from: at(46.0), trimBefore: at(28.45), trimAfter: at(29.4)},
];

export const Narration = () => (
  <>
    {NARRATION_SEGMENTS.map((segment, i) => (
      <Sequence
        key={i}
        from={segment.from}
        layout="none"
        name={`VO ${String(i + 1).padStart(2, '0')}`}
      >
        <Audio
          src={NARRATION_SRC}
          trimBefore={segment.trimBefore}
          trimAfter={segment.trimAfter}
          volume={NARRATION_VOLUME}
        />
      </Sequence>
    ))}
  </>
);

/* ------------------------------- SFX beats ------------------------------- */

export const BASS = staticFile('audio/v3/sfx-bass.mp3');
export const TICK = staticFile('audio/v3/sfx-tick.mp3');
export const RISER = staticFile('audio/v3/sfx-riser.mp3');
export const PENCIL = staticFile('audio/v3/sfx-pencil.mp3');
export const FLIP = staticFile('audio/v3/sfx-flip.mp3');
export const CLICK = staticFile('audio/v3/sfx-click.mp3');
export const SWOOSH = staticFile('audio/v3/sfx-swoosh.mp3');

/** Hook: numbers collide at ~2.07s. */
export const HOOK_IMPACT_FRAME = 62;

/** Odometer tick beats: accelerating (gap shrinks geometrically to 70ms). */
export const odometerTickFrames: number[] = (() => {
  const frames: number[] = [];
  let t = 3.05;
  let gap = 0.42;
  while (t < 7.1) {
    frames.push(Math.round(t * FPS));
    t += gap;
    gap = Math.max(gap * 0.86, 0.07);
  }
  return frames;
})();

/** Card cascade (scene starts at 540): local frame each card flips. */
export const CARDS_SCENE_FROM = 540;
export const cardFlipLocalFrame = (index: number): number => 132 + index * 4;

/** Step timeline: comp frames the 4 steps snap in. */
export const STEP_SNAP_COMP_FRAMES = [at(33.0), at(33.6), at(34.2), at(34.8)];
export const CLEANUP_DOCK_COMP_FRAME = at(39.4);

const Sfx = () => (
  <>
    {/* Hook collision: bass impact + red sparks. */}
    <Sequence from={HOOK_IMPACT_FRAME - 1} layout="none" name="SFX bass impact">
      <Audio src={BASS} volume={0.35} />
    </Sequence>

    {/* Odometer: accelerating ticks, getting louder as the count runs away. */}
    {odometerTickFrames.map((frame, i) => (
      <Sequence key={`tick-${i}`} from={frame} layout="none" name={`SFX tick ${i}`}>
        <Audio
          src={TICK}
          volume={
            i === odometerTickFrames.length - 1
              ? 0.34
              : 0.18 + (0.12 * i) / Math.max(1, odometerTickFrames.length - 1)
          }
        />
      </Sequence>
    ))}

    {/* Bar race: swelling riser under the growing bars. */}
    <Sequence from={at(8.6)} layout="none" name="SFX riser">
      <Audio src={RISER} volume={0.26} />
    </Sequence>

    {/* "The lie" hatched gap draws in with a pencil scratch. */}
    <Sequence from={at(13.4)} layout="none" name="SFX pencil">
      <Audio src={PENCIL} volume={0.28} />
    </Sequence>

    {/* 30 card flips: rapid, building a rhythmic wall of sound. */}
    {new Array(30).fill(true).map((_, i) => (
      <Sequence
        key={`flip-${i}`}
        from={CARDS_SCENE_FROM + cardFlipLocalFrame(i)}
        layout="none"
        name={`SFX flip ${i}`}
      >
        <Audio src={FLIP} volume={0.14 + (0.16 * i) / 29} />
      </Sequence>
    ))}

    {/* Push into one card. */}
    <Sequence from={at(30.0)} layout="none" name="SFX swoosh push">
      <Audio src={SWOOSH} volume={0.28} />
    </Sequence>

    {/* Step timeline snaps left-to-right. */}
    {STEP_SNAP_COMP_FRAMES.map((frame, i) => (
      <Sequence key={`step-${i}`} from={frame} layout="none" name={`SFX step click ${i}`}>
        <Audio src={CLICK} volume={0.2} />
      </Sequence>
    ))}

    {/* Cleanup bar docks: final metallic click. */}
    <Sequence from={CLEANUP_DOCK_COMP_FRAME} layout="none" name="SFX final click">
      <Audio src={CLICK} volume={0.4} />
    </Sequence>

    {/* Outro: single swoosh-thunk, then 1.5s of silence to end. */}
    <Sequence from={at(42.0)} layout="none" name="SFX swoosh thunk">
      <Audio src={SWOOSH} volume={0.35} />
    </Sequence>
  </>
);

export default Sfx;
