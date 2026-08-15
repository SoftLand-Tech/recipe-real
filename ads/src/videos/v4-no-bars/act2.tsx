// ACT 2 · LOCATION MONTAGE 1 — subway / summit / bunker. Timer stays calm.
import {FC} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {
  CREAM,
  CREAM_DIM,
  FONT_DISPLAY,
  FONT_UI,
  HandNote,
  Kicker,
  LOC,
  PhoneShell,
  Pot,
  SAFE,
  SceneBg,
  SignalIcon,
  SlamTitle,
  Steam,
  TERRA,
  TimerHUD,
  Vignette,
  clampIn,
  easeOut,
} from './ui';
import {BunkerBg, FrostEdges, SubwayBg, SummitBg} from './backdrops';

/* s06 — SLAM: SUBWAY PLATFORM. */
export const S06: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SubwayBg />
      <SlamTitle text="SUBWAY" tint={LOC.subway.accent} sub="PLATFORM · 60 FT UNDER" size={280} top={300} />
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="LOCATION 01 — MANHATTAN" />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 150,
          bottom: 130,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
          opacity: interpolate(frame, [6, 14], [0, 1], clampIn),
        }}
      >
        <SignalIcon alive={3} dyingAt={8} size={90} wobble />
      </div>
      <Vignette />
    </>
  );
};

/* s07 — phone status bar: bars die one by one into NO SERVICE. */
export const S07: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SubwayBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(11,18,25,0.55)'}} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 130,
          translate: `${interpolate(frame, [0, 10], [-60, 0], {...clampIn, easing: easeOut})}px -50%`,
          display: 'flex',
          gap: 80,
        }}
      >
        <PhoneShell width={430}>
          <div style={{position: 'absolute', top: 90, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
            <SignalIcon alive={3} dyingAt={6} size={150} wobble />
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 700,
                fontSize: 40,
                letterSpacing: 6,
                color: interpolate(frame, [10, 18], [0, 1], clampIn) > 0.5 ? CREAM : 'rgba(243,237,230,0.2)',
              }}
            >
              NO SERVICE
            </div>
            <div style={{fontFamily: FONT_UI, fontSize: 26, color: CREAM_DIM, letterSpacing: 2}}>searching for towers…</div>
          </div>
        </PhoneShell>
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="YOUR PHONE, CURRENTLY" />
      </div>
      <HandNote text="tunnels do that" x={1180} y={700} rotate={-5} />
      <Vignette />
    </>
  );
};

/* s08 — train WHOOSH wipe; timer HUD lands STEP 3 · SIMMER 08:00. */
export const S08: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SubwayBg />
      {/* train streaking through */}
      {[0, 1, 2].map((c) => {
        const p = interpolate(frame, [c * 4, c * 4 + 14], [-700 - c * 200, 2600], {...clampIn, easing: Easing.inOut(Easing.quad)});
        return (
          <div
            key={c}
            style={{
              position: 'absolute',
              top: 120 + c * 36,
              left: p,
              width: 760,
              height: 820 - c * 90,
              borderRadius: '48px 24px 24px 48px',
              backgroundColor: c === 0 ? '#101823' : '#1A2836',
              border: `4px solid rgba(95,168,220,${0.35 - c * 0.08})`,
              boxShadow: '0 0 90px rgba(95,168,220,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              padding: '0 40px',
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((w) => (
              <div key={w} style={{width: 44, height: 130, backgroundColor: 'rgba(207,228,245,0.24)', borderRadius: 8}} />
            ))}
          </div>
        );
      })}
      <TimerHUD step="STEP 3" title="SIMMER" seconds={480} float="right" width={560} />
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="RECIPE REAL · COOK MODE" color={TERRA} />
      </div>
      <Vignette strength={0.6} />
    </>
  );
};

/* s09 — HUD close-up: countdown ticks, ring depletes, dead signal in corner. */
export const S09: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: LOC.subway.a, opacity: 0.3}} />
      <TimerHUD step="STEP 3 · OF 9" title="SIMMER" seconds={480} elapsed={436} float="left" width={640} />
      <div
        style={{
          position: 'absolute',
          right: 200,
          top: 240,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          opacity: interpolate(frame, [6, 14], [0, 1], clampIn),
        }}
      >
        <SignalIcon alive={0} size={130} />
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 26, letterSpacing: 5, color: CREAM_DIM}}>0 BARS</div>
      </div>
      <div style={{position: 'absolute', right: SAFE, bottom: SAFE}}>
        <Kicker text="THE TIMER DOESN'T CARE" />
      </div>
      <Vignette />
    </>
  );
};

/* s10 — SLAM: SUMMIT. */
export const S10: FC = () => {
  return (
    <>
      <SummitBg />
      <SlamTitle text="SUMMIT" tint={LOC.summit.accent} sub="10,000 FT · WIND 40 MPH" size={300} top={300} />
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="LOCATION 02 — ABOVE IT ALL" />
      </div>
      <Vignette strength={0.3} />
    </>
  );
};

/* s11 — one bar, waving goodbye, tips off the icon. */
export const S11: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SummitBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(127,163,190,0.18)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 340, display: 'flex', justifyContent: 'center'}}>
        <SignalIcon alive={1} dyingAt={12} size={330} wobble tiltOff />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 740, textAlign: 'center', fontFamily: FONT_UI, fontWeight: 700, fontSize: 44, letterSpacing: 8, color: CREAM}}>
        1 BAR · DEPARTING
      </div>
      <HandNote text="bye" x={1345} y={260} rotate={8} size={72} />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="STEP 4 KEEPS TICKING" color={TERRA} />
      </div>
      <Vignette strength={0.3} />
    </>
  );
};

/* s12 — STEP 4 · REST 05:00, frost creeping. */
export const S12: FC = () => (
  <>
    <SummitBg />
    <TimerHUD step="STEP 4" title="REST" seconds={300} float="left" width={560} />
    <FrostEdges strength={0.8} />
    <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
      <Kicker text="MEAT RESTS · WIND HOWLS" />
    </div>
    <Vignette strength={0.3} />
  </>
);

/* s13 — SLAM: BASEMENT BUNKER. Zero bars since 1962. */
export const S13: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <BunkerBg />
      <SlamTitle text="BUNKER" tint={LOC.bunker.accent} sub="ZERO BARS SINCE 1962" size={280} top={280} />
      <HandNote text="stocked, though" x={1250} y={760} rotate={-4} size={60} color={CREAM_DIM} />
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="LOCATION 03 — TWO FLOORS DOWN" />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 170,
          bottom: 150,
          fontFamily: FONT_DISPLAY,
          fontSize: 110,
          color: CREAM,
          opacity: interpolate(frame, [14, 24], [0, 0.9], clampIn),
          rotate: '-4deg',
          border: `6px solid ${TERRA}`,
          padding: '6px 28px 0',
        }}
      >
        0 BARS
      </div>
      <Vignette />
    </>
  );
};

/* s14 — STEP 5 · SEASON — stew unbothered, bubbles rising. */
export const S14: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <BunkerBg />
      <TimerHUD step="STEP 5" title="SEASON" seconds={60} float="right" width={540} />
      <div
        style={{
          position: 'absolute',
          left: 260,
          bottom: 190,
          scale: `${interpolate(frame, [0, 10], [0.9, 1], {...clampIn, easing: easeOut})}`,
          opacity: interpolate(frame, [0, 8], [0, 1], clampIn),
        }}
      >
        <Pot size={330} bubbles />
        <Steam x={90} y={-60} scale={1} />
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="THE STEW IS UNBOTHERED" />
      </div>
      <Vignette />
    </>
  );
};
