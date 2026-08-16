import React from "react";

/** Phone-style device frame with a screen for UI mockups. */
export const Phone: React.FC<{
  width?: number;
  bezel?: string;
  screenBg: string;
  rotateDeg?: number;
  children: React.ReactNode;
}> = ({ width = 400, bezel = "#17100B", screenBg, rotateDeg = 0, children }) => {
  const height = Math.round(width * 2.05);
  return (
    <div
      style={{
        width,
        height,
        background: bezel,
        borderRadius: width * 0.14,
        padding: width * 0.028,
        boxShadow: "0 60px 120px rgba(30, 15, 5, 0.35)",
        rotate: `${rotateDeg}deg`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: screenBg,
          borderRadius: width * 0.115,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};
