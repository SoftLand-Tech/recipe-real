// Scenes s27–s40: HONEST EXTRA TIME, FINAL WHISTLE, TROPHY, END CARD.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {F_ARCHIVO, F_BEBAS, F_SPACE} from './fonts';
import {
  AMBER,
  CHALK,
  CHALK_FAINT,
  CREAM,
  CREAM_DIM,
  GRAY,
  GREEN,
  NAVY,
  NAVY_DEEP,
  RED,
  TERRA,
} from './tokens';
import {KitchenStage} from './components/KitchenStage';
import {
  Confetti,
  Kicker,
  SlamCard,
  StatBars,
  TickerTape,
  WipeBars,
  enterProgress,
  useShake,
} from './components/Graphics';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

// s27 — cleanup: printed up front
export const S27: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <KitchenStage variant="empty" dim />
      <SlamCard width={1080} accent={AMBER}>
        <Kicker text="STEP 5 — THE HONEST ONE" color={AMBER} />
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 210,
            color: AMBER,
            lineHeight: 1,
            marginTop: 6,
          }}
        >
          CLEANUP +20:00
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 44,
            color: CREAM,
            marginTop: 8,
          }}
        >
          Printed on the card before kickoff. Not a surprise.
        </div>
        {/* sponge + rising bubbles */}
        <div style={{position: 'relative', height: 150, marginTop: 20}}>
          <div
            style={{
              position: 'absolute',
              left: 40,
              bottom: 0,
              width: 150,
              height: 70,
              borderRadius: 18,
              background: GREEN,
              border: `4px solid ${CREAM_DIM}`,
            }}
          />
          {new Array(7).fill(0).map((_, i) => {
            const t = (frame + i * 7) % 34;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 70 + i * 34,
                  bottom: interpolate(t, [0, 34], [10, 130], clamp),
                  width: 14 + (i % 3) * 8,
                  height: 14 + (i % 3) * 8,
                  borderRadius: '50%',
                  border: `3px solid ${CHALK_FAINT}`,
                  opacity: interpolate(t, [0, 10, 34], [0, 0.9, 0], clamp),
                }}
              />
            );
          })}
        </div>
      </SlamCard>
    </AbsoluteFill>
  );
};

