// ACT 4: FULL COLOR SNAP — RecipeReal benefits, modern fast pacing (s17-s28).
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import type {FC} from 'react';
import {brand, SAFE} from '../../shared/theme';
import {IrisOverlay, Starburst} from './fx';
import {bebas, space} from './fonts';

const center = {display: 'flex', alignItems: 'center', justifyContent: 'center'} as const;

/* ---------- shared modern pieces ---------- */

const ColorKitchen: FC = () => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, backgroundColor: brand.canvas}} />
    {/* backsplash */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 300,
        height: 200,
        backgroundColor: brand.surfaceSoft,
        backgroundImage: `linear-gradient(${brand.hairline} 2px, transparent 2px), linear-gradient(90deg, ${brand.hairline} 2px, transparent 2px)`,
        backgroundSize: '52px 52px',
      }}
    />
    {/* window */}
    <div
      style={{
        position: 'absolute',
        left: 120,
        top: 120,
        width: 300,
        height: 170,
        backgroundColor: '#DDE8EA',
        border: `12px solid ${brand.surface}`,
        boxShadow: `0 0 0 3px ${brand.hairlineStrong}`,
      }}
    />
    {/* plant */}
    <div style={{position: 'absolute', right: 150, top: 180, width: 120, height: 190}}>
      <div
        style={{
          position: 'absolute',
          left: 25,
          bottom: 0,
          width: 70,
          height: 58,
          backgroundColor: brand.accent,
          borderRadius: '6px 6px 22px 22px',
        }}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 58,
            bottom: 52,
            width: 14,
            height: 96,
            backgroundColor: brand.success,
            borderRadius: 8,
            rotate: `${(i - 2) * 18}deg`,
            transformOrigin: '50% 100%',
          }}
        />
      ))}
    </div>
    {/* counter */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 300,
        backgroundColor: brand.surface,
        borderTop: `14px solid ${brand.hairlineStrong}`,
      }}
    />
    {/* cutting board */}
    <div
      style={{
        position: 'absolute',
        left: 620,
        bottom: 210,
        width: 340,
        height: 26,
        backgroundColor: brand.amberBright,
        borderRadius: 13,
        boxShadow: '0 10px 0 rgba(0,0,0,0.08)',
      }}
    />
  </div>
);

export const PhoneFrame: FC<{children: React.ReactNode; scale?: number; rotate?: number}> = ({
  children,
  scale = 1,
  rotate = 0,
}) => (
  <div
    style={{
      width: 430,
      height: 840,
      backgroundColor: brand.ink,
      borderRadius: 54,
      padding: 16,
      boxShadow: '0 40px 80px rgba(36,29,23,0.28)',
      rotate: `${rotate}deg`,
      scale: `${scale}`,
    }}
  >
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: brand.surface,
        borderRadius: 40,
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          translate: '-50% 0',
          width: 130,
          height: 22,
          backgroundColor: brand.ink,
          borderRadius: 12,
          zIndex: 3,
        }}
      />
      {children}
    </div>
  </div>
);

const Check: FC<{size?: number; color?: string}> = ({size = 44, color = brand.success}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      backgroundColor: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg viewBox="0 0 24 24" style={{width: size * 0.6, height: size * 0.6}}>
      <path d="M4 13 L10 19 L20 6" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const SpeedRays: FC<{color?: string; opacity?: number}> = ({color = brand.accentSoft, opacity = 0.7}) => (
  <div style={{position: 'absolute', inset: 0, ...center, opacity}}>
    {new Array(24).fill(0).map((_, i) => {
      const a = (i / 24) * 360;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 1080,
            height: 54,
            backgroundColor: color,
            rotate: `${a + 7.5}deg`,
            transformOrigin: '50% 50%',
            marginLeft: 900,
          }}
        />
      );
    })}
  </div>
);

/* ---------- scenes ---------- */

