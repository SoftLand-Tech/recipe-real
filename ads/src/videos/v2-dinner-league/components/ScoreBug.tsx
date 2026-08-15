// Persistent scoreboard bug (top-left): teams, scoreline, honest match clock,
// and the recipe's lagging "CLAIMS" clock until Cook Mode re-syncs it.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {F_BEBAS, F_SPACE} from '../fonts';
import {
  BUG_IN_F,
  BUG_OUT_F,
  SYNC_F,
  claimsSecondsAt,
  clockLabel,
  matchSecondsAt,
  scoreAt,
} from '../timeline';
import {CREAM, CREAM_DIM, GRAY, GREEN, RED, TERRA} from '../tokens';

export const ScoreBug: React.FC = () => {
  const frame = useCurrentFrame(); // absolute frame (root level)
  if (frame < BUG_IN_F || frame >= BUG_OUT_F) return null;

  const local = frame - BUG_IN_F;
  const drop = interpolate(local, [0, 9], [-120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  const secs = matchSecondsAt(frame);
  const claims = claimsSecondsAt(frame);
  const synced = frame >= SYNC_F;
  const [you, blog] = scoreAt(frame);

  // sub-second clock tick pulse
  const tick = secs % 1 < 0.12 ? 1.07 : 1;

  // score-change flash
  const flash = [0, 1, 2, 3, 4, 5].some(
    (n) => you === n && secs > 0 && Math.abs(secs % 60) < 0.5,
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 78,
          translate: `0px ${drop}px`,
          width: 470,
          background: 'rgba(9,19,32,0.93)',
          border: `2px solid rgba(243,237,230,0.25)`,
          borderLeft: `9px solid ${TERRA}`,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px 6px 14px',
            borderBottom: '2px solid rgba(243,237,230,0.18)',
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: RED,
                opacity: 0.6 + 0.4 * Math.abs(Math.sin(frame / 5)),
              }}
            />
            <span
              style={{
                fontFamily: F_SPACE,
                fontWeight: 700,
                fontSize: 21,
                letterSpacing: 3,
                color: CREAM_DIM,
              }}
            >
              DINNER LEAGUE
            </span>
          </div>
          <span
            style={{
              fontFamily: F_BEBAS,
              fontSize: 46,
              color: CREAM,
              lineHeight: 1,
              scale: `${tick}`,
            }}
          >
            {clockLabel(secs)}
          </span>
        </div>

        {/* teams + score */}
        <div style={{padding: '8px 16px 10px 14px'}}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 7,
              background:
                flash && you > 0 ? 'rgba(217,110,63,0.25)' : 'transparent',
            }}
          >
            <span
              style={{
                fontFamily: F_SPACE,
                fontWeight: 700,
                fontSize: 27,
                letterSpacing: 2,
                color: TERRA,
              }}
            >
              YOU
            </span>
            <span
              style={{
                fontFamily: F_BEBAS,
                fontSize: 44,
                color: CREAM,
                lineHeight: 1,
              }}
            >
              {you}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: F_SPACE,
                fontWeight: 700,
                fontSize: 27,
                letterSpacing: 2,
                color: GRAY,
              }}
            >
              BLOGGERS FC
            </span>
            <span
              style={{
                fontFamily: F_BEBAS,
                fontSize: 44,
                color: CREAM_DIM,
                lineHeight: 1,
              }}
            >
              {blog}
            </span>
          </div>
        </div>

        {/* clock source row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '7px 16px 9px 14px',
            background: 'rgba(0,0,0,0.35)',
          }}
        >
          {synced ? (
            <>
              <span
                style={{
                  fontFamily: F_SPACE,
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: 2,
                  color: GREEN,
                }}
              >
                COOK MODE
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontFamily: F_SPACE,
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: 2,
                  color: GREEN,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: GREEN,
                    opacity: 0.5 + 0.5 * Math.abs(Math.sin(frame / 4)),
                  }}
                />
                SYNCED
              </span>
            </>
          ) : (
            <>
              <span
                style={{
                  fontFamily: F_SPACE,
                  fontSize: 22,
                  letterSpacing: 2,
                  color: GRAY,
                }}
              >
                RECIPE CLAIMS
              </span>
              <span
                style={{
                  fontFamily: F_BEBAS,
                  fontSize: 34,
                  color: GRAY,
                  lineHeight: 1,
                }}
              >
                {clockLabel(claims)}
              </span>
            </>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