// s28 — two receipts: hidden vs printed
export const S28: React.FC = () => {
  const frame = useCurrentFrame();
  const leftIn = interpolate(frame, [0, 9], [-800, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const rightIn = interpolate(frame, [4, 13], [800, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const receipt = (
    title: string,
    lines: Array<[string, string, boolean]>,
    accent: string,
  ) => (
    <div
      style={{
        width: 560,
        background: CREAM,
        color: NAVY_DEEP,
        padding: '28px 36px 40px',
        fontFamily: F_SPACE,
        borderBottom: '12px dashed rgba(0,0,0,0.2)',
      }}
    >
      <div
        style={{
          fontFamily: F_BEBAS,
          fontSize: 64,
          letterSpacing: 2,
          borderBottom: `4px dashed rgba(0,0,0,0.25)`,
          paddingBottom: 6,
        }}
      >
        {title}
      </div>
      {lines.map(([k, v, hidden]) => (
        <div
          key={k}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 34,
            marginTop: 14,
            opacity: hidden ? 0.55 : 1,
          }}
        >
          <span>{k}</span>
          <span
            style={{
              background: hidden ? NAVY_DEEP : 'transparent',
              color: hidden ? NAVY_DEEP : accent,
              fontWeight: 700,
              padding: hidden ? '0 18px' : 0,
            }}
          >
            {v}
          </span>
        </div>
      ))}
    </div>
  );
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center'}}>
        <Kicker text="THE RECEIPTS" />
      </div>
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 90}}
      >
        <div style={{translate: `${leftIn}px 0`, rotate: '-2deg'}}>
          {receipt(
            'BLOG RECIPE',
            [
              ['prep', '4:00', false],
              ['cook', '11:00', false],
              ['cleanup', '??', true],
            ],
            GRAY,
          )}
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 38,
              color: GRAY,
              textAlign: 'center',
              marginTop: 14,
              letterSpacing: 3,
            }}
          >
            HIDDEN
          </div>
        </div>
        <div style={{translate: `${rightIn}px 0`, rotate: '2deg'}}>
          {receipt(
            'RECIPEREAL CARD',
            [
              ['prep', '9:00', false],
              ['cook', '14:00', false],
              ['cleanup', '+20:00', false],
            ],
            TERRA,
          )}
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 38,
              color: TERRA,
              textAlign: 'center',
              marginTop: 14,
              letterSpacing: 3,
            }}
          >
            PRINTED
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s29 — stats card: promised vs played
export const S29: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <KitchenStage variant="empty" dim />
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 170,
          opacity: enterProgress(frame, 5),
        }}
      >
        <Kicker text="MATCH STATS — FULL LEDGER" />
      </div>
      <AbsoluteFill style={{justifyContent: 'center', paddingLeft: 90}}>
        <StatBars
          leftLabel="PROMISED"
          leftValue="15:00"
          leftFrac={0.35}
          rightLabel="ACTUAL, CLEANUP IN"
          rightValue="43:00"
          rightFrac={1}
          gapLabel="+28:00"
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s30 — the hidden time, isolated
export const S30: React.FC = () => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [0, 30], [0.94, 1.06], {
    ...clamp,
    easing: Easing.bezier(0.3, 0, 0.7, 1),
  });
  return (
    <AbsoluteFill style={{background: NAVY_DEEP}}>
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 90,
          right: 90,
          height: 6,
          background: RED,
          opacity: 0.65,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          left: 90,
          right: 90,
          height: 6,
          background: RED,
          opacity: 0.65,
        }}
      />
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}
      >
        <div style={{scale: `${grow}`, display: 'flex', alignItems: 'baseline', gap: 30}}>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 380,
              color: RED,
              lineHeight: 0.9,
              textShadow: '0 0 80px rgba(217,107,92,0.35)',
            }}
          >
            +28:00
          </div>
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: 12,
            color: CREAM,
            opacity: enterProgress(frame, 6, 6),
          }}
        >
          THE HIDDEN TIME
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 40,
            color: CREAM_DIM,
            marginTop: 14,
            opacity: enterProgress(frame, 6, 12),
          }}
        >
          Preheats. Chopping. Cleanup. Nobody posts this number.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s31 — every tick on schedule
