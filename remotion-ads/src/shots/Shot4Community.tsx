import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { C, EASE, FOODS, MEMBERS } from "../theme";
import { Stage } from "../components/Stage";
import { WordReveal, PopChip } from "../components/WordReveal";
import { CommunityScreen, PhoneFrame } from "../components/phone";
import { Avatar, PostCard } from "../components/ui";
import { IconHeartFill, IconPot } from "../components/icons";

/**
 * Shot 4 — communities. Reference moves: a staggered grid of content cards
 * flying in, phone on stage, avatar cluster popping one by one, counters ticking.
 */

const FlyPost: React.FC<{
  index: number;
  delay: number;
  x: number;
  y: number;
  likes: number;
}> = ({ index, delay, x, y, likes }) => {
  const frame = useCurrentFrame();
  const member = MEMBERS[index % MEMBERS.length];
  const food = FOODS[(index * 5 + 2) % FOODS.length];
  const inProg = interpolate(frame, [delay, delay + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const hover = Math.sin(frame / 48 + index * 1.9) * 8;
  // Like counter ticks up while on screen.
  const tick = Math.floor(interpolate(frame, [delay + 30, 330], [0, 14], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translateY: (1 - inProg) * 120 + hover,
        scale: `${0.7 + inProg * 0.3}`,
        rotate: `${(1 - inProg) * 6}deg`,
        opacity: inProg,
      }}
    >
      <PostCard member={member} food={food} width={252} likes={likes + tick} comments={8 + index * 5} liked={index === 1} />
    </div>
  );
};

export const Shot4Community: React.FC = () => {
  const frame = useCurrentFrame();

  const phoneIn = interpolate(frame, [8, 52], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const scroll = interpolate(frame, [40, 330], [0, 190], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });

  return (
    <AbsoluteFill>
      <Stage seed={31} />

      {/* headline */}
      <div style={{ position: "absolute", left: 96, top: 96, maxWidth: 700 }}>
        <div
          style={{
            fontFamily: "Manrope, sans-serif",
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: C.accentBright,
            opacity: interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          Communities
        </div>
        <WordReveal
          text="Cook next to people who cook."
          delay={2}
          stagger={4}
          fontSize={62}
          style={{ paddingTop: 12 }}
        />
      </div>

      {/* avatar cluster + live chip */}
      <div style={{ position: "absolute", left: 100, top: 400, display: "flex", alignItems: "center" }}>
        {MEMBERS.slice(0, 5).map((m, i) => {
          const pop = interpolate(frame, [70 + i * 7, 83 + i * 7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: EASE.overshoot,
          });
          return (
            <div key={m.name} style={{ marginLeft: i === 0 ? 0 : -14, scale: `${pop}`, opacity: pop }}>
              <Avatar name={m.name} color={m.color} size={62} ring />
            </div>
          );
        })}
        <div
          style={{
            marginLeft: 22,
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontFamily: "Manrope, sans-serif",
            color: C.cream,
            opacity: interpolate(frame, [112, 132], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
          }}
        >
          <IconHeartFill size={19} />
          <span style={{ fontSize: 22, fontWeight: 800 }}>
            {(1200 + Math.floor(interpolate(frame, [112, 340], [0, 46], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))).toLocaleString()}+
          </span>
          <span style={{ fontSize: 22, fontWeight: 600, color: C.creamDim }}>cooking this week</span>
        </div>
      </div>

      {/* staggered post grid, center-left */}
      <FlyPost index={0} delay={26} x={110} y={560} likes={214} />
      <FlyPost index={1} delay={40} x={390} y={596} likes={168} />
      <FlyPost index={2} delay={54} x={668} y={572} likes={96} />

      {/* phone, right */}
      <div style={{ position: "absolute", left: 1330, top: 120, perspective: 2000 }}>
        <div
          style={{
            rotateY: `${13 - phoneIn * 6}deg`,
            rotateX: "-2deg",
            translateX: (1 - phoneIn) * 120,
            opacity: phoneIn,
          }}
        >
          <PhoneFrame scale={0.93}>
            <CommunityScreen scroll={scroll} />
          </PhoneFrame>
        </div>
      </div>

      {/* chips */}
      <div style={{ position: "absolute", left: 96, bottom: 88, display: "flex", gap: 16 }}>
        <PopChip delay={150} icon={<IconPot size={17} />} label="Share what you cooked" />
        <PopChip delay={164} bgColor={C.accent} fgColor={C.cream} label="Follow cooks you trust" />
      </div>
    </AbsoluteFill>
  );
};
