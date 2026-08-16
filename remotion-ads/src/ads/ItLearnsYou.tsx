import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { ItLearnsYou } from "../scenes";
import { buildTimeline, totalFrames } from "../timeline";
import { SceneAudio } from "../audio";
import { DARK as P, FONTS } from "../theme";
import { Backdrop, FadeIn, RiseIn, PopIn, GrowX, GrowY } from "../atoms";
import { EndCard, TimerMark } from "../brand";
import { TimerRing, Check, Strike, Label, Chip, PanIcon, PlatesIcon, mmss } from "../ui/widgets";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const H: React.FC<{ children: React.ReactNode; size?: number; delay?: number; style?: React.CSSProperties }> = ({
  children,
  size = 96,
  delay = 6,
  style,
}) => (
  <RiseIn delay={delay}>
    <div
      style={{
        fontFamily: FONTS.sans,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: "-0.02em",
        color: P.ink,
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </div>
  </RiseIn>
);

const Caption: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
  <FadeIn delay={delay}>
    <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 44, color: P.sub, textAlign: "center" }}>
      {children}
    </div>
  </FadeIn>
);

/* ---------------- 1. same — one number for everyone ---------------- */

const RECIPE_NAMES = [
  "Pasta Primavera",
  "Skillet Chicken",
  "Buddha Bowl",
  "Shrimp Tacos",
  "Miso Soup",
  "Beef Stir-Fry",
];

const SameCard: React.FC<{ name: string; delay: number }> = ({ name, delay }) => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.012 * Math.sin((frame - 30) / 13);
  return (
    <FadeIn delay={delay} dur={14}>
      <div
        style={{
          width: 400,
          height: 240,
          background: P.panel,
          border: `2px solid ${P.panelBorder}`,
          borderRadius: 22,
          padding: "30px 36px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          scale: `${pulse}`,
        }}
      >
        <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 32, color: P.faint }}>{name}</div>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 74, color: P.faint, letterSpacing: "-0.01em" }}>
          32 MIN
        </div>
      </div>
    </FadeIn>
  );
};

const Same: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 400px)", gap: 30 }}>
      {RECIPE_NAMES.map((name, i) => (
        <SameCard key={name} name={name} delay={8 + i * 5} />
      ))}
    </div>
    <H delay={66} size={92}>
      Same number. Everyone.
    </H>
  </AbsoluteFill>
);

/* ---------------- 2. you — you're not everyone ---------------- */

const You: React.FC = () => {
  const frame = useCurrentFrame();
  const gridDim = interpolate(frame, [90, 110], [1, 0.22], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 }}>
      <div style={{ position: "absolute", opacity: gridDim }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 400px)", gap: 30 }}>
          {RECIPE_NAMES.map((name) => (
            <div
              key={name}
              style={{
                width: 400,
                height: 240,
                background: P.panel,
                border: `2px solid ${P.panelBorder}`,
                borderRadius: 22,
                padding: "30px 36px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 32, color: P.faint }}>{name}</div>
              <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 74, color: P.faint }}>32 MIN</div>
            </div>
          ))}
        </div>
      </div>

      <PopIn delay={12} from={0.5}>
        <div
          style={{
            width: 680,
            background: P.panel,
            border: `5px solid ${P.accent}`,
            borderRadius: 28,
            padding: "48px 60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            rotate: "-2deg",
            boxShadow: "0 60px 130px rgba(0, 0, 0, 0.5)",
          }}
        >
          <Label size={32} color={P.sub}>
            your onion dice
          </Label>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 800,
              fontSize: 150,
              color: P.accent,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            7 MIN
          </div>
          <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 36, color: P.faint, position: "relative" }}>
            not 3
            <Strike delay={44} color={P.bad} thickness={5} />
          </div>
        </div>
      </PopIn>

      <div style={{ position: "absolute", top: 120 }}>
        <FadeIn delay={96} dur={14}>
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 100, letterSpacing: "-0.02em", color: P.ink }}>
            You’re not everyone.
          </div>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 3. intro — the app that learns you ---------------- */

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
      <RiseIn delay={6}>
        <TimerMark
          size={300}
          ring={P.accent}
          hand={P.ink}
          ringProgress={interpolate(frame, [0, 26], [0, 1], clamp)}
          handDeg={interpolate(frame, [4, 46], [0, 300], clamp)}
          strokeWidth={7}
        />
      </RiseIn>
      <RiseIn delay={26}>
        <div style={{ fontFamily: FONTS.serif, fontWeight: 600, fontSize: 130, letterSpacing: "-0.02em", color: P.ink }}>
          RecipeReal
        </div>
      </RiseIn>
      <RiseIn delay={52}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 50, color: P.sub }}>
          the first app that <span style={{ color: P.accent }}>learns your pace</span>
        </div>
      </RiseIn>
    </AbsoluteFill>
  );
};

