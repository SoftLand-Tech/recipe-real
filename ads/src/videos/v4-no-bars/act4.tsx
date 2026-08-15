// ACT 4 · LOCATION MONTAGE 2 — airplane / desert / polar. Escalate the locations, never the cook.
import {FC} from 'react';
import {Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {
  AirplaneIcon,
  CREAM,
  CREAM_DIM,
  FONT_DISPLAY,
  FONT_UI,
  HandNote,
  Kicker,
  LOC,
  NoServiceIcon,
  Pot,
  SAFE,
  SceneBg,
  SignalIcon,
  SlamTitle,
  Steam,
  TERRA,
  Thermometer,
  TimerHUD,
  Vignette,
  clampIn,
  easeOut,
} from './ui';
import {DesertBg, PlaneBg, PolarBg} from './backdrops';

/* s23 — SLAM: 35,000 FT. */
export const S23: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <PlaneBg />
      <SlamTitle text="35,000 FT" tint={LOC.plane.accent} sub="CRUISING · NO TOWERS UP HERE" size={240} top={300} />
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="LOCATION 04 — ROW 14, WINDOW SEAT" />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 300,
          bottom: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          opacity: interpolate(frame, [8, 16], [0, 0.9], clampIn),
        }}
      >
        <AirplaneIcon size={54} color={LOC.plane.accent} />
        <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 30, letterSpacing: 5, color: LOC.plane.accent}}>
          AIRPLANE MODE SOON
        </span>
      </div>
      <Vignette strength={0.45} />
    </>
  );
};

/* s24 — airplane mode ON; bars cross out. */
export const S24: FC = () => {
  const frame = useCurrentFrame();
  const on = interpolate(frame, [3, 10], [0, 1], {...clampIn, easing: Easing.bezier(0.2, 1.3, 0.4, 1)});
  return (
    <>
      <PlaneBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(10,16,30,0.35)'}} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 330,
          translate: `${interpolate(on, [0, 1], [240, 0])}px -50%`,
          display: 'flex',
          alignItems: 'center',
          gap: 46,
          backgroundColor: 'rgba(23,19,16,0.92)',
          border: '2px solid rgba(243,237,230,0.16)',
          borderRadius: 32,
          padding: '44px 70px',
          boxShadow: '0 34px 90px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{rotate: `${interpolate(on, [0, 1], [-90, 0])}deg`, scale: `${1 + (1 - on) * 0.4}`}}>
          <AirplaneIcon size={150} color={TERRA} />
        </div>
        <div>
          <div style={{fontFamily: FONT_DISPLAY, fontSize: 130, color: CREAM, letterSpacing: 4, lineHeight: 1}}>AIRPLANE MODE</div>
          <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 48, color: TERRA, letterSpacing: 8, marginTop: 12}}>IS ON. OBVIOUSLY.</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 18, marginTop: 26}}>
            <SignalIcon alive={0} size={56} />
            <svg width="70" height="30" viewBox="0 0 70 30" style={{position: 'absolute', left: 8}}>
              <line x1="0" y1="28" x2={interpolate(frame, [8, 16], [0, 70], {...clampIn, easing: easeOut})} y2="2" stroke={CREAM_DIM} strokeWidth="5" strokeLinecap="round" />
            </svg>
            <span style={{fontFamily: FONT_UI, fontSize: 28, color: CREAM_DIM, letterSpacing: 3}}>NOT THAT IT MATTERS</span>
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="RECIPE REAL · STEP 6 RUNNING" color={TERRA} />
      </div>
      <Vignette strength={0.45} />
    </>
  );
};

/* s25 — STEP 6 · REDUCE over the window view. */
export const S25: FC = () => (
  <>
    <PlaneBg />
    <TimerHUD step="STEP 6" title="REDUCE" seconds={240} float="left" width={560} />
    <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
      <Kicker text="SAILING ABOVE THE TOWERS" />
    </div>
    <Vignette strength={0.45} />
  </>
);

