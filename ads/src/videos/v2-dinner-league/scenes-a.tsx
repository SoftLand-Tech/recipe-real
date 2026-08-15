// Scenes s01–s13: HOOK + EARLY DISASTER.
import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {F_BEBAS, F_SPACE} from './fonts';
import {
  BLUE_COLD,
  CHALK,
  CHALK_FAINT,
  CREAM,
  CREAM_DIM,
  GRAY,
  NAVY,
  NAVY_DEEP,
  RED,
  TERRA,
} from './tokens';
import {KitchenStage} from './components/KitchenStage';
import {
  GoalFlash,
  InjuryCross,
  Kicker,
  LowerThird,
  PossessionBar,
  ReplayFrame,
  StepCard,
  WipeBars,
  enterProgress,
  useShake,
} from './components/Graphics';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

// s01 — cold open: LIVE slug + KITCHEN STADIUM headline slam
export const S01: React.FC = () => {
  const frame = useCurrentFrame();
  const head = enterProgress(frame, 10, 2);
  const sweep = interpolate(frame, [0, 34], [-18, 7], clamp);
  return (
    <AbsoluteFill style={{background: NAVY}}>
      {/* floodlight beams */}
      {[0, 1].map((k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            top: -200,
            left: k === 0 ? 60 : undefined,
            right: k === 1 ? 60 : undefined,
            width: 1000,
            height: 1100,
            background:
              'radial-gradient(circle at 50% 0%, rgba(243,237,230,0.16), rgba(243,237,230,0) 55%)',
            rotate: `${k === 0 ? sweep : -sweep}deg`,
          }}
        />
      ))}
      {/* crowd bokeh strip */}
      {new Array(60).fill(0).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (i * 137) % 1900,
            top: 120 + ((i * 53) % 180),
            width: 12 + (i % 3) * 4,
            height: 12 + (i % 3) * 4,
            borderRadius: '50%',
            background: i % 5 === 0 ? TERRA : CREAM_DIM,
            opacity: 0.35 + 0.3 * Math.abs(Math.sin(i + frame / 7)),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 96,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          scale: `${interpolate(frame, [0, 6], [1.7, 1], {
            ...clamp,
            easing: Easing.bezier(0.34, 1.56, 0.64, 1),
          })}`,
          opacity: enterProgress(frame, 4),
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: RED,
            opacity: 0.55 + 0.45 * Math.abs(Math.sin(frame / 4)),
          }}
        />
        <span
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: 8,
            color: CREAM,
          }}
        >
          LIVE
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 380,
          right: 90,
        }}
      >
        <div
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 44,
            letterSpacing: 10,
            color: TERRA,
            opacity: enterProgress(frame, 5, 8),
          }}
        >
          TONIGHT'S FIXTURE — MATCHDAY 1
        </div>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 230,
            lineHeight: 0.92,
            color: CREAM,
            letterSpacing: 4,
            translate: `0px ${interpolate(head, [0, 1], [90, 0])}px`,
            opacity: head,
          }}
        >
          KITCHEN
          <br />
          STADIUM
        </div>
        <div
          style={{
            width: interpolate(frame, [6, 26], [0, 640], clamp),
            height: 10,
            background: TERRA,
            marginTop: 18,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// s02 — wipe reveal of the stadium kitchen set
export const S02: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <KitchenStage variant="stove" circlePop />
      <WipeBars dir="ltr" />
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 130,
          right: 90,
        }}
      >
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 170,
            color: CREAM,
            lineHeight: 0.95,
            letterSpacing: 3,
            translate: `0px ${interpolate(frame, [2, 12], [110, 0], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })}px`,
            opacity: enterProgress(frame, 6, 2),
          }}
        >
          WE'RE UNDER WAY
        </div>
        <div
          style={{
            fontFamily: F_SPACE,
            fontSize: 44,
            color: CREAM_DIM,
            opacity: enterProgress(frame, 6, 10),
          }}
        >
          IN THE KITCHEN — FIRST OF TWO HALVES
        </div>
      </div>
    </AbsoluteFill>
  );
};

