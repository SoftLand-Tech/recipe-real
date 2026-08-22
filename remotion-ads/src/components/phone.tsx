import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, EASE, FOODS, MEMBERS, formatMSS } from "../theme";
import { IconBell, IconPause, IconSearch, IconStar } from "./icons";
import { Avatar, PostCard, RatingRow, RecipeCard, StepBadge, TabBar } from "./ui";

/**
 * Phone mockup + the three app screens used in the ad:
 * browse (library), cook mode (timing), community (feed).
 * Screen content scrolls with the timeline — everything frame-driven.
 */

export const PHONE_W = 330;
export const PHONE_H = 690;

export const PhoneFrame: React.FC<{ children: React.ReactNode; scale?: number }> = ({ children, scale = 1 }) => (
  <div
    style={{
      width: PHONE_W,
      height: PHONE_H,
      borderRadius: 52,
      backgroundColor: "#211C17",
      padding: 11,
      boxShadow: `0 0 0 2px #38302a, 0 60px 130px ${C.stageDeep}f0, 0 24px 60px ${C.stageDeep}90`,
      position: "relative",
      scale: `${scale}`,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 42,
        overflow: "hidden",
        backgroundColor: C.canvas,
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* status bar */}
      <div
        style={{
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 22px",
          fontFamily: "Manrope, sans-serif",
          fontWeight: 800,
          fontSize: 12.5,
          color: C.ink,
          flexShrink: 0,
        }}
      >
        <span>9:41</span>
        {/* dynamic island */}
        <div style={{ position: "absolute", left: "50%", top: 9, translate: "-50% 0", width: 92, height: 24, borderRadius: 999, backgroundColor: "#211C17" }} />
        <span style={{ display: "flex", gap: 5, alignItems: "center" }}>
          {/* signal */}
          <span style={{ display: "inline-flex", gap: 1.5, alignItems: "flex-end", height: 10 }}>
            {[4, 6, 8, 10].map((h) => (
              <span key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: C.ink, display: "inline-block" }} />
            ))}
          </span>
          {/* wifi */}
          <svg viewBox="0 0 24 24" style={{ width: 13, height: 13 }}>
            <path d="M12 18.5l-3.2-3.4a4.6 4.6 0 0 1 6.4 0z" fill={C.ink} />
            <path d="M6.2 12.2a8.4 8.4 0 0 1 11.6 0" stroke={C.ink} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </svg>
          {/* battery */}
          <span style={{ width: 21, height: 11, borderRadius: 3, border: `1.5px solid ${C.ink}`, display: "inline-block", position: "relative" }}>
            <span style={{ position: "absolute", inset: 1.5, right: 6, backgroundColor: C.ink, borderRadius: 1 }} />
            <span style={{ position: "absolute", right: -3.5, top: 3, width: 2, height: 4.5, borderRadius: 1, backgroundColor: C.ink }} />
          </span>
        </span>
      </div>
      {children}
      {/* home indicator */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          left: "50%",
          translate: "-50% 0",
          width: 110,
          height: 4.5,
          borderRadius: 999,
          backgroundColor: C.ink,
          opacity: 0.35,
        }}
      />
    </div>
  </div>
);

