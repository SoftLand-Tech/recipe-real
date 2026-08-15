// QC-only entry point: registers ONLY PatchNotes so stills can be rendered in
// isolation while sibling agents' folders are mid-edit. The real entry is
// src/index.ts (all five compositions) — do not use this for final renders.
import {type FC} from 'react';
import {Composition, registerRoot} from 'remotion';
import PatchNotes from './index';

const StillRoot: FC = () => (
  <Composition
    id="PatchNotes"
    component={PatchNotes}
    durationInFrames={1500}
    fps={30}
    width={1920}
    height={1080}
  />
);

registerRoot(StillRoot);
