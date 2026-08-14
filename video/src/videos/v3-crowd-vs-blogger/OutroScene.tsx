import type {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {EASE_OUT_QUINT, EASE_SLAM} from './ui';

const LOGO_FRAME = 138;

/** 42-50s — "Every minute, accounted for." + RecipeReal wordmark. */
const OutroScene: FC = () => {
  const frame = useCurrentFrame();

  const slam = interpolate(frame, [0, 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_SLAM,
  });
  const headlineShift = interpolate(frame, [LOGO_FRAME, LOGO_FRAME + 22], [0, -140], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });
  const ring = interpolate(frame, [0, 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logo = interpolate(frame, [LOGO_FRAME, LOGO_FRAME + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });
  const underline = interpolate(frame, [LOGO_FRAME + 8, LOGO_FRAME + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });
  const tagline = interpolate(frame, [LOGO_FRAME + 18, LOGO_FRAME + 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* Impact rings behind the headline. */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 140,
            top: 640,
            width: 800,
            height: 800,
            borderRadius: '50%',
            border: `${3 - i}px solid ${i === 0 ? brand.dangerBright : brand.accentBright}`,
            opacity: (0.5 - i * 0.22) * (1 - ring),
            scale: `${(0.25 + ring * (1.35 + i * 0.3)).toFixed(3)}`,
          }}
        />
      ))}

      {/* Headline. */}
      <div
        style={{
          position: 'absolute',
          top: 760 + headlineShift,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: slam,
          scale: `${(1.28 - 0.28 * slam).toFixed(3)}`,
        }}
      >
        <div
          style={{
            fontFamily: anton,
            fontSize: 132,
            lineHeight: 1.14,
            color: brand.cream,
          }}
        >
          EVERY MINUTE,
        </div>
        <div
          style={{
            fontFamily: anton,
            fontSize: 132,
            lineHeight: 1.14,
            color: brand.accentBright,
          }}
        >
          ACCOUNTED FOR.
        </div>
      </div>

      {/* RecipeReal wordmark. */}
      <div
        style={{
          position: 'absolute',
          top: 1160,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: logo,
          translate: `0px ${((1 - logo) * 46).toFixed(1)}px`,
        }}
      >
        <div style={{display: 'flex', justifyContent: 'center', alignItems: 'baseline'}}>
          <span style={{fontFamily: anton, fontSize: 128, color: brand.cream}}>
            Recipe
          </span>
          <span style={{fontFamily: anton, fontSize: 128, color: brand.accentBright}}>
            Real
          </span>
        </div>
        <div
          style={{
            margin: '18px auto 0',
            width: 520,
            height: 3,
            backgroundColor: brand.accentBright,
            transformOrigin: 'center center',
            transform: `scaleX(${underline.toFixed(3)})`,
          }}
        />
        <div
          style={{
            marginTop: 26,
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '0.42em',
            color: brand.creamFaint,
            opacity: tagline,
          }}
        >
          HONEST COOKING DATA
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default OutroScene;
