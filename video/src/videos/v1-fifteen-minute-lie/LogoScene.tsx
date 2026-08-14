import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {INTER, CLAMP, Wordmark} from './common';

export const LogoScene: FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.darkCanvas,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 42%, ${brand.accentBright}24, transparent 58%)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          translate: `0px ${interpolate(frame, [0, 20], [40, 0], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            ...CLAMP,
          })}px`,
        }}
      >
        <div
          style={{
            opacity: interpolate(frame, [0, 5], [0, 1], CLAMP),
            scale: interpolate(frame, [0, 18], [0.72, 1], {
              easing: Easing.bezier(0.34, 1.56, 0.64, 1),
              ...CLAMP,
            }),
          }}
        >
          <Wordmark size={152} />
        </div>
        <div
          style={{
            marginTop: 56,
            width: 540,
            height: 12,
            borderRadius: 6,
            backgroundColor: brand.accentBright,
            transformOrigin: '50% 50%',
            scale: `${interpolate(frame, [14, 32], [0, 1], {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              ...CLAMP,
            })} 1`,
          }}
        />
        <div
          style={{
            marginTop: 66,
            fontFamily: INTER,
            fontWeight: 500,
            fontSize: 60,
            color: brand.creamSecondary,
            opacity: interpolate(frame, [45, 65], [0, 1], CLAMP),
            translate: `0px ${interpolate(frame, [45, 65], [26, 0], {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              ...CLAMP,
            })}px`,
          }}
        >
          Cook the truth.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 150,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: INTER,
          fontWeight: 600,
          fontSize: 30,
          letterSpacing: 5,
          color: brand.creamFaint,
          opacity: interpolate(frame, [70, 90], [0, 1], CLAMP),
        }}
      >
        FIFTEEN ON THE LABEL · FORTY-THREE IN REAL LIFE
      </div>
    </AbsoluteFill>
  );
};
