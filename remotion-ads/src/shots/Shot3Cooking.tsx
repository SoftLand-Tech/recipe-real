import React from "react";
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, EASE } from "../theme";
import { KenBurnsPhoto, Stage } from "../components/Stage";
import { WordReveal, PopChip } from "../components/WordReveal";
import { CookScreen, PhoneFrame } from "../components/phone";
import { StepBadge } from "../components/ui";
import { IconBell, IconBubbles, IconCheck, IconClock, IconFlame } from "../components/icons";

/**
 * Shot 3 — cooking timing. Reference moves: full-bleed photo with Ken Burns and
 * a word-sliding headline, hard cut to a tilted phone close-up with floating
 * chips popping around it, and a glowing highlight on the feature that matters.
 * Mid-shot, the step advances — dots fill, the badge flips active → passive.
 */

const STEP_AT = 310; // frame where step 3 → 4

const StepFlowRow: React.FC<{
  label: string;
  meta: string;
  tone: "active" | "passive" | "cleanup";
  state: "done" | "now" | "next";
  delay: number;
}> = ({ label, meta, tone, state, delay }) => {
  const frame = useCurrentFrame();
  const inProg = interpolate(frame, [delay, delay + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const nowPulse = state === "now" ? 1 + Math.sin(frame / 9) * 0.012 : 1;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "15px 18px",
        borderRadius: 16,
        backgroundColor: state === "now" ? C.surface : C.stageLift,
        boxShadow: state === "now" ? `0 0 0 2px ${C.timingBright}, 0 24px 54px ${C.stageDeep}d0` : `0 0 0 1px ${C.hairline}22`,
        opacity: (state === "next" ? 0.55 : 1) * inProg,
        translateX: (1 - inProg) * 46,
        scale: `${nowPulse}`,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          backgroundColor: state === "done" ? C.timing : state === "now" ? C.timingSoft : C.surfaceSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: state === "done" ? C.cream : C.timing,
          fontWeight: 800,
          fontSize: 15,
          fontFamily: "Manrope, sans-serif",
        }}
      >
        {state === "done" ? <IconCheck size={14} color={C.cream} /> : tone === "passive" ? <IconClock size={15} color={C.timing} /> : tone === "cleanup" ? <IconBubbles size={15} /> : <IconFlame size={15} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 17.5, fontWeight: 800, color: state === "now" ? C.ink : C.cream }}>
          {label}
        </span>
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 600, color: state === "now" ? C.inkSecondary : C.creamFaint }}>
          {meta}
        </span>
      </div>
      <div style={{ marginLeft: "auto" }}>
        <StepBadge label={tone} tone={tone} />
      </div>
    </div>
  );
};

