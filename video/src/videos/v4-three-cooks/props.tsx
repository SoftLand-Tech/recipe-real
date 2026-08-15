// Per-cook props shown inside their panel while they deliver a line.

import type {FC} from 'react';
import {Easing, interpolate} from 'remotion';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {Q_POPS, REALIST_TICKS, type Window2} from './timeline';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const PropFrame: FC<{f: number; window: Window2; children: React.ReactNode}> = ({f, window: w, children}) => {
  const vis = Math.min(
    interpolate(f, [w[0], w[0] + 10], [0, 1], CLAMP),
    interpolate(f, [w[1] - 12, w[1]], [1, 0], CLAMP),
  );
  if (vis <= 0.001) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        scale: `${0.8 + vis * 0.2}`,
        opacity: vis,
      }}
    >
      {children}
    </div>
  );
};

/** Optimist: a kitchen timer spinning happily (two full spins across the line). */
export const TimerDial: FC<{f: number; window: Window2}> = ({f, window: w}) => {
  const p = interpolate(f, [w[0] + 8, w[1]], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const R = 58;
  const C = 2 * Math.PI * R;
  return (
    <PropFrame f={f} window={w}>
      <svg width={170} height={170} viewBox="0 0 170 170">
        <circle cx={85} cy={85} r={R + 8} fill={brand.surface} stroke={brand.hairlineStrong} strokeWidth={5} />
        {Array.from({length: 12}, (_, i) => (
          <line
            key={i}
            x1={85}
            y1={27}
            x2={85}
            y2={36}
            stroke={brand.inkFaint}
            strokeWidth={4}
            strokeLinecap="round"
            transform={`rotate(${i * 30} 85 85)`}
          />
        ))}
        <circle
          cx={85}
          cy={85}
          r={R}
          fill="none"
          stroke={brand.accent}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${C * p} ${C}`}
          transform="rotate(-90 85 85)"
        />
        <line
          x1={85}
          y1={85}
          x2={85}
          y2={38}
          stroke={brand.ink}
          strokeWidth={6}
          strokeLinecap="round"
          transform={`rotate(${p * 720} 85 85)`}
        />
        <circle cx={85} cy={85} r={7} fill={brand.accent} stroke={brand.ink} strokeWidth={3} />
      </svg>
      <div style={{fontFamily: inter, fontSize: 26, fontWeight: 700, color: brand.success}}>Done on time!</div>
    </PropFrame>
  );
};

/** Realist: a wall clock that sprouts extra ticks as uncounted time piles up. */
export const TickingClock: FC<{f: number; window: Window2}> = ({f, window: w}) => {
  const minute = interpolate(f, [w[0], w[1]], [40, 300], CLAMP);
  const hour = interpolate(f, [w[0], w[1]], [10, 55], CLAMP);
  const extra = Array.from({length: REALIST_TICKS.length}, (_, i) => (i + 1) * 30 + 15);
  // "+20 MIN" lands right as the Realist finishes (line ends at 578).
  const chip = interpolate(f, [582, 594], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  return (
    <PropFrame f={f} window={w}>
      <svg width={170} height={170} viewBox="0 0 170 170">
        <circle cx={85} cy={85} r={64} fill={brand.surface} stroke={brand.ink} strokeWidth={5} />
        {[0, 90, 180, 270].map((a) => (
          <line
            key={a}
            x1={85}
            y1={29}
            x2={85}
            y2={41}
            stroke={brand.ink}
            strokeWidth={5}
            strokeLinecap="round"
            transform={`rotate(${a} 85 85)`}
          />
        ))}
        {extra.map((a, i) => {
          const grow = interpolate(f, [REALIST_TICKS[i], REALIST_TICKS[i] + 8], [0, 1], CLAMP);
          if (grow <= 0.001) return null;
          return (
            <line
              key={a}
              x1={85}
              y1={29}
              x2={85}
              y2={41}
              stroke={brand.danger}
              strokeWidth={5}
              strokeLinecap="round"
              opacity={grow}
              transform={`rotate(${a} 85 85) scale(${0.4 + grow * 0.6})`}
              style={{transformBox: 'fill-box', transformOrigin: 'center'}}
            />
          );
        })}
        <line
          x1={85}
          y1={85}
          x2={85}
          y2={52}
          stroke={brand.ink}
          strokeWidth={6}
          strokeLinecap="round"
          transform={`rotate(${hour} 85 85)`}
        />
        <line
          x1={85}
          y1={85}
          x2={85}
          y2={38}
          stroke={brand.ink}
          strokeWidth={4}
          strokeLinecap="round"
          transform={`rotate(${minute} 85 85)`}
        />
        <circle cx={85} cy={85} r={5} fill={brand.ink} />
      </svg>
      <div
        style={{
          fontFamily: anton,
          fontSize: 30,
          color: brand.danger,
          backgroundColor: brand.dangerSoft,
          padding: '4px 16px',
          borderRadius: 12,
          opacity: chip,
          scale: `${0.6 + chip * 0.4}`,
        }}
      >
        +20 MIN
      </div>
    </PropFrame>
  );
};

const MINI_QS = [
  {at: Q_POPS[0], dx: -88, dy: -74, color: brand.accent, size: 64},
  {at: Q_POPS[1], dx: 96, dy: -30, color: brand.danger, size: 54},
  {at: Q_POPS[2], dx: -102, dy: 18, color: brand.amber, size: 48},
] as const;

/** Beginner: the recipe card tilts while question marks pop around it. */
export const MiniCard: FC<{f: number; window: Window2}> = ({f, window: w}) => {
  const active = Math.max(
    0,
    Math.min(
      interpolate(f, [w[0] + 8, w[0] + 16], [0, 1], CLAMP),
      interpolate(f, [w[1] - 12, w[1] - 4], [1, 0], CLAMP),
    ),
  );
  const tilt = active * Math.sin(((f - w[0]) / 30) * Math.PI * 2) * 8;
  return (
    <PropFrame f={f} window={w}>
      <div style={{position: 'relative'}}>
        <div
          style={{
            width: 190,
            height: 232,
            backgroundColor: brand.surface,
            border: `4px solid ${brand.hairlineStrong}`,
            borderRadius: 18,
            boxShadow: '0 14px 30px rgba(36,29,23,0.16)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            rotate: `${tilt}deg`,
          }}
        >
          <div style={{fontFamily: inter, fontSize: 15, letterSpacing: 3, color: brand.inkSecondary}}>TOTAL TIME</div>
          <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
            <span style={{fontFamily: anton, fontSize: 74, lineHeight: 1, color: brand.ink}}>30</span>
            <span style={{fontFamily: anton, fontSize: 26, color: brand.accent}}>MIN</span>
          </div>
          <div style={{width: '70%', borderTop: `3px dashed ${brand.hairlineStrong}`}} />
          <div style={{fontFamily: inter, fontSize: 15, color: brand.inkSecondary}}>Step 1 of… 12?</div>
        </div>
        {MINI_QS.map((q) => {
          const pop = interpolate(f, [q.at, q.at + 8, q.at + 36, q.at + 46], [0, 1.15, 1, 0.6], {
            ...CLAMP,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          });
          if (pop <= 0.01) return null;
          return (
            <div
              key={q.at}
              style={{
                position: 'absolute',
                left: 95 + q.dx,
                top: 116 + q.dy,
                fontFamily: anton,
                fontSize: q.size,
                color: q.color,
                rotate: `${q.dx > 0 ? 12 : -12}deg`,
                scale: `${pop}`,
              }}
            >
              ?
            </div>
          );
        })}
      </div>
    </PropFrame>
  );
};
