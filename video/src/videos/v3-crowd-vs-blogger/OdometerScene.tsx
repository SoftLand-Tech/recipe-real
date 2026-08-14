import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {EASE_OUT_QUINT} from './ui';

const DIGIT_HEIGHT = 230;
const STRIP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

/** Continuous odometer offset for column k (10^k place). */
const columnOffset = (value: number, k: number): number => {
  if (k === 0) {
    return value % 10;
  }
  const base = Math.floor(value / Math.pow(10, k)) % 10;
  const carry = (value / Math.pow(10, k + 1)) % 1;
  const roll = carry > 0.9 ? (carry - 0.9) * 10 : 0;
  return base + roll;
};

const DigitColumn: FC<{value: number; k: number; width: number; dim: number}> = ({
  value,
  k,
  width,
  dim,
}) => {
  const frame = useCurrentFrame();
  const countAt = (f: number) => {
    const p = interpolate(f, [8, 122], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.62, 0.04, 0.2, 1),
    });
    return p * 1000;
  };
  const offsetNow = columnOffset(countAt(frame), k);
  const offsetPrev = columnOffset(countAt(frame - 1), k);
  const speed = Math.min(
    16,
    Math.abs(offsetNow - offsetPrev) * DIGIT_HEIGHT * 0.09,
  );

  return (
    <div
      style={{
        width,
        height: DIGIT_HEIGHT,
        overflow: 'hidden',
        opacity: dim,
      }}
    >
      <div
        style={{
          translate: `0px ${(-offsetNow * DIGIT_HEIGHT).toFixed(1)}px`,
          filter: speed > 0.6 ? `blur(${speed.toFixed(1)}px)` : undefined,
        }}
      >
        {STRIP.map((digit, i) => (
          <div
            key={i}
            style={{
              height: DIGIT_HEIGHT,
              fontFamily: anton,
              fontSize: 210,
              lineHeight: `${DIGIT_HEIGHT}px`,
              textAlign: 'center',
              color: brand.cream,
            }}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
};

/** 3-8s — odometer counts 0 -> 1,000 recipes checked. */
const OdometerScene: FC = () => {
  const frame = useCurrentFrame();
  const count = interpolate(frame, [8, 122], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.62, 0.04, 0.2, 1),
  }) * 1000;

  const kickerOpacity = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Landing pop when the counter hits 1,000.
  const pop = interpolate(frame, [122, 131, 146], [1, 1.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });
  // Leading "1" and comma light up only as the count crosses into 1,000.
  const leadingDim = interpolate(count, [930, 1000], [0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const caption = 'RECIPES CHECKED';

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      <div
        style={{
          position: 'absolute',
          top: 560,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: inter,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: '0.44em',
          color: brand.creamFaint,
          opacity: kickerOpacity,
        }}
      >
        WE CHECKED
      </div>

      {/* Odometer */}
      <div
        style={{
          position: 'absolute',
          top: 720,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          scale: `${pop.toFixed(3)}`,
        }}
      >
        <DigitColumn value={count} k={3} width={170} dim={leadingDim} />
        <div
          style={{
            width: 54,
            height: DIGIT_HEIGHT,
            fontFamily: anton,
            fontSize: 190,
            lineHeight: `${DIGIT_HEIGHT}px`,
            textAlign: 'center',
            color: brand.cream,
            opacity: leadingDim,
          }}
        >
          ,
        </div>
        <DigitColumn value={count} k={2} width={170} dim={1} />
        <DigitColumn value={count} k={1} width={170} dim={1} />
        <DigitColumn value={count} k={0} width={170} dim={1} />
      </div>

      {/* Progress hairline mirrors the count. */}
      <div
        style={{
          position: 'absolute',
          top: 1035,
          left: 240,
          width: 600,
          height: 3,
          backgroundColor: brand.darkSurfaceSoft,
        }}
      >
        <div
          style={{
            width: `${(interpolate(frame, [8, 122], [0, 100], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.62, 0.04, 0.2, 1),
            })).toFixed(1)}%`,
            height: '100%',
            backgroundColor: brand.accentBright,
          }}
        />
      </div>

      {/* Caption stamps in as the counter lands. */}
      <div
        style={{
          position: 'absolute',
          top: 1120,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {caption.split('').map((char, i) => {
          const appear = interpolate(frame, [126 + i * 2, 138 + i * 2], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE_OUT_QUINT,
          });
          return (
            <span
              key={i}
              style={{
                fontFamily: inter,
                fontWeight: 800,
                fontSize: 44,
                letterSpacing: '0.14em',
                color: brand.cream,
                opacity: appear,
                translate: `0px ${((1 - appear) * 26).toFixed(1)}px`,
              }}
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default OdometerScene;