// s03 — matchup card: YOU vs BLOGGERS FC
export const S03: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 10], [560, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill>
      <KitchenStage variant="empty" dim />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            translate: `0px ${rise}px`,
          }}
        >
          <div
            style={{
              width: 560,
              background: TERRA,
              padding: '40px 44px',
              opacity: enterProgress(frame, 5),
            }}
          >
            <div style={{fontFamily: F_BEBAS, fontSize: 140, color: CREAM, lineHeight: 1}}>
              YOU
            </div>
            <div
              style={{
                fontFamily: F_SPACE,
                fontSize: 38,
                color: CREAM,
                marginTop: 10,
                lineHeight: 1.35,
              }}
            >
              HUNGRY • TIRED • TRUSTING
            </div>
          </div>
          <div
            style={{
              width: 170,
              background: NAVY_DEEP,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: F_BEBAS,
              fontSize: 100,
              color: CREAM_DIM,
              scale: `${enterProgress(frame, 7, 3, true)}`,
            }}
          >
            VS
          </div>
          <div
            style={{
              width: 560,
              background: GRAY,
              padding: '40px 44px',
              opacity: enterProgress(frame, 5, 2),
            }}
          >
            <div style={{fontFamily: F_BEBAS, fontSize: 140, color: CREAM, lineHeight: 1}}>
              BLOGGERS FC
            </div>
            <div
              style={{
                fontFamily: F_SPACE,
                fontSize: 38,
                color: CREAM,
                marginTop: 10,
                lineHeight: 1.35,
              }}
            >
              PROMISES 15:00 • DELIVERS ?
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <LowerThird
        kicker="TONIGHT'S FIXTURE"
        title="A FIFTEEN-MINUTE RECIPE"
        sub="So the card says."
        accent={GRAY}
      />
    </AbsoluteFill>
  );
};

// s04 — the recipe card closeup (light paper beat)
export const S04: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = interpolate(frame, [0, 9], [-900, 0], {
    ...clamp,
    easing: Easing.bezier(0.5, 0, 0.4, 1.15),
  });
  return (
    <AbsoluteFill>
      <KitchenStage variant="empty" dim />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 940,
            background: CREAM,
            color: NAVY_DEEP,
            padding: '46px 60px 40px',
            rotate: '-2.5deg',
            translate: `0px ${drop}px`,
            boxShadow: '0 40px 90px rgba(0,0,0,0.55)',
            borderBottom: '14px dashed rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 34,
              letterSpacing: 6,
              color: GRAY,
              fontWeight: 700,
            }}
          >
            BLOGGERS FC — TEAM SHEET
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 150,
              lineHeight: 1,
              color: NAVY_DEEP,
              marginTop: 8,
            }}
          >
            WEEKNIGHT PASTA
          </div>
          <div
            style={{
              display: 'inline-block',
              marginTop: 18,
              border: `8px solid ${GRAY}`,
              padding: '10px 30px',
              rotate: `${interpolate(frame, [8, 12], [-14, -6], clamp)}deg`,
              fontFamily: F_BEBAS,
              fontSize: 92,
              color: GRAY,
              letterSpacing: 4,
            }}
          >
            READY IN 15:00
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s05 — KICK-OFF flash (SFX-only punch)
export const S05: React.FC = () => {
  const shake = useShake(10);
  return (
    <AbsoluteFill style={{translate: shake.translate}}>
      <KitchenStage variant="stove" circlePop />
      <GoalFlash label="KICK-OFF" sub="FIRST WHISTLE — LET'S COOK" delay={1} />
    </AbsoluteFill>
  );
};

// s06 — possession: all theirs
export const S06: React.FC = () => {
  return (
    <AbsoluteFill>
      <KitchenStage variant="board" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Kicker text="POSSESSION — 1ST HALF" color={GRAY} />
        <div style={{marginTop: 26}}>
          <PossessionBar youPct={26} topLabel="CHASING" bottomLabel="ALL THEIRS EARLY" />
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: F_SPACE,
            fontSize: 42,
            color: CREAM_DIM,
          }}
        >
          Bloggers FC dictating the tempo. And the clock.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s07 — step one: preheat (budgeted zero minutes)
export const S07: React.FC = () => {
  return (
    <AbsoluteFill>
      <KitchenStage variant="oven" heat="cold" />
      <StepCard
        step="STEP 1 — PREPARE"
        name="PREHEAT THE OVEN"
        predicted="0:00 BUDGETED"
        actual="NOT STARTED"
        ok={false}
        note="No minutes allowed for a twenty-minute job."
      />
    </AbsoluteFill>
  );
};