/* ---------------- 4. three — three verified estimates ---------------- */

const EstCol: React.FC<{ label: string; minutes: string; frac: number; delay: number }> = ({
  label,
  minutes,
  frac,
  delay,
}) => (
  <PopIn delay={delay} from={0.45}>
    <div
      style={{
        width: 460,
        height: 560,
        background: P.panel,
        border: `2px solid ${P.panelBorder}`,
        borderRadius: 28,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "44px 40px",
        gap: 20,
      }}
    >
      <Label size={34} color={P.sub}>
        {label}
      </Label>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 160,
          color: P.accent,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {minutes}
      </div>
      <Label size={28} color={P.faint} weight={600}>
        minutes
      </Label>
      <div style={{ width: "100%", height: 120, background: P.soft, borderRadius: 16, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
        <GrowY delay={delay + 10} dur={30} style={{ width: "100%" }}>
          <div style={{ width: "100%", height: `${frac * 100}%`, background: P.accent, borderRadius: 16 }} />
        </GrowY>
      </div>
      <PopIn delay={delay + 24} from={0.3}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Check size={30} color={P.good} delay={delay + 26} />
          <span style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 28, color: P.good }}>verified</span>
        </div>
      </PopIn>
    </div>
  </PopIn>
);

const ThreeEstimates: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
    <H delay={8}>Three estimates. All real.</H>
    <div style={{ display: "flex", gap: 44 }}>
      <EstCol label="novice" minutes="42" frac={1} delay={14} />
      <EstCol label="intermediate" minutes="32" frac={0.76} delay={58} />
      <EstCol label="expert" minutes="25" frac={0.6} delay={100} />
    </div>
    <Caption delay={170}>timed by real stopwatch sessions</Caption>
  </AbsoluteFill>
);

/* ---------------- 5. cook — it logs everything ---------------- */

const CookLog: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const seconds = interpolate(frame, [0, Math.max(dur - 20, 30)], [300, 40], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
      <H delay={8}>It logs everything. Quietly.</H>
      <PopIn delay={22} from={0.75}>
        <div
          style={{
            width: 760,
            background: P.soft,
            border: `2px solid ${P.panelBorder}`,
            borderRadius: 36,
            padding: "40px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Label size={26} color={P.accent}>
              cook mode
            </Label>
            <Label size={26} color={P.faint} weight={600}>
              step 4 · simmer
            </Label>
          </div>
          <TimerRing
            size={280}
            stroke={20}
            progress={interpolate(frame, [0, dur - 10], [0.03, 0.94], clamp)}
            color={P.accent}
            track={P.panelBorder}
          >
            <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 68, color: P.ink, fontVariantNumeric: "tabular-nums" }}>
              {mmss(seconds)}
            </div>
          </TimerRing>
          <div style={{ display: "flex", gap: 10 }}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: i < 3 ? P.accent : P.panelBorder,
                }}
              />
            ))}
          </div>
          <PopIn delay={108} from={0.4}>
            <Chip palette={P} text="✓ SESSION LOGGED — +1 DATA POINT" fontSize={30} />
          </PopIn>
        </div>
      </PopIn>
    </AbsoluteFill>
  );
};

/* ---------------- 6. profile — your speed profile ---------------- */

