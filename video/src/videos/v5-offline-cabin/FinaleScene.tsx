// FINALE (46-50s): logo over the warm glow, then near-silence with one faint
// crackle at 47.5s. Local frame 0-119.
import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {inter} from './fonts';

const AIRPLANE_PATH =
  'M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';

const FinaleScene: FC = () => {
  const frame = useCurrentFrame();

  const veil = interpolate(frame, [0, 40], [0, 0.86], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  const logoIn = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const tagIn = interpolate(frame, [34, 62], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill>
      {/* Dark veil that keeps a warm core */}
      <AbsoluteFill
        style={{
          opacity: veil,
          background:
            'radial-gradient(62% 40% at 50% 42%, rgba(23,19,16,0.42) 0%, rgba(23,19,16,0.94) 78%)',
        }}
      />
      {/* Warm glow behind the wordmark */}
      <AbsoluteFill
        style={{
          opacity: 0.55 * logoIn * (0.85 + 0.15 * Math.sin(frame / 30)),
          background:
            'radial-gradient(46% 24% at 50% 42%, rgba(224,164,71,0.55), rgba(224,164,71,0) 70%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '34%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 54,
          fontFamily: inter,
          opacity: logoIn,
          scale: `${interpolate(frame, [8, 40], [0.94, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}`,
          translate: `0px ${interpolate(frame, [8, 40], [26, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px`,
        }}
      >
        {/* Offline mark */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 999,
            border: `2px solid ${brand.creamFaint}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: interpolate(frame, [4, 30], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <svg width={54} height={54} viewBox="0 0 24 24" fill={brand.cream}>
            <path d={AIRPLANE_PATH} />
          </svg>
        </div>

        {/* Wordmark */}
        <div style={{fontSize: 122, fontWeight: 700, letterSpacing: -3, lineHeight: 1}}>
          <span style={{color: brand.cream}}>Recipe</span>
          <span style={{color: brand.accentBright}}>Real</span>
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '58%',
          textAlign: 'center',
          fontFamily: inter,
          fontSize: 44,
          fontWeight: 600,
          letterSpacing: 10,
          color: brand.creamFaint,
          opacity: tagIn,
          translate: `0px ${interpolate(frame, [34, 62], [16, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px`,
        }}
      >
        COOK ANYWHERE
      </div>
    </AbsoluteFill>
  );
};

export default FinaleScene;
