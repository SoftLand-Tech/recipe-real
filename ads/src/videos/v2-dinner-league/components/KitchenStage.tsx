// Stadium-style kitchen set: chalk pitch floor, crowd bokeh, floodlights,
// geometric appliances (stove / oven / board / pot / plate). Everything is divs/SVG.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {
  AMBER,
  BLUE_COLD,
  CHALK,
  CHALK_FAINT,
  CREAM,
  CREAM_DIM,
  GRAY,
  GREEN,
  NAVY,
  NAVY_DEEP,
  SLATE,
  TERRA,
  TURF,
} from '../tokens';

export type StageVariant =
  | 'empty'
  | 'stove'
  | 'oven'
  | 'board'
  | 'pot'
  | 'plate'
  | 'trophy';

const Crowd: React.FC<{dim?: boolean}> = ({dim}) => {
  const frame = useCurrentFrame();
  const rows = [0, 1, 2];
  return (
    <div
      style={{
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        height: 330,
        opacity: dim ? 0.35 : 1,
      }}
    >
      {rows.map((r) => (
        <div
          key={r}
          style={{
            position: 'absolute',
            top: r * 90,
            left: 0,
            right: 0,
            height: 90,
          }}
        >
          {new Array(46).fill(0).map((_, i) => {
            const jitter = (i * 37 + r * 13) % 23;
            const flash = (i * 11 + r * 7 + Math.floor(frame / 5)) % 47 === 0;
            const tone = [GRAY, NAVY_DEEP, TERRA, CREAM_DIM][(i + r) % 4];
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: i * 42 + jitter,
                  top: 18 + (jitter % 17),
                  width: 14 + (jitter % 3) * 3,
                  height: 14 + (jitter % 3) * 3,
                  borderRadius: '50%',
                  background: flash ? CREAM : tone,
                  opacity: interpolate(
                    flash ? frame % 5 : 1,
                    [0, 5],
                    [0.9, 0.55],
                    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
                  ),
                }}
              />
            );
          })}
        </div>
      ))}
      {/* stand fascia */}
      <div
        style={{
          position: 'absolute',
          bottom: -6,
          left: -40,
          right: -40,
          height: 26,
          background: NAVY_DEEP,
          transform: 'skewX(-12deg)',
          borderTop: `2px solid ${CHALK_FAINT}`,
        }}
      />
    </div>
  );
};

const Floodlights: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 60], [-14, 6], {
    extrapolateRight: 'clamp',
  });
  return (
    <>
      {[0, 1].map((k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            top: -160,
            left: k === 0 ? 140 : undefined,
            right: k === 1 ? 140 : undefined,
            width: 900,
            height: 900,
            background: `radial-gradient(circle at 50% 0%, rgba(243,237,230,0.14) 0%, rgba(243,237,230,0.0) 55%)`,
            rotate: `${k === 0 ? sweep : -sweep}deg`,
          }}
        />
      ))}
    </>
  );
};

// Chalk pitch floor drawn in slight perspective.
const PitchFloor: React.FC<{circlePop?: boolean}> = ({circlePop}) => {
  const frame = useCurrentFrame();
  const circle = circlePop
    ? interpolate(frame, [0, 8], [0, 1], {
        easing: Easing.bezier(0.34, 1.56, 0.64, 1),
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;
  return (
    <svg
      viewBox="0 0 1920 1080"
      style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
    >
      <polygon points="0,1080 1920,1080 1430,660 490,660" fill={TURF} />
      <polygon
        points="0,1080 1920,1080 1430,660 490,660"
        fill="none"
        stroke={CHALK_FAINT}
        strokeWidth={4}
      />
      <line
        x1="960"
        y1="660"
        x2="960"
        y2="1080"
        stroke={CHALK_FAINT}
        strokeWidth={3}
      />
      <ellipse
        cx="960"
        cy="900"
        rx={170 * circle}
        ry={62 * circle}
        fill="none"
        stroke={CHALK}
        strokeWidth={4}
      />
      {/* turf mow stripes */}
      {[0, 1, 2, 3].map((i) => (
        <polygon
          key={i}
          points={`${490 + i * 235},660 ${490 + (i + 1) * 235},660 ${
            1920 - (490 + i * 235)
          },1080 ${1920 - (490 + (i + 1) * 235)},1080`}
          fill="rgba(255,255,255,0.022)"
        />
      ))}
    </svg>
  );
};

const Steam: React.FC<{x: number; y: number; count?: number}> = ({x, y, count = 3}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const t = (frame + i * 9) % 36;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + i * 26 - 14,
              top: y - interpolate(t, [0, 36], [0, 150]),
              width: 26,
              height: 46,
              borderRadius: 14,
              border: `3px solid ${CHALK_FAINT}`,
              borderBottom: 'none',
              opacity: interpolate(t, [0, 14, 36], [0, 0.65, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
        );
      })}
    </>
  );
};

