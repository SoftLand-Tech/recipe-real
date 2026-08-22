import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE } from "../theme";
import { Stage } from "../components/Stage";
import { WordReveal } from "../components/WordReveal";

/**
 * Shot 1 — logo glow intro (reference: breathing orb + wordmark on black).
 * Rings ripple out, the mark lands with overshoot, the wordmark rises.
 */
export const Shot1Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cx = width / 2;
  const cy = height / 2 - 40;

  const logoPop = interpolate(frame, [8, 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.overshoot,
  });
  const glowPulse = 0.75 + 0.25 * Math.sin(frame / 16);

  return (
    <AbsoluteFill>
      <Stage seed={3} particleDensity={1.4} />

      {/* central aura */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: 900,
          height: 900,
          translate: "-50% -50%",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${C.accent}38 0%, ${C.accent}12 34%, ${C.accent}00 62%)`,
          scale: `${(0.6 + logoPop * 0.4) * glowPulse}`,
          opacity: 0.55 + logoPop * 0.45,
        }}
      />

      {/* ripple rings */}
      {[0, 1, 2].map((i) => {
        const t = interpolate(frame, [14 + i * 16, 78 + i * 16], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE.outExpo,
        });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: 200,
              height: 200,
              translate: "-50% -50%",
              borderRadius: "50%",
              border: `2px solid ${C.accentBright}`,
              scale: `${0.4 + t * 3.6}`,
              opacity: (1 - t) * 0.5,
            }}
          />
        );
      })}

      {/* logo mark */}
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          translate: "-50% -50%",
          scale: `${logoPop}`,
          rotate: `${(1 - logoPop) * 8}deg`,
        }}
      >
        <div
          style={{
            width: 216,
            height: 216,
            borderRadius: 60,
            backgroundColor: C.stageDeep,
            boxShadow: `0 0 0 1.5px ${C.accentBright}55, 0 30px 90px ${C.accent}44, 0 0 130px ${C.accent}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Img src={staticFile("logo-glow.png")} style={{ width: 196, height: 196 }} />
        </div>
      </div>

      {/* wordmark + tagline */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: cy + 168,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <WordReveal text="RecipeReal" delay={26} fontSize={78} stagger={3} />
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 27,
            fontWeight: 600,
            color: C.creamDim,
            letterSpacing: 0.4,
            opacity: interpolate(frame, [58, 82], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
            translateY: interpolate(frame, [58, 82], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
          }}
        >
          Cook real food, together.
        </div>
      </div>
    </AbsoluteFill>
  );
};
