import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { EASE_OUT, RiseIn } from "./atoms";
import { FONTS, type Palette } from "./theme";

interface MarkProps {
  size?: number;
  ring: string;
  hand: string;
  knob?: string;
  /** 0–1, how much of the ring is drawn */
  ringProgress?: number;
  /** hand angle in degrees, 0 = 12 o'clock */
  handDeg?: number;
  strokeWidth?: number;
  face?: string;
}

/** Brand mark: a stopwatch. */
export const TimerMark: React.FC<MarkProps> = ({
  size = 120,
  ring,
  hand,
  knob,
  ringProgress = 1,
  handDeg = 0,
  strokeWidth = 8,
  face,
}) => {
  const r = 40;
  const c = 2 * Math.PI * r;
  const rad = (handDeg * Math.PI) / 180;
  const hx = 50 + 24 * Math.sin(rad);
  const hy = 54 - 24 * Math.cos(rad);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {face ? <circle cx={50} cy={54} r={40} fill={face} /> : null}
      <rect x={45} y={1} width={10} height={8} rx={2.5} fill={knob ?? ring} />
      <circle
        cx={50}
        cy={54}
        r={r}
        fill="none"
        stroke={ring}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={c * (1 - ringProgress)}
        transform="rotate(-90 50 54)"
      />
      <line
        x1={50}
        y1={54}
        x2={hx}
        y2={hy}
        stroke={hand}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={50} cy={54} r={4.5} fill={hand} />
    </svg>
  );
};

/** Animated brand mark used on intro/end cards. */
export const AnimatedMark: React.FC<{
  size?: number;
  palette: Palette;
  /** total sweep of the hand across the animation */
  sweep?: number;
}> = ({ size = 200, palette, sweep = 300 }) => {
  const frame = useCurrentFrame();
  return (
    <TimerMark
      size={size}
      ring={palette.accent}
      hand={palette.dark ? palette.ink : palette.ink}
      ringProgress={interpolate(frame, [0, 26], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_OUT,
      })}
      handDeg={interpolate(frame, [4, 46], [0, sweep], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })}
    />
  );
};

export const LogoLockup: React.FC<{
  palette: Palette;
  markSize?: number;
  wordSize?: number;
  serif?: boolean;
}> = ({ palette, markSize = 96, wordSize = 88, serif = true }) => (
  <div style={{ display: "flex", alignItems: "center", gap: markSize * 0.22 }}>
    <TimerMark size={markSize} ring={palette.accent} hand={palette.ink} />
    <div
      style={{
        fontFamily: serif ? FONTS.serif : FONTS.sans,
        fontWeight: serif ? 600 : 800,
        fontSize: wordSize,
        color: palette.ink,
        letterSpacing: "-0.015em",
      }}
    >
      RecipeReal
    </div>
  </div>
);

/** Shared end card: animated mark, wordmark, tagline, CTA pill. */
export const EndCard: React.FC<{
  palette: Palette;
  tagline: string;
  taglineSerif?: boolean;
  subline?: string;
}> = ({ palette, tagline, taglineSerif = false, subline = "5 recipes a month — free forever" }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 36,
    }}
  >
    <RiseIn delay={6}>
      <AnimatedMark size={190} palette={palette} />
    </RiseIn>
    <RiseIn delay={24}>
      <div
        style={{
          fontFamily: FONTS.serif,
          fontWeight: 600,
          fontSize: 150,
          letterSpacing: "-0.02em",
          color: palette.ink,
        }}
      >
        RecipeReal
      </div>
    </RiseIn>
    <RiseIn delay={44}>
      <div
        style={{
          fontFamily: taglineSerif ? FONTS.serif : FONTS.sans,
          fontWeight: taglineSerif ? 500 : 700,
          fontSize: 56,
          color: palette.sub,
        }}
      >
        {tagline}
      </div>
    </RiseIn>
    <RiseIn delay={66} dy={30}>
      <div
        style={{
          background: palette.accent,
          color: palette.onAccent,
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 44,
          padding: "26px 72px",
          borderRadius: 999,
          boxShadow: `0 24px 70px ${palette.glow2}`,
        }}
      >
        Start cooking — free
      </div>
    </RiseIn>
    <RiseIn delay={92} dy={16}>
      <div style={{ fontFamily: FONTS.sans, fontWeight: 500, fontSize: 32, color: palette.faint }}>
        {subline}
      </div>
    </RiseIn>
  </div>
);
