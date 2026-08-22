import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, EASE, mulberry32 } from "../theme";

/**
 * The dark warm stage every shot lives on — reference theme: near-black canvas,
 * slow breathing accent glows, fine drifting dust particles.
 * Purely frame-driven; particles are seeded so renders are deterministic.
 */

interface StageProps {
  /** Accent for the breathing glows (terracotta by default, teal in cook scenes). */
  glow?: string;
  /** Seed for particle layout. */
  seed?: number;
  /** Particle density multiplier. */
  particleDensity?: number;
  /** Overall scene opacity (for shot-tail dips if needed). */
  opacity?: number;
}

const Glow: React.FC<{ x: string; y: string; size: number; color: string; frame: number; phase: number }> = ({
  x,
  y,
  size,
  color,
  frame,
  phase,
}) => {
  const breathe = Math.sin(frame / 55 + phase) * 0.12;
  const drift = Math.sin(frame / 90 + phase * 1.7) * 26;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: size,
        height: size,
        translate: `${drift}px ${-drift * 0.4}px`,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color}${breathHex(breathe)} 0%, ${color}00 65%)`,
        opacity: 0.55 + breathe,
        filter: "blur(2px)",
      }}
    />
  );
};

/** Map a -1..1 breathe value to a 00..22 hex alpha suffix. */
const breathHex = (v: number): string => {
  const a = Math.round(Math.max(0, Math.min(1, v)) * 34);
  return a.toString(16).padStart(2, "0");
};

export const Stage: React.FC<StageProps> = ({ glow = C.accentBright, seed = 7, particleDensity = 1, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const rand = mulberry32(seed);
  const particles = new Array(Math.round(46 * particleDensity)).fill(0).map(() => ({
    x: rand(),
    y: rand(),
    r: 1.2 + rand() * 2.6,
    speed: 0.18 + rand() * 0.5,
    phase: rand() * Math.PI * 2,
    alpha: 0.14 + rand() * 0.3,
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: C.stage, opacity }}>
      {/* deep vignette floor */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 90% at 50% 108%, ${C.stageDeep}ee 0%, ${C.stageDeep}55 42%, ${C.stageDeep}00 68%)`,
        }}
      />
      {/* breathing glows */}
      <Glow x="6%" y="8%" size={720} color={glow} frame={frame} phase={0} />
      <Glow x="72%" y="58%" size={860} color={glow} frame={frame} phase={2.1} />
      <Glow x="40%" y="-12%" size={560} color="#6E4A33" frame={frame} phase={4.4} />
      {/* drifting dust */}
      {particles.map((p, i) => {
        const py = (p.y * height - frame * p.speed * 6) % height;
        const px = p.x * width + Math.sin(frame / 40 + p.phase) * 14;
        const twinkle = 0.6 + 0.4 * Math.sin(frame / 14 + p.phase * 3);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: px,
              top: py < 0 ? py + height : py,
              width: p.r,
              height: p.r,
              borderRadius: "50%",
              backgroundColor: C.cream,
              opacity: p.alpha * twinkle,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * A full-bleed food photo doing the reference's slow Ken Burns drift,
 * with a bottom scrim so headlines can sit on it.
 */
export const KenBurnsPhoto: React.FC<{ src: string; fromScale?: number; toScale?: number; driftX?: number }> = ({
  src,
  fromScale = 1.08,
  toScale = 1.2,
  driftX = 0,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.inOut });
  const scale = fromScale + (toScale - fromScale) * t;
  const x = driftX * t;
  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          width,
          height,
          objectFit: "cover",
          scale: `${scale}`,
          translate: `${x}px 0px`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${C.stageDeep}66 0%, ${C.stageDeep}00 26%, ${C.stageDeep}00 46%, ${C.stageDeep}bb 88%, ${C.stageDeep} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Slow rise used for floating UI — gives cards a gentle idle hover. */
export const hoverY = (frame: number, phase: number, amp = 10, period = 74): number =>
  Math.sin(frame / period * Math.PI * 2 + phase) * amp;
