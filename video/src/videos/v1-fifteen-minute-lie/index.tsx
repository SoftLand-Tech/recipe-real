import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {at, brand} from '../../shared/theme';
import {HookScene} from './HookScene';
import {ListScene} from './ListScene';
import {LogoScene} from './LogoScene';
import {PhoneScene} from './PhoneScene';
import {ShatterScene} from './ShatterScene';
import {SplitScene} from './SplitScene';

/** Narration at -3dB, sound design at -12dB. */
const NARRATION_VOLUME = 0.71;
const SFX_VOLUME = 0.25;

const sfx = (file: string) => staticFile(`audio/v1/${file}`);

/**
 * Sound-design beat map (frames @ 30fps), aligned to the narration's measured
 * sentence boundaries:
 * - 6    timer slam lands (hook open)
 * - 24   0.8s  glass crack — "This recipe is lying to you." hits
 * - 99/100   3.3s  timer shatters into LYING (crack + thud)
 * - 186/267/320   6.2/8.9/10.7s  list rows slam (thuds) on "ten / five / twenty more"
 * - 684  22.8s  community counter settles on 43:00 (tick)
 * - 752/809/866/923   per-step bars finish filling (ticks)
 * - 970  32.3s  REAL TOTAL 43:00 locks (tick)
 * - 1050 35s   split screen slams at 3x scale (bass impact)
 * - 1170 39s   REAL LIFE 43:00 re-punch (thud)
 * - 1260 42s   the label's 15:00 gets struck out (tick)
 * - 1350 45s   logo card (soft whoosh)
 */
export default function FifteenMinuteLie() {
  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* ——— Sound design ——— */}
      <Sequence from={0} name="Narration">
        <Audio src={sfx('narration.mp3')} volume={NARRATION_VOLUME} />
      </Sequence>
      <Sequence from={6} name="SFX timer slam">
        <Audio src={sfx('sfx-thud.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={at(0.8)} name="SFX accusation crack">
        <Audio src={sfx('sfx-crack.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={99} name="SFX shatter crack">
        <Audio src={sfx('sfx-crack.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={100} name="SFX shatter weight">
        <Audio src={sfx('sfx-thud.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={186} name="SFX chopping row">
        <Audio src={sfx('sfx-thud.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={267} name="SFX preheat row">
        <Audio src={sfx('sfx-thud.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={320} name="SFX cleanup row">
        <Audio src={sfx('sfx-thud.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={684} name="SFX counter settles">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={752} name="SFX bar 1">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={809} name="SFX bar 2">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={866} name="SFX bar 3">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={923} name="SFX bar 4">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={970} name="SFX real total">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={1050} name="SFX split bass impact">
        <Audio src={sfx('sfx-bass.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={1170} name="SFX real life punch">
        <Audio src={sfx('sfx-thud.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={1260} name="SFX label struck">
        <Audio src={sfx('sfx-tick.mp3')} volume={SFX_VOLUME} />
      </Sequence>
      <Sequence from={1350} name="SFX logo whoosh">
        <Audio src={sfx('sfx-whoosh.mp3')} volume={SFX_VOLUME} />
      </Sequence>

      {/* ——— Scenes ——— */}
      <Sequence from={0} durationInFrames={90} name="Hook — the lie (0-3s)">
        <HookScene />
      </Sequence>
      <Sequence
        from={90}
        durationInFrames={90}
        name="Shatter — LYING (3-6s)"
        premountFor={15}
      >
        <ShatterScene />
      </Sequence>
      <Sequence
        from={180}
        durationInFrames={360}
        name="Receipt of lies (6-18s)"
        premountFor={15}
      >
        <ListScene />
      </Sequence>
      <Sequence
        from={540}
        durationInFrames={510}
        name="RecipeReal app (18-35s)"
        premountFor={15}
      >
        <PhoneScene />
      </Sequence>
      <Sequence
        from={1050}
        durationInFrames={300}
        name="Label vs real life (35-45s)"
        premountFor={15}
      >
        <SplitScene />
      </Sequence>
      <Sequence
        from={1350}
        durationInFrames={150}
        name="Logo — cook the truth (45-50s)"
        premountFor={15}
      >
        <LogoScene />
      </Sequence>
    </AbsoluteFill>
  );
}
