import type {FC} from 'react';
import {AbsoluteFill, interpolate, random, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {HOOK_IMPACT_FRAME} from './audio';
import {anton, inter} from './fonts';
import {EASE_IN_HARD, EASE_OUT_QUINT} from './ui';

const SPARKS = 46;

const Spark: FC<{index: number; frame: number}> = ({index, frame}) => {
  const t = frame - HOOK_IMPACT_FRAME;
  if (t < 0 || t > 42) {
    return null;
  }
  const angle = random(`spark-angle-${index}`) * Math.PI * 2;
  const speed = 9 + random(`spark-speed-${index}`) * 30;
  const friction = 1 - Math.pow(0.9, t);
  const distance = (speed * friction) / 0.1;
  const gravity = 2.4 * t * t;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance + gravity;
  const size = 5 + random(`spark-size-${index}`) * 10;
  const streak = random(`spark-streak-${index}`) > 0.45;
  const color =
    random(`spark-color-${index}`) > 0.72 ? brand.amberBright : brand.dangerBright;

  return (
    <div
      style={{
        position: 'absolute',
        left: 540,
        top: 960,
        width: streak ? 3 : size,
        height: streak ? 14 + size : size,
        backgroundColor: color,
        rotate: `${((angle * 180) / Math.PI + 90).toFixed(1)}deg`,
        translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`,
        opacity: interpolate(t, [0, 4, 34, 42], [0, 1, 0.9, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }}
    />
  );
};

/** 0-3s — "20 MIN" drops from the top, "38 MIN" rises from the bottom. */
const HookScene: FC = () => {
  const frame = useCurrentFrame();

  // Both numbers travel frames 8..62 and collide at HOOK_IMPACT_FRAME.
  const travel = interpolate(frame, [8, HOOK_IMPACT_FRAME], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_HARD,
  });
  // Recoil away from the collision, then settle.
  const recoil = interpolate(
    frame,
    [HOOK_IMPACT_FRAME, HOOK_IMPACT_FRAME + 7, HOOK_IMPACT_FRAME + 16],
    [0, 14, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_OUT_QUINT},
  );

  const topY = interpolate(travel, [0, 1], [-1000, 660]) - recoil;
  const bottomY = interpolate(travel, [0, 1], [1000, 1010]) + recoil;

  // Impact flash + decaying screen shake.
  const shakeAmp =
    frame > HOOK_IMPACT_FRAME
      ? 26 * Math.pow(0.86, frame - HOOK_IMPACT_FRAME)
      : 0;
  const shakeX = (random(`shake-x-${frame}`) - 0.5) * 2 * shakeAmp;
  const shakeY = (random(`shake-y-${frame}`) - 0.5) * 2 * shakeAmp;
  const flash = interpolate(
    frame,
    [HOOK_IMPACT_FRAME, HOOK_IMPACT_FRAME + 3, HOOK_IMPACT_FRAME + 11],
    [0.5, 0.32, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const labelOpacity = interpolate(
    frame,
    [HOOK_IMPACT_FRAME + 6, HOOK_IMPACT_FRAME + 16],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      <AbsoluteFill
        style={{
          translate: `${shakeX.toFixed(1)}px ${shakeY.toFixed(1)}px`,
        }}
      >
        {/* Collision flash. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(60% 40% at 50% 50%, rgba(217,107,92,${flash.toFixed(
              3,
            )}) 0%, rgba(217,107,92,0) 70%)`,
          }}
        />

        {/* Sparks. */}
        {new Array(SPARKS).fill(true).map((_, i) => (
          <Spark key={i} index={i} frame={frame} />
        ))}

        {/* Top number: the promise. */}
        <div style={{position: 'absolute', left: 0, right: 0, top: topY}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 22,
            }}
          >
            <span
              style={{
                fontFamily: anton,
                fontSize: 250,
                color: brand.cream,
                lineHeight: 1,
              }}
            >
              20
            </span>
            <span
              style={{
                fontFamily: inter,
                fontWeight: 800,
                fontSize: 62,
                color: brand.creamFaint,
                letterSpacing: '0.12em',
              }}
            >
              MIN
            </span>
          </div>
          <div
            style={{
              marginTop: 18,
              textAlign: 'center',
              fontFamily: inter,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: '0.42em',
              color: brand.creamFaint,
              opacity: labelOpacity,
            }}
          >
            THE PROMISE
          </div>
        </div>

        {/* Bottom number: the reality. */}
        <div style={{position: 'absolute', left: 0, right: 0, top: bottomY}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 22,
            }}
          >
            <span
              style={{
                fontFamily: anton,
                fontSize: 250,
                color: brand.accentBright,
                lineHeight: 1,
              }}
            >
              38
            </span>
            <span
              style={{
                fontFamily: inter,
                fontWeight: 800,
                fontSize: 62,
                color: brand.creamFaint,
                letterSpacing: '0.12em',
              }}
            >
              MIN
            </span>
          </div>
          <div
            style={{
              marginTop: 18,
              textAlign: 'center',
              fontFamily: inter,
                fontWeight: 700,
              fontSize: 30,
              letterSpacing: '0.42em',
              color: brand.accentBright,
              opacity: labelOpacity,
            }}
          >
            THE REALITY
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default HookScene;