const Profile: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = [
    [0.06, 0.86],
    [0.22, 0.78],
    [0.38, 0.7],
    [0.54, 0.55],
    [0.7, 0.4],
    [0.94, 0.16],
  ] as const;
  const toXY = ([fx, fy]: readonly [number, number]) => ({ x: 60 + fx * 1080, y: 40 + fy * 460 });
  const pts = dots.map(toXY);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 48 }}>
      <H delay={6}>Your speed profile.</H>
      <div
        style={{
          width: 1200,
          height: 560,
          background: P.panel,
          border: `2px solid ${P.panelBorder}`,
          borderRadius: 28,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            top: 40 + 0.6 * 460,
            borderTop: `3px dashed ${P.panelBorder}`,
          }}
        />
        <div style={{ position: "absolute", left: 76, top: 40 + 0.6 * 460 - 46, fontFamily: FONTS.sans, fontWeight: 600, fontSize: 26, color: P.faint }}>
          community average
        </div>
        <svg width={1200} height={560} style={{ position: "absolute", inset: 0 }}>
          <polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke={P.accent2}
            strokeWidth={7}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={interpolate(frame, [20, 105], [100, 0], clamp)}
          />
        </svg>
        {pts.map((p, i) => (
          <PopIn key={i} delay={20 + i * 14} from={0.2} style={{ position: "absolute", left: p.x - 13, top: p.y - 13 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                background: i === pts.length - 1 ? P.accent : P.accent2,
                boxShadow: i === pts.length - 1 ? `0 0 34px ${P.accent}` : "none",
              }}
            />
          </PopIn>
        ))}
        <PopIn delay={100} from={0.4} style={{ position: "absolute", left: pts[5].x - 130, top: pts[5].y + 8 }}>
          <Chip palette={P} text="YOU" fontSize={30} />
        </PopIn>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 7. numbers — your sauté vs community ---------------- */

const CompareRow: React.FC<{ label: string; value: string; frac: number; color: string; delay: number }> = ({
  label,
  value,
  frac,
  color,
  delay,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <Label size={32} color={label === "YOUR SAUTÉ" ? P.accent : P.sub}>
        {label}
      </Label>
      <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 54, color, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
    <div style={{ width: 1240, height: 54, background: P.soft, borderRadius: 999, overflow: "hidden" }}>
      <GrowX delay={delay} dur={30}>
        <div style={{ width: `${frac * 100}%`, height: "100%", background: color, borderRadius: 999 }} />
      </GrowX>
    </div>
  </div>
);

const Numbers: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 }}>
    <H delay={8}>Stop guessing buffers.</H>
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <CompareRow label="YOUR SAUTÉ" value="4:48" frac={0.96} color={P.accent} delay={14} />
      <CompareRow label="COMMUNITY" value="3:20" frac={0.67} color={P.faint} delay={74} />
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      <FadeIn delay={112}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 40, color: P.faint, position: "relative" }}>
          “add ten minutes, just in case”
          <Strike delay={116} color={P.bad} thickness={5} />
        </div>
      </FadeIn>
      <PopIn delay={124} from={0.4}>
        <Chip palette={P} text="CALCULATED FOR YOU ✓" fontSize={32} />
      </PopIn>
    </div>
  </AbsoluteFill>
);

/* ---------------- 8. cleanup — baked into the total ---------------- */

const Cleanup: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
      <PopIn delay={12} from={0.55}>
        <div
          style={{
            background: P.panel,
            border: `2px solid ${P.panelBorder}`,
            borderRadius: 20,
            padding: "28px 44px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <PanIcon size={54} color={P.accent} />
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 62, color: P.ink }}>30</div>
          <Label size={24} color={P.faint} weight={600}>
            min cook
          </Label>
        </div>
      </PopIn>
      <FadeIn delay={24}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 76, color: P.faint }}>+</div>
      </FadeIn>
      <PopIn delay={30} from={0.55}>
        <div
          style={{
            background: P.panel,
            border: `2px solid ${P.panelBorder}`,
            borderRadius: 20,
            padding: "28px 44px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <PlatesIcon size={54} color={P.accent2} />
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 62, color: P.ink }}>12</div>
          <Label size={24} color={P.faint} weight={600}>
            min dishes
          </Label>
        </div>
      </PopIn>
      <FadeIn delay={52}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 76, color: P.faint }}>=</div>
      </FadeIn>
      <PopIn delay={84} from={0.4}>
        <div
          style={{
            background: P.accent,
            color: P.onAccent,
            borderRadius: 22,
            padding: "40px 54px",
            fontFamily: FONTS.sans,
            fontWeight: 800,
            fontSize: 96,
            letterSpacing: "-0.02em",
            boxShadow: "0 40px 90px rgba(240, 166, 60, 0.25)",
          }}
        >
          42 MIN
        </div>
      </PopIn>
    </div>
    <Caption delay={70}>every single time</Caption>
  </AbsoluteFill>
);