/* s17 — iris burst into FULL COLOR. VO: "There is. RecipeReal." */
export const Scene17: FC = () => {
  const frame = useCurrentFrame();
  const flood = interpolate(frame, [0, 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1, 0.3, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <AbsoluteFill style={{opacity: flood}}>
        <ColorKitchen />
      </AbsoluteFill>
      {/* color flood wipe */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(100deg, ${brand.accent} 0%, ${brand.amberBright} 120%)`,
          translate: `${interpolate(flood, [0, 1], ['-110%', '110%'])} 0`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...center,
          scale: `${interpolate(frame, [4, 18], [0.7, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1.5, 0.4, 1),
          })}`,
        }}
      >
        <div style={{textAlign: 'center'}}>
          <div
            style={{
              fontFamily: bebas,
              fontSize: 230,
              color: brand.ink,
              lineHeight: 0.95,
              letterSpacing: 2,
            }}
          >
            Recipe<span style={{color: brand.accent}}>Real</span>
          </div>
          <div
            style={{
              fontFamily: space,
              fontWeight: 700,
              fontSize: 44,
              letterSpacing: 10,
              color: brand.inkSecondary,
              marginTop: 8,
            }}
          >
            HONEST COOK TIMES
          </div>
        </div>
      </div>
      <IrisOverlay progress={interpolate(frame, [0, 8], [0.02, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })} />
    </AbsoluteFill>
  );
};

/* s18 — timed by 10,000 real cooks. VO. */
export const Scene18: FC = () => {
  const frame = useCurrentFrame();
  const count = Math.round(
    interpolate(frame, [2, 32], [137, 10000], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.3, 0, 0.2, 1),
    }),
  );
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays opacity={0.35} />
      <div style={{position: 'absolute', left: 210, top: 120}}>
        <PhoneFrame rotate={-4}>
          <div style={{padding: '70px 36px 0'}}>
            <div style={{fontFamily: space, fontWeight: 700, fontSize: 30, color: brand.ink}}>
              EASY ROAST CHICKEN
            </div>
            <div style={{fontFamily: space, fontSize: 21, color: brand.inkSecondary, marginTop: 6}}>
              time calibration
            </div>
            <div
              style={{
                marginTop: 26,
                fontFamily: bebas,
                fontSize: 96,
                color: brand.accent,
                lineHeight: 1,
              }}
            >
              {count.toLocaleString('en-US')}
            </div>
            <div style={{fontFamily: space, fontWeight: 500, fontSize: 22, color: brand.inkSecondary}}>
              REAL COOKS TIMED IT
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                marginTop: 24,
                maxWidth: 300,
              }}
            >
              {new Array(24).fill(0).map((_, i) => {
                const on = i / 24 < frame / 26;
                return (
                  <div
                    key={i}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      backgroundColor: on ? brand.accent : brand.hairline,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </PhoneFrame>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 260,
          width: 900,
          translate: `${interpolate(frame, [0, 10], [120, 0])}px 0`,
          opacity: interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        <div style={{fontFamily: bebas, fontSize: 190, color: brand.ink, lineHeight: 0.9}}>
          10,000 REAL COOKS
        </div>
        <div style={{fontFamily: space, fontWeight: 500, fontSize: 42, color: brand.inkSecondary, marginTop: 14}}>
          timed every step, every burn, every clock
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* s19 — starburst slam: REAL NUMBERS. SFX: pop. */
export const Scene19: FC = () => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 6], [0.2, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.6, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays color={brand.accentSoft} opacity={0.55} />
      <AbsoluteFill style={{...center, scale: `${pop}`}}>
        <Starburst size={860} fill={brand.amber} inner={0.7} rotate={interpolate(frame, [0, 20], [-8, 2])} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            translate: '-50% -50%',
            fontFamily: bebas,
            fontSize: 180,
            color: '#fff',
            letterSpacing: 6,
            textAlign: 'center',
            textShadow: '0 10px 0 rgba(36,29,23,0.25)',
          }}
        >
          REAL
          <br />
          NUMBERS
        </div>
      </AbsoluteFill>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 300 + i * 120,
            top: 880 - i * 40,
            opacity: interpolate(frame, [6 + i * 2, 10 + i * 2], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <Check size={54} />
        </div>
      ))}
    </AbsoluteFill>
  );
};

const StepRow: FC<{label: string; time: string; checked: boolean; highlight?: number}> = ({
  label,
  time,
  checked,
  highlight = 1,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 26,
      padding: '26px 34px',
      backgroundColor: brand.surface,
      borderRadius: 20,
      border: `2px solid ${brand.hairline}`,
      boxShadow: '0 12px 24px rgba(36,29,23,0.08)',
      scale: `${highlight}`,
    }}
  >
    {checked ? <Check /> : <div style={{width: 44, height: 44, borderRadius: '50%', backgroundColor: brand.hairline}} />}
    <div style={{fontFamily: space, fontWeight: 500, fontSize: 40, color: brand.ink, flex: 1}}>{label}</div>
    <div
      style={{
        fontFamily: bebas,
        fontSize: 54,
        color: brand.accent,
        backgroundColor: brand.accentSoft,
        padding: '4px 20px',
        borderRadius: 12,
      }}
    >
      {time}
    </div>
  </div>
);

/* s20 — real minutes on every step. VO. */
export const Scene20: FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    {label: 'Preheat the oven', time: '8:00'},
    {label: 'Sear, both sides', time: '6:30'},
    {label: 'Roast and rest', time: '28:00'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays opacity={0.25} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 110,
          textAlign: 'center',
          fontFamily: bebas,
          fontSize: 120,
          color: brand.ink,
        }}
      >
        EVERY STEP, TIMED
      </div>
      <div style={{position: 'absolute', left: 330, top: 300, display: 'flex', flexDirection: 'column', gap: 30, width: 1260}}>
        {rows.map((r, i) => {
          const slide = interpolate(frame, [i * 4, i * 4 + 10], [-80, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1, 0.3, 1),
          });
          const tick = interpolate(frame, [i * 4 + 8, i * 4 + 16], [1, 1.04], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div key={r.label} style={{translate: `${slide}px 0`, opacity: slide === 0 ? 1 : 0.4}}>
              <StepRow label={r.label} time={r.time} checked={false} highlight={tick} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* s21 — green checks cascade. SFX: ding. */
export const Scene21: FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    {label: 'Chop the veg', time: '6:40'},
    {label: 'Sear the chicken', time: '12:00'},
    {label: 'Simmer the sauce', time: '8:20'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 110,
          textAlign: 'center',
          fontFamily: bebas,
          fontSize: 120,
          color: brand.ink,
        }}
      >
        DONE MEANS DONE
      </div>
      <div style={{position: 'absolute', left: 330, top: 300, display: 'flex', flexDirection: 'column', gap: 30, width: 1260}}>
        {rows.map((r, i) => {
          const on = frame >= 2 + i * 5;
          const pop = interpolate(frame, [2 + i * 5, 7 + i * 5], [0.3, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1.6, 0.4, 1),
          });
          return (
            <div key={r.label} style={{scale: `${pop}`, opacity: on ? 1 : 0.25}}>
              <StepRow label={r.label} time={r.time} checked={on} highlight={1} />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* s22 — the truth sticker: 15 struck, 43 stamped. VO + slam. */
export const Scene22: FC = () => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [0, 6], [1.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.4, 0.4, 1),
  });
  const strike = interpolate(frame, [16, 24], [-100, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shake = frame >= 6 && frame <= 14 ? Math.sin(frame * 2.6) * 5 : 0;
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays opacity={0.3} />
      <AbsoluteFill style={{...center}}>
        <div
          style={{
            rotate: '-5deg',
            scale: `${slam}`,
            translate: `${shake}px 0`,
            backgroundColor: brand.surface,
            border: `10px solid ${brand.ink}`,
            borderRadius: 28,
            padding: '70px 90px',
            boxShadow: '0 40px 70px rgba(36,29,23,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 70,
          }}
        >
          <div style={{textAlign: 'center', opacity: 0.55}}>
            <div style={{fontFamily: bebas, fontSize: 120, color: brand.ink, position: 'relative'}}>
              15 MIN
              <div
                style={{
                  position: 'absolute',
                  left: strike,
                  right: 0,
                  top: '50%',
                  height: 16,
                  backgroundColor: brand.danger,
                  rotate: '-8deg',
                }}
              />
            </div>
            <div style={{fontFamily: space, fontSize: 30, color: brand.inkSecondary}}>the card said</div>
          </div>
          <svg viewBox="0 0 100 60" style={{width: 150}}>
            <path d="M4 30 H86 M72 8 L94 30 L72 52" stroke={brand.accent} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{textAlign: 'center'}}>
            <div style={{fontFamily: bebas, fontSize: 210, color: brand.accent, lineHeight: 0.9}}>43</div>
            <div style={{fontFamily: space, fontWeight: 700, fontSize: 30, color: brand.inkSecondary}}>
              MINUTES REAL
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s23 — starburst punch: THE TRUTH. SFX: pop. */
export const Scene23: FC = () => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 5], [0.2, 1.06], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.7, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      <SpeedRays color="rgba(217,110,63,0.25)" opacity={0.9} />
      <AbsoluteFill style={{...center, scale: `${pop}`}}>
        <Starburst size={900} fill={brand.accent} inner={0.68} rotate={interpolate(frame, [0, 20], [6, -4])} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            translate: '-50% -50%',
            fontFamily: bebas,
            fontSize: 240,
            color: '#fff',
            letterSpacing: 8,
          }}
        >
          THE TRUTH
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s24 — cleanup included, +20 honest minutes. VO. */
export const Scene24: FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    {label: 'COOK', time: '43 MIN'},
    {label: 'CLEAN UP', time: '+20 MIN'},
    {label: 'GUESSWORK', time: '0 MIN'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays opacity={0.22} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 110, textAlign: 'center'}}>
        <div style={{fontFamily: bebas, fontSize: 130, color: brand.ink}}>CLEANUP? INCLUDED.</div>
        <div style={{fontFamily: space, fontWeight: 500, fontSize: 40, color: brand.inkSecondary}}>
          the recipe ends when the sink is empty
        </div>
      </div>
      {/* receipt */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 330,
          translate: `${interpolate(frame, [0, 10], ['-50% 160px', '-50% 0px'])}`,
          backgroundColor: brand.surface,
          border: `4px dashed ${brand.hairlineStrong}`,
          padding: '40px 70px',
          rotate: '-2deg',
          opacity: interpolate(frame, [0, 6], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        {lines.map((l, i) => (
          <div
            key={l.label}
            style={{
              display: 'flex',
              gap: 90,
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 0',
              borderBottom: i < 2 ? `2px solid ${brand.hairline}` : 'none',
              opacity: interpolate(frame, [4 + i * 4, 8 + i * 4], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div style={{fontFamily: space, fontWeight: 700, fontSize: 46, color: brand.ink}}>{l.label}</div>
            <div style={{fontFamily: bebas, fontSize: 56, color: l.label === 'CLEAN UP' ? brand.amber : brand.accent}}>
              {l.time}
            </div>
          </div>
        ))}
        <div style={{display: 'flex', gap: 20, alignItems: 'center', marginTop: 26}}>
          <Check size={52} color={brand.success} />
          <div style={{fontFamily: space, fontWeight: 700, fontSize: 40, color: brand.success}}>
            HONEST TOTAL: 63 MIN
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* s25 — Cook Mode runs every timer. VO. */
export const Scene25: FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [2, 30], [0, 300], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays opacity={0.2} />
      <div style={{position: 'absolute', left: 200, top: 120}}>
        <PhoneFrame scale={0.92}>
          <div style={{padding: '80px 34px 0', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div
              style={{
                fontFamily: space,
                fontWeight: 700,
                fontSize: 26,
                letterSpacing: 6,
                color: brand.accent,
              }}
            >
              COOK MODE
            </div>
            <div style={{position: 'relative', marginTop: 30}}>
              <svg viewBox="0 0 200 200" style={{width: 260, height: 260}}>
                <circle cx="100" cy="100" r="84" fill="none" stroke={brand.hairline} strokeWidth="18" />
                <circle
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke={brand.accent}
                  strokeWidth="18"
                  strokeDasharray={`${(sweep / 360) * 527.8} 527.8`}
                  transform="rotate(-90 100 100)"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  ...center,
                  fontFamily: bebas,
                  fontSize: 84,
                  color: brand.ink,
                }}
              >
                12:00
              </div>
            </div>
            <div style={{marginTop: 34, width: '100%', display: 'flex', flexDirection: 'column', gap: 12}}>
              {['SEAR THE CHICKEN', 'FLIP AT 6:30', 'REST 5:00'].map((s, i) => (
                <div
                  key={s}
                  style={{
                    fontFamily: space,
                    fontWeight: 500,
                    fontSize: 22,
                    color: i === 0 ? brand.canvas : brand.inkSecondary,
                    backgroundColor: i === 0 ? brand.accent : brand.surfaceSoft,
                    padding: '12px 18px',
                    borderRadius: 10,
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
        </PhoneFrame>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 300,
          width: 850,
          translate: `${interpolate(frame, [0, 10], [110, 0])}px 0`,
          opacity: interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        <div style={{fontFamily: bebas, fontSize: 200, color: brand.ink, lineHeight: 0.9}}>
          COOK MODE RUNS THE TIMERS
        </div>
        <div style={{fontFamily: space, fontWeight: 500, fontSize: 42, color: brand.inkSecondary, marginTop: 10}}>
          preheat, flip, rest — it counts so you don't
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* s26 — timer stack rings green. SFX: ding. */
export const Scene26: FC = () => {
  const frame = useCurrentFrame();
  const timers = [
    {label: 'PREHEAT', time: '8:00'},
    {label: 'FLIP', time: '6:30'},
    {label: 'REST', time: '5:00'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      <SpeedRays color="rgba(217,110,63,0.18)" opacity={0.9} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 130,
          textAlign: 'center',
          fontFamily: bebas,
          fontSize: 120,
          color: brand.canvas,
        }}
      >
        EVERY TIMER, AUTO
      </div>
      <div style={{position: 'absolute', left: 360, top: 330, display: 'flex', flexDirection: 'column', gap: 34, width: 1200}}>
        {timers.map((t, i) => {
          const on = frame >= 3 + i * 5;
          const pop = interpolate(frame, [3 + i * 5, 8 + i * 5], [0.86, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1.6, 0.4, 1),
          });
          return (
            <div
              key={t.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 34,
                padding: '24px 40px',
                borderRadius: 22,
                backgroundColor: on ? brand.successSoft : brand.darkSurface,
                border: `3px solid ${on ? brand.success : brand.darkSurfaceSoft}`,
                scale: `${pop}`,
              }}
            >
              {on ? <Check size={58} /> : <div style={{width: 58, height: 58, borderRadius: '50%', backgroundColor: brand.darkSurfaceSoft}} />}
              <div style={{fontFamily: space, fontWeight: 700, fontSize: 46, color: on ? brand.ink : brand.creamFaint, flex: 1}}>
                {t.label}
              </div>
              <div style={{fontFamily: bebas, fontSize: 60, color: on ? brand.success : brand.creamFaint}}>{t.time}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* s27 — offline: bars drop, recipes stay. VO. */
export const Scene27: FC = () => {
  const frame = useCurrentFrame();
  const barsOn = 5 - Math.min(5, Math.floor(frame / 3));
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <SpeedRays opacity={0.2} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 120, textAlign: 'center'}}>
        <div style={{fontFamily: bebas, fontSize: 170, color: brand.ink}}>NO SIGNAL? KEEP COOKING.</div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 380, ...center, gap: 120}}>
        {/* signal bars */}
        <div style={{display: 'flex', alignItems: 'flex-end', gap: 18}}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                width: 54,
                height: 90 + i * 60,
                backgroundColor: i < barsOn ? brand.inkSecondary : brand.hairline,
                borderRadius: 10,
                scale: `${interpolate(frame, [i * 3, i * 3 + 4], [1, barsOn > i ? 1 : 0.9], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })}`,
              }}
            />
          ))}
        </div>
        {/* airplane */}
        <div
          style={{
            width: 260,
            height: 260,
            borderRadius: '50%',
            backgroundColor: brand.ink,
            ...center,
            scale: `${interpolate(frame, [8, 14], [0.3, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.2, 1.6, 0.4, 1),
            })}`,
          }}
        >
          <svg viewBox="0 0 24 24" style={{width: 150, height: 150, rotate: '-45deg'}}>
            <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill={brand.canvas} />
          </svg>
        </div>
        {/* recipe stays bright */}
        <div
          style={{
            backgroundColor: brand.surface,
            border: `4px solid ${brand.hairlineStrong}`,
            borderRadius: 16,
            padding: '26px 34px',
            rotate: '3deg',
            boxShadow: '0 18px 36px rgba(36,29,23,0.15)',
          }}
        >
          <div style={{fontFamily: bebas, fontSize: 44, color: brand.ink}}>ROAST CHICKEN</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 8}}>
            <Check size={44} />
            <div style={{fontFamily: space, fontWeight: 500, fontSize: 26, color: brand.success}}>STILL LOADED</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* s28 — cabin vignette, works offline. SFX: click. */
export const Scene28: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* cozy glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 62%, rgba(217,110,63,0.28) 0%, rgba(23,19,16,0) 55%)',
        }}
      />
      {/* cabin logs */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...(i % 2 === 0 ? {left: -40} : {right: -40}),
            top: 40 + i * 64,
            width: 520,
            height: 44,
            backgroundColor: brand.darkSurfaceSoft,
            borderRadius: 22,
            opacity: 0.7,
          }}
        />
      ))}
      <div style={{position: 'absolute', left: 0, right: 0, top: 470, ...center, gap: 40}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
          <PhoneFrame scale={0.5} rotate={-3}>
            <div style={{...center, height: '100%'}}>
              <div style={{fontFamily: bebas, fontSize: 130, color: brand.accentBright}}>43 MIN</div>
            </div>
          </PhoneFrame>
        </div>
        <div
          style={{
            fontFamily: bebas,
            fontSize: 170,
            color: brand.cream,
            lineHeight: 0.95,
            textAlign: 'left',
          }}
        >
          WORKS
          <br />
          OFFLINE
        </div>
        <div
          style={{
            scale: `${interpolate(frame, [4, 9], [0.3, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.2, 1.6, 0.4, 1),
            })}`,
          }}
        >
          <Check size={110} />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: SAFE,
          bottom: 110,
          fontFamily: space,
          fontWeight: 500,
          fontSize: 36,
          color: brand.creamFaint,
          opacity: interpolate(frame, [6, 12], [0, 1], {extrapolateRight: 'clamp'}),
        }}
      >
        cabin, basement, airplane mode — dinner still loads
      </div>
    </AbsoluteFill>
  );
};
