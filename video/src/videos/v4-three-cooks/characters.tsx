// Stylized cartoon busts: circle head, per-character hat/colors, flapping SVG mouth.
// Everything is a pure function of the passed composition frame `f`.

import type {FC} from 'react';
import {interpolate, random} from 'remotion';
import {brand} from '../../shared/theme';
import type {Window2} from './timeline';

const INK = brand.ink;

export type CookId = 'optimist' | 'realist' | 'beginner';

export const COOKS: Record<
  CookId,
  {name: string; color: string; dark: string; soft: string; skin: string; apron: string; hat: string; hatDark: string}
> = {
  optimist: {
    name: 'THE OPTIMIST',
    color: '#EFB63E',
    dark: '#8A6216',
    soft: '#F7EAD0',
    skin: '#F6DCC0',
    apron: '#BF552B',
    hat: '#FFFFFF',
    hatDark: '#D9D2C7',
  },
  realist: {
    name: 'THE REALIST',
    color: '#8A6E5A',
    dark: '#4A3A2E',
    soft: '#EFE8DD',
    skin: '#EACBA9',
    apron: '#5C5148',
    hat: '#6E5A48',
    hatDark: '#57463A',
  },
  beginner: {
    name: 'THE BEGINNER',
    color: '#A9C7DE',
    dark: '#3E6379',
    soft: '#E4EEF6',
    skin: '#F4DCC6',
    apron: '#3F7D52',
    hat: '#A9C7DE',
    hatDark: '#7FA6BE',
  },
};

export const COOK_ORDER: readonly CookId[] = ['optimist', 'realist', 'beginner'];

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Mouth openness 0..1 while a voice window is active, driven by seeded noise. */
const mouthOpenness = (f: number, speaking: Window2 | undefined, seed: string): number => {
  if (!speaking) return 0.1;
  const gate = Math.min(
    interpolate(f, [speaking[0], speaking[0] + 6], [0, 1], CLAMP),
    interpolate(f, [speaking[1] - 4, speaking[1]], [1, 0], CLAMP),
  );
  if (gate <= 0) return 0.1;
  return 0.1 + 0.88 * gate * random(seed, f);
};

/** 0..1 nod amplitude across the active nod windows. */
const nodAmount = (f: number, windows: readonly Window2[]): number => {
  let amp = 0;
  for (const w of windows) {
    if (f < w[0] || f > w[1]) continue;
    amp = Math.max(
      amp,
      Math.min(
        interpolate(f, [w[0], w[0] + 6], [0, 1], CLAMP),
        interpolate(f, [w[1] - 6, w[1]], [1, 0], CLAMP),
      ),
    );
  }
  return amp;
};

const WinkLid: FC<{cook: CookId; f: number; winkAt: number | undefined}> = ({cook, f, winkAt}) => {
  if (winkAt === undefined) return null;
  const close = Math.min(
    interpolate(f, [winkAt, winkAt + 8], [0, 1], CLAMP),
    interpolate(f, [winkAt + 16, winkAt + 24], [1, 0], CLAMP),
  );
  if (close <= 0.001) return null;
  const h = close * 26;
  return (
    <rect
      x={133}
      y={96}
      width={27}
      height={h}
      rx={7}
      fill={COOKS[cook].skin}
      stroke={INK}
      strokeWidth={4}
    />
  );
};

type CookBustProps = {
  cook: CookId;
  /** Absolute composition frame driving the animation. */
  f: number;
  speaking?: Window2;
  nodWindows?: readonly Window2[];
  winkAt?: number;
  width?: number;
};

