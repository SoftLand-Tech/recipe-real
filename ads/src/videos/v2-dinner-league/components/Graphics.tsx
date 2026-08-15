// Broadcast graphics primitives: wipes, lower-thirds, step cards, stat bars,
// replay frames, tickers, boards, confetti, timer rings. Animate inline via
// useCurrentFrame + interpolate (skill rules).
import React from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {F_BEBAS, F_SPACE} from '../fonts';
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
} from '../tokens';

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

// ---------- entrance/exit progress helpers ----------
export const enterProgress = (
  frame: number,
  dur = 8,
  delay = 0,
  overshoot = false,
): number =>
  interpolate(frame, [delay, delay + dur], [0, 1], {
    ...clamp,
    easing: overshoot
      ? Easing.bezier(0.34, 1.56, 0.64, 1)
      : Easing.bezier(0.16, 1, 0.3, 1),
  });

// ---------- full-screen broadcast wipe bar (scene entrance) ----------
export const WipeBars: React.FC<{
  dir?: 'ltr' | 'rtl';
  color?: string;
}> = ({dir = 'ltr', color = TERRA}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 10], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.6, 0, 0.4, 1),
  });
  const x = dir === 'ltr' ? interpolate(p, [0, 1], [-120, 2200]) : interpolate(p, [0, 1], [2040, -280]);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: -60,
        bottom: -60,
        width: 360,
        background: color,
        rotate: '9deg',
        opacity: interpolate(p, [0, 0.75, 1], [1, 1, 0], clamp),
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 10,
          background: CREAM,
          opacity: 0.9,
        }}
      />
    </div>
  );
};

// ---------- lower-third commentator bar ----------
export const LowerThird: React.FC<{
  kicker: string;
  title: string;
  sub?: string;
  accent?: string;
  exit?: boolean;
}> = ({kicker, title, sub, accent = TERRA, exit = true}) => {
  const frame = useCurrentFrame();
  const inP = enterProgress(frame, 7);
  const outP = exit ? interpolate(frame, [999, 1005], [0, 1], clamp) : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: 90,
        bottom: 120,
        translate: `${interpolate(inP - outP, [0, 1], [-700, 0])}px 0`,
        opacity: interpolate(inP - outP, [0, 0.4, 1], [0, 1, 1], clamp),
      }}
    >
      <div
        style={{
          background: 'rgba(9,19,32,0.94)',
          borderLeft: `10px solid ${accent}`,
          padding: '22px 44px 24px 34px',
          maxWidth: 1150,
        }}
      >
        <div
          style={{
            fontFamily: F_SPACE,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 4,
            color: accent,
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </div>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 96,
            lineHeight: 1.02,
            color: CREAM,
            letterSpacing: 2,
          }}
        >
          {title}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 38,
              color: CREAM_DIM,
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
      <div
        style={{
          width: interpolate(inP, [0, 1], [0, 320]),
          height: 8,
          background: accent,
          marginTop: 0,
        }}
      />
    </div>
  );
};