export const KitchenStage: React.FC<{
  variant?: StageVariant;
  dim?: boolean;
  heat?: 'cold' | 'hot';
  circlePop?: boolean;
}> = ({variant = 'stove', dim, heat = 'hot', circlePop}) => {
  const frame = useCurrentFrame();
  const hot = heat === 'hot';
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <Crowd dim={dim} />
      <Floodlights />
      <PitchFloor circlePop={circlePop} />

      {/* back wall counters */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          right: 90,
          top: 385,
          height: 260,
          background: SLATE,
          borderBottom: `3px solid ${CHALK_FAINT}`,
          opacity: 0.92,
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 40 + i * 340,
              top: 190,
              width: 250,
              height: 8,
              background: 'rgba(0,0,0,0.35)',
            }}
          />
        ))}
      </div>

      {(variant === 'stove' || variant === 'pot' || variant === 'oven') && (
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 600,
            width: 800,
            height: 250,
            background: SLATE,
            borderRadius: 18,
            border: `3px solid ${CHALK_FAINT}`,
          }}
        >
          {/* burner rings */}
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 120 + i * 380,
                top: 60,
                width: 160,
                height: 160,
                borderRadius: '50%',
                border: `10px solid ${hot ? TERRA : BLUE_COLD}`,
                boxShadow: hot
                  ? `0 0 44px ${TERRA}66`
                  : `0 0 24px ${BLUE_COLD}44`,
                opacity: hot
                  ? 0.75 + 0.25 * Math.abs(Math.sin(frame / 6))
                  : 0.8,
              }}
            />
          ))}
        </div>
      )}

      {variant === 'stove' && (
        <>
          {/* pan */}
          <div
            style={{
              position: 'absolute',
              left: 640,
              top: 640,
              width: 230,
              height: 70,
              background: '#2E2620',
              borderRadius: '50%',
              border: `5px solid ${CREAM_DIM}`,
              translate: `0px ${interpolate(
                Math.sin(frame / 9),
                [0, 1],
                [0, -5],
              )}px`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                right: -120,
                top: 22,
                width: 130,
                height: 18,
                background: CREAM_DIM,
                borderRadius: 8,
                rotate: '-8deg',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 24,
                top: 18,
                width: 90,
                height: 26,
                borderRadius: 14,
                background: hot ? AMBER : '#3A332C',
                opacity: hot ? 0.9 : 1,
              }}
            />
          </div>
          {hot && <Steam x={660} y={610} />}
        </>
      )}

      {variant === 'pot' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 660,
              top: 560,
              width: 300,
              height: 200,
              background: '#2E2620',
              borderRadius: '26px 26px 40px 40px',
              border: `5px solid ${CREAM_DIM}`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 12,
                top: 26,
                borderRadius: '18px 18px 30px 30px',
                background: hot ? AMBER : '#3A332C',
                opacity: 0.85,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 130,
                top: -46,
                width: 40,
                height: 60,
                background: CREAM_DIM,
                borderRadius: 10,
              }}
            />
          </div>
          {/* pasta strands dropping */}
          {[0, 1, 2, 3, 4].map((i) => {
            const t = Math.max(0, frame - i * 2);
            const drop = interpolate(t, [0, 10], [-260, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.5, 0, 1, 1),
            });
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 715 + i * 22,
                  top: 560 + drop,
                  width: 7,
                  height: 74,
                  borderRadius: 4,
                  background: AMBER,
                  rotate: `${6 + i * 4}deg`,
                }}
              />
            );
          })}
          <Steam x={700} y={540} count={4} />
        </>
      )}

      {variant === 'oven' && (
        <div
          style={{
            position: 'absolute',
            left: 760,
            top: 480,
            width: 420,
            height: 380,
            background: SLATE,
            borderRadius: 22,
            border: `4px solid ${CHALK_FAINT}`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 30,
              borderRadius: 14,
              background: hot ? `#3E2A16` : '#0C1622',
              border: `6px solid ${hot ? AMBER : BLUE_COLD}`,
              boxShadow: hot ? `0 0 60px ${AMBER}55` : `0 0 40px ${BLUE_COLD}33`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 60,
                top: 90,
                width: 210,
                height: 120,
                borderRadius: '50%',
                background: hot ? AMBER : BLUE_COLD,
                opacity: hot ? 0.25 : 0.16,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 46,
                textAlign: 'center',
                color: hot ? AMBER : BLUE_COLD,
                fontFamily: 'Bebas Neue',
                fontSize: 54,
                letterSpacing: 3,
              }}
            >
              {hot ? '200°C' : 'COLD'}
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 40,
              right: 40,
              bottom: 20,
              height: 14,
              borderRadius: 7,
              background: CHALK_FAINT,
            }}
          />
        </div>
      )}

      {variant === 'board' && (
        <div
          style={{
            position: 'absolute',
            left: 560,
            top: 620,
            width: 820,
            height: 260,
            background: '#4A3A2C',
            borderRadius: 20,
            border: `6px solid ${CHALK_FAINT}`,
          }}
        >
          {/* onion halves */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 90 + i * 240,
                top: 70,
                width: 130,
                height: 110,
                borderRadius: '50%',
                background: '#C9A678',
                border: `5px solid #9C7B52`,
              }}
            >
              {[0.28, 0.5, 0.72].map((r) => (
                <div
                  key={r}
                  style={{
                    position: 'absolute',
                    left: `${(0.5 - r / 2) * 100}%`,
                    top: `${(0.5 - r / 2) * 100}%`,
                    width: `${r * 100}%`,
                    height: `${r * 100}%`,
                    borderRadius: '50%',
                    border: `3px solid #9C7B52`,
                  }}
                />
              ))}
            </div>
          ))}
          {/* chopping knife */}
          <div
            style={{
              position: 'absolute',
              left: 700,
              top: interpolate(frame % 12, [0, 6, 12], [0, -70, 0]),
              width: 190,
              height: 56,
              background: CREAM,
              clipPath: 'polygon(0 100%, 0 30%, 100% 0, 100% 100%)',
              rotate: '8deg',
            }}
          />
        </div>
      )}

      {(variant === 'plate' || variant === 'trophy') && (
        <>
          {variant === 'trophy' && (
            <div
              style={{
                position: 'absolute',
                left: 790,
                top: 700,
                width: 340,
                height: 220,
                background: SLATE,
                borderRadius: '12px 12px 0 0',
                border: `3px solid ${CHALK_FAINT}`,
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              left: 760,
              top:
                variant === 'trophy'
                  ? interpolate(frame, [0, 22], [260, 470], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                      easing: Easing.bezier(0.18, 1.4, 0.4, 1),
                    })
                  : 660,
              width: 400,
              height: 130,
              borderRadius: '50%',
              background: CREAM,
              boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
            }}
          >
            {/* the dinner */}
            <div
              style={{
                position: 'absolute',
                left: 90,
                top: 14,
                width: 220,
                height: 90,
                borderRadius: '50%',
                background: AMBER,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 150,
                top: 6,
                width: 100,
                height: 60,
                borderRadius: '50%',
                background: TERRA,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 70,
                top: 44,
                width: 80,
                height: 36,
                borderRadius: '50%',
                background: GREEN,
              }}
            />
          </div>
          <Steam x={830} y={610} />
        </>
      )}

      {/* vignette + optional dim */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, ${
            dim ? 'rgba(9,19,32,0.9)' : 'rgba(9,19,32,0.55)'
          } 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
