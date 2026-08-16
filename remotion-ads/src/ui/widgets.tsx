import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { EASE_OUT } from "../atoms";
import { FONTS, type Palette } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const mmss = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Circular progress ring with centered content. */
export const TimerRing: React.FC<{
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}> = ({ size = 240, stroke = 20, progress, color, track, children }) => {
  const r = 50 - stroke / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** Animated checkmark that draws itself. */
export const Check: React.FC<{ size?: number; color: string; delay?: number; dur?: number }> = ({
  size = 64,
  color,
  delay = 0,
  dur = 12,
}) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 56 56">
      <path
        d="M 10 30 L 23 43 L 46 12"
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={interpolate(frame, [delay, delay + dur], [100, 0], {
          ...clamp,
          easing: EASE_OUT,
        })}
      />
    </svg>
  );
};

/** Strike-through line drawn across the parent (parent must be position:relative). */
export const Strike: React.FC<{
  delay?: number;
  dur?: number;
  color: string;
  thickness?: number;
  rotateDeg?: number;
}> = ({ delay = 0, dur = 12, color, thickness = 6, rotateDeg = -1.5 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: "-4%",
        right: "-4%",
        top: "50%",
        height: thickness,
        marginTop: -thickness / 2,
        borderRadius: 999,
        background: color,
        rotate: `${rotateDeg}deg`,
        transformOrigin: "left center",
        scale: `${interpolate(frame, [delay, delay + dur], [0, 1], { ...clamp, easing: EASE_OUT })} 1`,
      }}
    />
  );
};

/** Small caps label. */
export const Label: React.FC<{
  children: React.ReactNode;
  size?: number;
  color: string;
  weight?: number;
  spacing?: string;
}> = ({ children, size = 30, color, weight = 700, spacing = "0.14em" }) => (
  <div
    style={{
      fontFamily: FONTS.sans,
      fontSize: size,
      fontWeight: weight,
      letterSpacing: spacing,
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

/** Pill chip. */
export const Chip: React.FC<{
  palette: Palette;
  text: string;
  bg?: string;
  color?: string;
  fontSize?: number;
  rotateDeg?: number;
}> = ({ palette, text, bg, color, fontSize = 30, rotateDeg = 0 }) => (
  <div
    style={{
      background: bg ?? palette.accent,
      color: color ?? palette.onAccent,
      fontFamily: FONTS.sans,
      fontWeight: 800,
      fontSize,
      letterSpacing: "0.08em",
      padding: "14px 30px",
      borderRadius: 999,
      rotate: `${rotateDeg}deg`,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

/** Simple pan + flame icon. */
export const PanIcon: React.FC<{ size?: number; color: string }> = ({ size = 44, color }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <circle cx={22} cy={26} r={15} stroke={color} strokeWidth={4} />
    <path d="M 37 26 L 46 20" stroke={color} strokeWidth={4} strokeLinecap="round" />
    <path
      d="M 17 8 C 15 12 19 13 17 16 M 24 6 C 22 10 26 11 24 14"
      stroke={color}
      strokeWidth={3.4}
      strokeLinecap="round"
    />
  </svg>
);

/** Stacked plates icon. */
export const PlatesIcon: React.FC<{ size?: number; color: string }> = ({ size = 44, color }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <circle cx={24} cy={26} r={16} stroke={color} strokeWidth={4} />
    <circle cx={24} cy={26} r={9} stroke={color} strokeWidth={3} />
    <path d="M 14 8 H 34" stroke={color} strokeWidth={4} strokeLinecap="round" />
  </svg>
);

/** Star (rating). */
export const StarIcon: React.FC<{ size?: number; color: string }> = ({ size = 30, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
  </svg>
);
