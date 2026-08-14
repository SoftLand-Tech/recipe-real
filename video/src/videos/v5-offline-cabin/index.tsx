// "Offline Cabin Cook" — atmospheric cinematic ad, 50s @ 30fps, 1080x1920.
// Sound design replaces music: hook blips/buzz, airplane chime, chops, pan,
// a ducking sizzle bed, step dings, plate, one final crackle. Three sparse VO lines.
import type {FC} from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {brand} from '../../shared/theme';
import AudioTrack from './AudioTrack';
import CabinScene from './CabinScene';
import FinaleScene from './FinaleScene';
import {inter} from './fonts';
import HookScene from './HookScene';
import {CABIN_FROM, FINALE_DURATION, FINALE_FROM, HOOK_DURATION} from './timing';

const OfflineCabin: FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas, fontFamily: inter}}>
      {/* Cabin kitchen runs 3s -> end underneath the other layers */}
      <Sequence from={CABIN_FROM} name="Cabin kitchen" premountFor={30}>
        <CabinScene />
      </Sequence>
      <Sequence durationInFrames={HOOK_DURATION} name="Signal hook" premountFor={30}>
        <HookScene />
      </Sequence>
      <Sequence
        from={FINALE_FROM}
        durationInFrames={FINALE_DURATION}
        name="Finale logo"
        premountFor={30}
      >
        <FinaleScene />
      </Sequence>
      <AudioTrack />
    </AbsoluteFill>
  );
};

export default OfflineCabin;
