import React from "react";
import { Sequence, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import type { SceneSlot } from "./timeline";

/** VO + SFX for one scene; must be rendered inside the scene's Sequence. */
export const SceneAudio: React.FC<{ adId: string; scene: SceneSlot }> = ({ adId, scene }) => (
  <>
    <Sequence from={scene.voStart} layout="none" name={`${scene.def.id} VO`}>
      <Audio src={staticFile(`audio/${adId}/${scene.def.id}.mp3`)} />
    </Sequence>
    {scene.def.sfx?.map((cue, i) => (
      <Sequence key={i} from={cue.at} layout="none">
        <Audio src={staticFile(`sfx/${cue.name}.mp3`)} volume={cue.volume ?? 0.5} />
      </Sequence>
    ))}
  </>
);