/* ---------------- 9. smarter — sharper with every cook ---------------- */

const Sharper: React.FC = () => {
  const bars = Array.from({ length: 10 }, (_, i) => 1 - i * 0.095);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
      <H delay={6}>Sharper with every cook.</H>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 30, height: 420 }}>
        {bars.map((frac, i) => (
          <GrowY key={i} delay={18 + i * 8} dur={20} style={{ width: 66, height: "100%", display: "flex", alignItems: "flex-end" }}>
            <div
              style={{
                width: "100%",
                height: `${Math.max(frac, 0.12) * 100}%`,
                background: i === bars.length - 1 ? P.accent : P.panelBorder,
                borderRadius: 14,
                boxShadow: i === bars.length - 1 ? `0 0 44px ${P.accent}` : "none",
              }}
            />
          </GrowY>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Caption delay={10}>estimate error, cook 1 → 10</Caption>
        <FadeIn delay={96}>
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 52, color: P.accent }}>±3%</div>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 10. yours — your stopwatch ---------------- */

const Yours: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [60, 74], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
      <H delay={10} size={88}>
        Stop cooking with someone
        <br />
        else’s stopwatch.
      </H>
      <div style={{ position: "relative", width: 420, height: 420 }}>
        <div style={{ position: "absolute", inset: 0, opacity: 1 - reveal }}>
          <TimerMark size={420} ring={P.faint} hand={P.faint} strokeWidth={5} />
          <div
            style={{
              position: "absolute",
              bottom: -58,
              width: "100%",
              textAlign: "center",
              fontFamily: FONTS.sans,
              fontWeight: 600,
              fontSize: 34,
              color: P.faint,
            }}
          >
            everyone else’s pace
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: reveal, scale: `${0.7 + reveal * 0.3}` }}>
          <TimerMark
            size={420}
            ring={P.accent}
            hand={P.ink}
            strokeWidth={6}
            handDeg={interpolate(frame, [64, 90], [0, 540], clamp)}
          />
          <div
            style={{
              position: "absolute",
              bottom: -58,
              width: "100%",
              textAlign: "center",
              fontFamily: FONTS.sans,
              fontWeight: 800,
              fontSize: 40,
              color: P.accent,
            }}
          >
            yours
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- composition ---------------- */

const slots = buildTimeline(ItLearnsYou);

const Scene: React.FC<{ id: string; dur: number }> = ({ id, dur }) => {
  switch (id) {
    case "same":
      return <Same />;
    case "you":
      return <You />;
    case "intro":
      return <Intro />;
    case "three":
      return <ThreeEstimates />;
    case "cook":
      return <CookLog dur={dur} />;
    case "profile":
      return <Profile />;
    case "numbers":
      return <Numbers />;
    case "cleanup":
      return <Cleanup />;
    case "smarter":
      return <Sharper />;
    case "yours":
      return <Yours />;
    case "cta":
      return <EndCard palette={P} tagline="It learns you." />;
    default:
      return null;
  }
};

export const ItLearnsYouComp: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: P.bg, fontFamily: FONTS.sans, color: P.ink }}>
    <Backdrop palette={P} />
    {slots.map((s) => (
      <Sequence key={s.def.id} from={s.start} durationInFrames={s.duration} layout="none" name={s.def.id}>
        <Scene id={s.def.id} dur={s.duration} />
        <SceneAudio adId="ItLearnsYou" scene={s} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const ILY_DURATION = totalFrames(ItLearnsYou);