// ---------- center card that slams in ----------
export const SlamCard: React.FC<{
  children: React.ReactNode;
  width?: number;
  accent?: string;
  tone?: 'navy' | 'cream';
}> = ({children, width = 900, accent = TERRA, tone = 'navy'}) => {
  const frame = useCurrentFrame();
  const p = enterProgress(frame, 9, 0, true);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          width,
          background: tone === 'navy' ? 'rgba(9,19,32,0.95)' : CREAM,
          color: tone === 'navy' ? CREAM : NAVY_DEEP,
          borderTop: `8px solid ${accent}`,
          borderBottom: `3px solid ${CHALK_FAINT}`,
          padding: '36px 56px 40px',
          scale: `${interpolate(p, [0, 1], [1.22, 1])}`,
          opacity: interpolate(p, [0, 0.3, 1], [0, 1, 1], clamp),
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

// ---------- animated green check ----------
export const CheckDraw: React.FC<{size?: number; color?: string}> = ({
  size = 64,
  color = GREEN,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [6, 16], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.5, 0, 0.5, 1),
  });
  const pulse = interpolate(
    Math.sin(frame / 4),
    [-1, 1],
    [0, 0.35],
  );
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `5px solid ${color}`,
        background: `rgba(111,169,127,${0.12 + pulse})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 40 40">
        <path
          d="M8 22 L17 31 L33 10"
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={60}
          strokeDashoffset={60 * (1 - draw)}
        />
      </svg>
    </div>
  );
};

// ---------- per-step card: PREDICTED vs ACTUAL ----------
export const StepCard: React.FC<{
  step: string;
  name: string;
  predicted: string;
  actual: string;
  ok?: boolean;
  note?: string;
}> = ({step, name, predicted, actual, ok = true, note}) => {
  const frame = useCurrentFrame();
  return (
    <SlamCard width={980} accent={ok ? GREEN : RED}>
      <div
        style={{
          fontFamily: F_SPACE,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: 5,
          color: ok ? GREEN : RED,
        }}
      >
        {step}
      </div>
      <div
        style={{
          fontFamily: F_BEBAS,
          fontSize: 150,
          lineHeight: 1,
          letterSpacing: 3,
        }}
      >
        {name}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          marginTop: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 34,
              color: CREAM_DIM,
              letterSpacing: 2,
            }}
          >
            PREDICTED
          </div>
          <div style={{fontFamily: F_BEBAS, fontSize: 92, color: CREAM_DIM}}>
            {predicted}
          </div>
        </div>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 64,
            color: CHALK_FAINT,
          }}
        >
          /
        </div>
        <div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 34,
              color: ok ? GREEN : RED,
              letterSpacing: 2,
            }}
          >
            ACTUAL
          </div>
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 92,
              color: ok ? GREEN : RED,
            }}
          >
            {actual}
          </div>
        </div>
        <div style={{marginLeft: 40}}>
          <CheckDraw size={96} color={ok ? GREEN : RED} />
        </div>
      </div>
      {note ? (
        <div
          style={{
            marginTop: 14,
            fontFamily: F_SPACE,
            fontSize: 36,
            color: CREAM_DIM,
          }}
        >
          {note}
        </div>
      ) : null}
    </SlamCard>
  );
};

// ---------- diagonal GOAL band flash ----------
export const GoalFlash: React.FC<{
  label: string;
  sub?: string;
  color?: string;
  delay?: number;
}> = ({label, sub, color = TERRA, delay = 0}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + 5, delay + 13, delay + 18], [0, 1, 1, 1.25], {
    ...clamp,
    easing: Easing.bezier(0.2, 1.2, 0.4, 1),
  });
  const op = interpolate(frame, [delay, delay + 3, delay + 15, delay + 19], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          right: '-10%',
          height: 300,
          background: color,
          rotate: '-7deg',
          scale: `${p}`,
          opacity: op,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 90px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: 190,
            color: CREAM,
            lineHeight: 0.95,
            letterSpacing: 6,
          }}
        >
          {label}
        </div>
        {sub ? (
          <div
            style={{
              fontFamily: F_SPACE,
              fontWeight: 700,
              fontSize: 40,
              color: CREAM,
              letterSpacing: 3,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ---------- replay overlay: scanlines + watermark ----------
export const ReplayFrame: React.FC<{tag?: string}> = ({tag = 'REPLAY'}) => {
  const frame = useCurrentFrame();
  return (
    <>
      <AbsoluteFill
        style={{
          background:
            'repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 3px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 7px)',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'rgba(127,168,201,0.10)',
          mixBlendMode: 'screen',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 110,
          top: 260,
          fontFamily: F_BEBAS,
          fontSize: 74,
          letterSpacing: 10,
          color: CREAM,
          background: NAVY_DEEP,
          border: `4px solid ${CREAM}`,
          padding: '8px 30px',
          rotate: '-4deg',
          opacity: 0.9 * (frame % 20 < 14 ? 1 : 0.35),
        }}
      >
        {tag}
      </div>
    </>
  );
};

// ---------- possession bar ----------
export const PossessionBar: React.FC<{
  youPct: number;
  topLabel: string;
  bottomLabel: string;
}> = ({youPct, topLabel, bottomLabel}) => {
  const frame = useCurrentFrame();
  const you = interpolate(frame, [3, 22], [0, youPct], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <div style={{width: 1160}}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 10,
          fontFamily: F_SPACE,
          fontWeight: 700,
          fontSize: 36,
        }}
      >
        <span style={{color: TERRA}}>YOU {Math.round(you)}%</span>
        <span style={{color: GRAY}}>BLOGGERS FC {Math.round(100 - you)}%</span>
      </div>
      <div
        style={{
          height: 74,
          background: GRAY,
          display: 'flex',
          overflow: 'hidden',
          border: `3px solid ${CHALK_FAINT}`,
        }}
      >
        <div
          style={{
            width: `${you}%`,
            background: TERRA,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 18,
            fontFamily: F_BEBAS,
            fontSize: 44,
            color: CREAM,
            whiteSpace: 'nowrap',
          }}
        >
          {topLabel}
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 18,
            fontFamily: F_BEBAS,
            fontSize: 44,
            color: NAVY_DEEP,
            whiteSpace: 'nowrap',
          }}
        >
          {bottomLabel}
        </div>
      </div>
    </div>
  );
};

// ---------- ticker tape ----------
export const TickerTape: React.FC<{
  items: string[];
  y?: number;
  accent?: string;
}> = ({items, y = 1010, accent = TERRA}) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 150], [0, -1400], clamp);
  const row = [...items, ...items, ...items].join('   •   ');
  return (
    <div
      style={{
        position: 'absolute',
        left: -40,
        right: -40,
        top: y,
        height: 66,
        background: NAVY_DEEP,
        borderTop: `5px solid ${accent}`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: x,
          whiteSpace: 'nowrap',
          fontFamily: F_SPACE,
          fontWeight: 700,
          fontSize: 40,
          color: CREAM,
          letterSpacing: 2,
        }}
      >
        {row}   •   {row}
      </div>
    </div>
  );
};

// ---------- stat bars (promised vs actual) ----------
export const StatBars: React.FC<{
  leftLabel: string;
  leftValue: string;
  leftFrac: number;
  rightLabel: string;
  rightValue: string;
  rightFrac: number;
  gapLabel?: string;
}> = ({leftLabel, leftValue, leftFrac, rightLabel, rightValue, rightFrac, gapLabel}) => {
  const frame = useCurrentFrame();
  const grow = (delay: number) =>
    interpolate(frame, [delay, delay + 16], [0, 1], {
      ...clamp,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  const barW = 1500;
  const row = (
    label: string,
    value: string,
    frac: number,
    color: string,
    delay: number,
  ) => (
    <div style={{marginBottom: 34}}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: F_SPACE,
          fontWeight: 700,
          fontSize: 40,
          marginBottom: 8,
          letterSpacing: 2,
        }}
      >
        <span style={{color: CREAM_DIM}}>{label}</span>
        <span style={{color}}>{value}</span>
      </div>
      <div
        style={{
          width: barW,
          height: 60,
          border: `3px solid ${CHALK_FAINT}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${frac * 100 * grow(delay)}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
  return (
    <div>
      {row(leftLabel, leftValue, leftFrac, GRAY, 4)}
      {row(rightLabel, rightValue, rightFrac, TERRA, 10)}
      {gapLabel ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginTop: -6,
          }}
        >
          <div
            style={{
              fontFamily: F_BEBAS,
              fontSize: 84,
              color: RED,
              lineHeight: 1,
            }}
          >
            {gapLabel}
          </div>
          <div
            style={{
              fontFamily: F_SPACE,
              fontSize: 36,
              color: RED,
              borderBottom: `4px solid ${RED}`,
              letterSpacing: 2,
            }}
          >
            THE GAP NOBODY POSTS
          </div>
        </div>
      ) : null}
    </div>
  );
};

