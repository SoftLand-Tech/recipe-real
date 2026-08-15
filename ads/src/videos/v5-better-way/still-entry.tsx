// Isolated entry for still/QC renders only — avoids bundling sibling agents'
// in-flight files. The production entry is src/index.ts (Root.tsx).
import {Composition, registerRoot} from 'remotion';
import type {FC} from 'react';
import BetterWay from './index';

const StillRoot: FC = () => (
  <Composition
    id="BetterWay"
    component={BetterWay}
    durationInFrames={1500}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(StillRoot);
