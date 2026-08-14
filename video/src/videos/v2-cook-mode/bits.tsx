// Small shared pieces: easings, icons, pills, smoke, fire, tap ripple.
import type {CSSProperties, FC, ReactNode} from 'react';
import {Easing, interpolate, random} from 'remotion';
import {brand} from '../../shared/theme';
import {inter} from './fonts';

// ---------------------------------------------------------------------------
// Easings (per skill timing guidance — bezier curves, not springs)
// ---------------------------------------------------------------------------
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1); // crisp UI entrance
export const EASE_IN_OUT = Easing.bezier(0.45, 0, 0.55, 1); // editorial moves
export const EASE_OVERSHOOT = Easing.bezier(0.34, 1.56, 0.64, 1); // playful pop

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/** Fade in over `fadeIn` frames, hold, fade out over `fadeOut` frames. */
export const fadeIO = (
  frame: number,
  duration: number,
  fadeIn = 10,
  fadeOut = 14,
): number =>
  interpolate(
    frame,
    [0, fadeIn, duration - fadeOut, duration],
    [0, 1, 1, 0],
    CLAMP,
  );

/** mm:ss clock readout. */
export const formatClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Icons — all inline SVG, no assets, no network
// ---------------------------------------------------------------------------
type IconProps = {
  size: number;
  color: string;
};

export const IconChevronLeft: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M15 5 L8 12 L15 19"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconHeart: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 20 C 7 15.2, 4 12.6, 4 9.2 A 4.1 4.1 0 0 1 12 6.6 A 4.1 4.1 0 0 1 20 9.2 C 20 12.6, 17 15.2, 12 20 Z" />
  </svg>
);

export const IconStar: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12 3 L14.6 8.6 L20.7 9.4 L16.3 13.7 L17.3 19.8 L12 17 L6.7 19.8 L7.7 13.7 L3.3 9.4 L9.4 8.6 Z" />
  </svg>
);

export const IconClock: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={2.2} />
    <path
      d="M12 7.5 L12 12 L15.5 14"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconCheck: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 13 L10 18 L19 7"
      stroke={color}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconAirplane: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M2.4 13.2 L21 3.4 L14.9 20.6 L11.3 14.2 Z" />
  </svg>
);

export const IconEye: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M2.5 12 C 5 7.4, 8.3 5, 12 5 C 15.7 5, 19 7.4, 21.5 12 C 19 16.6, 15.7 19, 12 19 C 8.3 19, 5 16.6, 2.5 12 Z"
      stroke={color}
      strokeWidth={2}
    />
    <circle cx="12" cy="12" r="3.4" stroke={color} strokeWidth={2} />
  </svg>
);

export const IconWifiOff: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 10.2 a14.5 14.5 0 0 1 16 0" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    <path d="M7.2 13.6 a9 9 0 0 1 9.6 0" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
    <circle cx="12" cy="17.2" r="1.6" fill={color} />
    <path d="M4.5 4 L20 20.5" stroke={color} strokeWidth={2.1} strokeLinecap="round" />
  </svg>
);

export const IconPhoneSaved: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="7" y="3" width="10" height="18" rx="2.6" stroke={color} strokeWidth={2} />
    <path d="M9.6 12.2 L11.4 14 L14.6 10.4" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconSignal: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <rect x="3" y="14" width="3.4" height="6" rx="1" />
    <rect x="8.6" y="10" width="3.4" height="10" rx="1" />
    <rect x="14.2" y="6" width="3.4" height="14" rx="1" />
  </svg>
);

export const IconBattery: FC<IconProps> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 28 24" fill="none">
    <rect x="2" y="7" width="20" height="10" rx="2.6" stroke={color} strokeWidth={2} />
    <rect x="4.6" y="9.6" width="12" height="4.8" rx="1.2" fill={color} />
    <rect x="23.6" y="10.4" width="2.4" height="3.2" rx="1" fill={color} />
  </svg>
);