/** Browse screen — brand chip header, search, category chips, recipe rails. */
export const BrowseScreen: React.FC<{ scroll?: number }> = ({ scroll = 0 }) => {
  const rail1 = [FOODS[0], FOODS[3], FOODS[5], FOODS[6]];
  const rail2 = [FOODS[8], FOODS[1], FOODS[9], FOODS[2]];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: C.canvas, overflow: "hidden" }}>
      <div style={{ paddingTop: 6, paddingBottom: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 16px" }}>
          <Img src={staticFile("logo-glow.png")} style={{ width: 30, height: 30, borderRadius: 8 }} />
          <span style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 17.5, color: C.ink, letterSpacing: -0.3 }}>
            RecipeReal
          </span>
          <div style={{ marginLeft: "auto" }}>
            <IconBell size={17} color={C.inkSecondary} />
          </div>
        </div>
        <div
          style={{
            margin: "10px 16px 0",
            height: 38,
            borderRadius: 999,
            backgroundColor: C.surfaceSoft,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 14px",
          }}
        >
          <IconSearch size={15} />
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 13, fontWeight: 600, color: C.inkFaint }}>
            Search 20,000+ recipes…
          </span>
        </div>
        <div style={{ display: "flex", gap: 7, padding: "10px 16px 0" }}>
          {["All", "Dinner", "Dessert", "Quick"].map((chip, i) => (
            <div
              key={chip}
              style={{
                padding: "6px 13px",
                borderRadius: 999,
                backgroundColor: i === 0 ? C.accent : C.surfaceSoft,
                color: i === 0 ? C.cream : C.inkSecondary,
                fontFamily: "Manrope, sans-serif",
                fontSize: 11.5,
                fontWeight: 800,
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 12, padding: "6px 16px 0", translateY: -scroll }}>
          {[rail1, rail2].map((rail, railIndex) => (
            <div key={railIndex}>
              <div
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: C.inkFaint,
                  textTransform: "uppercase",
                  padding: "4px 2px 8px",
                }}
              >
                {railIndex === 0 ? "Trending this week" : "Quick dinners"}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {rail.map((food) => (
                  <div key={food.file} style={{ flex: 1 }}>
                    <Img src={staticFile(`food/${food.file}`)} style={{ width: "100%", height: 84, objectFit: "cover", borderRadius: 12 }} />
                    <div style={{ fontFamily: "Manrope, sans-serif", fontSize: 11.5, fontWeight: 700, color: C.ink, padding: "6px 1px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {food.title}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 2 }}>
                      <IconStar size={10} />
                      <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 10.5, fontWeight: 700, color: C.inkSecondary }}>
                        {food.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* scroll fade */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 30, background: `linear-gradient(${C.canvas}00, ${C.canvas})` }} />
      </div>
      <TabBar active={0} width={PHONE_W - 22} />
    </div>
  );
};

/** Cook screen — the app's focused cooking mode with the stopwatch. */
export const CookScreen: React.FC<{
  /** Elapsed seconds to show on the stopwatch. */
  elapsedSeconds: number;
  /** 0..1 progress for the teal ring. */
  ringProgress: number;
  step: number;
  totalSteps: number;
  description: string;
  stepType: "active" | "passive";
  alarmMinutes: number | null;
  running: boolean;
}> = ({ elapsedSeconds, ringProgress, step, totalSteps, description, stepType, alarmMinutes, running }) => {
  const R = 86;
  const circumference = 2 * Math.PI * R;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: C.canvas, overflow: "hidden" }}>
      {/* header: close + step of */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px 0", flexShrink: 0 }}>
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 15, fontWeight: 600, color: C.inkSecondary }}>×</span>
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: 1.4, color: C.inkFaint }}>
          STEP {step} OF {totalSteps}
        </span>
        <span style={{ width: 15 }} />
      </div>
      {/* step dots */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", padding: "14px 0 4px", flexShrink: 0 }}>
        {new Array(totalSteps).fill(0).map((_, i) => (
          <div
            key={i}
            style={{
              width: i === step - 1 ? 20 : 7,
              height: 7,
              borderRadius: 999,
              backgroundColor: i < step ? C.timing : i === step - 1 ? C.timing : C.hairlineStrong,
            }}
          />
        ))}
      </div>
      {/* timer block */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0 0" }}>
        <div style={{ position: "relative", width: 200, height: 200 }}>
          <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, rotate: "-90deg" }}>
            <circle cx="100" cy="100" r={R} fill="none" stroke={C.timingSoft} strokeWidth="9" />
            <circle
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={C.timing}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ringProgress)}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span
              style={{
                fontFamily: "Manrope, sans-serif",
                fontSize: 44,
                fontWeight: 800,
                color: running ? C.ink : C.inkSecondary,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: 1,
                lineHeight: 1,
              }}
            >
              {formatMSS(elapsedSeconds)}
            </span>
            <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 10.5, fontWeight: 700, color: C.inkFaint, paddingTop: 7 }}>
              {running ? "TIMER IS RUNNING" : "PAUSED"}
            </span>
          </div>
        </div>
      </div>
      {/* badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", padding: "14px 18px 0", flexShrink: 0 }}>
        <StepBadge label={stepType} tone={stepType} />
        {alarmMinutes ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              backgroundColor: C.amberSoft,
              color: "#8A5A12",
              fontFamily: "Manrope, sans-serif",
              fontSize: 11,
              fontWeight: 800,
              borderRadius: 8,
              padding: "5px 10px",
            }}
          >
            <IconBell size={12} />
            {alarmMinutes} min
          </div>
        ) : null}
      </div>
      {/* step description card */}
      <div style={{ padding: "14px 18px 0" }}>
        <div
          style={{
            backgroundColor: C.surface,
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: `0 10px 24px #3A2A1F12, 0 0 0 1px ${C.hairline}`,
          }}
        >
          <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 13.5, fontWeight: 600, color: C.ink, lineHeight: 1.45 }}>
            {description}
          </span>
        </div>
      </div>
      {/* footer button */}
      <div style={{ marginTop: "auto", padding: "0 18px 14px" }}>
        <div
          style={{
            height: 46,
            borderRadius: 999,
            backgroundColor: running ? C.surfaceSoft : C.accent,
            color: running ? C.ink : C.cream,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontFamily: "Manrope, sans-serif",
            fontSize: 15,
            fontWeight: 800,
            boxShadow: running ? "none" : `0 12px 26px ${C.accent}55`,
          }}
        >
          {running ? (
            <>
              <IconPause size={14} color={C.ink} />
              Pause
            </>
          ) : (
            "Start cooking"
          )}
        </div>
      </div>
    </div>
  );
};

