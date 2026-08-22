import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, EASE } from "../theme";

/**
 * The reference's headline move: each word slides up into place with a snappy
 * settle, staggered left to right. Optionally an accent word gets its own color.
 */

interface WordRevealProps {
  text: string;
  /** Substrings to render in the accent color. */
  accentWords?: string[];
  accentColor?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  /** Frames between word starts. */
  stagger?: number;
  /** Frames each word takes to land. */
  duration?: number;
  delay?: number;
  lineHeight?: number;
  letterSpacing?: number;
  style?: React.CSSProperties;
}

export const WordReveal: React.FC<WordRevealProps> = ({
  text,
  accentWords = [],
  accentColor = C.accentBright,
  fontSize = 76,
  fontWeight = 800,
  color = C.cream,
  stagger = 4,
  duration = 16,
  delay = 0,
  lineHeight = 1.12,
  letterSpacing = -1.5,
  style,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div style={{ display: "flex", flexWrap: "wrap", rowGap: 8, columnGap: "0.28em", ...style }}>
      {words.map((word, i) => {
        const start = delay + i * stagger;
        const progress = interpolate(frame, [start, start + duration], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASE.outExpo,
        });
        const isAccent = accentWords.includes(word.replace(/[.,+]/g, ""));
        return (
          <span
            key={`${word}-${i}`}
            style={{
              fontSize,
              fontWeight,
              lineHeight,
              letterSpacing,
              color: isAccent ? accentColor : color,
              fontFamily: "Manrope, sans-serif",
              display: "inline-block",
              translateY: (1 - progress) * 56,
              opacity: progress,
              willChange: "transform, opacity",
            }}
          >
            {word}
            {"\u00A0"}
          </span>
        );
      })}
    </div>
  );
};

/** Reference chip: small rounded pill that pops in with overshoot. */
export const PopChip: React.FC<{
  label: React.ReactNode;
  delay?: number;
  bgColor?: string;
  fgColor?: string;
  icon?: React.ReactNode;
  scale?: number;
}> = ({ label, delay = 0, bgColor = C.cream, fgColor = C.ink, icon, scale = 1 }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [delay, delay + 13], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.overshoot,
  });
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "13px 22px",
        borderRadius: 999,
        backgroundColor: bgColor,
        color: fgColor,
        fontFamily: "Manrope, sans-serif",
        fontWeight: 700,
        fontSize: 24 * scale,
        boxShadow: `0 18px 44px ${C.stageDeep}cc, 0 0 0 1px ${C.cream}12`,
        scale: `${pop * scale}`,
        opacity: Math.min(1, pop * 1.6),
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </div>
  );
};
