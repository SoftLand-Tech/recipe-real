import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { ThirtyMinuteLie } from "../scenes";
import { buildTimeline, totalFrames } from "../timeline";
import { SceneAudio } from "../audio";
import { LIGHT as P, FONTS } from "../theme";
import { Backdrop, FadeIn, RiseIn, PopIn, GrowX } from "../atoms";
import { EndCard } from "../brand";
import { Phone } from "../ui/phone";
import { TimerRing, Check, Strike, Label, Chip, PanIcon, PlatesIcon, StarIcon, mmss } from "../ui/widgets";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Serif: React.FC<{ children: React.ReactNode; size?: number; style?: React.CSSProperties }> = ({
  children,
  size = 100,
  style,
}) => (
  <div
    style={{
      fontFamily: FONTS.serif,
      fontWeight: 600,
      fontSize: size,
      lineHeight: 1.06,
      letterSpacing: "-0.015em",
      color: P.ink,
      textAlign: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

const Caption: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
  <FadeIn delay={delay}>
    <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 44, color: P.sub }}>{children}</div>
  </FadeIn>
);

/* ---------------- 1. hook — the recipe card lies ---------------- */

const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const shakeAt = 78;
  const shake = interpolate(frame, [shakeAt, shakeAt + 8], [1, 0], clamp) *
    Math.sin(frame * 3.3) * 10;
  const clockDeg = interpolate(frame, [0, dur], [0, 720], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      {/* ghost stopwatch behind */}
      <svg width={940} height={940} viewBox="0 0 100 100" style={{ position: "absolute", opacity: 0.5 }}>
        <circle cx={50} cy={50} r={44} fill="none" stroke={P.soft} strokeWidth={2} />
        <circle cx={50} cy={50} r={3.4} fill={P.faint} />
        <line
          x1={50}
          y1={50}
          x2={50 + 38 * Math.sin((clockDeg * Math.PI) / 180)}
          y2={50 - 38 * Math.cos((clockDeg * Math.PI) / 180)}
          stroke={P.faint}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </svg>

      <div
        style={{
          width: 660,
          background: P.panel,
          border: `2px solid ${P.panelBorder}`,
          borderRadius: 28,
          padding: "52px 56px 58px",
          boxShadow: "0 50px 110px rgba(60, 30, 10, 0.16)",
          rotate: "-2deg",
          translate: `${shake}px 0px`,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Serif size={58} style={{ textAlign: "left" }}>
            One-Pan Pasta
          </Serif>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <StarIcon color={P.accent2} />
            <span style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 30, color: P.sub }}>4.8</span>
          </div>
        </div>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 28, color: P.faint }}>
          serves 4 · one pan · “easy weeknight”
        </div>
        <div style={{ height: 2, background: P.soft }} />
        <Label size={26} color={P.faint}>
          total time
        </Label>
        <PopIn delay={16} from={0.6}>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontWeight: 800,
              fontSize: 138,
              color: P.accent,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            30 MIN
          </div>
        </PopIn>

        {/* the truth stamp */}
        <PopIn delay={shakeAt} from={1.7} dur={10}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                border: `7px solid ${P.bad}`,
                color: P.bad,
                borderRadius: 18,
                padding: "16px 40px",
                background: "rgba(255, 250, 244, 0.94)",
                rotate: "6deg",
                fontFamily: FONTS.sans,
                fontWeight: 800,
                fontSize: 96,
                letterSpacing: "0.01em",
                boxShadow: "0 30px 70px rgba(160, 40, 20, 0.25)",
              }}
            >
              1 HR 32 MIN
            </div>
          </div>
        </PopIn>
      </div>

      <div style={{ position: "absolute", bottom: 110 }}>
        <Caption delay={104}>— the recipe said thirty minutes</Caption>
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- 2. notYou — you're not bad at cooking ---------------- */

