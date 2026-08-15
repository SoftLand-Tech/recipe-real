// "Recipe Patch Notes v2.0" — RecipeReal campaign 2, ad 3.
// Recipes are buggy software; 10,000 cooks shipped the fix. 1920×1080 @30fps, 1500 frames.
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {SCENES} from './scenes';
import {SFX_FRAME, TIMELINE} from './timeline';
import {SCENE_COMPONENTS} from './acts';
import {C} from './ui';

const PatchNotes = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      {TIMELINE.map((slot) => {
        const Scene = SCENE_COMPONENTS[slot.id];
        if (!Scene) {
          throw new Error(`No component for scene ${slot.id}`);
        }
        const sfxAt = SFX_FRAME[slot.id] ?? 0;
        return (
          <Sequence
            key={slot.id}
            name={`${slot.id} · ${SCENES[slot.index].visual.slice(0, 40)}`}
            from={slot.start}
            durationInFrames={slot.frames}
            premountFor={20}
          >
            <AbsoluteFill style={{backgroundColor: C.bg}}>
              <Scene />
              {slot.voFile ? (
                <Audio src={staticFile(`audio/v3/${slot.voFile}`)} volume={0.9} />
              ) : null}
              {sfxAt > 0 ? (
                <Sequence from={sfxAt} layout="none" durationInFrames={slot.frames - sfxAt}>
                  <Audio src={staticFile(`audio/v3/${slot.scene.sfx}.mp3`)} volume={0.32} />
                </Sequence>
              ) : (
                <Audio src={staticFile(`audio/v3/${slot.scene.sfx}.mp3`)} volume={0.32} />
              )}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default PatchNotes;