export const S31: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = ['ONIONS 6:00', 'SEAR 4:00', 'SAUCE 8:00', 'PASTA 7:00', 'CLEANUP 20:00'];
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(111,169,127,0.1), rgba(14,26,43,0) 55%)',
        }}
      />
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center'}}>
        <Kicker text="THE RUN-IN — TICK BY TICK" color={GREEN} />
      </div>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
          {steps.map((s, i) => {
            const active = frame >= 8 + i * 5;
            const pulse = active
              ? 0.5 + 0.5 * Math.abs(Math.sin((frame - 8 - i * 5) / 3))
              : 0;
            return (
              <div
                key={s}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 26,
                  opacity: interpolate(frame, [2 + i * 2, 8 + i * 2], [0, 1], clamp),
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: active ? GREEN : 'transparent',
                    border: `5px solid ${active ? GREEN : CHALK_FAINT}`,
                    boxShadow: active ? `0 0 ${18 * pulse}px ${GREEN}` : 'none',
                  }}
                />
                <div
                  style={{
                    fontFamily: F_BEBAS,
                    fontSize: 86,
                    color: active ? CREAM : CREAM_DIM,
                    lineHeight: 1,
                    letterSpacing: 2,
                    minWidth: 620,
                  }}
                >
                  {s}
                </div>
                <div
                  style={{
                    width: interpolate(frame, [8 + i * 5, 20 + i * 5], [0, 330], {
                      ...clamp,
                      easing: Easing.bezier(0.16, 1, 0.3, 1),
                    }),
                    height: 10,
                    background: GREEN,
                  }}
                />
                <div
                  style={{
                    fontFamily: F_SPACE,
                    fontWeight: 700,
                    fontSize: 40,
                    color: GREEN,
                    opacity: active ? 1 : 0,
                  }}
                >
                  LANDED
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s32 — plating, the final touch
export const S32: React.FC = () => {
  const frame = useCurrentFrame();
  const tilt = interpolate(frame, [0, 12], [-14, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{scale: `${interpolate(frame, [0, 34], [1.06, 1], clamp)}`}}>
        <KitchenStage variant="plate" dim />
      </AbsoluteFill>
      {/* the pan tipping in */}
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 420,
          width: 300,
          height: 90,
          background: '#2E2620',
          borderRadius: '50%',
          border: `6px solid ${CREAM_DIM}`,
          rotate: `${tilt}deg`,
          opacity: interpolate(frame, [0, 20, 26], [1, 1, 0], clamp),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 130,
          right: 90,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <Kicker text="FINAL TOUCH" />
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 140,
              color: CREAM,
              lineHeight: 1,
              marginTop: 6,
            }}
          >
            PLATING
          </div>
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 40,
            color: CREAM_DIM,
            textAlign: 'right',
          }}
        >
          Timer says 3:00.
          <br />
          Timer is right.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// s33 — the referee checks his watch
export const S33: React.FC = () => {
  const frame = useCurrentFrame();
  const hand = Math.floor(frame / 2) * 12; // twitchy second hand
  return (
    <AbsoluteFill style={{background: NAVY_DEEP}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(243,237,230,0.08), rgba(9,19,32,0) 60%)',
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 60}}>
        <div style={{position: 'relative', width: 460, height: 460}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `16px solid ${CREAM}`,
              background: NAVY_DEEP,
            }}
          />
          {new Array(12).fill(0).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 223,
                top: 30,
                width: 8,
                height: 26,
                background: CREAM,
                transformOrigin: '4px 200px',
                transform: `rotate(${i * 30}deg)`,
              }}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              left: 222,
              top: 110,
              width: 10,
              height: 130,
              background: TERRA,
              transformOrigin: '5px 120px',
              transform: `rotate(${hand}deg)`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 218,
              top: 208,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: TERRA,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 74,
              textAlign: 'center',
              fontFamily: F_BEBAS,
              fontSize: 54,
              color: CREAM_DIM,
              letterSpacing: 3,
            }}
          >
            43:00
          </div>
        </div>
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 130,
              color: CREAM,
              lineHeight: 1,
            }}
          >
            HE CHECKS HIS WATCH
          </div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 40,
              color: CREAM_DIM,
              marginTop: 10,
            }}
          >
            The stadium holds its breath. The sauce reduces.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s34 — FINAL WHISTLE (SFX-only punch)
