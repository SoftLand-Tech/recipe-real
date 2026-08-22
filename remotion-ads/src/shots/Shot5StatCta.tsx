import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, mulberry32 } from "../theme";
import { Stage } from "../components/Stage";
import { PopChip } from "../components/WordReveal";
import { IconApple, IconPlayStore } from "../components/icons";

/**
 * Shot 5 — the stat burst into the CTA. Reference moves: straight cut into a
 * huge number counting up inside an expanding glow, then a centered CTA card
 * with pulsing buttons and store badges.
 */

const StoreBadge: React.FC<{ icon: React.ReactNode; top: string; bottom: string; delay: number }> = ({
  icon,
  top,
  bottom,
  delay,
}) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [delay, delay + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.overshoot,
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: "15px 30px",
        borderRadius: 18,
        backgroundColor: C.cream,
        scale: `${pop}`,
        opacity: pop,
        boxShadow: `0 24px 60px ${C.stageDeep}d0`,
      }}
    >
      {icon}
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, fontFamily: "Manrope, sans-serif" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: C.inkSecondary }}>{top}</span>
        <span style={{ fontSize: 21, fontWeight: 800, color: C.ink }}>{bottom}</span>
      </div>
    </div>
  );
};

export const Shot5StatCta: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const statDur = 200;
  const isStat = frame < statDur;

  // ---- stat count-up ----
  const count = Math.round(
    interpolate(frame, [6, 64], [0, 20000], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo })
  );
  const plusPop = interpolate(frame, [62, 76], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.overshoot,
  });

  // burst rays + particles
  const burstT = interpolate(frame, [6, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo });
  const rand = mulberry32(99);
  const sparks = new Array(34).fill(0).map(() => ({ angle: rand() * Math.PI * 2, dist: 140 + rand() * 480, size: 3 + rand() * 6, alpha: 0.3 + rand() * 0.6 }));

  const ctaIn = interpolate(frame, [statDur + 4, statDur + 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const ctaPulse = 1 + Math.sin(frame / 13) * 0.014;

  return (
    <AbsoluteFill>
      <Stage seed={55} particleDensity={1.6} />

      {isStat ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          {/* expanding glow */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 1250,
              height: 1250,
              translate: "-50% -50%",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${C.accent}30 0%, ${C.accent}0d 40%, ${C.accent}00 66%)`,
              scale: `${0.5 + burstT * 0.6}`,
              opacity: 0.5 + Math.sin(frame / 15) * 0.15,
            }}
          />
          {/* burst rings */}
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 320,
                height: 320,
                translate: "-50% -50%",
                borderRadius: "50%",
                border: `2.5px solid ${C.accentBright}`,
                scale: `${0.3 + burstT * (2.6 + i * 0.9)}`,
                opacity: (1 - burstT) * (0.55 - i * 0.18),
              }}
            />
          ))}
          {/* sparks */}
          {sparks.map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: width / 2 + Math.cos(s.angle) * s.dist * burstT,
                top: height / 2 + Math.sin(s.angle) * s.dist * burstT * 0.72,
                width: s.size,
                height: s.size,
                borderRadius: "50%",
                backgroundColor: i % 3 === 0 ? C.amber : C.accentBright,
                opacity: s.alpha * (1 - burstT * 0.85),
              }}
            />
          ))}

          {/* the number */}
          <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Manrope, sans-serif" }}>
            <span
              style={{
                fontSize: 250,
                fontWeight: 800,
                letterSpacing: -7,
                color: C.cream,
                fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 90px ${C.accent}55`,
              }}
            >
              {count.toLocaleString()}
            </span>
            <span
              style={{
                fontSize: 130,
                fontWeight: 800,
                color: C.accentBright,
                paddingLeft: 8,
                scale: `${plusPop}`,
                textShadow: `0 0 60px ${C.accent}66`,
              }}
            >
              +
            </span>
          </div>
          <div
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 31,
              fontWeight: 700,
              color: C.creamDim,
              paddingTop: 8,
              opacity: interpolate(frame, [40, 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
              translateY: interpolate(frame, [40, 66], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
            }}
          >
            recipes — and new ones land every week
          </div>
        </AbsoluteFill>
      ) : (
        /* ---- CTA ---- */
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 34,
              translateY: (1 - ctaIn) * 60,
              opacity: ctaIn,
              scale: `${ctaPulse * (0.97 + ctaIn * 0.03)}`,
            }}
          >
            <div
              style={{
                width: 148,
                height: 148,
                borderRadius: 40,
                backgroundColor: C.stageDeep,
                boxShadow: `0 0 0 1.5px ${C.accentBright}55, 0 26px 80px ${C.accent}44, 0 0 110px ${C.accent}33`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Img src={staticFile("logo-glow.png")} style={{ width: 132, height: 132 }} />
            </div>
            <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 74, fontWeight: 800, color: C.cream, letterSpacing: -1.5, lineHeight: 1.05, textAlign: "center" }}>
              Cook real food,
              <br />
              <span style={{ color: C.accentBright }}>together.</span>
            </div>
            <div style={{ display: "flex", gap: 22 }}>
              <StoreBadge icon={<IconApple />} top="Download on the" bottom="App Store" delay={statDur + 40} />
              <StoreBadge icon={<IconPlayStore />} top="Get it on" bottom="Google Play" delay={statDur + 52} />
            </div>
            <div style={{ paddingTop: 6 }}>
              <PopChip
                delay={statDur + 72}
                bgColor={C.accent}
                fgColor={C.cream}
                label="Free · RecipeReal"
                scale={1.25}
              />
            </div>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
