import type {FC} from 'react';
import {Composition} from 'remotion';
import BetterWay from './videos/v5-better-way';
import DinnerLeague from './videos/v2-dinner-league';
import NoBars from './videos/v4-no-bars';
import PatchNotes from './videos/v3-patch-notes';
import SpeedrunTruth from './videos/v1-speedrun';

// Campaign 2: 5 ads × 50s, 16:9 landscape for Google Ads / YouTube.
// 1920×1080 @ 30fps = 1500 frames each.
export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="SpeedrunTruth"
        component={SpeedrunTruth}
        durationInFrames={1500}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="DinnerLeague"
        component={DinnerLeague}
        durationInFrames={1500}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PatchNotes"
        component={PatchNotes}
        durationInFrames={1500}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="NoBars"
        component={NoBars}
        durationInFrames={1500}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="BetterWay"
        component={BetterWay}
        durationInFrames={1500}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
