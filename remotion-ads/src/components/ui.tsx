import React from "react";
import { Img, staticFile } from "remotion";
import { C, FOODS, MEMBERS, type Food } from "../theme";
import { IconClock, IconComment, IconHeart, IconHeartFill, IconHome, IconCompass, IconStar, IconUser, IconUsers } from "./icons";

/**
 * Light-UI primitives that mirror the real app (mobile/src/theme/tokens.ts):
 * cream cards, soft shadows, terracotta accents, warm secondary ink.
 */

export const RatingRow: React.FC<{ rating: number; minutes: number; inkDim?: string; fontScale?: number }> = ({
  rating,
  minutes,
  inkDim = C.inkSecondary,
  fontScale = 1,
}) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, color: inkDim, fontFamily: "Manrope, sans-serif" }}>
    <IconStar size={13 * fontScale} />
    <span style={{ fontSize: 13 * fontScale, fontWeight: 700, color: C.ink }}>{rating.toFixed(1)}</span>
    <span style={{ opacity: 0.45 }}>·</span>
    <IconClock size={13 * fontScale} color={inkDim} />
    <span style={{ fontSize: 13 * fontScale, fontWeight: 600 }}>
      {minutes >= 60 ? `${Math.round(minutes / 60)} hr` : `${minutes} min`}
    </span>
  </div>
);

/** Vertical recipe card — the browse-screen staple. */
export const RecipeCard: React.FC<{
  food: Food;
  width: number;
  fontScale?: number;
}> = ({ food, width, fontScale = 1 }) => (
  <div
    style={{
      width,
      backgroundColor: C.surface,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: `0 22px 54px ${C.stageDeep}b0, 0 0 0 1px ${C.hairline}`,
      display: "flex",
      flexDirection: "column",
    }}
  >
    <Img src={staticFile(`food/${food.file}`)} style={{ width, height: width * 0.75, objectFit: "cover" }} />
    <div style={{ padding: 12 * fontScale, display: "flex", flexDirection: "column", gap: 7 * fontScale }}>
      <div
        style={{
          fontFamily: "Manrope, sans-serif",
          fontSize: 14.5 * fontScale,
          fontWeight: 700,
          color: C.ink,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {food.title}
      </div>
      <RatingRow rating={food.rating} minutes={food.minutes} fontScale={fontScale} />
    </div>
  </div>
);

/** Avatar circle with warm initial. */
export const Avatar: React.FC<{ name: string; color?: string; size?: number; ring?: boolean }> = ({
  name,
  color = C.accent,
  size = 34,
  ring = false,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      backgroundColor: color,
      color: C.cream,
      fontFamily: "Manrope, sans-serif",
      fontWeight: 800,
      fontSize: size * 0.42,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: ring ? `0 0 0 3px ${C.stage}, 0 0 0 5px ${color}66` : undefined,
    }}
  >
    {name[0]}
  </div>
);

/** Community post card — avatar, name, photo, like/comment row. */
export const PostCard: React.FC<{
  member: (typeof MEMBERS)[number];
  food: Food;
  width: number;
  likes: number;
  comments: number;
  liked?: boolean;
}> = ({ member, food, width, likes, comments, liked = false }) => (
  <div
    style={{
      width,
      backgroundColor: C.surface,
      borderRadius: 18,
      overflow: "hidden",
      boxShadow: `0 22px 54px ${C.stageDeep}b0, 0 0 0 1px ${C.hairline}`,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 13px" }}>
      <Avatar name={member.name} color={member.color} size={28} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 13.5, fontWeight: 800, color: C.ink }}>
          {member.name}
        </span>
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 10.5, fontWeight: 600, color: C.inkFaint }}>
          cooked {food.title}
        </span>
      </div>
      <div
        style={{
          marginLeft: "auto",
          fontFamily: "Manrope, sans-serif",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.5,
          color: C.success,
          backgroundColor: "#E3EFE8",
          borderRadius: 999,
          padding: "3px 8px",
        }}
      >
        MADEDAY
      </div>
    </div>
    <Img src={staticFile(`food/${food.file}`)} style={{ width, height: width * 0.66, objectFit: "cover" }} />
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 13px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {liked ? <IconHeartFill size={16} /> : <IconHeart size={16} />}
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12.5, fontWeight: 700, color: C.inkSecondary }}>
          {likes}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <IconComment size={15} />
        <span style={{ fontFamily: "Manrope, sans-serif", fontSize: 12.5, fontWeight: 700, color: C.inkSecondary }}>
          {comments}
        </span>
      </div>
    </div>
  </div>
);

/** Cook-screen step badge — app StepTone colors. */
export const StepBadge: React.FC<{ label: string; tone: "active" | "passive" | "cleanup" }> = ({ label, tone }) => {
  const tones = {
    active: C.stepActive,
    passive: C.stepPassive,
    cleanup: C.stepCleanup,
  } as const;
  const t = tones[tone];
  return (
    <div
      style={{
        backgroundColor: t.bg,
        color: t.fg,
        fontFamily: "Manrope, sans-serif",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 1,
        borderRadius: 8,
        padding: "5px 10px",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
};

/** Bottom tab bar — Home, Explore, Community, Profile. */
export const TabBar: React.FC<{ active: 0 | 1 | 2 | 3; width: number }> = ({ active, width }) => {
  const tabs = [
    { label: "Home", icon: <IconHome size={21} color={active === 0 ? C.accent : C.inkFaint} /> },
    { label: "Explore", icon: <IconCompass size={21} color={active === 1 ? C.accent : C.inkFaint} /> },
    { label: "Community", icon: <IconUsers size={21} color={active === 2 ? C.accent : C.inkFaint} /> },
    { label: "Profile", icon: <IconUser size={21} color={active === 3 ? C.accent : C.inkFaint} /> },
  ];
  return (
    <div
      style={{
        width,
        height: 56,
        backgroundColor: C.canvas,
        borderTop: `1px solid ${C.hairline}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        paddingTop: 4,
      }}
    >
      {tabs.map((t) => (
        <div key={t.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          {t.icon}
          <span
            style={{
              fontFamily: "Manrope, sans-serif",
              fontSize: 9.5,
              fontWeight: 700,
              color: t.label === tabs[active].label ? C.accent : C.inkFaint,
            }}
          >
            {t.label}
          </span>
        </div>
      ))}
    </div>
  );
};

/** Convenience: card + food pairs for grids. */
export const pickFoods = (indices: number[]): Food[] => indices.map((i) => FOODS[i % FOODS.length]);
