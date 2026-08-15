// ACT 1 · HOOK — signal bars dying → NO SIGNAL slam → dinner was there all along.
import {FC} from 'react';
import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {
  CREAM,
  CREAM_DIM,
  FONT_DISPLAY,
  FONT_UI,
  Kicker,
  LOC,
  NoServiceIcon,
  Plate,
  SAFE,
  SceneBg,
  Scanlines,
  SignalIcon,
  Steam,
  TERRA,
  Vignette,
  clampIn,
  easeOut,
} from './ui';
import {KitchenBg} from './backdrops';

/* s01 — four bars, tallest dies first, blue creeps in. */
export const S01: FC = () => {
  const frame = useCurrentFrame();
  const tint = interpolate(frame, [0, 20], [0, 0.4], clampIn);
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: LOC.subway.a, opacity: tint}} />
      <div style={{position: 'absolute', left: 220, top: 330}}>
        <SignalIcon alive={4} dyingAt={5} size={340} />
      </div>
      <div style={{position: 'absolute', left: 220, top: 760, fontFamily: FONT_UI, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: CREAM}}>
        4 BARS
        <span style={{color: TERRA}}>{'  →  3'}</span>
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="SIGNAL CHECK" />
      </div>
      <Vignette />
    </>
  );
};

/* s02 — two more bars flicker out with glitch jitter. */
export const S02: FC = () => {
  const frame = useCurrentFrame();
  const glitch = random1(frame);
  const tint = interpolate(frame, [0, 22], [0.4, 0.62], clampIn);
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: LOC.subway.a, opacity: tint}} />
      <div
        style={{
          position: 'absolute',
          left: 220,
          top: 330,
          translate: `${glitch * 8}px ${glitch * 4}px`,
        }}
      >
        <SignalIcon alive={3} dyingAt={4} size={340} wobble />
      </div>
      <div style={{position: 'absolute', left: 220, top: 760, fontFamily: FONT_UI, fontWeight: 700, fontSize: 40, letterSpacing: 6, color: CREAM}}>
        3 BARS
        <span style={{color: TERRA}}>{'  →  2'}</span>
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="STILL DROPPING" />
      </div>
      {frame > 14 && <Scanlines opacity={0.08} />}
      <Vignette />
    </>
  );
};

const random1 = (f: number) => Math.sin(f * 2.7) * 0.5 + 0.5;

/* s03 — last bar flatlines to the zero-bar icon. (SFX-only punch) */
export const S03: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: LOC.subway.a, opacity: 0.62}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center'}}>
        <SignalIcon alive={1} dyingAt={5} size={340} tiltOff />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
          display: 'flex',
          justifyContent: 'center',
          opacity: interpolate(frame, [9, 16], [0, 1], {...clampIn, easing: easeOut}),
        }}
      >
        <NoServiceIcon size={230} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 660,
          textAlign: 'center',
          fontFamily: FONT_UI,
          fontWeight: 500,
          fontSize: 44,
          letterSpacing: 10,
          color: CREAM_DIM,
          opacity: interpolate(frame, [10, 18], [0, 0.6 + Math.abs(Math.sin(frame * 0.5)) * 0.4], clampIn),
        }}
      >
        SEARCHING…
      </div>
      <Vignette />
    </>
  );
};

/* s04 — HARD SLAM "NO SIGNAL". (SFX-only punch) */
export const S04: FC = () => {
  const frame = useCurrentFrame();
  const shudder = frame < 10 ? Math.sin(frame * 4.2) * 10 * (1 - frame / 10) : 0;
  const text = 'NO SIGNAL';
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: LOC.subway.b, opacity: 0.88}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 360,
          textAlign: 'center',
          fontFamily: FONT_DISPLAY,
          fontSize: 330,
          lineHeight: 1,
          letterSpacing: 10,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{position: 'absolute', left: 0, right: 0, color: TERRA, translate: `${-8 + shudder}px 5px`, opacity: 0.85}}>{text}</span>
        <span style={{position: 'absolute', left: 0, right: 0, color: LOC.subway.accent, translate: `${8 - shudder}px -5px`, opacity: 0.7}}>{text}</span>
        <span style={{position: 'relative', color: CREAM, translate: `${shudder}px 0`}}>{text}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 730,
          translate: '-50% 0',
          width: interpolate(frame, [2, 14], [0, 900], {...clampIn, easing: easeOut}),
          height: 14,
          backgroundColor: TERRA,
        }}
      />
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="EVERYWHERE, APPARENTLY" />
      </div>
      <Scanlines opacity={0.14} />
      <Vignette strength={0.7} />
    </>
  );
};

/* s05 — push wide: the plated dinner was there all along. */
export const S05: FC = () => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();
  const push = interpolate(frame, [0, durationInFrames], [1.3, 1], {...clampIn, easing: Easing.bezier(0.3, 1, 0.3, 1)});
  return (
    <div style={{position: 'absolute', inset: 0, scale: `${push}`, transformOrigin: '50% 55%'}}>
      <KitchenBg />
      {/* the dead phone, propped against a glass */}
      <div
        style={{
          position: 'absolute',
          right: 340,
          top: 300,
          rotate: '9deg',
          opacity: interpolate(frame, [0, 8], [0.6, 1], clampIn),
        }}
      >
        <NoServiceIcon size={150} color={CREAM_DIM} />
      </div>
      {/* dinner, unbothered */}
      <div style={{position: 'absolute', left: '50%', top: 560, translate: '-50% 0'}}>
        <Plate size={560} />
        <Steam x={200} y={-160} scale={1.4} spread={1.4} />
      </div>
      <div style={{position: 'absolute', left: '50%', top: 360, translate: '-50% 0'}}>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 150,
            color: CREAM,
            letterSpacing: 4,
            opacity: interpolate(frame, [4, 12], [0, 1], clampIn),
          }}
        >
          DINNER&apos;S STILL ON
        </div>
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="RECIPE REAL · COOK MODE" color={TERRA} />
      </div>
      <Vignette />
    </div>
  );
};
