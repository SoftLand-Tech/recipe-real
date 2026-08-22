import React from "react";

/**
 * Minimal line icons for the phone-screen mockups.
 * Stroke-based, round caps — matches the app's soft UI feel.
 */

type IconProps = { size?: number; color?: string; strokeWidth?: number };

const base = (size: number): React.CSSProperties => ({
  width: size,
  height: size,
  display: "block",
});

export const IconHome: React.FC<IconProps> = ({ size = 22, color = "#756B66", strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path d="M4 11.5 12 4l8 7.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 10.5V20h12v-9.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconCompass: React.FC<IconProps> = ({ size = 22, color = "#756B66", strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <circle cx="12" cy="12" r="8.4" stroke={color} strokeWidth={strokeWidth} />
    <path d="M14.8 9.2l-1.6 4.4-4.4 1.6 1.6-4.4z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" fill={color} fillOpacity={0.15} />
  </svg>
);

export const IconUsers: React.FC<IconProps> = ({ size = 22, color = "#756B66", strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <circle cx="9" cy="9" r="3.2" stroke={color} strokeWidth={strokeWidth} />
    <path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M15.5 6.4a3 3 0 0 1 0 5.5M17.5 14.6c2 .5 3.2 1.9 3.7 4.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

export const IconUser: React.FC<IconProps> = ({ size = 22, color = "#756B66", strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <circle cx="12" cy="8.6" r="3.4" stroke={color} strokeWidth={strokeWidth} />
    <path d="M5.5 19.5c.7-3.4 3.2-5.1 6.5-5.1s5.8 1.7 6.5 5.1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

export const IconSearch: React.FC<IconProps> = ({ size = 18, color = "#9C938E", strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={strokeWidth} />
    <path d="m15.5 15.5 4.5 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

export const IconClock: React.FC<IconProps> = ({ size = 13, color = "#756B66", strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} />
    <path d="M12 7.5V12l3 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconHeart: React.FC<IconProps> = ({ size = 17, color = "#756B66", strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path
      d="M12 20s-7.5-4.6-7.5-9.4C4.5 7.6 6.6 5.7 9 5.7c1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.4 0 4.5 1.9 4.5 4.9C19.5 15.4 12 20 12 20z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </svg>
);

export const IconHeartFill: React.FC<IconProps> = ({ size = 17, color = "#D9534F" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <path d="M12 20s-7.5-4.6-7.5-9.4C4.5 7.6 6.6 5.7 9 5.7c1.3 0 2.4.6 3 1.6.6-1 1.7-1.6 3-1.6 2.4 0 4.5 1.9 4.5 4.9C19.5 15.4 12 20 12 20z" />
  </svg>
);

export const IconComment: React.FC<IconProps> = ({ size = 17, color = "#756B66", strokeWidth = 1.8 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4 3.5V16H7a2.5 2.5 0 0 1-2.5-2.5z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
  </svg>
);

export const IconStar: React.FC<{ size?: number; color?: string }> = ({ size = 13, color = "#D69A2D" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.5l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
  </svg>
);

export const IconBell: React.FC<IconProps> = ({ size = 14, color = "#8A5A12", strokeWidth = 2 }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path d="M6 16v-5.5a6 6 0 0 1 12 0V16l1.5 2.5h-15z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

export const IconPlay: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = "#FAF8F5" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <path d="M8 5.5v13l10-6.5z" />
  </svg>
);

export const IconPause: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = "#FAF8F5" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <rect x="7" y="5.5" width="3.4" height="13" rx="1.2" />
    <rect x="13.6" y="5.5" width="3.4" height="13" rx="1.2" />
  </svg>
);

export const IconApple: React.FC<{ size?: number; color?: string }> = ({ size = 26, color = "#F3EDE6" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <path d="M16.7 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.5-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.6 0-3 .9-3.8 2.3-1.6 2.8-.4 6.9 1.2 9.2.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.7.7 2.9.7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.4-.9-2.4-3.7zM14.4 5.9c.6-.8 1-1.8.9-2.9-.9.1-2 .6-2.7 1.4-.6.7-1 1.8-.9 2.8 1 .1 2-.5 2.7-1.3z" />
  </svg>
);

export const IconPlayStore: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = "#F3EDE6" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path d="M4.5 3.7v16.6c0 .4.4.6.7.4l9.3-8.1-9.3-9.3c-.3-.2-.7 0-.7.4z" fill={color} />
    <path d="M17 8.6 6.7 3.2 16.5 13l2.3-2.7c.3-.4.2-.9-.2-1.1z" fill={color} opacity={0.85} />
    <path d="M6.7 20.8 17 15.4c.4-.2.5-.7.2-1.1L16.5 13 6.7 21.2c.3.2.7.1 1-.1z" fill={color} opacity={0.7} />
    <path d="M6.7 3.2 16.5 13 6.7 21.2" stroke={color} strokeWidth={0} />
  </svg>
);

export const IconFlame: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = "#287C78" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <path d="M12 2.8c.5 2.9-.7 4.6-2.2 6.1-1.6 1.6-3.3 3.2-3.3 6.1a5.5 5.5 0 0 0 11 0c0-1.9-.8-3.2-1.8-4.4-.3 1-1 1.8-2 2.1.4-2.5-.5-5.4-1.7-9.9z" />
  </svg>
);

export const IconCheck: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = "#F3EDE6" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path d="M5 12.8l4.4 4.4L19 7.6" stroke={color} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconBubbles: React.FC<{ size?: number; color?: string }> = ({ size = 15, color = "#6A4A78" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill={color}>
    <circle cx="9" cy="13.5" r="4.6" opacity={0.9} />
    <circle cx="16.6" cy="8.6" r="2.7" opacity={0.7} />
    <circle cx="16.2" cy="16.4" r="1.9" opacity={0.55} />
  </svg>
);

export const IconPot: React.FC<{ size?: number; color?: string }> = ({ size = 17, color = "#211A17" }) => (
  <svg viewBox="0 0 24 24" style={base(size)} fill="none">
    <path d="M5 11h14v5.2a3.4 3.4 0 0 1-3.4 3.4H8.4A3.4 3.4 0 0 1 5 16.2z" stroke={color} strokeWidth={1.9} strokeLinejoin="round" />
    <path d="M3.2 11h17.6M9 7.2c0-1 .9-1.2.9-2.2M13 7.2c0-1 .9-1.2.9-2.2" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  </svg>
);