export const S34: React.FC = () => {
  const frame = useCurrentFrame();
  const shake = useShake(12);
  const flash = interpolate(frame, [0, 4], [1, 0], clamp);
  return (
    <AbsoluteFill style={{background: NAVY_DEEP, translate: shake.translate}}>
      <AbsoluteFill style={{background: CREAM, opacity: flash}} />
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}
      >
        <div
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: 14,
            color: CREAM_DIM,
          }}
        >
          THAT'S IT
        </div>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 300,
            color: TERRA,
            lineHeight: 0.92,
            letterSpacing: 6,
          }}
        >
          FULL TIME
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s35 — dinner lifts the trophy
export const S35: React.FC = () => {
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <KitchenStage variant="trophy" />
      <Confetti count={90} />
      {/* floodlight flares */}
      {[0, 1].map((k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            top: -140,
            left: k === 0 ? 100 : undefined,
            right: k === 1 ? 100 : undefined,
            width: 700,
            height: 700,
            background:
              'radial-gradient(circle at 50% 0%, rgba(243,237,230,0.22), rgba(243,237,230,0) 60%)',
          }}
        />
      ))}
      {/* chalk laurels */}
      <svg
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        <path
          d="M 500 720 Q 420 560 560 440"
          fill="none"
          stroke={CHALK}
          strokeWidth={8}
          strokeLinecap="round"
        />
        <path
          d="M 1420 720 Q 1500 560 1360 440"
          fill="none"
          stroke={CHALK}
          strokeWidth={8}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 120,
          right: 90,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <Kicker text="THE TROPHY LIFT" />
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 130,
              color: CREAM,
              lineHeight: 1,
            }}
          >
            DINNER, UP IN THE AIR
          </div>
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 40,
            color: CREAM_DIM,
            textAlign: 'right',
          }}
        >
          Plated at 43:00.
          <br />
          Exactly as called.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// s36 — full-time scoreline
export const S36: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <WipeBars color={TERRA} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            background: 'rgba(9,19,32,0.95)',
            borderTop: `8px solid ${TERRA}`,
            padding: '40px 90px',
            opacity: enterProgress(frame, 6),
          }}
        >
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: 8,
              color: CREAM_DIM,
              textAlign: 'center',
            }}
          >
            FULL TIME — DINNER LEAGUE
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 44,
              marginTop: 8,
            }}
          >
            <span style={{fontFamily: F_BEBAS, fontSize: 110, color: TERRA}}>YOU</span>
            <span style={{fontFamily: F_BEBAS, fontSize: 240, color: CREAM, lineHeight: 1}}>
              5
            </span>
            <span style={{fontFamily: F_BEBAS, fontSize: 110, color: CREAM_DIM }}>—</span>
            <span style={{fontFamily: F_BEBAS, fontSize: 240, color: GRAY, lineHeight: 1}}>
              1
            </span>
            <span style={{fontFamily: F_BEBAS, fontSize: 110, color: GRAY}}>BLOG</span>
          </div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 38,
              color: CREAM_DIM,
              textAlign: 'center',
              marginTop: 4,
            }}
          >
            five honest steps — one lying recipe card
          </div>
        </div>
      </AbsoluteFill>
      <TickerTape items={['FT: YOU 5 — 1 BLOGGERS FC', 'DINNER: ON TIME']} y={970} />
    </AbsoluteFill>
  );
};

