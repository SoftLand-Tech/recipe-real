// Shared visual kit for "No Bars. Full Dinner."
// Rules: animate with useCurrentFrame() + interpolate() inline in style props;
// prefer CSS scale/translate/rotate shorthands; everything deterministic (random() 1 arg).
import {FC, ReactNode} from 'react';
import {Easing, interpolate, random, useCurrentFrame, useVideoConfig} from 'remotion';
import {brand} from '../../shared/theme';
export {SAFE} from '../../shared/theme';
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';

const bebas = loadBebas();
const grotesk = loadGrotesk('normal', {weights: ['400', '500', '700'], subsets: ['latin']});
const caveat = loadCaveat('normal', {weights: ['400', '700'], subsets: ['latin']});

export const FONT_DISPLAY = bebas.fontFamily;
export const FONT_UI = grotesk.fontFamily;
export const FONT_HAND = caveat.fontFamily;

// Terracotta is the app/truth color — CONSTANT across every location tint.
export const TERRA = brand.accentBright; // #D96E3F
export const INK = brand.darkCanvas; // #171310
export const CREAM = brand.cream; // #F3EDE6
export const CREAM_DIM = brand.creamSecondary;
export const SURFACE = brand.darkSurface;
export const SURFACE_SOFT = brand.darkSurfaceSoft;

export type LocKey = 'subway' | 'summit' | 'bunker' | 'plane' | 'desert' | 'polar' | 'base';

export const LOC: Record<LocKey, {a: string; b: string; accent: string; label: string}> = {
  subway: {a: '#22344A', b: '#0B1219', accent: '#5FA8DC', label: 'SUBWAY'},
  summit: {a: '#C9DDEC', b: '#7FA3BE', accent: '#FFFFFF', label: 'SUMMIT'},
  bunker: {a: '#4A3417', b: '#150E05', accent: '#E0A447', label: 'BUNKER'},
  plane: {a: '#223051', b: '#0A101E', accent: '#8FAEE0', label: '35,000 FT'},
  desert: {a: '#DFBE7C', b: '#7E5A2E', accent: '#F6E3B4', label: 'DESERT'},
  polar: {a: '#B7D2DE', b: '#2C4254', accent: '#9FE8D8', label: 'POLAR'},
  base: {a: '#26201A', b: INK, accent: TERRA, label: ''},
};

export const clampIn = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeOvershoot = Easing.bezier(0.34, 1.4, 0.64, 1);
export const easeIn = Easing.in(Easing.cubic);

/* ------------------------------------------------------------------ */
/* Scene chrome                                                        */
/* ------------------------------------------------------------------ */

export const SceneBg: FC<{loc: LocKey; children?: ReactNode}> = ({loc, children}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `linear-gradient(175deg, ${LOC[loc].a} 0%, ${LOC[loc].b} 100%)`,
    }}
  >
    {children}
  </div>
);

