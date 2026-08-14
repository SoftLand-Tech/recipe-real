import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {ANTON, INTER, CLAMP} from './common';

/** Local beats: scene starts at frame 1050 (35s). */
const PULSE_BEAT = 120; // 39s — "43:00" re-emphasizes
const STRIKE_BEAT = 210; // 42s — the label's 15:00 gets struck out

export const SplitScene: FC = () => {
  const frame = useCurrentFrame();

  const slam = interpolate(frame, [0, 7], [3, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    ...CLAMP,
  });
  const drift = interpolate(frame, [7, 299], [1, 1.025], CLAMP);

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      <AbsoluteFill style={{scale: slam * drift, opacity: interpolate(frame, [0, 4], [0, 1], CLAMP)}}>
        {/* Top: the label's fantasy */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 954,
            backgroundColor: brand.darkCanvas,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 200,
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 46,
              letterSpacing: 10,
              color: brand.creamFaint,
            }}
          >
            ON THE LABEL
          </div>
          <div style={{position: 'relative', marginTop: 70}}>
            <div
              style={{
                fontFamily: ANTON,
                fontSize: 315,
                lineHeight: 1,
                color: brand.cream,
                opacity: interpolate(frame, [STRIKE_BEAT, STRIKE_BEAT + 14], [1, 0.5], CLAMP),
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              15:00
            </div>
            <div
              style={{
                position: 'absolute',
                left: -20,
                right: -20,
                top: '50%',
                height: 16,
                borderRadius: 8,
                backgroundColor: brand.dangerBright,
                transformOrigin: '0% 50%',
                scale: `${interpolate(frame, [STRIKE_BEAT, STRIKE_BEAT + 14], [0, 1], {
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                  ...CLAMP,
                })} 1`,
              }}
            />
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: 110,
              fontFamily: INTER,
              fontWeight: 600,
              fontSize: 30,
              letterSpacing: 6,
              color: brand.creamFaint,
              opacity: interpolate(frame, [240, 258], [0, 1], CLAMP),
            }}
          >
            MEASURED BY 4,218 HOME COOKS
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            position: 'absolute',
            top: 954,
            left: 0,
            right: 0,
            height: 12,
            backgroundColor: brand.cream,
            transformOrigin: '50% 50%',
            scale: `${interpolate(frame, [0, 10], [0, 1], {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              ...CLAMP,
            })} 1`,
          }}
        />

        {/* Bottom: real life */}
        <div
          style={{
            position: 'absolute',
            top: 966,
            left: 0,
            right: 0,
            height: 954,
            background: `linear-gradient(180deg, ${brand.accent}, ${brand.accentPress})`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 150,
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 46,
              letterSpacing: 10,
              color: 'rgba(243, 237, 230, 0.85)',
            }}
          >
            REAL LIFE
          </div>
          <div
            style={{
              marginTop: 60,
              fontFamily: ANTON,
              fontSize: 330,
              lineHeight: 1,
              color: brand.cream,
              fontVariantNumeric: 'tabular-nums',
              scale: interpolate(frame, [PULSE_BEAT, PULSE_BEAT + 8, PULSE_BEAT + 26], [1, 1.08, 1], CLAMP),
            }}
          >
            43:00
          </div>
        </div>
      </AbsoluteFill>

      {/* Bass-impact flash */}
      <AbsoluteFill
        style={{
          backgroundColor: brand.cream,
          opacity: interpolate(frame, [0, 2], [0.8, 0], CLAMP),
        }}
      />
    </AbsoluteFill>
  );
};
