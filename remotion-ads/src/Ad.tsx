import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { loadFont } from "@remotion/google-fonts/Manrope";
import { Shot1Logo } from "./shots/Shot1Logo";
import { Shot2Library } from "./shots/Shot2Library";
import { Shot3Cooking } from "./shots/Shot3Cooking";
import { Shot4Community } from "./shots/Shot4Community";
import { Shot5StatCta } from "./shots/Shot5StatCta";

loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

/**
 * RecipeReal — 60s 16:9 ad.
 * Reference motion language: hard cuts between shots, motion already running at
 * every cut, dark warm stage with light UI floating on it, glow accents.
 * No crossfades — energy carries the edit.
 */

// Shot boundaries in frames @30fps — hard cuts.
const S1 = 0; // logo glow
const S2 = 126; // library
const S3 = 540; // cooking mode
const S4 = 1020; // community
const S5 = 1380; // stat + CTA
const END = 1800;

export const RecipeRealAd: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#171310" }}>
      <Sequence name="1 · Logo glow" from={S1} durationInFrames={S2 - S1}>
        <Shot1Logo />
      </Sequence>
      <Sequence name="2 · Library 20k" from={S2} durationInFrames={S3 - S2}>
        <Shot2Library />
      </Sequence>
      <Sequence name="3 · Cooking mode" from={S3} durationInFrames={S4 - S3}>
        <Shot3Cooking />
      </Sequence>
      <Sequence name="4 · Community" from={S4} durationInFrames={S5 - S4}>
        <Shot4Community />
      </Sequence>
      <Sequence name="5 · Stat + CTA" from={S5} durationInFrames={END - S5}>
        <Shot5StatCta />
      </Sequence>
    </AbsoluteFill>
  );
};