export const Shot3Cooking: React.FC = () => {
  const frame = useCurrentFrame();
  const introDur = 92;

  // ---- Part B timing state ----
  const bFrame = frame - introDur;
  const elapsed = 192 + bFrame; // stopwatch starts at 3:12 and runs
  const stepAdvanced = bFrame >= STEP_AT - introDur;
  const ringProgress = interpolate(bFrame, [0, 370], [0.3, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.inOut,
  });

  const phoneIn = interpolate(bFrame, [0, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });

  // Glow highlight ring around the phone timer — draws attention, pulses.
  const ringDraw = interpolate(bFrame, [56, 96], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const ringPulse = 1 + Math.sin(bFrame / 11) * 0.02;

  return (
    <AbsoluteFill>
      {frame < introDur ? (
        /* ---- Part A: full-bleed photo moment ---- */
        <AbsoluteFill>
          <KenBurnsPhoto src={staticFile("food/biryani.jpg")} fromScale={1.1} toScale={1.24} driftX={-36} />
          <div style={{ position: "absolute", left: 96, bottom: 130, right: 96 }}>
            <WordReveal text="Cooking mode," accentWords={["Cooking"]} accentColor={C.timingBright} delay={4} fontSize={86} />
            <WordReveal text="timed for real." delay={14} fontSize={86} color={C.creamDim} />
            <div
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 24,
                fontWeight: 600,
                color: C.creamDim,
                paddingTop: 20,
                opacity: interpolate(frame, [34, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
                translateY: interpolate(frame, [34, 60], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.outExpo }),
              }}
            >
              One step on screen. The clock — and the alarms — run themselves.
            </div>
          </div>
        </AbsoluteFill>
      ) : (
        /* ---- Part B: cook-screen close-up ---- */
        <AbsoluteFill>
          <Stage seed={21} glow={C.timingBright} />

          {/* small label */}
          <div style={{ position: "absolute", left: 96, top: 96 }}>
            <div
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: C.timingBright,
                opacity: interpolate(bFrame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              }}
            >
              Cooking timing
            </div>
            <WordReveal
              text={stepAdvanced ? "Passive? Walk away." : "It keeps time for you."}
              accentWords={stepAdvanced ? ["Passive?"] : ["time"]}
              accentColor={C.timingBright}
              delay={4}
              fontSize={56}
              style={{ paddingTop: 12 }}
            />
          </div>

          {/* phone center-left, gentle tilt */}
          <div style={{ position: "absolute", left: 210, top: 150, perspective: 2100 }}>
            <div
              style={{
                rotateY: `${-16 + phoneIn * 9}deg`,
                rotateX: "-2deg",
                translateX: (1 - phoneIn) * -80,
                opacity: phoneIn,
              }}
            >
              <PhoneFrame scale={0.97}>
                <CookScreen
                  elapsedSeconds={elapsed}
                  ringProgress={ringProgress}
                  step={stepAdvanced ? 4 : 3}
                  totalSteps={8}
                  stepType={stepAdvanced ? "passive" : "active"}
                  description={
                    stepAdvanced
                      ? "Transfer to the oven and let it bake — the alarm will call you back."
                      : "Simmer the sauce, stirring now and then, until it thickens and coats the spoon."
                  }
                  alarmMinutes={stepAdvanced ? 25 : null}
                  running
                />
              </PhoneFrame>

              {/* glowing highlight around the timer zone */}
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  top: 218,
                  width: 294,
                  height: 258,
                  borderRadius: 150,
                  border: `3px solid ${C.timingBright}`,
                  boxShadow: `0 0 34px ${C.timingBright}66, inset 0 0 30px ${C.timingBright}22`,
                  opacity: ringDraw * (0.65 + Math.sin(bFrame / 11) * 0.2),
                  scale: `${ringPulse}`,
                }}
              />
            </div>
          </div>

          {/* step flow, right side */}
          <div style={{ position: "absolute", left: 950, top: 210, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
            <StepFlowRow
              label="Simmer the sauce"
              meta={stepAdvanced ? "done · 6 min" : "running · stopwatch on"}
              tone="active"
              state={stepAdvanced ? "done" : "now"}
              delay={26}
            />
            <StepFlowRow
              label="Bake in the oven"
              meta={stepAdvanced ? "alarm set · 25 min" : "up next · alarm ready"}
              tone="passive"
              state={stepAdvanced ? "now" : "next"}
              delay={44}
            />
            <StepFlowRow label="Rest & plate" meta="after that" tone="cleanup" state="next" delay={62} />
          </div>

          {/* chips, bottom right */}
          <div style={{ position: "absolute", left: 950, bottom: 118, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <PopChip
              delay={stepAdvanced ? STEP_AT - introDur + 6 : 9999}
              icon={<IconBell size={16} color="#8A5A12" />}
              label="Alarm set · 25 min"
              bgColor={C.amberSoft}
              fgColor="#8A5A12"
            />
            <PopChip delay={110} icon={<IconClock size={15} color="#1E5A56" />} label="Honest times" bgColor={C.timingSoft} fgColor="#1E5A56" />
            <PopChip delay={124} label="Active vs passive steps" />
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