export const CookBust: FC<CookBustProps> = ({cook, f, speaking, nodWindows, winkAt, width = 240}) => {
  const c = COOKS[cook];
  const open = mouthOpenness(f, speaking, `mouth-${cook}`);
  const amp = nodAmount(f, nodWindows ?? []);
  const nodY = amp * (Math.sin(f * 0.5) * 0.5 + 0.5) * 10;
  const nodR = amp * Math.sin(f * 0.5 + 1.2) * 2.4;
  const winkTilt = winkAt === undefined ? 0 : Math.min(
    interpolate(f, [winkAt, winkAt + 8], [0, 1], CLAMP),
    interpolate(f, [winkAt + 16, winkAt + 24], [1, 0], CLAMP),
  );
  const sweat =
    speaking && cook === 'beginner'
      ? interpolate(f, [speaking[0], speaking[0] + 12], [0, 0.9], CLAMP)
      : 0;

  return (
    <svg width={width} viewBox="0 0 240 282" style={{overflow: 'visible'}}>
      {/* shoulders / apron */}
      <rect x={34} y={204} width={172} height={78} rx={32} fill={c.apron} stroke={INK} strokeWidth={5} />
      <rect x={104} y={204} width={32} height={26} rx={6} fill={brand.surface} stroke={INK} strokeWidth={4} />

      <g transform={`translate(0 ${nodY}) rotate(${nodR - winkTilt * 3} 120 196)`}>
        {/* head */}
        <circle cx={120} cy={120} r={72} fill={c.skin} stroke={INK} strokeWidth={5} />

        {/* hats */}
        {cook === 'optimist' && (
          <g>
            <circle cx={92} cy={40} r={23} fill={c.hat} stroke={INK} strokeWidth={5} />
            <circle cx={148} cy={40} r={23} fill={c.hat} stroke={INK} strokeWidth={5} />
            <circle cx={120} cy={30} r={27} fill={c.hat} stroke={INK} strokeWidth={5} />
            <rect x={86} y={54} width={68} height={20} rx={7} fill={c.hat} stroke={INK} strokeWidth={5} />
          </g>
        )}
        {cook === 'realist' && (
          <g>
            <path d="M52 106 a68 46 0 0 1 136 0 z" fill={c.hat} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            <rect x={146} y={94} width={44} height={12} rx={6} fill={c.hatDark} stroke={INK} strokeWidth={4} transform="rotate(-8 168 100)" />
            <circle cx={120} cy={68} r={5} fill={c.hatDark} stroke={INK} strokeWidth={4} />
          </g>
        )}
        {cook === 'beginner' && (
          <g>
            <path d="M50 104 a70 48 0 0 1 140 0 z" fill={c.hat} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
            <rect x={103} y={84} width={34} height={13} rx={6} fill={c.hatDark} stroke={INK} strokeWidth={4} />
            <circle cx={120} cy={72} r={4.5} fill={brand.surface} stroke={INK} strokeWidth={3} />
          </g>
        )}

        {/* eyes */}
        {cook === 'optimist' && (
          <g>
            <path d="M80 90 q14 -12 28 -4" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <path d="M132 86 q14 -8 28 4" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <circle cx={94} cy={108} r={10} fill={INK} />
            <circle cx={146} cy={108} r={10} fill={INK} />
          </g>
        )}
        {cook === 'realist' && (
          <g>
            <line x1={80} y1={90} x2={108} y2={89} stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <line x1={132} y1={89} x2={160} y2={90} stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <circle cx={94} cy={110} r={9} fill={INK} />
            <circle cx={146} cy={110} r={9} fill={INK} />
            <rect x={84} y={100} width={21} height={10} rx={4} fill={c.skin} />
            <rect x={135} y={100} width={21} height={10} rx={4} fill={c.skin} />
          </g>
        )}
        {cook === 'beginner' && (
          <g>
            <line x1={78} y1={88} x2={106} y2={82} stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <line x1={134} y1={82} x2={162} y2={88} stroke={INK} strokeWidth={5} strokeLinecap="round" />
            <circle cx={94} cy={108} r={12} fill={INK} />
            <circle cx={146} cy={108} r={12} fill={INK} />
            <circle cx={98} cy={104} r={3.5} fill={brand.surface} />
            <circle cx={150} cy={104} r={3.5} fill={brand.surface} />
          </g>
        )}

        {/* wink eyelid over the viewer-right eye */}
        <WinkLid cook={cook} f={f} winkAt={winkAt} />

        {/* cheeks / stubble / sweat */}
        {cook === 'optimist' && (
          <g opacity={0.7}>
            <ellipse cx={78} cy={136} rx={11} ry={7} fill="#F2AC92" />
            <ellipse cx={162} cy={136} rx={11} ry={7} fill="#F2AC92" />
          </g>
        )}
        {cook === 'realist' && (
          <g fill={brand.inkFaint}>
            <circle cx={96} cy={176} r={2} />
            <circle cx={104} cy={181} r={2} />
            <circle cx={112} cy={184} r={2} />
            <circle cx={128} cy={184} r={2} />
            <circle cx={136} cy={181} r={2} />
            <circle cx={144} cy={176} r={2} />
          </g>
        )}
        {cook === 'beginner' && (
          <path
            d="M182 76 c8 12 8 20 0 24 c-8 -4 -8 -12 0 -24 z"
            fill="#7FB3D5"
            stroke={INK}
            strokeWidth={3}
            opacity={sweat}
          />
        )}

        {/* flapping mouth */}
        <ellipse
          cx={120}
          cy={158}
          rx={17}
          ry={4 + open * 17}
          fill="#61241C"
          stroke={INK}
          strokeWidth={4.5}
        />
      </g>
    </svg>
  );
};
