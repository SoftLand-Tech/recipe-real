import React from "react";
import { Composition } from "remotion";
import { ThirtyMinuteLieComp, TML_DURATION } from "./ads/ThirtyMinuteLie";
import { ItLearnsYouComp, ILY_DURATION } from "./ads/ItLearnsYou";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ThirtyMinuteLie"
      component={ThirtyMinuteLieComp}
      durationInFrames={TML_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="ItLearnsYou"
      component={ItLearnsYouComp}
      durationInFrames={ILY_DURATION}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