const NotYou: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 46 }}>
    <RiseIn delay={6}>
      <Serif size={108}>
        You’re not{" "}
        <span style={{ position: "relative", display: "inline-block", color: P.sub }}>
          bad at cooking
          <Strike delay={56} color={P.accent} thickness={8} />
        </span>
        .
      </Serif>
    </RiseIn>
    <RiseIn delay={66}>
      <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 58, color: P.sub }}>
        That number was <span style={{ color: P.accent, fontWeight: 800 }}>fiction</span>.
      </div>
    </RiseIn>
  </AbsoluteFill>
);

/* ---------------- 3. why — what the recipe left out ---------------- */

const WhySegment: React.FC<{ label: string; add: string; width: number; color: string; delay: number }> = ({
  label,
  add,
  width,
  color,
  delay,
}) => (
  <PopIn delay={delay} from={0.4} style={{ width, height: 128 }}>
    <div
      style={{
        width: "100%",
        height: "100%",
        background: color,
        borderRadius: 18,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        color: P.onAccent,
      }}
    >
      <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 28, letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 38 }}>{add}</div>
    </div>
  </PopIn>
);

const Why: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
    <RiseIn delay={6}>
      <Serif size={84}>What the recipe left out.</Serif>
    </RiseIn>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
      <PopIn delay={14} from={0.6} style={{ width: 360, height: 128 }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            background: P.soft,
            borderRadius: 18,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            color: P.sub,
          }}
        >
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 28, letterSpacing: "0.1em" }}>
            PUBLISHED
          </div>
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 38 }}>30 MIN</div>
        </div>
      </PopIn>
      <WhySegment label="PREP" add="+9" width={210} color={P.bad} delay={62} />
      <WhySegment label="PREHEAT" add="+10" width={230} color={P.accent} delay={88} />
      <WhySegment label="CLEANUP" add="+12" width={250} color={P.accent2} delay={114} />
    </div>
    <PopIn delay={140} from={0.5}>
      <Chip palette={P} text="REAL: 61 MIN" fontSize={44} />
    </PopIn>
  </AbsoluteFill>
);

/* ---------------- 4. reveal — real time before you start ---------------- */

const Column: React.FC<{ label: string; minutes: string; delay: number; active?: boolean }> = ({
  label,
  minutes,
  delay,
  active,
}) => (
  <PopIn delay={delay} from={0.5}>
    <div
      style={{
        flex: 1,
        border: active ? `4px solid ${P.accent}` : `2px solid ${P.panelBorder}`,
        borderRadius: 16,
        padding: "18px 8px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Label size={22} color={active ? P.accent : P.faint}>
        {label}
      </Label>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 58,
          color: active ? P.accent : P.ink,
          lineHeight: 1,
        }}
      >
        {minutes}
      </div>
      <GrowX delay={delay + 8} dur={20} style={{ width: "100%" }}>
        <div style={{ height: 12, borderRadius: 999, background: active ? P.accent : P.soft }} />
      </GrowX>
    </div>
  </PopIn>
);

const Reveal: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 48 }}>
    <RiseIn delay={8}>
      <Serif size={88}>The real time. Before you start.</Serif>
    </RiseIn>
    <PopIn delay={26} from={0.7} style={{ position: "relative" }}>
      <div style={{ position: "absolute", top: -34, right: -130, zIndex: 2 }}>
        <PopIn delay={96} from={0.3}>
          <Chip palette={P} text="✓ STOPWATCH-VERIFIED" fontSize={26} rotateDeg={4} />
        </PopIn>
      </div>
      <Phone width={400} screenBg={P.panel} rotateDeg={-2}>
        <div style={{ padding: "44px 34px", display: "flex", flexDirection: "column", gap: 22 }}>
          <Serif size={44} style={{ textAlign: "left" }}>
            Chicken Tagine
          </Serif>
          <div style={{ fontFamily: FONTS.sans, fontWeight: 600, fontSize: 24, color: P.faint }}>
            246 verified cooks
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <Column label="novice" minutes="42" delay={48} />
            <Column label="inter." minutes="32" delay={70} active />
            <Column label="expert" minutes="25" delay={92} />
          </div>
          <div
            style={{
              background: P.soft,
              borderRadius: 14,
              padding: "18px 22px",
              fontFamily: FONTS.sans,
              fontWeight: 600,
              fontSize: 26,
              color: P.sub,
              textAlign: "center",
            }}
          >
            + 12 min dishes → <span style={{ fontWeight: 800, color: P.ink }}>44 total</span>
          </div>
        </div>
      </Phone>
    </PopIn>
    <Caption delay={130}>measured by real cooks, on real stopwatches</Caption>
  </AbsoluteFill>
);

