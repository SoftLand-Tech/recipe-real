import type {FC} from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {at, brand} from '../../shared/theme';
import Sfx from './audio';
import {Narration} from './audio';
import BarsScene from './BarsScene';
import CardsScene from './CardsScene';
import HookScene from './HookScene';
import OdometerScene from './OdometerScene';
import OutroScene from './OutroScene';
import TimelineScene from './TimelineScene';

/**
 * "Crowd vs. Blogger" — 50s data-viz ad (1500 frames @ 30fps, 1080x1920).
 * Beat map: hook 0-3s / odometer 3-8s / bar race 8-18s / card cascade 18-30s
 * (push-in until 32s) / step timeline 32-42s / outro 42-50s.
 */
const CrowdVsBlogger: FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      <Sequence from={0} durationInFrames={90} name="Hook: stat slam">
        <HookScene />
      </Sequence>

      <Sequence from={at(3)} durationInFrames={150} premountFor={30} name="Odometer: 1,000 recipes">
        <OdometerScene />
      </Sequence>

      <Sequence from={at(8)} durationInFrames={300} premountFor={30} name="Bar race: promise vs real">
        <BarsScene />
      </Sequence>

      <Sequence from={at(18)} durationInFrames={420} premountFor={30} name="Card cascade + push-in">
        <CardsScene />
      </Sequence>

      <Sequence from={at(32)} durationInFrames={300} premountFor={30} name="Step timeline">
        <TimelineScene />
      </Sequence>

      <Sequence from={at(42)} durationInFrames={240} premountFor={30} name="Outro: logo">
        <OutroScene />
      </Sequence>

      <Narration />
      <Sfx />
    </AbsoluteFill>
  );
};

export default CrowdVsBlogger;
