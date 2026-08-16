import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "./theme";

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const FadeIn: React.FC<{
  delay?: number;
  dur?: number;
  style?: CSSProperties;
  children: ReactNode;
}> = ({ delay = 0, dur = 16, style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [delay, delay + dur], [0, 1], {
          ...clamp,
          easing: EASE_OUT,
        }),
      }}
    >
      {children}
    </div>
  );
};

export const RiseIn: React.FC<{
  delay?: number;
  dur?: number;
  dy?: number;
  style?: CSSProperties;
  children: ReactNode;
}> = ({ delay = 0, dur = 22, dy = 48, style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [delay, delay + dur * 0.7], [0, 1], { ...clamp, easing: EASE_OUT }),
        translate: `0px ${interpolate(frame, [delay, delay + dur], [dy, 0], { ...clamp, easing: EASE_OUT })}px`,
      }}
    >
      {children}
    </div>
  );
};

export const PopIn: React.FC<{
  delay?: number;
  dur?: number;
  from?: number;
  style?: CSSProperties;
  children: ReactNode;
}> = ({ delay = 0, dur = 16, from = 0.4, style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(frame, [delay, delay + Math.max(4, dur * 0.5)], [0, 1], clamp),
        scale: interpolate(frame, [delay, delay + dur], [from, 1], { ...clamp, easing: EASE_POP }),
      }}
    >
      {children}
    </div>
  );
};

export const GrowX: React.FC<{
  delay?: number;
  dur?: number;
  origin?: CSSProperties["transformOrigin"];
  style?: CSSProperties;
  children: ReactNode;
}> = ({ delay = 0, dur = 18, origin = "left center", style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        transformOrigin: origin,
        scale: `${interpolate(frame, [delay, delay + dur], [0, 1], { ...clamp, easing: EASE_OUT })} 1`,
      }}
    >
      {children}
    </div>
  );
};

export const GrowY: React.FC<{
  delay?: number;
  dur?: number;
  origin?: CSSProperties["transformOrigin"];
  style?: CSSProperties;
  children: ReactNode;
}> = ({ delay = 0, dur = 18, origin = "bottom center", style, children }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        transformOrigin: origin,
        scale: `1 ${interpolate(frame, [delay, delay + dur], [0, 1], { ...clamp, easing: EASE_OUT })}`,
      }}
    >
      {children}
    </div>
  );
};

/** Soft ambient glow blobs for the ad background. */
export const Backdrop: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: -300,
          background: `radial-gradient(720px 720px at 12% 16%, ${palette.glow1}, transparent 70%)`,
          translate: `0px ${interpolate(frame, [0, 400], [0, 44])}px`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -300,
          background: `radial-gradient(820px 820px at 88% 86%, ${palette.glow2}, transparent 70%)`,
          translate: `0px ${interpolate(frame, [0, 400], [0, -36])}px`,
        }}
      />
    </>
  );
};
