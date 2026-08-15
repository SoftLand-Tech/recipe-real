// Scenes s14–s26: HALF-TIME SUBSTITUTION — Cook Mode runs the second half.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {F_BEBAS, F_SPACE} from './fonts';
import {
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
  AMBER,
} from './tokens';
import {KitchenStage} from './components/KitchenStage';
import {
  ChalkPitchMini,
  CheckDraw,
  GoalFlash,
  Kicker,
  PossessionBar,
  ReplayFrame,
  StepCard,
  TickerTape,
  TimerRing,
  WipeBars,
  enterProgress,
  useShake,
} from './components/Graphics';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

// s14 — SUBSTITUTION: Cook Mode comes on
export const S14: React.FC = () => {
  const frame = useCurrentFrame();
  const wash = interpolate(frame, [0, 20], [0.55, 0.14], clamp);
  const rowIn = (delay: number) =>
    interpolate(frame, [delay, delay + 8], [900, 0], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  return (
    <AbsoluteFill>
      <KitchenStage variant="stove" />
      <AbsoluteFill style={{background: TERRA, opacity: wash}} />
      <div style={{position: 'absolute', left: 90, top: 300}}>
        <Kicker text="SUBSTITUTION — HALF-TIME" />
        <div
          style={{
            marginTop: 24,
            width: 1180,
            background: 'rgba(9,19,32,0.94)',
            padding: '34px 44px',
            borderLeft: `12px solid ${GRAY}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              translate: `${rowIn(4)}px 0`,
              opacity: enterProgress(frame, 5, 4),
            }}
          >
            <div
              style={{
                fontFamily: F_BEBAS,
                fontSize: 42,
                color: GRAY,
                border: `3px solid ${GRAY}`,
                padding: '4px 16px',
              }}
            >
              OFF
            </div>
            <div
              style={{
                fontFamily: F_BEBAS,
                fontSize: 96,
                color: GRAY,
                textDecoration: 'line-through',
                textDecorationColor: RED,
                textDecorationThickness: 8,
              }}
            >
              GUESSWORK
            </div>
            <div style={{fontFamily: F_SPACE, fontSize: 36, color: GRAY}}>
              the blog's timing
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              marginTop: 18,
              translate: `${rowIn(9)}px 0`,
              opacity: enterProgress(frame, 5, 9),
            }}
          >
            <div
              style={{
                fontFamily: F_BEBAS,
                fontSize: 42,
                color: CREAM,
                background: TERRA,
                padding: '4px 16px',
              }}
            >
              ON
            </div>
            <div
              style={{
                fontFamily: F_BEBAS,
                fontSize: 130,
                color: TERRA,
                lineHeight: 1,
                textShadow: '0 0 34px rgba(217,110,63,0.4)',
              }}
            >
              COOK MODE
            </div>
            <div style={{fontFamily: F_SPACE, fontSize: 36, color: CREAM_DIM}}>
              timers for every step
            </div>
          </div>
        </div>
      </div>
      <TickerTape items={['MANAGER CALLS IT', 'COOK MODE IS ON', 'SUB: AUTO TIMERS']} y={960} />
    </AbsoluteFill>
  );
};

// s15 — phone UI: the Cook Mode board
export const S15: React.FC = () => {
  const frame = useCurrentFrame();
  const steps: Array<[string, string]> = [
    ['ONIONS', '6:00'],
    ['SEAR', '4:00'],
    ['SAUCE', '8:00'],
    ['PASTA', '7:00'],
    ['PLATE', '3:00'],
  ];
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 30%, rgba(217,110,63,0.14), rgba(14,26,43,0) 55%)',
        }}
      />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 640,
            height: 900,
            background: NAVY_DEEP,
            border: `10px solid ${CHALK_FAINT}`,
            borderRadius: 44,
            padding: 34,
            scale: `${enterProgress(frame, 8, 0, true)}`,
            boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              background: TERRA,
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontFamily: F_BEBAS,
                fontSize: 56,
                color: CREAM,
                letterSpacing: 3,
              }}
            >
              COOK MODE
            </span>
            <span
              style={{
                fontFamily: F_SPACE,
                fontWeight: 700,
                fontSize: 28,
                color: CREAM,
                background: 'rgba(0,0,0,0.28)',
                padding: '6px 14px',
                borderRadius: 20,
              }}
            >
              ON air
            </span>
          </div>
          <div style={{marginTop: 22}}>
            {steps.map(([name, t], i) => {
              const active = i === 0;
              const rowP = enterProgress(frame, 6, 8 + i * 3);
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '20px 22px',
                    marginBottom: 12,
                    background: active ? 'rgba(217,110,63,0.2)' : 'rgba(255,255,255,0.05)',
                    borderLeft: `8px solid ${active ? TERRA : CHALK_FAINT}`,
                    opacity: rowP,
                    translate: `${(1 - rowP) * -60}px 0`,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: F_SPACE,
                        fontWeight: 700,
                        fontSize: 34,
                        color: active ? TERRA : CREAM,
                        letterSpacing: 2,
                      }}
                    >
                      {name}
                    </div>
                    <div
                      style={{
                        fontFamily: F_SPACE,
                        fontSize: 26,
                        color: CREAM_DIM,
                      }}
                    >
                      crowd-timed • auto timer
                    </div>
                  </div>
                  <div
                    style={{
                      fontFamily: F_BEBAS,
                      fontSize: 58,
                      color: active ? TERRA : CREAM_DIM,
                      lineHeight: 1,
                    }}
                  >
                    {t}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 110,
          right: 90,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: F_SPACE,
          fontSize: 40,
          color: CREAM_DIM,
        }}
      >
        <span>Every step gets a real clock.</span>
        <span style={{color: TERRA}}>NO. 14 — COOK MODE</span>
      </div>
    </AbsoluteFill>
  );
};

// s16 — clock re-sync
export const S16: React.FC = () => {
  const frame = useCurrentFrame();
  const outP = interpolate(frame, [0, 10], [1, 0], clamp);
  const inP = enterProgress(frame, 8, 4, true);
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <div style={{position: 'absolute', top: 120, left: 0, right: 0, textAlign: 'center'}}>
        <Kicker text="TIMING SOURCE — RE-SYNC" />
      </div>
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 80}}
      >
        {/* old fantasy clock dissolves */}
        <div
          style={{
            width: 520,
            height: 520,
            border: `10px solid ${GRAY}`,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: outP,
            rotate: `${(1 - outP) * 24}deg`,
            scale: `${interpolate(frame, [0, 10], [1, 0.7], clamp)}`,
          }}
        >
          <div style={{fontFamily: F_BEBAS, fontSize: 150, color: GRAY, lineHeight: 1}}>
            15:00
          </div>
          <div style={{fontFamily: F_SPACE, fontSize: 36, color: GRAY}}>FANTASY CLOCK</div>
        </div>
        {/* real clock snaps in */}
        <div
          style={{
            width: 560,
            height: 560,
            border: `12px solid ${GREEN}`,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            scale: `${inP}`,
            opacity: interpolate(inP, [0, 1], [0, 1], clamp),
            boxShadow: `0 0 70px rgba(111,169,127,0.3)`,
          }}
        >
          <div style={{fontFamily: F_BEBAS, fontSize: 170, color: CREAM, lineHeight: 1}}>
            REAL
          </div>
          <div style={{fontFamily: F_SPACE, fontSize: 38, color: GREEN, letterSpacing: 3}}>
            CROWD-SOURCED TIMES
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          bottom: 150,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: F_BEBAS,
          fontSize: 110,
          color: GREEN,
          letterSpacing: 10,
          opacity: enterProgress(frame, 5, 12),
          scale: `${enterProgress(frame, 6, 12, true)}`,
        }}
      >
        SYNCED
      </div>
    </AbsoluteFill>
  );
};

// s17 — the crowd verdict: 43:00
export const S17: React.FC = () => {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame, [10, 18], [2.4, 1], {
    ...clamp,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(243,237,230,0.07), rgba(14,26,43,0) 60%)',
        }}
      />
      <div style={{position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center'}}>
        <Kicker text="THE CROWD CALLED IT" />
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 44,
            color: CREAM_DIM,
            marginTop: 14,
            opacity: enterProgress(frame, 5, 4),
          }}
        >
          10,000 home cooks timed this fixture, step by step
        </div>
      </div>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            border: `10px solid ${TERRA}`,
            padding: '20px 90px 34px',
            rotate: '-3deg',
            scale: `${stamp}`,
            background: 'rgba(9,19,32,0.6)',
          }}
        >
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: 8,
              color: TERRA,
            }}
          >
            REAL FULL TIME
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 330,
              lineHeight: 0.95,
              color: CREAM,
            }}
          >
            43:00
          </div>
        </div>
      </AbsoluteFill>
      <TickerTape
        items={['VERDICT: 43:00', '10,000 HOME COOKS', 'CLEANUP INCLUDED', 'NO SURPRISES']}
      />
    </AbsoluteFill>
  );
};

// s18 — possession flips our way
export const S18: React.FC = () => {
  const frame = useCurrentFrame();
  const dotX = interpolate(frame, [4, 26], [420, 1500], {
    ...clamp,
    easing: Easing.bezier(0.3, 0, 0.3, 1),
  });
  return (
    <AbsoluteFill>
      <KitchenStage variant="stove" dim />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 40}}>
        <Kicker text="POSSESSION — 2ND HALF" color={TERRA} />
        <PossessionBar youPct={71} topLabel="IN CONTROL" bottomLabel="CHASING" />
        {/* pitch strip with moving ball */}
        <div
          style={{
            position: 'relative',
            width: 1160,
            height: 150,
            borderBottom: `4px solid ${CHALK_FAINT}`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 580,
              top: 0,
              bottom: 0,
              width: 3,
              background: CHALK_FAINT,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: dotX,
              top: 44,
              width: 42,
              height: 42,
              borderRadius: '50%',
              background: CREAM,
              boxShadow: '0 0 26px rgba(243,237,230,0.5)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: 24,
              fontFamily: F_SPACE,
              fontSize: 34,
              color: TERRA,
            }}
          >
            YOU
          </div>
          <div
            style={{
              position: 'absolute',
              right: 0,
              bottom: 24,
              fontFamily: F_SPACE,
              fontSize: 34,
              color: GRAY,
            }}
          >
            THEM
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s19 — ONIONS: 6:00 predicted, 6:00 actual — GOAL
export const S19: React.FC = () => {
  return (
    <AbsoluteFill>
      <KitchenStage variant="board" dim />
      <StepCard
        step="STEP 2 — WITH COOK MODE"
        name="ONIONS"
        predicted="6:00"
        actual="6:00"
        note="Called by the crowd. Landed on the whistle."
      />
      <GoalFlash label="GOAL" sub="YOU 1 — 1 BLOGGERS FC" delay={30} />
    </AbsoluteFill>
  );
};

// s20 — onions in, the timer runs itself
export const S20: React.FC = () => {
  const frame = useCurrentFrame();
  const remain = 1 - interpolate(frame, [6, 40], [0, 0.55], clamp);
  const secs = Math.round(360 * remain);
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <AbsoluteFill>
      <KitchenStage variant="stove" heat="hot" />
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 120}}
      >
        <div>
          <Kicker text="AUTO TIMER — ONIONS" color={GREEN} />
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 120,
              color: CREAM,
              lineHeight: 1,
              marginTop: 12,
              opacity: enterProgress(frame, 5, 3),
            }}
          >
            NOBODY
            <br />
            GUESSES
          </div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 40,
              color: CREAM_DIM,
              marginTop: 10,
            }}
          >
            The clock starts itself.
          </div>
        </div>
        <div style={{scale: `${enterProgress(frame, 7, 2, true)}`}}>
          <TimerRing progress={remain} label={label} size={360} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s21 — GOAL punch (SFX-only): the sear lands
export const S21: React.FC = () => {
  const shake = useShake(10);
  return (
    <AbsoluteFill style={{background: TERRA, translate: shake.translate}}>
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 330,
            color: CREAM,
            lineHeight: 0.9,
            letterSpacing: 8,
          }}
        >
          GOAL!
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 56,
            color: CREAM,
            letterSpacing: 4,
          }}
        >
          SEAR — 4:00 CALLED, 4:00 PLAYED
        </div>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 90,
            color: NAVY_DEEP,
            background: CREAM,
            padding: '2px 30px',
            lineHeight: 1.2,
          }}
        >
          YOU 2 — 1
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s22 — REPLAY: the flip
export const S22: React.FC = () => {
  const frame = useCurrentFrame();
  const arc = (t: number) => -620 * t * (1 - t) * 4; // parabola peak -620
  const t = interpolate(frame, [0, 22], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{filter: 'saturate(0.6)'}}>
        <KitchenStage variant="stove" heat="hot" dim />
      </AbsoluteFill>
      <ReplayFrame tag="REPLAY" />
      {/* chalk trajectory */}
      <svg
        viewBox="0 0 1920 1080"
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}
      >
        <path
          d="M 560 760 Q 960 -80 1360 760"
          fill="none"
          stroke={CHALK}
          strokeWidth={7}
          strokeDasharray="26 22"
          opacity={enterProgress(frame, 6, 2)}
        />
      </svg>
      {/* flipping pan */}
      <div
        style={{
          position: 'absolute',
          left: 850 + t * 200,
          top: 700 + arc(t),
          width: 240,
          height: 74,
          background: '#2E2620',
          borderRadius: '50%',
          border: `6px solid ${CREAM_DIM}`,
          rotate: `${t * 360}deg`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -130,
            top: 24,
            width: 140,
            height: 20,
            background: CREAM_DIM,
            borderRadius: 10,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 120,
          fontFamily: F_BEBAS,
          fontSize: 120,
          color: CREAM,
          lineHeight: 1,
          opacity: enterProgress(frame, 4, 6),
        }}
      >
        LOOK AT THAT FLIP
      </div>
    </AbsoluteFill>
  );
};

// s23 — SAUCE: 8:00 / 8:00
export const S23: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <KitchenStage variant="pot" dim />
      <StepCard
        step="STEP 3 — ON SCHEDULE"
        name="SAUCE"
        predicted="8:00"
        actual="8:00"
        note="Simmered exactly as long as reality requires."
      />
      <div
        style={{
          position: 'absolute',
          right: 90,
          top: 96,
          fontFamily: F_BEBAS,
          fontSize: 74,
          color: GREEN,
          border: `5px solid ${GREEN}`,
          padding: '6px 26px',
          rotate: '3deg',
          opacity: enterProgress(frame, 5, 20, true),
        }}
      >
        YOU 3 — 1
      </div>
    </AbsoluteFill>
  );
};

// s24 — PASTA lands on the minute
export const S24: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <KitchenStage variant="pot" />
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 90}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 40,
            background: 'rgba(9,19,32,0.94)',
            borderLeft: `10px solid ${GREEN}`,
            padding: '24px 44px',
            translate: `${interpolate(frame, [4, 12], [900, 0], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px 0`,
          }}
        >
          <CheckDraw size={86} />
          <div>
            <div
              style={{
                fontFamily: F_SPACE,
                fontWeight: 700,
                fontSize: 32,
                letterSpacing: 4,
                color: GREEN,
              }}
            >
              STEP 4 — PASTA
            </div>
            <div style={{fontFamily: F_BEBAS, fontSize: 110, color: CREAM, lineHeight: 1}}>
              7:00 CALLED — 7:00 IN
            </div>
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 64,
              color: GREEN,
              border: `5px solid ${GREEN}`,
              padding: '4px 22px',
              rotate: '3deg',
            }}
          >
            4 — 1
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s25 — offline-first: recipes still load
export const S25: React.FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    'WEEKNIGHT PASTA',
    'SHEET-PAN CHICKEN',
    'TEN-MINUTE SOUP',
    'LEFTOVER FRIED RICE',
    'ONE-PAN EGGS',
  ];
  const scroll = interpolate(frame, [0, 40], [0, -110], clamp);
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70}}>
        {/* wifi off */}
        <svg width={240} height={190} viewBox="0 0 240 190">
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M ${40 + i * 36} ${140 - i * 4} Q ${120} ${40 - i * 42} ${200 - i * 36} ${
                140 - i * 4
              }`}
              fill="none"
              stroke={GRAY}
              strokeWidth={12}
              strokeLinecap="round"
            />
          ))}
          <circle cx={120} cy={150} r={13} fill={GRAY} />
          <line
            x1={30}
            y1={170}
            x2={210}
            y2={20}
            stroke={RED}
            strokeWidth={16}
            strokeLinecap="round"
          />
        </svg>
        {/* recipe list still scrolling */}
        <div
          style={{
            width: 760,
            background: NAVY_DEEP,
            border: `6px solid ${CHALK_FAINT}`,
            borderRadius: 26,
            padding: '26px 34px',
            height: 380,
            overflow: 'hidden',
          }}
        >
          <div style={{translate: `0px ${scroll}px`}}>
            {rows.map((r, i) => (
              <div
                key={r}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  padding: '18px 8px',
                  borderBottom: `2px solid rgba(243,237,230,0.12)`,
                  opacity: i === 0 ? 1 : 0.8,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: GREEN,
                    opacity: i === 0 ? 1 : 0.4,
                  }}
                />
                <span style={{fontFamily: F_SPACE, fontSize: 40, color: CREAM}}>{r}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: F_BEBAS,
                    fontSize: 44,
                    color: GREEN,
                  }}
                >
                  READY
                </span>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 110,
          right: 90,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: F_SPACE,
          fontWeight: 700,
          fontSize: 40,
        }}
      >
        <span style={{color: CREAM}}>No signal in the aisles?</span>
        <span style={{color: TERRA}}>OFFLINE-FIRST — RECIPES ON BOARD</span>
      </div>
    </AbsoluteFill>
  );
};

