// "One Recipe, Three Cooks" — RecipeReal character sketch.
// 50s (1500 frames @ 30fps), 1080x1920.
// Beats: chaos hook -> freeze on the "30 MIN" card -> panels re-enter ->
// three character lines -> RecipeReal estimate UI -> outro with wink.

import type {FC} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {brand} from '../../shared/theme';
import {EstimateScene} from './estimate';
import {FreezeScene} from './freeze';
import {HookScene} from './hook';
import {HoverCardScene} from './hover-card';
import {OutroScene} from './outro';
import {PanelsScene} from './panels';
import {inter} from './fonts';
import {
  audio,
  CHIME_AT,
  COUNT_TICKS,
  HOOK_SHOUTS,
  LINES,
  REALIST_TICKS,
  SCENES,
  VOICE_VOLUME,
  WINK_AT,
} from './timeline';

const ThreeCooks: FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas, fontFamily: inter}}>
      {/* ---------- VISUALS ---------- */}
      <Sequence name="Hook: shouting match" from={0} durationInFrames={SCENES.hookEnd}>
        <HookScene />
      </Sequence>
      <Sequence
        name="Freeze: 30 MIN card"
        from={SCENES.freezeStart}
        durationInFrames={SCENES.freezeEnd - SCENES.freezeStart}
      >
        <FreezeScene />
      </Sequence>
      <Sequence
        name="Panels: three cooks"
        from={SCENES.panelsStart}
        durationInFrames={832}
        premountFor={30}
      >
        <PanelsScene />
      </Sequence>
      <Sequence name="Hovering card" from={SCENES.panelsStart} durationInFrames={838} premountFor={30}>
        <HoverCardScene />
      </Sequence>
      <Sequence
        name="RecipeReal estimates"
        from={SCENES.uiStart}
        durationInFrames={SCENES.total - SCENES.uiStart}
        premountFor={30}
      >
        <EstimateScene />
      </Sequence>
      <Sequence
        name="Outro: nod + wink"
        from={SCENES.outroStart}
        durationInFrames={SCENES.total - SCENES.outroStart}
        premountFor={30}
      >
        <OutroScene />
      </Sequence>

      {/* ---------- AUDIO ---------- */}
      {/* Hook: chaos bed, cut dead at the hard cut. */}
      <Sequence name="SFX: chaos bed" from={0} durationInFrames={SCENES.hookEnd}>
        <Audio src={staticFile(audio('sfx-chaos.mp3'))} volume={0.3} />
      </Sequence>
      {/* Hook: three shouts overlapping, 4–8 frames apart. */}
      {HOOK_SHOUTS.map((s) => (
        <Sequence key={s.file} name={`Shout: ${s.file}`} from={s.from} durationInFrames={s.dur}>
          <Audio src={staticFile(audio(s.file))} volume={VOICE_VOLUME} />
        </Sequence>
      ))}
      {/* Record-scratch-stop right on the freeze. */}
      <Sequence name="SFX: record scratch" from={SCENES.hookEnd} durationInFrames={26}>
        <Audio src={staticFile(audio('sfx-scratch.mp3'))} volume={0.32} />
      </Sequence>
      {/* Scripted lines, one per cook + narrator. */}
      {Object.values(LINES).map((line) => (
        <Sequence key={line.file} name={`Line: ${line.file}`} from={line.from} durationInFrames={line.dur}>
          <Audio src={staticFile(audio(line.file))} volume={VOICE_VOLUME} />
        </Sequence>
      ))}
      {/* Realist's clock sprouting extra ticks. */}
      {REALIST_TICKS.map((t) => (
        <Sequence key={`tick-${t}`} from={t} durationInFrames={15}>
          <Audio src={staticFile(audio('sfx-tick.mp3'))} volume={0.22} />
        </Sequence>
      ))}
      {/* Beginner's boing as their card starts tilting. */}
      <Sequence name="SFX: boing" from={LINES.beginner.from} durationInFrames={20}>
        <Audio src={staticFile(audio('sfx-boing.mp3'))} volume={0.28} />
      </Sequence>
      {/* Soft ticks under the counting estimates. */}
      {COUNT_TICKS.map((t) => (
        <Sequence key={`count-${t}`} from={t} durationInFrames={15}>
          <Audio src={staticFile(audio('sfx-tick.mp3'))} volume={0.16} />
        </Sequence>
      ))}
      {/* Unified chime as all three estimates land. */}
      <Sequence name="SFX: chime" from={CHIME_AT} durationInFrames={45}>
        <Audio src={staticFile(audio('sfx-chime.mp3'))} volume={0.3} />
      </Sequence>
      {/* Playful pop on the wink. */}
      <Sequence name="SFX: pop" from={WINK_AT} durationInFrames={15}>
        <Audio src={staticFile(audio('sfx-pop.mp3'))} volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default ThreeCooks;
