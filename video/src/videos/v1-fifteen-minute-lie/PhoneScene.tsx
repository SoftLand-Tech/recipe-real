import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {ANTON, INTER, CLAMP, Wordmark} from './common';

/**
 * Scene starts at frame 540 (18s). Key sync points (local frames):
 * - 40: strike sweeps the publisher claim (pause after "Cleanup included.")
 * - 63: publisher card pulses on "Fifteen on the label." (20.1s)
 * - 112: community time springs 15 -> 43 on "Forty-three in real life." (21.8s)
 * - 192/249/306/363: step bars fill one by one with ticks
 */
const STRIKE_BEAT = 40;
const COUNT_START = 112;
const COUNT_END = 140;
const TOTAL_BEAT = 420;

const STEPS = [
  {label: 'Chop vegetables', minutes: 10, beat: 192},
  {label: 'Preheat oven', minutes: 5, beat: 249},
  {label: 'Roast', minutes: 18, beat: 306},
  {label: 'Clean up', minutes: 10, beat: 363},
] as const;

const MAX_BAR_MINUTES = 20;

const AVATAR_COLORS = [
  brand.accentBright,
  brand.amberBright,
  brand.successBright,
  brand.creamSecondary,
  brand.dangerBright,
] as const;

export const PhoneScene: FC = () => {
  const frame = useCurrentFrame();

  const minutes = Math.round(
    interpolate(frame, [COUNT_START, COUNT_END], [15, 43], {
      easing: Easing.bezier(0.34, 1.45, 0.64, 1),
      ...CLAMP,
    }),
  );

  const entrance = interpolate(frame, [0, 24], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    ...CLAMP,
  });
  const floatY = Math.sin((frame / 240) * Math.PI * 2) * 8;

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* Faint "43" watermark behind the phone */}
      <div
        style={{
          position: 'absolute',
          top: 430,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: ANTON,
          fontSize: 640,
          lineHeight: 1,
          color: brand.accent,
          opacity: interpolate(frame, [140, 190], [0, 0.06], CLAMP),
        }}
      >
        43
      </div>

      {/* Phone body */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 220,
          width: 640,
          height: 1310,
          borderRadius: 88,
          border: `14px solid #3b322a`,
          backgroundColor: brand.darkSurface,
          boxShadow: '0 60px 120px rgba(0, 0, 0, 0.55)',
          overflow: 'hidden',
          opacity: entrance,
          scale: interpolate(frame, [0, 24], [0.92, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            ...CLAMP,
          }),
          translate: `0px ${interpolate(frame, [0, 24], [140, 0], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            ...CLAMP,
          }) + floatY}px`,
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 230,
            width: 180,
            height: 36,
            borderRadius: 20,
            backgroundColor: '#0d0b09',
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            padding: '76px 42px 40px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* App header */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <Wordmark size={46} />
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 20,
                letterSpacing: 3,
                color: brand.accentBright,
                border: `3px solid ${brand.accentBright}`,
                borderRadius: 999,
                padding: '8px 16px',
                opacity: interpolate(frame, [90, 104], [0, 1], CLAMP),
              }}
            >
              CROWD-TIMED
            </div>
          </div>

          {/* Recipe title + crowd meta */}
          <div
            style={{
              marginTop: 34,
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 50,
              lineHeight: 1.15,
              color: brand.cream,
            }}
          >
            Sheet-Pan Chicken &amp; Veg
          </div>
          <div
            style={{
              marginTop: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              opacity: interpolate(frame, [45, 62], [0, 1], CLAMP),
            }}
          >
            <div style={{display: 'flex'}}>
              {AVATAR_COLORS.map((c, i) => (
                <div
                  key={c}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: c,
                    border: `4px solid ${brand.darkSurface}`,
                    marginLeft: i === 0 ? 0 : -12,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 500,
                fontSize: 30,
                color: brand.creamSecondary,
              }}
            >
              4,218 home cooks timed this
            </div>
          </div>

          {/* Publisher claim card — struck through */}
          <div
            style={{
              marginTop: 44,
              backgroundColor: brand.darkSurfaceSoft,
              borderRadius: 28,
              padding: '30px 38px',
              scale: interpolate(frame, [63, 70, 84], [1, 1.045, 1], CLAMP),
            }}
          >
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: 5,
                color: brand.creamFaint,
              }}
            >
              PUBLISHER CLAIMS
            </div>
            <div style={{position: 'relative', marginTop: 12, width: 280}}>
              <div
                style={{
                  fontFamily: ANTON,
                  fontSize: 86,
                  lineHeight: 1,
                  color: brand.creamFaint,
                  opacity: interpolate(frame, [STRIKE_BEAT, STRIKE_BEAT + 14], [1, 0.55], CLAMP),
                }}
              >
                15 MIN
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: -8,
                  right: -8,
                  top: '50%',
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: brand.dangerBright,
                  transformOrigin: '0% 50%',
                  scale: `${interpolate(frame, [STRIKE_BEAT, STRIKE_BEAT + 12], [0, 1], {
                    easing: Easing.bezier(0.16, 1, 0.3, 1),
                    ...CLAMP,
                  })} 1`,
                }}
              />
            </div>
          </div>

          {/* Community real-time card — springs from the claimed 15 to the real 43 */}
          <div
            style={{
              marginTop: 26,
              backgroundColor: brand.darkSurfaceSoft,
              borderRadius: 28,
              padding: '30px 38px',
              borderLeft: `10px solid ${brand.accentBright}`,
            }}
          >
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: 5,
                color: brand.accentBright,
              }}
            >
              COMMUNITY REAL TIME
            </div>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 24}}>
              <div
                style={{
                  fontFamily: ANTON,
                  fontSize: 148,
                  lineHeight: 1.05,
                  color: brand.accentBright,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {minutes}:00
              </div>
              <div
                style={{
                  fontFamily: INTER,
                  fontWeight: 700,
                  fontSize: 30,
                  color: brand.amberBright,
                  opacity: interpolate(frame, [COUNT_END + 10, COUNT_END + 24], [0, 1], CLAMP),
                }}
              >
                ▲ 28 MIN LONGER
              </div>
            </div>
          </div>

          {/* Step-by-step reality bars */}
          <div
            style={{
              marginTop: 40,
              fontFamily: INTER,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: 5,
              color: brand.creamFaint,
              opacity: interpolate(frame, [170, 184], [0, 1], CLAMP),
            }}
          >
            STEP-BY-STEP REALITY
          </div>
          <div style={{marginTop: 20, display: 'flex', flexDirection: 'column', gap: 26}}>
            {STEPS.map((step) => {
              const fill = interpolate(frame, [step.beat, step.beat + 20], [0, 1], {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                ...CLAMP,
              });
              return (
                <div key={step.label}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: INTER,
                        fontWeight: 600,
                        fontSize: 32,
                        color: brand.cream,
                      }}
                    >
                      {step.label}
                    </div>
                    <div
                      style={{
                        fontFamily: INTER,
                        fontWeight: 700,
                        fontSize: 30,
                        color: brand.creamSecondary,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {step.minutes} min
                    </div>
                  </div>
                  <div
                    style={{
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: brand.darkCanvas,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(step.minutes / MAX_BAR_MINUTES) * 100}%`,
                        height: '100%',
                        borderRadius: 13,
                        background: `linear-gradient(90deg, ${brand.accent}, ${brand.accentBright})`,
                        transformOrigin: '0% 50%',
                        scale: `${fill} 1`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real total */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 26,
              borderTop: `3px solid ${brand.darkSurfaceSoft}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              opacity: interpolate(frame, [TOTAL_BEAT, TOTAL_BEAT + 6], [0, 1], CLAMP),
              scale: interpolate(frame, [TOTAL_BEAT, TOTAL_BEAT + 10], [0.7, 1], {
                easing: Easing.bezier(0.34, 1.56, 0.64, 1),
                ...CLAMP,
              }),
            }}
          >
            <div
              style={{
                fontFamily: INTER,
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: 5,
                color: brand.creamFaint,
              }}
            >
              REAL TOTAL
            </div>
            <div
              style={{
                fontFamily: ANTON,
                fontSize: 96,
                lineHeight: 1,
                color: brand.amberBright,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              43:00
            </div>
          </div>
        </div>
      </div>

      {/* Soft exit into the split-screen slam */}
      <AbsoluteFill
        style={{backgroundColor: brand.darkCanvas, opacity: interpolate(frame, [498, 509], [0, 0.85], CLAMP)}}
      />
    </AbsoluteFill>
  );
};
