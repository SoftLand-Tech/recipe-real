import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {ANTON, INTER, CLAMP, jitter, shakeAmp} from './common';

/**
 * Receipt-of-lies rows. Beats are local frames (scene starts at frame 180 = 6s):
 * chopping echoes the just-heard line, preheat lands after "you didn't plan for"
 * (ends 8.0s), cleanup lands right on "Twenty more." (ends 10.6s).
 */
const ROWS = [
  {label: 'CHOPPING', minutes: 10, beat: 6},
  {label: 'PREHEAT', minutes: 5, beat: 87},
  {label: 'CLEANUP', minutes: 20, beat: 140},
] as const;

export const ListScene: FC = () => {
  const frame = useCurrentFrame();

  const shake =
    shakeAmp(frame, ROWS[0].beat, 14) +
    shakeAmp(frame, ROWS[1].beat, 14) +
    shakeAmp(frame, ROWS[2].beat, 14);

  const hidden =
    Math.round(interpolate(frame, [ROWS[0].beat, ROWS[0].beat + 8], [0, ROWS[0].minutes], CLAMP)) +
    Math.round(interpolate(frame, [ROWS[1].beat, ROWS[1].beat + 8], [0, ROWS[1].minutes], CLAMP)) +
    Math.round(interpolate(frame, [ROWS[2].beat, ROWS[2].beat + 8], [0, ROWS[2].minutes], CLAMP));

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${brand.accent}14, transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          scale: interpolate(frame, [0, 359], [1, 1.045], CLAMP),
          translate: `${jitter('list-x', frame, shake)}px ${jitter('list-y', frame, shake)}px`,
        }}
      >
        {/* Section label */}
        <div
          style={{
            position: 'absolute',
            top: 205,
            left: 60,
            right: 60,
            textAlign: 'center',
            fontFamily: INTER,
            fontWeight: 600,
            fontSize: 46,
            letterSpacing: 10,
            color: brand.creamFaint,
            opacity: interpolate(frame, [0, 8], [0, 1], CLAMP),
            translate: `0px ${interpolate(frame, [0, 10], [22, 0], {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              ...CLAMP,
            })}px`,
          }}
        >
          WHERE THE TIME GOES
        </div>

        {/* Receipt rows */}
        {ROWS.map((row, i) => {
          const {beat, label, minutes} = row;
          return (
            <div
              key={label}
              style={{
                position: 'absolute',
                top: 450 + i * 300,
                left: 70,
                right: 70,
                display: 'flex',
                alignItems: 'center',
                gap: 34,
                opacity: interpolate(frame, [beat, beat + 3], [0, 1], CLAMP),
                scale: interpolate(frame, [beat, beat + 6], [1.6, 1], {
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                  ...CLAMP,
                }),
              }}
            >
              <div
                style={{
                  fontFamily: ANTON,
                  fontSize: 118,
                  lineHeight: 1,
                  color: brand.cream,
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 6,
                  backgroundColor: brand.darkSurfaceSoft,
                  borderRadius: 3,
                  marginTop: 12,
                }}
              />
              <div
                style={{
                  fontFamily: ANTON,
                  fontSize: 118,
                  lineHeight: 1,
                  color: brand.amberBright,
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {Math.round(
                  interpolate(frame, [beat, beat + 8], [0, minutes], CLAMP),
                )}{' '}
                MIN
              </div>
            </div>
          );
        })}

        {/* Hidden-time tally */}
        <div
          style={{
            position: 'absolute',
            top: 1395,
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 18,
            opacity: interpolate(frame, [ROWS[0].beat, ROWS[0].beat + 10], [0, 1], CLAMP),
            scale: interpolate(frame, [160, 168, 182], [1, 1.09, 1], CLAMP),
          }}
        >
          <div
            style={{
              fontFamily: INTER,
              fontWeight: 600,
              fontSize: 36,
              letterSpacing: 9,
              color: brand.creamFaint,
            }}
          >
            HIDDEN TIME
          </div>
          <div
            style={{
              fontFamily: ANTON,
              fontSize: 150,
              lineHeight: 1,
              color: brand.accentBright,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            +{hidden} MIN
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
