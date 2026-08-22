import { Composition } from "remotion";
import { RecipeRealAd } from "./Ad";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RecipeRealAd"
        component={RecipeRealAd}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
