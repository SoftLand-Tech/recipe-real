import type {FC} from 'react';
import {Composition} from 'remotion';
import CookModeDemo from './videos/v2-cook-mode';
import CrowdVsBlogger from './videos/v3-crowd-vs-blogger';
import FifteenMinuteLie from './videos/v1-fifteen-minute-lie';
import OfflineCabin from './videos/v5-offline-cabin';
import ThreeCooks from './videos/v4-three-cooks';

// 5 ads × 50s: 1080×1920 @ 30fps = 1500 frames each.
export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="FifteenMinuteLie"
        component={FifteenMinuteLie}
        durationInFrames={1500}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CookModeDemo"
        component={CookModeDemo}
        durationInFrames={1500}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="CrowdVsBlogger"
        component={CrowdVsBlogger}
        durationInFrames={1500}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ThreeCooks"
        component={ThreeCooks}
        durationInFrames={1500}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="OfflineCabin"
        component={OfflineCabin}
        durationInFrames={1500}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