// s37 — the tagline
export const S37: React.FC = () => {
  const frame = useCurrentFrame();
  const underline = interpolate(frame, [8, 22], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <Confetti count={30} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 44,
              letterSpacing: 10,
              color: GRAY,
            }}
          >
            FULL TIME
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 210,
              color: CREAM,
              lineHeight: 0.98,
              letterSpacing: 3,
              translate: `0px ${interpolate(frame, [0, 12], [80, 0], {
                ...clamp,
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              })}px`,
            }}
          >
            DINNER. ON TIME.
          </div>
          <div
            style={{
              width: 900 * underline,
              height: 12,
              background: TERRA,
              margin: '10px auto 0',
            }}
          />
          <div
            style={{
              marginTop: 26,
              fontFamily: F_SPACE,
              fontSize: 40,
              color: CREAM_DIM,
              opacity: enterProgress(frame, 5, 16),
            }}
          >
            43 minutes. Zero surprises. Every one on the card.
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s38 — the wordmark forms
export const S38: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [2, 16], [0, 100], {
    ...clamp,
    easing: Easing.bezier(0.3, 0, 0.2, 1),
  });
  const draw = interpolate(frame, [12, 22], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.5, 0, 0.5, 1),
  });
  return (
    <AbsoluteFill style={{background: NAVY, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative'}}>
        <div
          style={{
            fontFamily: F_ARCHIVO,
            fontSize: 190,
            color: CREAM,
            lineHeight: 1,
            clipPath: `inset(0 ${100 - reveal}% 0 0)`,
          }}
        >
          RecipeReal
        </div>
        <svg
          width={980}
          height={30}
          viewBox="0 0 980 30"
          style={{position: 'absolute', left: 0, bottom: -18}}
        >
          <path
            d="M4 20 Q 250 4 490 16 T 976 12"
            fill="none"
            stroke={TERRA}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={1000}
            strokeDashoffset={1000 * (1 - draw)}
          />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// s39 — Cook Mode tagline
export const S39: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = (frame * 6) % 360;
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(217,110,63,0.12), rgba(14,26,43,0) 55%)',
        }}
      />
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 30}}
      >
        <div
          style={{
            fontFamily: F_ARCHIVO,
            fontSize: 96,
            color: CREAM,
            opacity: enterProgress(frame, 5),
          }}
        >
          RecipeReal
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 50,
          }}
        >
          <svg width={120} height={120} viewBox="0 0 120 120">
            <circle
              cx={60}
              cy={60}
              r={50}
              fill="none"
              stroke={CHALK_FAINT}
              strokeWidth={10}
            />
            <circle
              cx={60}
              cy={60}
              r={50}
              fill="none"
              stroke={TERRA}
              strokeWidth={12}
              strokeDasharray={314}
              strokeDashoffset={314 * 0.22}
              transform={`rotate(${sweep} 60 60)`}
              strokeLinecap="round"
            />
          </svg>
          <div>
            <div
              style={{
                fontFamily: F_BEBAS,
                fontSize: 150,
                color: TERRA,
                lineHeight: 0.95,
              }}
            >
              COOK MODE.
            </div>
            <div
              style={{
                fontFamily: F_BEBAS,
                fontSize: 96,
                color: CREAM,
                lineHeight: 1,
                opacity: enterProgress(frame, 6, 8),
              }}
            >
              EVERY MINUTE ON THE CLOCK.
            </div>
          </div>
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 38,
            color: CREAM_DIM,
            opacity: enterProgress(frame, 5, 16),
          }}
        >
          Calibrated by thousands of real home cooks — cleanup included.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s40 — end card (absorbs remainder)
export const S40: React.FC = () => {
  const frame = useCurrentFrame();
  const ctaPulse = 1 + 0.03 * Math.abs(Math.sin(frame / 5));
  return (
    <AbsoluteFill
      style={{
        background: NAVY,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 46,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 38%, rgba(243,237,230,0.08), rgba(14,26,43,0) 55%)',
        }}
      />
      <div
        style={{
          fontFamily: F_ARCHIVO,
          fontSize: 150,
          color: CREAM,
          lineHeight: 1,
          scale: `${enterProgress(frame, 8, 0, true)}`,
        }}
      >
        RecipeReal
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: GREEN,
          }}
        />
        <span
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 36,
            color: GREEN,
            letterSpacing: 4,
          }}
        >
          HONEST COOK TIMES — 10,000 HOME COOKS
        </span>
      </div>
      <div
        style={{
          background: TERRA,
          padding: '26px 90px',
          fontFamily: F_BEBAS,
          fontSize: 110,
          color: CREAM,
          letterSpacing: 6,
          scale: `${ctaPulse}`,
          boxShadow: '0 24px 70px rgba(217,110,63,0.35)',
        }}
      >
        DOWNLOAD FREE
      </div>
      <div style={{display: 'flex', gap: 34}}>
        {['App Store', 'Google Play'].map((store, i) => (
          <div
            key={store}
            style={{
              border: `4px solid ${CREAM_DIM}`,
              borderRadius: 16,
              padding: '18px 44px',
              fontFamily: F_SPACE,
              fontWeight: 500,
              fontSize: 42,
              color: CREAM,
              opacity: enterProgress(frame, 5, 8 + i * 4),
            }}
          >
            {store}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
