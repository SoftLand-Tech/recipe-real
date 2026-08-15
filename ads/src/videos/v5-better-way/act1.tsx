// ACTS 1-3: the 1950s B/W infomercial melodrama (scenes s01-s16).
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import type {FC} from 'react';
import {BW, BWScene, Caption, IrisOverlay, Lime, OrnateFrame, Rings} from './fx';
import {
  BurntChicken,
  Cook,
  DishesMountain,
  EggTimer,
  OvenDial,
  RecipeCard,
  RetroClock,
  RetroKitchen,
  Smoke,
  SmokeAlarm,
  SwingBulb,
} from './cast';
import {bebas} from './fonts';

const center = {display: 'flex', alignItems: 'center', justifyContent: 'center'} as const;

/* s01 — horrified cook, smoke, zoom-punch. VO: "It said fifteen minutes!" */
export const Scene01: FC = () => {
  const frame = useCurrentFrame();
  const punch = interpolate(frame, [0, 9], [1, 1.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <BWScene>
      <div style={{...center, scale: `${punch}`, translate: '0 -30px'}}>
        <RetroKitchen />
        <Smoke x={470} y={430} count={5} scale={1.1} />
        <div style={{position: 'absolute', left: 640, top: 250}}>
          <Cook pose="horror" scale={1.25} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: 1130,
            top: 480,
            rotate: `${interpolate(frame, [0, 8, 12, 16], [-3, -7, -5, -6])}deg`,
          }}
        >
          <RecipeCard scale={0.72} stampPulse={interpolate(frame, [0, 6], [0.94, 1.05], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })} />
        </div>
      </div>
      <Caption text="IT SAID FIFTEEN MINUTES!" />
    </BWScene>
  );
};

/* s02 — smoke alarm Greek chorus. SFX only. */
export const Scene02: FC = () => {
  const frame = useCurrentFrame();
  const beeps = Math.min(3, Math.floor(frame / 6) + 1);
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <div style={{...center, flexDirection: 'column'}}>
        <SmokeAlarm size={280} />
        <Rings count={5} color={BW.paper} size={300} speed={1.1} maxOpacity={0.7} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 470, ...center}}>
        <Cook pose="stare" scale={0.85} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 150,
          textAlign: 'center',
          fontFamily: bebas,
          fontSize: 96,
          color: BW.paper,
          letterSpacing: 10,
        }}
      >
        {'BEEP '.repeat(beeps).trim()}
      </div>
    </BWScene>
  );
};

/* s03 — burnt dinner, drooping fork. VO: "Tired of recipe lies?" */
export const Scene03: FC = () => {
  const frame = useCurrentFrame();
  return (
    <BWScene>
      <RetroKitchen dim={0.35} />
      <div style={{position: 'absolute', left: 1210, top: 130}}>
        <Cook pose="horror" scale={0.95} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 300, ...center}}>
        <BurntChicken width={620} />
      </div>
      {/* drooping fork */}
      <div
        style={{
          position: 'absolute',
          left: 1245,
          top: 585,
          width: 14,
          height: 190,
          backgroundColor: BW.paper,
          borderRadius: 7,
          rotate: `${interpolate(frame, [0, 22], [8, 64], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.45, 0, 0.55, 1),
          })}deg`,
          transformOrigin: '50% 0%',
        }}
      >
        <div style={{display: 'flex', gap: 5, marginLeft: -12, marginTop: -26}}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{width: 8, height: 34, backgroundColor: BW.paper, borderRadius: 4}} />
          ))}
        </div>
      </div>
      <Caption text="TIRED OF RECIPE LIES?" />
    </BWScene>
  );
};

/* s04 — "15 MIN" card pulses, clock spins to 43. VO: "Forty-three minutes of betrayal." */
export const Scene04: FC = () => {
  const frame = useCurrentFrame();
  const spin = interpolate(frame, [0, 34], [90, 360 + 258], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.5, 0, 0.9, 0.6),
  });
  const pulse = 1 + Math.sin(frame * 0.55) * 0.045;
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 300,
          rotate: '-5deg',
          scale: `${interpolate(frame, [0, 8], [1.14, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}`,
        }}
      >
        <RecipeCard scale={1.05} stampPulse={pulse} />
      </div>
      <div style={{position: 'absolute', right: 170, top: 300, scale: `${1 + frame * 0.004}`}}>
        <RetroClock minuteDeg={spin} hourDeg={interpolate(frame, [0, 34], [45, 150])} size={430} />
      </div>
      <Caption text="43 MINUTES OF BETRAYAL" />
    </BWScene>
  );
};