export const Vignette: FC<{strength?: number}> = ({strength = 0.5}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(9,6,4,${strength}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

export const Scanlines: FC<{opacity?: number}> = ({opacity = 0.12}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.35) 0px, rgba(255,255,255,0.35) 2px, transparent 2px, transparent 7px)`,
        translate: `0px ${(frame * 3) % 7}px`,
        pointerEvents: 'none',
      }}
    />
  );
};

/** Small letterspaced eyebrow with a terracotta dash — the connective tissue of the ad. */
export const Kicker: FC<{text: string; color?: string; size?: number}> = ({text, color = CREAM_DIM, size = 30}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
    <div style={{width: 46, height: 6, backgroundColor: TERRA}} />
    <span
      style={{
        fontFamily: FONT_UI,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: 8,
        color,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </span>
  </div>
);

/** Handwritten deadpan aside. */
export const HandNote: FC<{text: string; x?: number; y?: number; rotate?: number; size?: number; color?: string}> = ({
  text,
  x = 0,
  y = 0,
  rotate = -3,
  size = 52,
  color = CREAM_DIM,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        rotate: `${rotate}deg`,
        fontFamily: FONT_HAND,
        fontSize: size,
        color,
        opacity: interpolate(frame, [2, 10], [0, 1], clampIn),
        translate: `0px ${interpolate(frame, [2, 10], [12, 0], {...clampIn, easing: easeOut})}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Signal icon gags                                                    */
/* ------------------------------------------------------------------ */

const BAR_H = [0.4, 0.62, 0.8, 1];

/**
 * Signal bars. `alive` = bars standing at scene end. `dyingAt` = frame where the
 * tallest standing bar starts to die; `wobble` shakes the living bars.
 */
export const SignalIcon: FC<{
  alive: number;
  dyingAt?: number;
  size?: number;
  color?: string;
  dim?: string;
  wobble?: boolean;
  tiltOff?: boolean;
}> = ({alive, dyingAt, size = 220, color = CREAM, dim = 'rgba(243,237,230,0.16)', wobble = false, tiltOff = false}) => {
  const frame = useCurrentFrame();
  const barW = size * 0.18;
  const gap = size * 0.14;
  const jig = wobble ? Math.sin(frame * 1.7) * 3 + (random(`jig-${frame}`) - 0.5) * 4 : 0;
  return (
    <div style={{position: 'relative', display: 'flex', alignItems: 'flex-end', gap, height: size, translate: `${jig}px 0`}}>
      {BAR_H.map((h, i) => {
        const lit = i < alive;
        const isDying = lit && dyingAt !== undefined && i === alive - 1;
        const dieP = isDying ? interpolate(frame, [dyingAt, dyingAt + 7], [1, 0], {...clampIn, easing: Easing.in(Easing.quad)}) : 1;
        const tilt = tiltOff && isDying ? interpolate(frame, [dyingAt ?? 0, (dyingAt ?? 0) + 10], [0, 84], clampIn) : 0;
        return (
          <div
            key={i}
            style={{
              width: barW,
              height: size * h,
              backgroundColor: lit ? color : dim,
              borderRadius: barW * 0.28,
              transform: `scaleY(${lit ? dieP : 1}) rotate(${tilt}deg)`,
              opacity: lit ? dieP : 1,
              transformOrigin: '50% 100%',
              boxShadow: lit ? `0 0 ${18 * dieP}px ${color}55` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};

/** Round "no service" dot in a slashed circle. */
export const NoServiceIcon: FC<{size?: number; color?: string}> = ({size = 120, color = CREAM}) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeWidth="6" />
    <circle cx="50" cy="50" r="13" fill={color} />
    <line x1="24" y1="76" x2="76" y2="24" stroke={color} strokeWidth="6" strokeLinecap="round" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Timer HUD (the constant, calm heart of the ad)                      */
/* ------------------------------------------------------------------ */

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`;

export const TimerHUD: FC<{
  step: string;
  title: string;
  seconds: number;
  elapsed?: number;
  width?: number;
  compact?: boolean;
  float?: 'left' | 'right' | 'center';
  glow?: string;
}> = ({step, title, seconds, elapsed = 0, width = 560, compact = false, float = 'left', glow = TERRA}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const remaining = Math.max(0, seconds - elapsed - Math.floor(frame / 30));
  const ringP = interpolate(frame, [0, durationInFrames], [0.04, 0.3]);
  const enter = interpolate(frame, [0, 9], [0, 1], {...clampIn, easing: easeOut});
  const R = 74;
  const C = 2 * Math.PI * R;
  const pos =
    float === 'left' ? {left: 110, top: 300} : float === 'right' ? {right: 110, top: 300} : {left: '50%', top: 300};
  return (
    <div
      style={{
        position: 'absolute',
        ...pos,
        ...(float === 'center' ? {translate: '-50% 0'} : {}),
        width,
        backgroundColor: 'rgba(23,19,16,0.92)',
        border: `2px solid rgba(243,237,230,0.14)`,
        borderRadius: 28,
        padding: compact ? '30px 38px' : '42px 48px',
        boxShadow: `0 30px 80px rgba(0,0,0,0.55), 0 0 90px ${glow}22`,
        scale: `${interpolate(enter, [0, 1], [0.86, 1])}`,
        opacity: enter,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: glow}}>{step}</span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: FONT_UI,
            fontWeight: 500,
            fontSize: 22,
            letterSpacing: 3,
            color: CREAM_DIM,
            border: '1.5px solid rgba(243,237,230,0.22)',
            borderRadius: 999,
            padding: '6px 16px',
          }}
        >
          <div style={{width: 10, height: 10, borderRadius: 999, backgroundColor: glow}} />
          COOK MODE
        </div>
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 36, marginTop: 18}}>
        <svg width={170} height={170} viewBox="0 0 170 170" style={{flexShrink: 0}}>
          <circle cx="85" cy="85" r={R} fill="none" stroke="rgba(243,237,230,0.12)" strokeWidth="12" />
          <circle
            cx="85"
            cy="85"
            r={R}
            fill="none"
            stroke={glow}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * ringP}
            transform="rotate(-90 85 85)"
          />
          <text
            x="85"
            y="98"
            textAnchor="middle"
            fill={CREAM}
            style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 40}}
          >
            {Math.round((1 - ringP) * 100)}%
          </text>
        </svg>
        <div>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: compact ? 76 : 96,
              color: CREAM,
              lineHeight: 0.95,
              letterSpacing: 3,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: compact ? 68 : 84,
              color: glow,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: 2,
              scale: `${1 + (frame % 30 < 2 ? 0.05 : 0)}`,
            }}
          >
            {mmss(remaining)}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Phone shell + step list                                             */
/* ------------------------------------------------------------------ */

export const PhoneShell: FC<{children?: ReactNode; width?: number; gray?: boolean}> = ({
  children,
  width = 400,
  gray = false,
}) => {
  const frame = useCurrentFrame();
  const height = width * 2.05;
  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        borderRadius: width * 0.14,
        backgroundColor: gray ? '#191919' : '#0C0A08',
        border: `10px solid ${gray ? '#2A2A2A' : '#241D17'}`,
        boxShadow: gray ? '0 40px 90px rgba(0,0,0,0.5)' : `0 40px 90px rgba(0,0,0,0.6), 0 0 110px ${TERRA}26`,
        overflow: 'hidden',
        rotate: `${Math.sin(frame * 0.9) * 0.15}deg`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 26px',
          backgroundColor: gray ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.3)',
          fontFamily: FONT_UI,
          fontWeight: 500,
          fontSize: 20,
          color: gray ? '#8A8A8A' : CREAM_DIM,
        }}
      >
        <span>8:12</span>
        <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
          {gray ? <span style={{letterSpacing: 2}}>NO SERVICE</span> : <SignalIcon alive={0} size={22} dim="rgba(243,237,230,0.2)" />}
          <div style={{width: 34, height: 16, border: '2px solid currentColor', borderRadius: 4}}>
            <div style={{width: '70%', height: '100%', backgroundColor: 'currentColor'}} />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
};

const CHECK = 'M 8 12 L 13 17 L 22 7';

export const StepRow: FC<{label: string; minutes: string; state: 'done' | 'active' | 'todo'; popAt?: number}> = ({
  label,
  minutes,
  state,
  popAt = 0,
}) => {
  const frame = useCurrentFrame();
  const pop = state === 'done' ? interpolate(frame, [popAt, popAt + 6], [0, 1], {...clampIn, easing: easeOvershoot}) : 1;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
      <svg width={36} height={36} viewBox="0 0 30 30" style={{scale: `${pop}`, flexShrink: 0}}>
        <circle
          cx="15"
          cy="15"
          r="13"
          fill={state === 'done' ? TERRA : 'none'}
          stroke={state === 'done' ? TERRA : state === 'active' ? CREAM : 'rgba(243,237,230,0.25)'}
          strokeWidth="2.5"
        />
        {state === 'done' && (
          <path d={CHECK} fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {state === 'active' && <circle cx="15" cy="15" r="5" fill={CREAM} />}
      </svg>
      <span
        style={{
          fontFamily: FONT_UI,
          fontWeight: state === 'todo' ? 400 : 700,
          fontSize: 34,
          color: state === 'todo' ? 'rgba(243,237,230,0.38)' : CREAM,
          letterSpacing: 1,
          flex: 1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONT_UI,
          fontWeight: 700,
          fontSize: 30,
          fontVariantNumeric: 'tabular-nums',
          color: state === 'active' ? TERRA : 'rgba(243,237,230,0.45)',
        }}
      >
        {minutes}
      </span>
    </div>
  );
};

export const StepList: FC<{
  steps: {label: string; minutes: string}[];
  done: number;
  width?: number;
  gap?: number;
}> = ({steps, done, width = 700, gap = 26}) => (
  <div style={{width, display: 'flex', flexDirection: 'column', gap}}>
    {steps.map((s, i) => (
      <StepRow
        key={s.label}
        label={s.label}
        minutes={s.minutes}
        state={i < done ? 'done' : i === done ? 'active' : 'todo'}
        popAt={2 + i * 3}
      />
    ))}
  </div>
);

/* ------------------------------------------------------------------ */
/* Slam titles + wipes                                                 */
/* ------------------------------------------------------------------ */

export const SlamTitle: FC<{
  text: string;
  tint: string;
  sub?: string;
  size?: number;
  top?: number;
  align?: 'left' | 'center';
}> = ({text, tint, sub, size = 250, top = 340, align = 'left'}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 10], [0, 1], {...clampIn, easing: Easing.bezier(0.2, 1.2, 0.3, 1)});
  const shudder = frame < 12 ? Math.sin(frame * 5) * 6 * (1 - frame / 12) : 0;
  const x = interpolate(enter, [0, 1], [-120, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'center' ? '50%' : 110,
        top,
        ...(align === 'center' ? {translate: `${interpolate(enter, [0, 1], [-50, -50])}% 0`} : {}),
        fontFamily: FONT_DISPLAY,
        fontSize: size,
        lineHeight: 0.92,
        letterSpacing: 4,
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{position: 'relative'}}>
        <span style={{position: 'absolute', color: TERRA, translate: `${-6 + shudder}px ${4}px`, opacity: 0.9}}>{text}</span>
        <span style={{position: 'absolute', color: tint, translate: `${6 - shudder}px ${-4}px`, opacity: 0.75}}>{text}</span>
        <span style={{position: 'relative', color: CREAM, translate: `${shudder}px 0`}}>{text}</span>
        <div
          style={{
            marginTop: 26,
            height: 14,
            width: interpolate(frame, [0, 14], [0, 560], {...clampIn, easing: easeOut}),
            backgroundColor: TERRA,
          }}
        />
        {sub && (
          <div
            style={{
              marginTop: 26,
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 44,
              letterSpacing: 10,
              color: CREAM,
              opacity: interpolate(frame, [6, 16], [0, 1], clampIn),
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};

/** Full-bleed color band that travels across — used as a hard scene wipe. */
export const TravelWipe: FC<{color: string; dir?: 1 | -1; at?: number; band?: number}> = ({
  color,
  dir = 1,
  at = 0,
  band = 900,
}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [at, at + 12], [-2400 * dir, 2400 * dir], {...clampIn, easing: Easing.inOut(Easing.quad)});
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '50%',
        width: band,
        translate: `${x}px 0`,
        backgroundColor: color,
        transform: 'skewX(-12deg)',
        boxShadow: '0 0 120px rgba(0,0,0,0.5)',
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Dinner props                                                        */
/* ------------------------------------------------------------------ */

export const Steam: FC<{x: number; y: number; scale?: number; color?: string; spread?: number}> = ({
  x,
  y,
  scale = 1,
  color = 'rgba(243,237,230,0.5)',
  spread = 1,
}) => {
  const frame = useCurrentFrame();
  const wisps = [0, 1, 2];
  return (
    <div style={{position: 'absolute', left: x, top: y}}>
      {wisps.map((w) => {
        const p = ((frame + w * 14) % 42) / 42;
        return (
          <svg
            key={w}
            width={60 * scale}
            height={120 * scale}
            viewBox="0 0 60 120"
            style={{
              position: 'absolute',
              left: (w - 1) * 46 * scale * spread,
              top: 0,
              opacity: interpolate(p, [0, 0.25, 0.85, 1], [0, 0.8, 0.5, 0], clampIn),
              translate: `0px ${-p * 90 * scale}px`,
            }}
          >
            <path
              d="M30 118 C 12 92, 46 74, 30 50 C 16 30, 44 20, 30 2"
              fill="none"
              stroke={color}
              strokeWidth={7 * scale}
              strokeLinecap="round"
            />
          </svg>
        );
      })}
    </div>
  );
};

export const Plate: FC<{size?: number; bite?: boolean}> = ({size = 460, bite = false}) => (
  <div style={{position: 'relative', width: size, height: size * 0.36}}>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: `linear-gradient(180deg, ${brand.cream} 0%, #D9CFC0 100%)`,
        boxShadow: '0 26px 60px rgba(0,0,0,0.55)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '12%',
        top: '16%',
        width: '76%',
        height: '68%',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%, #B4522B 0%, #8C3A1D 70%)',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '26%',
        top: '24%',
        width: '26%',
        height: '34%',
        borderRadius: '50%',
        backgroundColor: '#E9B44C',
        rotate: '-14deg',
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '52%',
        top: '30%',
        width: '20%',
        height: '26%',
        borderRadius: '50%',
        backgroundColor: '#6FA97F',
      }}
    />
    {bite && (
      <div
        style={{
          position: 'absolute',
          right: '6%',
          top: '2%',
          width: '34%',
          height: '90%',
          borderRadius: '50%',
          backgroundColor: brand.cream,
        }}
      />
    )}
  </div>
);

export const Pot: FC<{size?: number; bubbles?: boolean; lidLift?: number}> = ({size = 300, bubbles = false, lidLift = 0}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: size, height: size * 0.8}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: size * 0.18,
          width: size,
          height: size * 0.55,
          borderRadius: '18px 18px 40px 40px',
          background: `linear-gradient(180deg, #3A3129 0%, #241D17 100%)`,
          border: '3px solid rgba(243,237,230,0.18)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: size * 0.08,
          top: size * 0.16 - lidLift,
          width: size * 0.84,
          height: size * 0.14,
          borderRadius: 12,
          backgroundColor: '#4A3F33',
          rotate: `${-lidLift * 0.12}deg`,
          boxShadow: '0 10px 24px rgba(0,0,0,0.5)',
        }}
      />
      <div style={{position: 'absolute', left: size * 0.42, top: size * 0.02 - lidLift, width: size * 0.16, height: size * 0.1, borderRadius: 8, backgroundColor: '#4A3F33'}} />
      {bubbles &&
        [0, 1, 2, 3].map((b) => {
          const p = ((frame + b * 11) % 30) / 30;
          return (
            <div
              key={b}
              style={{
                position: 'absolute',
                left: size * (0.22 + random(`bx-${b}`) * 0.5),
                top: size * 0.3 - p * size * 0.22,
                width: 8 + b * 3,
                height: 8 + b * 3,
                borderRadius: 999,
                border: '2px solid rgba(243,237,230,0.5)',
                opacity: interpolate(p, [0, 0.3, 1], [0, 0.9, 0], clampIn),
              }}
            />
          );
        })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Small icons                                                         */
/* ------------------------------------------------------------------ */

export const AirplaneIcon: FC<{size?: number; color?: string}> = ({size = 64, color = CREAM}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <path d="M8 34 L54 18 L38 46 L30 38 L22 50 L20 38 Z" fill={color} />
  </svg>
);

export const CloudIcon: FC<{size?: number; color?: string; rain?: boolean}> = ({size = 180, color = '#9AA0A6', rain = false}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: size, height: size * 0.7}}>
      <svg width={size} height={size * 0.62} viewBox="0 0 180 110">
        <path
          d="M40 88 C 14 88, 8 62, 30 54 C 30 30, 62 20, 76 40 C 90 22, 124 24, 128 50 C 154 48, 164 74, 140 88 Z"
          fill={color}
        />
      </svg>
      {rain &&
        [0, 1, 2].map((r) => {
          const p = ((frame + r * 9) % 24) / 24;
          return (
            <div
              key={r}
              style={{
                position: 'absolute',
                left: size * (0.2 + r * 0.28),
                top: size * 0.6 + p * size * 0.32,
                width: 5,
                height: 18,
                borderRadius: 3,
                backgroundColor: '#7C9BD6',
                opacity: interpolate(p, [0, 0.2, 0.9, 1], [0, 0.9, 0.9, 0], clampIn),
              }}
            />
          );
        })}
    </div>
  );
};

export const CrossedCloudIcon: FC<{size?: number}> = ({size = 200}) => (
  <div style={{position: 'relative'}}>
    <CloudIcon size={size} color="#6A7076" />
    <svg width={size} height={size * 0.7} viewBox="0 0 200 140" style={{position: 'absolute', inset: 0}}>
      <line x1="14" y1="126" x2="182" y2="16" stroke={TERRA} strokeWidth="9" strokeLinecap="round" />
    </svg>
  </div>
);

/** The RecipeReal wordmark — styled text only, no assets. */
export const Wordmark: FC<{size?: number; sub?: string}> = ({size = 220, sub}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: size * 0.02}}>
        <span style={{fontFamily: FONT_DISPLAY, fontSize: size, color: CREAM, letterSpacing: 2, lineHeight: 1}}>Recipe</span>
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: size,
            color: TERRA,
            letterSpacing: 2,
            lineHeight: 1,
            textShadow: `0 0 ${40 + Math.sin(frame * 0.8) * 8}px ${TERRA}66`,
          }}
        >
          Real
        </span>
      </div>
      {sub && (
        <span style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 36, letterSpacing: 14, color: CREAM_DIM}}>{sub}</span>
      )}
    </div>
  );
};