/* s26 — seatmate side-eye. (SFX-only punch) */
export const S26: FC = () => {
  const frame = useCurrentFrame();
  const glance = interpolate(frame, [4, 12, 16, 22], [0, 0, 1, 1], {...clampIn, easing: Easing.bezier(0.3, 1.4, 0.4, 1)});
  return (
    <>
      <PlaneBg />
      {/* HUD reflection on window */}
      <div
        style={{
          position: 'absolute',
          right: 190,
          top: 250,
          width: 480,
          rotate: '-6deg',
          opacity: 0.5 + glance * 0.2,
          border: '2px solid rgba(217,110,63,0.5)',
          borderRadius: 24,
          backgroundColor: 'rgba(23,19,16,0.5)',
          padding: '24px 30px',
        }}
      >
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: TERRA}}>STEP 6 · REDUCE 04:00</div>
        <div style={{fontFamily: FONT_UI, fontSize: 22, color: CREAM_DIM, marginTop: 8}}>stir occasionally</div>
      </div>
      {/* seats + heads */}
      <div style={{position: 'absolute', left: 220, bottom: 0, display: 'flex', gap: 60}}>
        {/* our cook */}
        <div style={{position: 'relative', width: 260}}>
          <div style={{position: 'absolute', bottom: 0, width: 260, height: 330, borderRadius: '30px 30px 0 0', backgroundColor: '#182236'}} />
          <div style={{position: 'absolute', bottom: 300, left: 70, width: 120, height: 120, borderRadius: '50%', backgroundColor: '#101823'}} />
          <div style={{position: 'absolute', bottom: 335, left: 118, width: 250, height: 8, borderRadius: 4, backgroundColor: 'rgba(143,174,224,0.3)' }} />
        </div>
        {/* seatmate turning */}
        <div style={{position: 'relative', width: 260}}>
          <div style={{position: 'absolute', bottom: 0, width: 260, height: 330, borderRadius: '30px 30px 0 0', backgroundColor: '#1A2540' }} />
          <div
            style={{
              position: 'absolute',
              bottom: 300,
              left: 70,
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: '#0C1420',
              translate: `${glance * 46}px 0`,
              rotate: `${glance * -6}deg`,
            }}
          />
          <div style={{position: 'absolute', bottom: 340, left: 100, width: 90, height: 8, borderRadius: 4, backgroundColor: 'rgba(143,174,224,0.35)'}} />
        </div>
      </div>
      <HandNote text="he's taking notes" x={430} y={330} rotate={-5} size={60} />
      <Vignette strength={0.5} />
    </>
  );
};

/* s27 — SLAM: OPEN DESERT. */
export const S27: FC = () => (
  <>
    <DesertBg />
    <SlamTitle text="OPEN DESERT" tint={LOC.desert.b} sub="MILE MARKER 0 · MOJAVE" size={230} top={280} />
    <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
      <Kicker text="LOCATION 05 — NOTHING FOR MILES" color="#5C4014" />
    </div>
    <Vignette strength={0.35} />
  </>
);

/* s28 — signal icon melts in the heat shimmer. */
export const S28: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <DesertBg />
      <div style={{position: 'absolute', left: 0, right: 0, top: 400, display: 'flex', justifyContent: 'center'}}>
        <div
          style={{
            rotate: `${Math.sin(frame * 0.8) * 3}deg`,
            transform: `skewX(${Math.sin(frame * 0.5) * 4}deg)`,
          }}
        >
          <SignalIcon alive={0} size={300} wobble />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, textAlign: 'center'}}>
        <span style={{fontFamily: FONT_DISPLAY, fontSize: 150, color: '#4A2F10', letterSpacing: 4}}>0 BARS TO THE HORIZON</span>
      </div>
      <HandNote text="even the icon is melting" x={1290} y={330} rotate={-4} size={56} color="#5C4014" />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="STEP 7 · SEAR, UNBOTHERED" color="#5C4014" />
      </div>
      <Vignette strength={0.35} />
    </>
  );
};

/* s29 — STEP 7 · SEAR, pan throwing sparks. */
export const S29: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <DesertBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(126,90,46,0.25)'}} />
      <TimerHUD step="STEP 7" title="SEAR" seconds={180} float="right" width={540} />
      {/* pan with sparks */}
      <div style={{position: 'absolute', left: 260, bottom: 210}}>
        <div
          style={{
            width: 380,
            height: 110,
            borderRadius: '12px 12px 190px 190px',
            background: 'linear-gradient(180deg, #3B3129 0%, #211A14 100%)',
            border: '3px solid rgba(243,237,230,0.2)',
          }}
        />
        <div style={{position: 'absolute', right: -150, top: 30, width: 150, height: 26, borderRadius: 12, backgroundColor: '#3B3129'}} />
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: -30,
            width: 260,
            height: 34,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(246,227,180,0.0), rgba(246,227,180,0.55), rgba(246,227,180,0.0))',
          }}
        />
        {Array.from({length: 10}).map((_, i) => {
          const p = ((frame * 2.4 + i * 13) % 40) / 40;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 90 + random(`sp-${i}`) * 220,
                top: -p * 190,
                width: 5 + random(`sw-${i}`) * 5,
                height: 5 + random(`sw-${i}`) * 5,
                borderRadius: 999,
                backgroundColor: i % 3 === 0 ? TERRA : '#F6E3B4',
                opacity: interpolate(p, [0, 0.2, 0.9, 1], [0, 1, 0.9, 0], clampIn),
              }}
            />
          );
        })}
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="SIZZLE LOUDER THAN THE WIND" color="#5C4014" />
      </div>
      <Vignette strength={0.4} />
    </>
  );
};