/* ---------------- 5. three — three estimates ---------------- */

const BigNumberCard: React.FC<{ label: string; minutes: string; delay: number; active?: boolean }> = ({
  label,
  minutes,
  delay,
  active,
}) => (
  <PopIn delay={delay} from={0.5}>
    <div
      style={{
        width: 430,
        height: 440,
        background: P.panel,
        border: active ? `5px solid ${P.accent}` : `2px solid ${P.panelBorder}`,
        borderRadius: 26,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        scale: active ? 1.06 : 1,
        boxShadow: active ? "0 40px 90px rgba(200, 90, 40, 0.2)" : "0 24px 60px rgba(60, 30, 10, 0.08)",
      }}
    >
      <Label size={32} color={active ? P.accent : P.faint}>
        {label}
      </Label>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 170,
          color: active ? P.accent : P.ink,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {minutes}
      </div>
      <Label size={26} color={P.faint} weight={600}>
        minutes
      </Label>
    </div>
  </PopIn>
);

const Three: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 70 }}>
    <div style={{ display: "flex", gap: 56, alignItems: "center" }}>
      <BigNumberCard label="novice" minutes="42" delay={14} />
      <BigNumberCard label="intermediate" minutes="32" delay={60} active />
      <BigNumberCard label="expert" minutes="25" delay={104} />
    </div>
    <Caption delay={150}>same recipe — pick your level</Caption>
  </AbsoluteFill>
);

/* ---------------- 6. cook — guided cook mode ---------------- */