// ---------- confetti ----------
export const Confetti: React.FC<{count?: number; start?: number}> = ({
  count = 80,
  start = 0,
}) => {
  const frame = useCurrentFrame();
  return (
    <>
      {new Array(count).fill(0).map((_, i) => {
        const seedX = random(`conf-x-${i}`);
        const seedY = random(`conf-y-${i}`);
        const speed = 6 + seedY * 9;
        const x = seedX * 2000 - 40;
        const y = interpolate(frame - start, [0, 110], [-80, 1200], {
          ...clamp,
        }) + (seedY * 240);
        const rot = frame * (6 + seedX * 14);
        const colors = [TERRA, CREAM, GREEN, GRAY];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y * (0.6 + speed / 14),
              width: 12 + (i % 3) * 6,
              height: 20 + (i % 4) * 7,
              background: colors[i % colors.length],
              rotate: `${rot}deg`,
              opacity: 0.95,
            }}
          />
        );
      })}
    </>
  );
};

// ---------- timer ring ----------
export const TimerRing: React.FC<{
  progress: number; // 0..1 remaining
  label: string;
  size?: number;
}> = ({progress, label, size = 300}) => {
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size} height={size} style={{position: 'absolute', inset: 0}}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="rgba(9,19,32,0.85)"
          stroke={CHALK_FAINT}
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={GREEN}
          strokeWidth={14}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{textAlign: 'center'}}>
        <div
          style={{
            fontFamily: F_BEBAS,
            fontSize: size * 0.3,
            color: CREAM,
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};

// ---------- kicker label (small caps) ----------
export const Kicker: React.FC<{text: string; color?: string}> = ({
  text,
  color = TERRA,
}) => (
  <div
    style={{
      fontFamily: F_SPACE,
      fontWeight: 700,
      fontSize: 38,
      letterSpacing: 6,
      color,
      textTransform: 'uppercase',
    }}
  >
    {text}
  </div>
);

// ---------- mini pitch diagram with X marks ----------
export const ChalkPitchMini: React.FC<{
  marks?: number; // landed steps
  width?: number;
}> = ({marks = 0, width = 760}) => {
  const frame = useCurrentFrame();
  const h = width * 0.62;
  return (
    <svg width={width} height={h} viewBox="0 0 760 470">
      <rect
        x="6"
        y="6"
        width="748"
        height="458"
        fill="rgba(18,48,30,0.55)"
        stroke={CHALK}
        strokeWidth={5}
        rx="4"
      />
      <line x1="380" y1="6" x2="380" y2="464" stroke={CHALK} strokeWidth={3} />
      <circle
        cx="380"
        cy="235"
        r="64"
        fill="none"
        stroke={CHALK}
        strokeWidth={3}
      />
      <rect
        x="250"
        y="6"
        width="260"
        height="96"
        fill="none"
        stroke={CHALK}
        strokeWidth={3}
      />
      {new Array(Math.max(0, marks)).fill(0).map((_, i) => {
        const appear = interpolate(frame, [6 + i * 5, 12 + i * 5], [0, 1], {
          ...clamp,
        });
        const x = 120 + i * 130;
        const y = 150 + ((i % 2) * 160);
        return (
          <g key={i} opacity={appear}>
            <line
              x1={x - 26}
              y1={y - 26}
              x2={x + 26}
              y2={y + 26}
              stroke={GREEN}
              strokeWidth={10}
              strokeLinecap="round"
            />
            <line
              x1={x + 26}
              y1={y - 26}
              x2={x - 26}
              y2={y + 26}
              stroke={GREEN}
              strokeWidth={10}
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
};

// ---------- red cross medical icon ----------
export const InjuryCross: React.FC<{size?: number}> = ({size = 90}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 3), [-1, 1], [1, 1.08]);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `6px solid ${RED}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        scale: `${pulse}`,
        marginRight: 26,
      }}
    >
      <div
        style={{
          width: size * 0.26,
          height: size * 0.62,
          background: RED,
          position: 'absolute',
        }}
      />
      <div
        style={{
          width: size * 0.62,
          height: size * 0.26,
          background: RED,
          position: 'absolute',
        }}
      />
    </div>
  );
};

// ---------- frame shake (impacts) ----------
export const useShake = (decay = 12): {translate: string} => {
  const frame = useCurrentFrame();
  const a = interpolate(frame, [0, decay], [14, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  return {
    translate: `${Math.sin(frame * 2.7) * a}px ${Math.cos(frame * 3.1) * a}px`,
  };
};