/* s30 — thermometer gag: 106 in the shade. */
export const S30: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <DesertBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(126,90,46,0.18)'}} />
      <div style={{position: 'absolute', right: 380, top: 190}}>
        <Thermometer height={620} />
      </div>
      <div style={{position: 'absolute', left: 130, top: 250}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 300, color: '#3E2808', lineHeight: 0.9}}>106°F</div>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 120, color: '#4A2F10', letterSpacing: 4}}>IN THE SHADE</div>
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 38, color: '#5C4014', letterSpacing: 5, marginTop: 20}}>
          TIMER FINE. YOU, MAYBE NOT.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 320,
          bottom: 140,
          rotate: '6deg',
          border: '6px solid rgba(62,40,8,0.8)',
          padding: '10px 30px 14px',
          opacity: interpolate(frame, [8, 16], [0, 1], clampIn),
        }}
      >
        <span style={{fontFamily: FONT_DISPLAY, fontSize: 90, color: '#3E2808'}}>STEP 7 · STILL SEARING</span>
      </div>
      <Vignette strength={0.35} />
    </>
  );
};

/* s31 — SLAM: POLAR STATION. */
export const S31: FC = () => (
  <>
    <PolarBg />
    <SlamTitle text="POLAR STATION" tint={LOC.polar.accent} sub="−40° OUTSIDE · RESEARCH GRADE DINNER" size={190} top={280} />
    <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
      <Kicker text="LOCATION 06 — THE LAST ONE. PROMISE." />
    </div>
    <Vignette strength={0.4} />
  </>
);

/* s32 — frost cracks across the frame; aurora shifts. */
export const S32: FC = () => {
  const frame = useCurrentFrame();
  const cracks = [
    'M 0 200 L 180 260 L 340 210 L 560 300 L 760 250',
    'M 1920 160 L 1740 240 L 1560 200 L 1380 290 L 1180 230',
    'M 240 1080 L 380 940 L 520 990 L 700 880',
    'M 1700 1080 L 1560 950 L 1440 1000 L 1280 900',
  ];
  return (
    <>
      <PolarBg />
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        {cracks.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(223,240,250,0.8)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={1400}
            strokeDashoffset={1400 - interpolate(frame, [i * 3, i * 3 + 16], [0, 1400], clampIn)}
          />
        ))}
      </svg>
      <div style={{position: 'absolute', left: '50%', top: 400, translate: '-50% 0', textAlign: 'center'}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 240, color: CREAM, lineHeight: 0.95}}>−40°</div>
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 40, letterSpacing: 8, color: CREAM_DIM, marginTop: 10}}>
          THE STEW IS FINE. IT&apos;S INSIDE.
        </div>
      </div>
      <Vignette strength={0.4} />
    </>
  );
};

/* s33 — STEP 8 · SIMMER; steam fogs the frost from within. */
export const S33: FC = () => {
  const frame = useCurrentFrame();
  const fog = interpolate(frame, [0, 20], [0, 0.55], clampIn);
  return (
    <>
      <PolarBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: `rgba(223,240,250,${0.35 - fog * 0.5})` }} />
      <TimerHUD step="STEP 8" title="SIMMER" seconds={600} float="right" width={560} />
      <div style={{position: 'absolute', left: 300, bottom: 190}}>
        <Pot size={380} bubbles />
        <Steam x={120} y={-40} scale={1.6} spread={1.4} color="rgba(223,240,250,0.65)" />
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="STEAM BEATS FROST" />
      </div>
      <Vignette strength={0.4} />
    </>
  );
};

/* s34 — eight steps, zero bars: checks cascade. */
export const S34: FC = () => {
  const frame = useCurrentFrame();
  const steps = ['Prep', 'Brown', 'Simmer', 'Rest', 'Season', 'Reduce', 'Sear', 'Simmer low'];
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', left: 150, top: 150}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 130, color: CREAM, marginBottom: 36}}>EIGHT STEPS. ZERO BARS.</div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 30}}>
          {steps.map((s, i) => {
            const at = 2 + i * 3;
            const pop = interpolate(frame, [at, at + 5], [0, 1], {...clampIn, easing: Easing.bezier(0.34, 1.5, 0.64, 1)});
            return (
              <div
                key={`${s}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  backgroundColor: 'rgba(34,28,22,0.9)',
                  border: '2px solid rgba(243,237,230,0.12)',
                  borderRadius: 18,
                  padding: '18px 22px',
                  scale: `${pop}`,
                }}
              >
                <svg width={34} height={34} viewBox="0 0 30 30">
                  <circle cx="15" cy="15" r="13" fill={TERRA} />
                  <path d="M 8 12 L 13 17 L 22 7" fill="none" stroke="#171310" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 32, color: CREAM}}>{i + 1}. {s}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{position: 'absolute', right: 150, bottom: 120, display: 'flex', alignItems: 'center', gap: 24, rotate: '-3deg'}}>
        <NoServiceIcon size={80} color={TERRA} />
        <span style={{fontFamily: FONT_DISPLAY, fontSize: 84, color: TERRA, border: `5px solid ${TERRA}`, padding: '4px 24px 8px'}}>0 BARS</span>
      </div>
      <Vignette />
    </>
  );
};