export const SpinnerRing: FC<{size?: number; color?: string; wobble?: number; stallAt?: number}> = ({
  size = 140,
  color = '#9AA0A6',
  wobble = 0,
  stallAt,
}) => {
  const frame = useCurrentFrame();
  const spin = stallAt === undefined ? frame * 14 : Math.min(frame, stallAt) * 14;
  const wob = Math.sin(frame * 1.3) * wobble;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{rotate: `${spin + wob}deg`}}
    >
      <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(154,160,166,0.18)" strokeWidth="9" />
      <path d="M50 12 A 38 38 0 0 1 88 50" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
};

export const SweatDrop: FC<{x: number; y: number}> = ({x, y}) => {
  const frame = useCurrentFrame();
  const p = (frame % 26) / 26;
  return (
    <svg
      width="44"
      height="60"
      viewBox="0 0 44 60"
      style={{position: 'absolute', left: x, top: y + p * 90, opacity: interpolate(p, [0, 0.15, 0.9, 1], [0, 1, 1, 0], clampIn)}}
    >
      <path d="M22 4 C 32 24, 40 34, 40 44 A 18 18 0 0 1 4 44 C 4 34, 12 24, 22 4 Z" fill="#7C9BD6" />
    </svg>
  );
};

export const Thermometer: FC<{height?: number}> = ({height = 560}) => {
  const frame = useCurrentFrame();
  const wig = Math.sin(frame * 1.1) * 0.5 + 0.5;
  return (
    <div style={{position: 'relative', width: height * 0.34, height}}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          translate: '-50% 0',
          top: 0,
          width: height * 0.16,
          height: height * 0.78,
          borderRadius: 999,
          backgroundColor: 'rgba(23,19,16,0.85)',
          border: '3px solid rgba(243,237,230,0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: `${88 + wig * 10}%`,
            background: `linear-gradient(180deg, ${brand.dangerBright} 0%, ${TERRA} 60%, ${brand.amberBright} 100%)`,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          translate: '-50% 0',
          bottom: 0,
          width: height * 0.3,
          height: height * 0.3,
          borderRadius: '50%',
          backgroundColor: brand.dangerBright,
          boxShadow: `0 0 ${30 + wig * 26}px ${brand.dangerBright}88`,
        }}
      />
      <svg width={height * 0.34} height={height} viewBox="0 0 60 180" style={{position: 'absolute', inset: 0}}>
        {[0, 1, 2, 3, 4, 5].map((t) => (
          <line key={t} x1={44} y1={20 + t * 22} x2={54} y2={20 + t * 22} stroke="rgba(243,237,230,0.4)" strokeWidth="3" />
        ))}
      </svg>
    </div>
  );
};
