import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {ANTON, CLAMP, TIMER_BOX, TimerDigits, jitter} from './common';

/** Local frame of the crack impact (global 99 = 3.3s, as "fifteen minutes" ends). */
const IMPACT = 9;
const COLS = 4;
const ROWS = 2;
const SHARDS = COLS * ROWS;

const CENTER_X = 540;
const CENTER_Y = TIMER_BOX.top + TIMER_BOX.height / 2;

/** Deterministic crack polylines radiating from the timer center. */
const CRACKS = Array.from({length: 9}, (_, k) => {
  const base = (k / 9) * Math.PI * 2 + random(`crack-a:${k}`) * 0.6;
  let x = CENTER_X;
  let y = CENTER_Y;
  let d = `M ${x} ${y}`;
  let len = 150 + random(`crack-l:${k}`) * 110;
  for (let s = 0; s < 3; s++) {
    const a = base + (random(`crack-w:${k}:${s}`) - 0.5) * 1.0;
    x += Math.cos(a) * len;
    y += Math.sin(a) * len;
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    len *= 0.7;
  }
  return d;
});

export const ShatterScene: FC = () => {
  const frame = useCurrentFrame();
  const flying = frame >= IMPACT;
  const flicker = !flying && random(`pre-flick:${Math.floor(frame / 2)}`) > 0.45;

  const flash = flying
    ? interpolate(frame, [IMPACT, IMPACT + 3], [0.65, 0], CLAMP)
    : 0;
  const crackOpacity = interpolate(
    frame,
    [IMPACT, IMPACT + 2, IMPACT + 16],
    [0, 0.95, 0],
    CLAMP,
  );

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* The timer, intact then shattered into clipped shards */}
      <div
        style={{
          position: 'absolute',
          top: TIMER_BOX.top,
          left: TIMER_BOX.side,
          right: TIMER_BOX.side,
          height: TIMER_BOX.height,
        }}
      >
        {Array.from({length: SHARDS}, (_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const p = flying
            ? interpolate(frame, [IMPACT, IMPACT + 46], [0, 1], {
                easing: Easing.in(Easing.cubic),
                ...CLAMP,
              })
            : 0;
          const angle = random(`shard-a:${i}`) * Math.PI * 2;
          const dist = 260 + random(`shard-d:${i}`) * 540;
          const dx = Math.cos(angle) * dist * p;
          const dy = Math.sin(angle) * dist * p + 480 * p * p;
          const rot = (random(`shard-r:${i}`) - 0.5) * 170 * p;
          const jx = jitter(`shard-jx:${i}`, frame, flying ? 2 : 5, 2);
          const jy = jitter(`shard-jy:${i}`, frame, flying ? 2 : 5, 2);
          const opacity = flying
            ? interpolate(p, [0, 0.85], [1, 0], CLAMP)
            : 1;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                clipPath: `inset(${row * 50}% ${(COLS - 1 - col) * 25}% ${
                  (ROWS - 1 - row) * 50
                }% ${col * 25}%)`,
                translate: `${dx + jx}px ${dy + jy}px`,
                rotate: `${rot}deg`,
                opacity,
              }}
            >
              <TimerDigits
                size={380}
                color={!flying && flicker ? brand.dangerBright : brand.cream}
              />
            </div>
          );
        })}
      </div>

      {/* LYING slams in on the crack impact */}
      <div
        style={{
          position: 'absolute',
          top: 545,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: ANTON,
          fontSize: 290,
          lineHeight: 1,
          letterSpacing: 14,
          color: brand.dangerBright,
          opacity: interpolate(frame, [IMPACT + 3, IMPACT + 5], [0, 1], CLAMP),
          scale: interpolate(frame, [IMPACT + 3, IMPACT + 8], [3, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            ...CLAMP,
          }),
        }}
      >
        LYING
      </div>
      <div
        style={{
          position: 'absolute',
          top: 905,
          left: 260,
          width: 560,
          height: 10,
          borderRadius: 5,
          backgroundColor: brand.dangerBright,
          transformOrigin: '0% 50%',
          scale: `${interpolate(frame, [IMPACT + 12, IMPACT + 26], [0, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            ...CLAMP,
          })} 1`,
        }}
      />

      {/* Crack lines + impact flash */}
      <svg
        viewBox="0 0 1080 1920"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: crackOpacity,
        }}
      >
        {CRACKS.map((d) => (
          <path key={d} d={d} fill="none" stroke={brand.cream} strokeWidth={3} />
        ))}
      </svg>
      <AbsoluteFill style={{backgroundColor: brand.cream, opacity: flash}} />
    </AbsoluteFill>
  );
};