/* s05 — clock horror 15 to 43, cook waits alone. VO: "Dinner an hour late. Again." */
export const Scene05: FC = () => {
  const frame = useCurrentFrame();
  const spin = interpolate(frame, [0, 36], [90, 1080], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.4, 0, 0.8, 0.5),
  });
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <div style={{position: 'absolute', left: 230, top: 250}}>
        <RetroClock minuteDeg={spin} hourDeg={interpolate(frame, [0, 36], [45, 165])} size={560} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 430,
          opacity: 0.95,
          translate: `0 ${interpolate(frame, [0, 30], [0, -10])}px`,
          textAlign: 'center',
        }}
      >
        <Cook pose="hands" scale={0.8} />
        {/* little table with empty plate */}
        <div
          style={{
            marginTop: -46,
            marginLeft: 16,
            width: 240,
            height: 18,
            backgroundColor: BW.paper,
            border: `4px solid ${BW.ink}`,
          }}
        />
        <div style={{marginLeft: 30, width: 14, height: 70, backgroundColor: BW.dark}} />
        <div
          style={{
            marginTop: -74,
            marginLeft: 120,
            width: 190,
            height: 30,
            borderRadius: '50%',
            backgroundColor: BW.paper,
            border: `4px solid ${BW.ink}`,
          }}
        />
      </div>
      <Caption text="DINNER AN HOUR LATE. AGAIN." />
    </BWScene>
  );
};

/* s06 — spotlight on the burnt chicken. SFX: melodramatic sting. */
export const Scene06: FC = () => {
  const frame = useCurrentFrame();
  const cone = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#0D0C0A'}} />
      <div
        style={{
          position: 'absolute',
          left: 260,
          top: -160,
          width: 1400,
          height: 1300,
          background:
            'radial-gradient(ellipse 38% 46% at 50% 38%, rgba(237,234,226,0.30) 0%, rgba(237,234,226,0.10) 45%, rgba(237,234,226,0) 70%)',
          scale: `${cone}`,
        }}
      />
      {/* light pool under the platter */}
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 790,
          width: 1000 * cone,
          height: 130,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(237,234,226,0.22) 0%, rgba(237,234,226,0) 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...center,
          scale: `${interpolate(frame, [0, 12], [1.24, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}`,
        }}
      >
        <BurntChicken width={760} />
      </div>
      <Smoke x={960} y={520} count={3} scale={1} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 120, ...center}}>
        <Lime text="THE CHICKEN." size={110} />
      </div>
    </BWScene>
  );
};

/* s07 — the chicken sheds one tear. VO: "Is your chicken... crying?" */
export const Scene07: FC = () => {
  const frame = useCurrentFrame();
  const tearY = interpolate(frame, [6, 34], [0, 185], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.4, 0, 0.7, 1),
  });
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...center,
          scale: `${interpolate(frame, [0, 14], [1.18, 1.02], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}`,
        }}
      >
        <BurntChicken width={1050} tearY={tearY} />
      </div>
      <Caption text="IS YOUR CHICKEN... CRYING?" />
    </BWScene>
  );
};

/* s08 — preheat panic: shaking dial, multiplying question marks. VO. */
export const Scene08: FC = () => {
  const frame = useCurrentFrame();
  const shake = Math.sin(frame * 2.4) * 26 - 40;
  return (
    <BWScene>
      <RetroKitchen dim={0.3} />
      <div style={{position: 'absolute', left: 260, top: 200}}>
        <Cook pose="scream" scale={1.1} />
      </div>
      <div style={{position: 'absolute', right: 250, top: 280}}>
        <OvenDial deg={shake} size={360} />
      </div>
      {new Array(7).fill(0).map((_, i) => {
        const ax = random(`qa-${i}`) * 6.28;
        const dist = 300 + random(`qd-${i}`) * 180;
        const appear = 2 + i * 3;
        const p = interpolate(frame, [appear, appear + 4], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 470 + Math.cos(ax) * dist,
              top: 380 + Math.sin(ax) * dist * 0.7,
              fontFamily: bebas,
              fontSize: 64 + random(`qs-${i}`) * 60,
              color: BW.paper,
              opacity: p,
              scale: `${interpolate(p, [0, 1], [2.2, 1])}`,
              rotate: `${random(`qr-${i}`) * 50 - 25}deg`,
              textShadow: '0 4px 0 rgba(0,0,0,0.6)',
            }}
          >
            ?
          </div>
        );
      })}
      <Caption text="NOBODY TOLD YOU TO PREHEAT" />
    </BWScene>
  );
};

