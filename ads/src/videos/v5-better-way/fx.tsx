// Shared effects: B/W film treatment, iris wipes, starbursts, captions.
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import type {FC, ReactNode} from 'react';
import {brand, SAFE} from '../../shared/theme';
import {bebas, lime, space} from './fonts';

export const BW = {
  ink: '#161310',
  dark: '#26221D',
  mid: '#6E6862',
  light: '#C9C4BB',
  paper: '#EDEAE2',
} as const;

/** Deterministic film grain: new speck pattern every frame, plus scratches
 *  and gate weave. `random()` always called with exactly one argument. */
export const FilmGrain: FC<{intensity?: number; scratches?: boolean}> = ({
  intensity = 1,
  scratches = true,
}) => {
  const frame = useCurrentFrame();
  const specks = new Array(90).fill(0).map((_, i) => {
    const x = random(`gx-${frame}-${i}`) * 1920;
    const y = random(`gy-${frame}-${i}`) * 1080;
    const o = random(`go-${frame}-${i}`) * 0.15 * intensity;
    const white = random(`gw-${frame}-${i}`) > 0.45;
    const s = 2 + Math.floor(random(`gs-${frame}-${i}`) * 3);
    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: s,
          height: s,
          backgroundColor: white ? '#FFFFFF' : '#000000',
          opacity: o,
        }}
      />
    );
  });
  const scratchOn = scratches && random(`sc-${frame}`) > 0.7;
  const sx = random(`scx-${frame}`) * 1880;
  const flick = random(`fl-${frame}`) * 0.045 * intensity;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      {specks}
      {scratchOn ? (
        <div
          style={{
            position: 'absolute',
            left: sx,
            top: -60,
            width: 2 + Math.floor(random(`scw-${frame}`) * 2),
            height: 1200,
            backgroundColor: 'rgba(255,255,255,0.16)',
          }}
        />
      ) : null}
      <AbsoluteFill style={{backgroundColor: '#FFFFFF', opacity: flick}} />
    </AbsoluteFill>
  );
};

/** Full 1950s black-and-white frame: grayscale + contrast, iris vignette,
 *  gate weave, grain. Wrap every Act 1-3 scene in this. */
export const BWScene: FC<{children: ReactNode; grain?: number; bg?: string}> = ({
  children,
  grain = 1,
  bg = BW.ink,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        filter: 'grayscale(1) contrast(1.13) brightness(1.03)',
        translate: `${(random(`wx-${frame}`) - 0.5) * 2.5}px ${
          (random(`wy-${frame}`) - 0.5) * 2.5
        }px`,
      }}
    >
      {children}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.52) 100%)',
        }}
      />
      <FilmGrain intensity={grain} />
    </AbsoluteFill>
  );
};

/** Iris wipe overlay. progress 0 = fully closed (black), 1 = fully open. */
export const IrisOverlay: FC<{progress: number}> = ({progress}) => {
  const r = interpolate(progress, [0, 1], [0, 1290], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mask = `radial-gradient(circle at 50% 50%, transparent 0px, transparent ${r}px, black ${
    r + 6
  }px)`;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#000',
        WebkitMaskImage: mask,
        maskImage: mask,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Spiky starburst polygon (amber infomercial energy). */
export const Starburst: FC<{
  size: number;
  fill: string;
  inner?: number;
  points?: number;
  rotate?: number;
  style?: React.CSSProperties;
}> = ({size, fill, inner = 0.62, points = 18, rotate = 0, style}) => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? 98 : 98 * inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  return (
    <svg
      viewBox="-100 -100 200 200"
      style={{width: size, height: size, rotate: `${rotate}deg`, ...style}}
    >
      <polygon points={pts.join(' ')} fill={fill} />
    </svg>
  );
};

/** Radiating emphasis rings (alarm chorus, timer ring, pulses). */
export const Rings: FC<{
  count: number;
  color: string;
  size: number;
  thickness?: number;
  speed?: number;
  maxOpacity?: number;
}> = ({count, color, size, thickness = 6, speed = 1.6, maxOpacity = 0.9}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {new Array(count).fill(0).map((_, i) => {
        const start = i * (28 / count);
        const p = interpolate(frame, [start, start + 26 * speed], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        if (p <= 0 || p >= 1) return null;
        const s = interpolate(p, [0, 1], [size * 0.25, size * 1.9], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: s,
              height: s,
              borderRadius: '50%',
              border: `${thickness}px solid ${color}`,
              opacity: interpolate(p, [0, 0.25, 1], [0, maxOpacity, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Lower-third caption. Melodrama mode = B/W bar, modern = brand chip. */
export const Caption: FC<{text: string; modern?: boolean; wide?: boolean}> = ({
  text,
  modern,
  wide,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: SAFE,
        display: 'flex',
        justifyContent: 'center',
        opacity: enter,
        translate: `0 ${interpolate(enter, [0, 1], [26, 0])}px`,
      }}
    >
      <div
        style={{
          backgroundColor: modern ? brand.ink : 'rgba(10,9,8,0.82)',
          color: modern ? brand.canvas : BW.paper,
          fontFamily: modern ? space : bebas,
          fontWeight: modern ? 500 : 400,
          fontSize: modern ? 42 : 46,
          letterSpacing: modern ? 0.5 : 3,
          padding: modern ? '14px 42px' : '12px 38px',
          borderRadius: modern ? 14 : 4,
          textTransform: 'uppercase',
          whiteSpace: wide ? 'normal' : 'nowrap',
          textAlign: 'center',
          border: modern ? 'none' : `3px solid ${BW.paper}`,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** 50s ornamental title card frame (double border + corner diamonds). */
export const OrnateFrame: FC<{children: ReactNode; padding?: number}> = ({
  children,
  padding = 46,
}) => (
  <div
    style={{
      position: 'absolute',
      inset: SAFE,
      border: `6px solid ${BW.paper}`,
      boxShadow: `inset 0 0 0 3px ${BW.ink}, inset 0 0 0 14px ${BW.paper}, inset 0 0 0 17px ${BW.ink}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding,
      backgroundColor: 'rgba(10,9,8,0.25)',
    }}
  >
    {['top left', 'top right', 'bottom left', 'bottom right'].map((pos) => {
      const [v, h] = pos.split(' ');
      return (
        <div
          key={pos}
          style={{
            position: 'absolute',
            top: v === 'top' ? 18 : undefined,
            bottom: v === 'bottom' ? 18 : undefined,
            left: h === 'left' ? 18 : undefined,
            right: h === 'right' ? 18 : undefined,
            width: 22,
            height: 22,
            rotate: '45deg',
            backgroundColor: BW.paper,
          }}
        />
      );
    })}
    {children}
  </div>
);

/** Big Limelight intertitle line for the 50s act. */
export const Lime: FC<{text: string; size?: number; style?: React.CSSProperties}> = ({
  text,
  size = 120,
  style,
}) => (
  <div
    style={{
      fontFamily: lime,
      fontSize: size,
      color: BW.paper,
      textAlign: 'center',
      lineHeight: 1.04,
      textShadow: '0 6px 0 rgba(0,0,0,0.55)',
      ...style,
    }}
  >
    {text}
  </div>
);