// s08 — injury news + own goal
export const S08: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <KitchenStage variant="oven" heat="cold" dim />
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 120,
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(9,19,32,0.94)',
          borderLeft: `10px solid ${RED}`,
          padding: '26px 44px 26px 30px',
          translate: `${interpolate(frame, [0, 7], [-760, 0], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          })}px 0`,
        }}
      >
        <InjuryCross size={92} />
        <div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: 4,
              color: RED,
            }}
          >
            TEAM NEWS — INJURY
          </div>
          <div style={{fontFamily: F_BEBAS, fontSize: 104, color: CREAM, lineHeight: 1.02}}>
            THE PREHEAT WAS FORGOTTEN
          </div>
        </div>
      </div>
      <GoalFlash label="OWN GOAL" sub="BLOGGERS FC 1 — 0 YOU" color={GRAY} delay={16} />
    </AbsoluteFill>
  );
};

const clampEasing = () => ({
  ...clamp,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
});

// s09 — REPLAY: the cold oven
export const S09: React.FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 48], [1, 1.14], clamp);
  const corner = interpolate(frame, [0, 8], [900, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{scale: `${zoom}`, filter: 'saturate(0.45)'}}>
        <KitchenStage variant="oven" heat="cold" />
      </AbsoluteFill>
      <ReplayFrame />
      {/* corner wipe bar */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: corner - 600,
          width: 560,
          height: 1500,
          background: CREAM,
          rotate: '16deg',
          opacity: 0.95,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 120,
          background: 'rgba(9,19,32,0.94)',
          borderLeft: `10px solid ${BLUE_COLD}`,
          padding: '20px 40px 22px 30px',
          translate: `0px ${interpolate(frame, [4, 12], [140, 0], clampEasing())}px`,
        }}
      >
        <div
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 4,
            color: BLUE_COLD,
          }}
        >
          THIRD ANGLE — SLOW MOTION
        </div>
        <div style={{fontFamily: F_BEBAS, fontSize: 92, color: CREAM, lineHeight: 1.05}}>
          THE OVEN: STILL COLD
        </div>
      </div>
    </AbsoluteFill>
  );
};