/* s09 — iris-in on the egg timer spinning past the numbers. SFX: click. */
export const Scene09: FC = () => {
  const frame = useCurrentFrame();
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <div style={{position: 'absolute', inset: 0, ...center}}>
        <EggTimer deg={frame * 49} size={520} />
      </div>
      {/* motion arcs */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 960,
            top: 540,
            width: 620 + i * 90,
            height: 620 + i * 90,
            marginLeft: -(310 + i * 45),
            marginTop: -(310 + i * 45),
            borderRadius: '50%',
            border: `3px dashed ${BW.mid}`,
            opacity: 0.5,
            rotate: `${frame * (14 + i * 9)}deg`,
          }}
        />
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: 110, ...center}}>
        <Lime text="HOW LONG??" size={130} />
      </div>
      <IrisOverlay
        progress={interpolate(frame, [0, 7], [0.06, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}
      />
    </BWScene>
  );
};

/* s10 — recipe times inflate on the clipboard. VO: "Ten minutes of prep? Try forty." */
export const Scene10: FC = () => {
  const frame = useCurrentFrame();
  const inflate = (from: number, to: number, delay: number) =>
    Math.round(
      interpolate(frame, [4 + delay, 26 + delay], [from, to], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.bezier(0.3, 0, 0.4, 1),
      }),
    );
  const rows = [
    {label: 'PREP THE VEG', from: 10, to: 40, delay: 0},
    {label: 'SEAR THE CHICKEN', from: 8, to: 26, delay: 4},
    {label: 'MAKE THE SAUCE', from: 5, to: 18, delay: 8},
  ];
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <div
        style={{
          position: 'absolute',
          left: 460,
          top: 200,
          width: 1000,
          backgroundColor: BW.paper,
          border: `6px solid ${BW.ink}`,
          boxShadow: '22px 26px 0 rgba(0,0,0,0.5)',
          rotate: `${interpolate(frame, [0, 10], [5, -2])}deg`,
          padding: '56px 64px',
        }}
      >
        <div
          style={{
            fontFamily: bebas,
            fontSize: 54,
            letterSpacing: 4,
            color: BW.ink,
            borderBottom: `5px solid ${BW.ink}`,
            paddingBottom: 10,
            marginBottom: 26,
          }}
        >
          THE RECIPE SAYS
        </div>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '22px 0',
              borderBottom: i < 2 ? `3px dashed ${BW.mid}` : 'none',
              translate: `0 ${Math.sin(frame * 1.6 + i) * 2}px`,
            }}
          >
            <div style={{fontFamily: bebas, fontSize: 52, color: BW.dark, letterSpacing: 2}}>
              {r.label}
            </div>
            <div
              style={{
                fontFamily: bebas,
                fontSize: 78,
                color: inflate(r.from, r.to, r.delay) > r.from ? BW.ink : BW.mid,
                border: `5px solid ${BW.ink}`,
                padding: '0 22px',
                minWidth: 190,
                textAlign: 'center',
              }}
            >
              {inflate(r.from, r.to, r.delay)} MIN
            </div>
          </div>
        ))}
      </div>
      <Caption text="PREP: 10 MIN BECOMES 40" />
    </BWScene>
  );
};

/* s11 — dishes mountain, long shadows. VO: "And then... the cleanup." */
export const Scene11: FC = () => {
  const frame = useCurrentFrame();
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#141210'}} />
      {/* side light beams */}
      <div
        style={{
          position: 'absolute',
          left: -140,
          top: -100,
          width: 700,
          height: 1400,
          rotate: '18deg',
          background: 'linear-gradient(90deg, rgba(237,234,226,0.16), rgba(237,234,226,0))',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...center,
          scale: `${interpolate(frame, [0, 30], [1.22, 1.06], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.3, 0, 0.3, 1),
          })}`,
        }}
      >
        <DishesMountain width={1500} />
      </div>
      {/* long dramatic shadow */}
      <div
        style={{
          position: 'absolute',
          left: 260,
          bottom: -140,
          width: 900,
          height: 300,
          backgroundColor: 'rgba(0,0,0,0.55)',
          transform: 'skewX(-24deg)',
          filter: 'blur(6px)',
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, top: 100, ...center}}>
        <Lime text="THE CLEANUP" size={140} />
      </div>
      <div style={{position: 'absolute', right: 150, bottom: 200}}>
        <Cook pose="hands" scale={0.62} />
      </div>
    </BWScene>
  );
};