// ---------------------------------------------------------------------------
// Pill — rounded caption chip used outside the phone
// ---------------------------------------------------------------------------
export const Pill: FC<{
  bg: string;
  color: string;
  border?: string;
  icon?: ReactNode;
  children: ReactNode;
  fontSize?: number;
  style?: CSSProperties;
}> = ({bg, color, border, icon, children, fontSize = 30, style}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '18px 32px',
      borderRadius: 999,
      backgroundColor: bg,
      border: border ? `2px solid ${border}` : undefined,
      color,
      fontFamily: inter,
      fontWeight: 600,
      fontSize,
      letterSpacing: 0.2,
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {icon}
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Circular progress ring — pathLength=1 + strokeDashoffset (per skill guidance)
// ---------------------------------------------------------------------------
export const ProgressRing: FC<{
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track: string;
  children?: ReactNode;
}> = ({size, stroke, progress, color, track, children}) => {
  const p = Math.min(1, Math.max(0, progress));
  const r = (size - stroke) / 2;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - p}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tap ripple + finger press — expanding ring, fading opacity
// ---------------------------------------------------------------------------
export const TapRipple: FC<{frame: number; at: number}> = ({frame, at}) => {
  const t = frame - at;
  if (t < 0 || t > 22) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 150,
          height: 150,
          borderRadius: '50%',
          border: `3px solid ${brand.accent}`,
          scale: `${interpolate(t, [0, 18], [0.25, 2.1], {
            ...CLAMP,
            easing: EASE_OUT,
          })}`,
          opacity: interpolate(t, [0, 4, 18], [0, 0.85, 0], CLAMP),
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 78,
          height: 78,
          borderRadius: '50%',
          backgroundColor: 'rgba(36, 29, 23, 0.3)',
          translate: `0px ${interpolate(t, [0, 5, 9, 16], [30, 0, 0, 30], {
            ...CLAMP,
            easing: EASE_IN_OUT,
          })}px`,
          scale: interpolate(t, [0, 5, 9, 16], [1, 0.82, 0.82, 1], {
            ...CLAMP,
            easing: EASE_IN_OUT,
          }),
          opacity: interpolate(t, [0, 3, 14, 18], [0, 1, 1, 0], CLAMP),
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Smoke — rising wisp blobs, fully deterministic (frame-driven loop)
// ---------------------------------------------------------------------------
const WISP_PATH =
  'M60 6 C96 62, 108 128, 60 206 C12 128, 24 62, 60 6 Z';

export const SmokeLayer: FC<{
  frame: number;
  width: number;
  height: number;
  opacity?: number;
  tint?: string;
}> = ({frame, width, height, opacity = 1, tint = '#8B8178'}) => {
  const wisps = [0, 1, 2, 3, 4, 5];
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity,
        pointerEvents: 'none',
      }}
    >
      {wisps.map((i) => {
        const cycle = 96 + i * 14;
        const p =
          ((frame * (0.85 + i * 0.12) + i * 47) % cycle) / cycle;
        const y = interpolate(p, [0, 1], [height * 0.35, -320], CLAMP);
        const x = interpolate(p, [0, 1], [(i - 2.5) * 26, (i - 2.5) * 88], CLAMP);
        const op = interpolate(p, [0, 0.22, 0.82, 1], [0, 0.4, 0.34, 0], CLAMP);
        const s = interpolate(p, [0, 1], [0.65, 1.55], CLAMP);
        return (
          <svg
            key={i}
            width={130}
            height={240}
            viewBox="0 0 120 240"
            style={{
              position: 'absolute',
              left: width * (0.1 + i * 0.155),
              top: height * 0.42,
              translate: `${x}px ${y}px`,
              scale: `${s}`,
              opacity: op,
            }}
          >
            <path d={WISP_PATH} fill={tint} />
          </svg>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pan on fire — glow, pan body, flickering flames (random per 2-frame step)
// ---------------------------------------------------------------------------
const Flame: FC<{
  frame: number;
  seed: string;
  color: string;
  width: number;
  height: number;
  x: number;
}> = ({frame, seed, color, width, height, x}) => {
  const flick = random(seed, Math.floor(frame / 2));
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 60 120"
      style={{
        position: 'absolute',
        left: x,
        bottom: 0,
        opacity: 0.85 + flick * 0.15,
        transformOrigin: '50% 100%',
        scale: `${0.92 + flick * 0.12} ${0.8 + flick * 0.5}`,
      }}
    >
      <path
        d="M30 4 C46 34, 54 58, 30 104 C6 58, 14 34, 30 4 Z"
        fill={color}
      />
    </svg>
  );
};

export const PanOnFire: FC<{frame: number}> = ({frame}) => {
  const glow = random('glow', Math.floor(frame / 2));
  const glow2 = random('glow2', Math.floor(frame / 3));
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 130,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      {/* ember glow */}
      <div
        style={{
          position: 'absolute',
          width: 620,
          height: 480,
          bottom: -110,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(217, 107, 92, ${0.5 + glow * 0.25}), rgba(200, 130, 31, 0.18) 55%, rgba(0,0,0,0) 75%)`,
        }}
      />
      {/* flames */}
      <div style={{position: 'relative', width: 300, height: 190}}>
        <Flame frame={frame} seed="flameL" color={brand.dangerBright} width={70} height={130} x={48} />
        <Flame frame={frame} seed="flameC" color={brand.accentBright} width={92} height={185} x={104} />
        <Flame frame={frame} seed="flameR" color={brand.amberBright} width={62} height={112} x={186} />
        {/* flame core flicker */}
        <div
          style={{
            position: 'absolute',
            bottom: -8,
            left: 110,
            width: 80,
            height: 46,
            borderRadius: '50%',
            backgroundColor: '#F6C97E',
            opacity: 0.5 + glow2 * 0.4,
            scale: `${0.9 + glow2 * 0.25} ${0.85 + glow * 0.35}`,
          }}
        />
        {/* pan */}
        <div
          style={{
            position: 'absolute',
            bottom: -34,
            left: 20,
            width: 260,
            height: 78,
            borderRadius: '50%',
            backgroundColor: '#15100B',
            border: '5px solid #34271B',
          }}
        />
        {/* handle */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 272,
            width: 128,
            height: 22,
            borderRadius: 12,
            backgroundColor: '#34271B',
            rotate: '-16deg',
            transformOrigin: '0% 50%',
          }}
        />
      </div>
    </div>
  );
};