// s10 — split clock: recipe says 4:00, real 9:30
export const S10: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [8, 40], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.5, 0, 1, 1),
  });
  return (
    <AbsoluteFill style={{background: NAVY}}>
      <div
        style={{
          position: 'absolute',
          top: 130,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <Kicker text="THE CHOPPING TALE — TWO CLOCKS" />
      </div>
      <AbsoluteFill
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 60}}
      >
        <div
          style={{
            width: 620,
            background: 'rgba(135,123,108,0.16)',
            border: `4px solid ${GRAY}`,
            padding: '38px 20px',
            translate: `${interpolate(frame, [0, 8], [-500, 0], clampEasing())}px 0`,
          }}
        >
          <div style={{fontFamily: F_SPACE, fontSize: 40, color: GRAY, letterSpacing: 3}}>
            RECIPE SAYS
          </div>
          <div style={{fontFamily: F_BEBAS, fontSize: 240, color: GRAY, lineHeight: 1}}>
            4:00
          </div>
          <div style={{fontFamily: F_SPACE, fontSize: 36, color: GRAY}}>of chopping</div>
        </div>
        <div style={{position: 'relative', width: 260, height: 260}}>
          <svg width={260} height={260} viewBox="0 0 260 260">
            <line
              x1={30}
              y1={200}
              x2={30 + 190 * drift}
              y2={200 - 120 * drift}
              stroke={RED}
              strokeWidth={12}
              strokeLinecap="round"
            />
            <polygon
              points={`${30 + 190 * drift},${200 - 120 * drift} ${
                30 + 168 * drift
              },${200 - 116 * drift} ${30 + 186 * drift},${200 - 96 * drift}`}
              fill={RED}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              left: 90,
              fontFamily: F_BEBAS,
              fontSize: 64,
              color: RED,
            }}
          >
            +5:30
          </div>
        </div>
        <div
          style={{
            width: 620,
            background: 'rgba(243,237,230,0.07)',
            border: `4px solid ${CREAM}`,
            padding: '38px 20px',
            translate: `${interpolate(frame, [0, 8], [500, 0], clampEasing())}px 0`,
          }}
        >
          <div style={{fontFamily: F_SPACE, fontSize: 40, color: CREAM, letterSpacing: 3}}>
            THE CLOCK SAYS
          </div>
          <div style={{fontFamily: F_BEBAS, fontSize: 240, color: CREAM, lineHeight: 1}}>
            9:30
          </div>
          <div style={{fontFamily: F_SPACE, fontSize: 36, color: CREAM_DIM}}>
            and still counting
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s11 — the clock says ten (digits roll 4 → 10)
export const S11: React.FC = () => {
  const frame = useCurrentFrame();
  const minutes = Math.floor(interpolate(frame, [2, 26], [4, 10], clamp));
  return (
    <AbsoluteFill>
      <KitchenStage variant="board" />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Kicker text="CHOPPING — MINUTE BY MINUTE" color={RED} />
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 24,
            marginTop: 10,
          }}
        >
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 340,
              color: CREAM,
              lineHeight: 0.9,
            }}
          >
            {minutes}
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 90,
              color: CREAM_DIM,
              lineHeight: 1,
            }}
          >
            MIN
            <br />
            PLAYED
          </div>
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 44,
            color: RED,
            border: `4px solid ${RED}`,
            padding: '8px 28px',
            scale: `${enterProgress(frame, 5, 24, true)}`,
          }}
        >
          BLOGGERS PROMISED 4:00
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// s12 — stoppage time board
export const S12: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [0, 10], [620, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill>
      <KitchenStage variant="board" dim />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            translate: `0px ${rise}px`,
            boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              background: NAVY_DEEP,
              border: `6px solid ${CHALK_FAINT}`,
              borderRight: 'none',
              padding: '30px 40px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: F_SPACE,
                fontWeight: 700,
                fontSize: 38,
                color: CREAM,
                letterSpacing: 2,
              }}
            >
              STOPPAGE TIME
            </div>
            <div
              style={{
                fontFamily: F_SPACE,
                fontSize: 34,
                color: CREAM_DIM,
              }}
            >
              1ST HALF — ALREADY
            </div>
          </div>
          <div
            style={{
              width: 420,
              background: '#F0B429',
              color: NAVY_DEEP,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: F_BEBAS,
              fontSize: 300,
              lineHeight: 1,
              textShadow: '0 0 30px rgba(255,255,255,0.55)',
              scale: `${enterProgress(frame, 6, 6, true)}`,
            }}
          >
            +5
          </div>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 90,
          bottom: 120,
          fontFamily: F_SPACE,
          fontSize: 40,
          color: CREAM_DIM,
        }}
      >
        The board goes up. The kitchen sighs.
      </div>
    </AbsoluteFill>
  );
};

// s13 — HALF-TIME card
export const S13: React.FC = () => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [0, 9], [-2200, 0], {
    ...clamp,
    easing: Easing.bezier(0.5, 0, 0.2, 1),
  });
  return (
    <AbsoluteFill>
      <KitchenStage variant="empty" dim />
      <div
        style={{
          position: 'absolute',
          left: wipe,
          top: 300,
          right: 0,
          height: 480,
          background: NAVY_DEEP,
          borderTop: `6px solid ${CHALK}`,
          borderBottom: `6px solid ${CHALK}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 140,
          gap: 90,
          overflow: 'hidden',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: 6,
              color: TERRA,
            }}
          >
            HALF-TIME
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 210,
              color: CREAM,
              lineHeight: 0.95,
            }}
          >
            24:00
          </div>
          <div style={{fontFamily: F_SPACE, fontSize: 40, color: CREAM_DIM}}>PLAYED</div>
        </div>
        <div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 40,
              letterSpacing: 6,
              color: GRAY,
            }}
          >
            THE CARD SAID
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 210,
              color: GRAY,
              lineHeight: 0.95,
              textDecoration: 'line-through',
              textDecorationColor: RED,
              textDecorationThickness: 12,
            }}
          >
            15:00
          </div>
          <div style={{fontFamily: F_SPACE, fontSize: 40, color: GRAY}}>PROMISED</div>
        </div>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 110,
            color: RED,
            rotate: '-8deg',
            border: `7px solid ${RED}`,
            padding: '14px 34px',
            scale: `${enterProgress(frame, 6, 12, true)}`,
          }}
        >
          +9 OVER
        </div>
      </div>
    </AbsoluteFill>
  );
};