// s26 — as it stands: scoreboard closeup + pitch diagram
export const S26: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <WipeBars dir="rtl" color={GREEN} />
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 100}}
      >
        <div
          style={{
            background: 'rgba(9,19,32,0.95)',
            borderTop: `8px solid ${TERRA}`,
            padding: '36px 60px',
            opacity: enterProgress(frame, 6),
          }}
        >
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: 5,
              color: CREAM_DIM,
            }}
          >
            AS IT STANDS
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 36,
              marginTop: 8,
            }}
          >
            <span style={{fontFamily: F_BEBAS, fontSize: 200, color: TERRA, lineHeight: 1}}>
              4
            </span>
            <span style={{fontFamily: F_BEBAS, fontSize: 90, color: CREAM_DIM, lineHeight: 1}}>
              —
            </span>
            <span style={{fontFamily: F_BEBAS, fontSize: 200, color: GRAY, lineHeight: 1}}>
              1
            </span>
          </div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 36,
              color: CREAM_DIM,
              textAlign: 'center',
            }}
          >
            YOU vs BLOGGERS FC
          </div>
        </div>
        <div style={{scale: `${enterProgress(frame, 8, 3, true)}`}}>
          <ChalkPitchMini marks={4} />
          <div
            style={{
              marginTop: 14,
              fontFamily: F_SPACE,
              fontSize: 34,
              color: GREEN,
              textAlign: 'center',
              letterSpacing: 2,
            }}
          >
            EVERY X — A STEP LANDED ON TIME
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