/** Community screen — feed of cooks sharing what they made. */
export const CommunityScreen: React.FC<{ scroll?: number }> = ({ scroll = 0 }) => {
  const posts = [
    { member: MEMBERS[0], food: FOODS[1], likes: 214, comments: 31, liked: true },
    { member: MEMBERS[1], food: FOODS[6], likes: 168, comments: 22 },
    { member: MEMBERS[2], food: FOODS[4], likes: 96, comments: 14 },
  ];
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: C.canvas, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 16px 8px", flexShrink: 0 }}>
        <span style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 19, color: C.ink }}>Community</span>
        <div style={{ display: "flex" }}>
          {MEMBERS.slice(0, 3).map((m, i) => (
            <div key={m.name} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <Avatar name={m.name} color={m.color} size={26} ring />
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 12, padding: "2px 14px", translateY: -scroll }}>
          {posts.map((p) => (
            <PostCard key={p.food.file} {...p} width={280} />
          ))}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 26, background: `linear-gradient(${C.canvas}00, ${C.canvas})` }} />
      </div>
      <TabBar active={2} width={PHONE_W - 22} />
    </div>
  );
};

/** A free-floating recipe card with gentle idle drift — for shots 2 and 4. */
export const FloatingRecipeCard: React.FC<{ food: (typeof FOODS)[number]; width: number; x: number; y: number; delay: number; hoverPhase: number }> = ({
  food,
  width,
  x,
  y,
  delay,
  hoverPhase,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [delay, delay + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.outExpo,
  });
  const hover = Math.sin(frame / 46 + hoverPhase) * 9;
  const hoverX = Math.cos(frame / 58 + hoverPhase) * 5;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        translateY: (1 - enter) * 90 + hover,
        translateX: (1 - enter) * -40 + hoverX,
        rotate: `${(1 - enter) * -9 + Math.sin(frame / 66 + hoverPhase) * 1.6}deg`,
        opacity: enter,
        scale: `${0.86 + enter * 0.14}`,
      }}
    >
      <RecipeCard food={food} width={width} />
    </div>
  );
};

/** Small helper reused by shots for the rating row alone. */
export const CardRatingRow = RatingRow;