/* s12 — the avalanche. SFX: sad trombone. */
export const Scene12: FC = () => {
  const frame = useCurrentFrame();
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#141210'}} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...center,
          rotate: `${interpolate(frame, [0, 18], [0, 9], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.in(Easing.quad),
          })}deg`,
          translate: `0 ${interpolate(frame, [0, 18], [0, 90])}px`,
        }}
      >
        <DishesMountain width={1400} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 300,
          bottom: 170,
          translate: `0 ${interpolate(frame, [4, 18], [0, 46], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px`,
        }}
      >
        <Cook pose="hands" scale={0.7} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 130, ...center}}>
        <Lime text="DEFEAT." size={96} />
      </div>
    </BWScene>
  );
};

/* s13 — swinging bulb over the broken cook. VO: "There has to be another way." */
export const Scene13: FC = () => {
  const frame = useCurrentFrame();
  return (
    <BWScene grain={1.2}>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#0F0E0C'}} />
      <SwingBulb deg={Math.sin(frame / 7) * 11} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 430,
          ...center,
          opacity: interpolate(frame, [0, 6], [0.6, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <Cook pose="hands" scale={1.05} />
      </div>
      <Caption text="THERE HAS TO BE ANOTHER WAY" />
    </BWScene>
  );
};

/* s14 — RECORD SCRATCH freeze on the scream. SFX only. */
export const Scene14: FC = () => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, 4], [1.12, 1.42], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flash = interpolate(frame, [0, 2], [0.85, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <BWScene grain={1.4}>
      <div style={{position: 'absolute', inset: 0, backgroundColor: BW.dark}} />
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 60, top: -49, scale: `${zoom}`}}>
          <Cook pose="scream" scale={4.5} />
        </div>
      </AbsoluteFill>
      {/* freeze lines */}
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 380 + i * 260,
            height: 5,
            backgroundColor: BW.paper,
            opacity: 0.25,
          }}
        />
      ))}
      <AbsoluteFill style={{backgroundColor: '#fff', opacity: flash}} />
    </BWScene>
  );
};

/* s15 — THE TITLE CARD SLAM. VO (shouted): "There's GOT to be a better way!" */
export const Scene15: FC = () => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [0, 5], [1.7, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.4, 0.4, 1),
  });
  const shakeX = frame >= 5 && frame <= 15 ? (random(`sx-${frame}`) - 0.5) * 22 : 0;
  const shakeY = frame >= 5 && frame <= 15 ? (random(`sy-${frame}`) - 0.5) * 14 : 0;
  return (
    <BWScene grain={1.3}>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#0A0908'}} />
      <AbsoluteFill
        style={{
          scale: `${slam}`,
          translate: `${shakeX}px ${shakeY}px`,
          padding: 40,
        }}
      >
        <OrnateFrame>
          <div>
            <Lime text="THERE'S GOT TO BE" size={108} />
            <Lime text="A BETTER WAY!" size={168} style={{marginTop: 18}} />
          </div>
        </OrnateFrame>
      </AbsoluteFill>
    </BWScene>
  );
};

/* s16 — echo card, iris closes to a pinpoint. SFX: iris pop. */
export const Scene16: FC = () => {
  const frame = useCurrentFrame();
  const recede = interpolate(frame, [0, 18], [1, 0.82], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <BWScene>
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#0A0908'}} />
      <AbsoluteFill
        style={{
          scale: `${recede}`,
          opacity: interpolate(recede, [0.82, 1], [0.55, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        <OrnateFrame padding={80}>
          <Lime text="A BETTER WAY?" size={150} />
        </OrnateFrame>
      </AbsoluteFill>
      <IrisOverlay
        progress={interpolate(frame, [5, 19], [1, 0.02], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.quad),
        })}
      />
    </BWScene>
  );
};
