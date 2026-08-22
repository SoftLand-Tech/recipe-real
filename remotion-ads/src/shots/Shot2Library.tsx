import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, EASE } from "../theme";
import { Stage } from "../components/Stage";
import { WordReveal, PopChip } from "../components/WordReveal";
import { BrowseScreen, FloatingRecipeCard, PhoneFrame } from "../components/phone";
import { RecipeOrbit } from "../three/RecipeOrbit";
import { IconStar } from "../components/icons";

/**
 * Shot 2 — the library. Reference moves: tilted phone entering on a dark stage,
 * content orbiting in 3D, floating cards drifting, chips popping with overshoot.
 * The ring keeps rotating through the cut — motion never settles.
 */
export const Shot2Library: React.FC = () => {
  const frame = useCurrentFrame();
  const shotDur = 414;

  // Phone entry — slides in from the right while settling its 3D tilt.
  const phoneIn = interpolate(frame, [14, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const phoneX = (1 - phoneIn) * 560;
  const phoneTilt = 20 - phoneIn * 13; // 20deg -> 7deg
  const phoneDrift = Math.sin(frame / 55) * 4;

  // Browse screen slow-scroll across the whole shot.
  const scroll = interpolate(frame, [30, shotDur - 30], [0, 176], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });

  // Orbit fade-in right at the cut, then full.
  const orbitOpacity = interpolate(frame, [0, 20], [0.25, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill>
      <Stage seed={9} />
      <RecipeOrbit opacity={orbitOpacity} />

      {/* headline block, top-left */}
      <div style={{ position: "absolute", left: 96, top: 108, maxWidth: 760 }}>
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: C.accentBright,
            opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          The library
        </div>
        <WordReveal
          text="20,000+ recipes. Real ones."
          accentWords={["20,000+"]}
          delay={2}
          stagger={4}
          fontSize={72}
          style={{ paddingTop: 14 }}
        />
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 25,
            fontWeight: 600,
            color: C.creamDim,
            lineHeight: 1.45,
            maxWidth: 620,
            paddingTop: 18,
            opacity: interpolate(frame, [30, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
            translateY: interpolate(frame, [30, 55], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
          }}
        >
          From quick weeknight dinners to all-day projects — with honest times and new recipes arriving every week.
        </div>
      </div>

      {/* phone, right side, in 3D perspective */}
      <div style={{ position: "absolute", left: 1210, top: 168, perspective: 1900 }}>
        <div
          style={{
            translate: `${phoneX}px 0px`,
            rotateY: `${phoneTilt}deg`,
            rotateX: `${-3 + phoneDrift * 0.2}deg`,
            rotate: `${phoneDrift * 0.1}deg`,
          }}
        >
          <PhoneFrame scale={0.96}>
            <BrowseScreen scroll={scroll} />
          </PhoneFrame>
        </div>
      </div>

      {/* floating recipe cards, left field */}
      <FloatingRecipeCard food={{ file: "biryani.jpg", title: "Chicken Biryani", minutes: 75, rating: 4.8 }} width={216} x={118} y={520} delay={40} hoverPhase={0} />
      <FloatingRecipeCard food={{ file: "moussecake.jpg", title: "Almond Mousse Cake", minutes: 55, rating: 4.9 }} width={196} x={366} y={576} delay={56} hoverPhase={2.2} />
      <FloatingRecipeCard food={{ file: "focaccia.jpg", title: "Focaccia", minutes: 90, rating: 4.8 }} width={178} x={248} y={800} delay={72} hoverPhase={4.1} />

      {/* chips popping bottom-left */}
      <div style={{ position: "absolute", left: 96, bottom: 92, display: "flex", gap: 18 }}>
        <PopChip
          delay={86}
          icon={<IconStar size={17} />}
          label="New recipes every week"
        />
        <PopChip
          delay={100}
          bgColor={C.accent}
          fgColor={C.cream}
          label="Halal-friendly"
        />
      </div>
    </AbsoluteFill>
  );
};