const StepRow: React.FC<{ text: string; doneAt?: number; active?: boolean }> = ({ text, doneAt, active }) => {
  const frame = useCurrentFrame();
  const done = doneAt !== undefined && frame >= doneAt;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 22px",
        borderRadius: 14,
        background: active ? P.soft : "transparent",
        opacity: done ? 0.65 : 1,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          border: `3px solid ${done ? P.good : active ? P.accent : P.faint}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {done ? <Check size={22} color={P.good} delay={doneAt} dur={8} /> : null}
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: active ? 700 : 600,
          fontSize: 30,
          color: active ? P.ink : P.sub,
          position: "relative",
        }}
      >
        {text}
        {done ? <Strike delay={doneAt} color={P.faint} thickness={4} /> : null}
      </div>
    </div>
  );
};

const Cook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const seconds = interpolate(frame, [0, Math.max(dur - 20, 30)], [252, 28], clamp);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40 }}>
      <RiseIn delay={6}>
        <Serif size={88}>One tap per step.</Serif>
      </RiseIn>
      <PopIn delay={22} from={0.75}>
        <div
          style={{
            width: 780,
            background: P.panel,
            border: `2px solid ${P.panelBorder}`,
            borderRadius: 36,
            padding: "40px 48px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
            boxShadow: "0 50px 110px rgba(60, 30, 10, 0.14)",
          }}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <Label size={26} color={P.accent}>
              cook mode
            </Label>
            <Label size={26} color={P.faint} weight={600}>
              step 3 of 7
            </Label>
          </div>
          <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 46, color: P.ink }}>
            Sauté the onions
          </div>
          <TimerRing size={280} stroke={20} progress={interpolate(frame, [0, dur - 10], [0.04, 0.96], clamp)} color={P.accent} track={P.soft}>
            <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 68, color: P.ink, fontVariantNumeric: "tabular-nums" }}>
              {mmss(seconds)}
            </div>
          </TimerRing>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
            <StepRow text="Dice the onions" doneAt={40} />
            <StepRow text="Warm the pan" doneAt={64} />
            <StepRow text="Sauté — keep going" active />
          </div>
        </div>
      </PopIn>
    </AbsoluteFill>
  );
};

/* ---------------- 7. learn — it learns your pace ---------------- */

const PaceRow: React.FC<{ label: string; value: string; was: string; delay: number }> = ({
  label,
  value,
  was,
  delay,
}) => (
  <PopIn delay={delay} from={0.55}>
    <div
      style={{
        width: 1120,
        background: P.panel,
        border: `2px solid ${P.panelBorder}`,
        borderRadius: 20,
        padding: "30px 48px",
        display: "flex",
        alignItems: "center",
        gap: 40,
      }}
    >
      <div style={{ width: 380 }}>
        <Label size={32} color={P.sub}>
          {label}
        </Label>
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 74,
          color: P.accent,
          letterSpacing: "-0.02em",
          width: 300,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontWeight: 600,
          fontSize: 32,
          color: P.faint,
          position: "relative",
          flex: 1,
        }}
      >
        {was}
        <Strike delay={delay + 20} color={P.bad} thickness={5} />
      </div>
    </div>
  </PopIn>
);

const Learn: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
    <RiseIn delay={6}>
      <Serif size={88}>It learns your pace.</Serif>
    </RiseIn>
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PaceRow label="your onion dice" value="7:12" was="recipe said 3:00" delay={72} />
      <PaceRow label="your garlic sauté" value="4:48" was="recipe said 3:00" delay={106} />
      <PaceRow label="your cleanup" value="12 min" was="guesswork" delay={140} />
    </div>
  </AbsoluteFill>
);

/* ---------------- 8. total — dishes included ---------------- */

const EquationChip: React.FC<{ icon: React.ReactNode; value: string; label: string; delay: number }> = ({
  icon,
  value,
  label,
  delay,
}) => (
  <PopIn delay={delay} from={0.55}>
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
      {icon}
      <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 62, color: P.ink }}>{value}</div>
      <Label size={24} color={P.faint} weight={600}>
        {label}
      </Label>
    </div>
  </PopIn>
);

const Total: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 56 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
      <EquationChip icon={<PanIcon size={54} color={P.accent} />} value="30" label="min cook" delay={12} />
      <FadeIn delay={24}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 76, color: P.faint }}>+</div>
      </FadeIn>
      <EquationChip icon={<PlatesIcon size={54} color={P.accent2} />} value="12" label="min dishes" delay={44} />
      <FadeIn delay={60}>
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
            boxShadow: "0 40px 90px rgba(200, 90, 40, 0.3)",
          }}
        >
          42 MIN
        </div>
      </PopIn>
    </div>
    <Caption delay={64}>the dishes are part of dinner</Caption>
  </AbsoluteFill>
);

/* ---------------- 9. proof — estimate vs reality ---------------- */

const Dial: React.FC<{ label: string; time: string; delay: number; good?: boolean }> = ({
  label,
  time,
  delay,
  good,
}) => (
  <PopIn delay={delay} from={0.55}>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        padding: "40px 60px",
        background: P.panel,
        border: `2px solid ${good ? P.good : P.panelBorder}`,
        borderRadius: 26,
      }}
    >
      <Label size={30} color={P.sub}>
        {label}
      </Label>
      <TimerRing size={230} stroke={18} progress={0.86} color={good ? P.good : P.accent} track={P.soft}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 800, fontSize: 56, color: P.ink, fontVariantNumeric: "tabular-nums" }}>
          {time}
        </div>
      </TimerRing>
    </div>
  </PopIn>
);

const Proof: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 44 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
      <Dial label="estimate" time="52:00" delay={16} />
      <PopIn delay={122} from={0.3}>
        <Check size={130} color={P.good} delay={126} dur={10} />
      </PopIn>
      <Dial label="your kitchen" time="51:24" delay={74} good />
    </div>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <Caption delay={126}>an estimate you can actually plan around</Caption>
      <FadeIn delay={136}>
        <div style={{ fontFamily: FONTS.sans, fontWeight: 700, fontSize: 32, color: P.faint }}>
          36 seconds apart
        </div>
      </FadeIn>
    </div>
  </AbsoluteFill>
);

/* ---------------- 10. plan — evening timeline ---------------- */

const PlanBlock: React.FC<{
  left: string;
  width: string;
  label: string;
  color: string;
  textColor: string;
  delay: number;
}> = ({ left, width, label, color, textColor, delay }) => (
  <div style={{ position: "absolute", top: 0, bottom: 0, left, width }}>
    <GrowX delay={delay} dur={20}>
      <div
        style={{
          width: "100%",
          height: "100%",
          background: color,
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: textColor,
          fontFamily: FONTS.sans,
          fontWeight: 800,
          fontSize: 28,
          letterSpacing: "0.08em",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </GrowX>
  </div>
);

const Plan: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 64 }}>
    <RiseIn delay={6}>
      <Serif size={82}>Plan your evening around the truth.</Serif>
    </RiseIn>
    <div style={{ width: 1480 }}>
      <div style={{ position: "relative", width: "100%", height: 130 }}>
        <PlanBlock left="0%" width="19%" label="WORK" color={P.soft} textColor={P.sub} delay={18} />
        <PlanBlock left="20%" width="17%" label="COOK" color={P.accent} textColor={P.onAccent} delay={38} />
        <PlanBlock left="38%" width="21%" label="DINNER 7:22" color={P.accent2} textColor={P.onAccent} delay={58} />
        <PlanBlock left="60%" width="6%" label="" color={P.bad} textColor={P.onAccent} delay={74} />
        <PlanBlock left="67%" width="31%" label="YOUR EVENING" color={P.soft} textColor={P.sub} delay={86} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 18,
          fontFamily: FONTS.sans,
          fontWeight: 600,
          fontSize: 30,
          color: P.faint,
        }}
      >
        <span>5 PM</span>
        <span>6 PM</span>
        <span>7 PM</span>
        <span>8 PM</span>
        <span>9 PM</span>
      </div>
    </div>
  </AbsoluteFill>
);

/* ---------------- composition ---------------- */

const slots = buildTimeline(ThirtyMinuteLie);

const Scene: React.FC<{ id: string; dur: number }> = ({ id, dur }) => {
  switch (id) {
    case "hook":
      return <Hook dur={dur} />;
    case "notYou":
      return <NotYou />;
    case "why":
      return <Why />;
    case "reveal":
      return <Reveal />;
    case "three":
      return <Three />;
    case "cook":
      return <Cook dur={dur} />;
    case "learn":
      return <Learn />;
    case "total":
      return <Total />;
    case "proof":
      return <Proof />;
    case "plan":
      return <Plan />;
    case "cta":
      return <EndCard palette={P} tagline="Real time. Real cooking." taglineSerif />;
    default:
      return null;
  }
};

export const ThirtyMinuteLieComp: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: P.bg, fontFamily: FONTS.sans, color: P.ink }}>
    <Backdrop palette={P} />
    {slots.map((s) => (
      <Sequence key={s.def.id} from={s.start} durationInFrames={s.duration} layout="none" name={s.def.id}>
        <Scene id={s.def.id} dur={s.duration} />
        <SceneAudio adId="ThirtyMinuteLie" scene={s} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const TML_DURATION = totalFrames(ThirtyMinuteLie);
