// Phone mockup + hand-built Cook Mode UI. All timing is a pure function of the
// global frame (the phone stage renders in the root context, un-Sequenced).
import type {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {inter} from './fonts';
import {
  CLAMP,
  EASE_OUT,
  EASE_OVERSHOOT,
  IconAirplane,
  IconBattery,
  IconCheck,
  IconChevronLeft,
  IconClock,
  IconHeart,
  IconPhoneSaved,
  IconSignal,
  IconStar,
  IconWifiOff,
  PanOnFire,
  ProgressRing,
  SmokeLayer,
  TapRipple,
  formatClock,
} from './bits';

// ---------------------------------------------------------------------------
// Timing map (global frames @ 30fps)
// ---------------------------------------------------------------------------
export const TAP_FRAME = 225; // finger taps "Start Cook Mode" (7.5s)
export const DING_FRAMES = [795, 870, 945, 1020, 1095, 1170]; // 26.5s → 39s

const DISASTER_OUT: [number, number] = [84, 108];
const A_IN = 92; // recipe screen reveal (~3.1s)
const B_IN = 248; // cook timeline screen (8.3s)
const ROW_IN = 285; // first step row (9.5s)
const SCROLL_SWITCHES = [1020, 1095]; // list scrolls to reveal rows 5–6
const OFFLINE_TOAST = 1215; // 40.5s
const OFFLINE_PANEL = 1230; // 41s
const TOGGLE: [number, number] = [1236, 1248]; // airplane knob slides
const CHECK_IN = 1290; // 43s — self-drawing checkmark
const PHONE_EXIT: [number, number] = [1362, 1390];

const SCREEN_W = 592;
const SCREEN_H = 1262;

type Step = {
  title: string;
  detail: string;
  minutes: number;
  cooks: number;
};

const STEPS: readonly Step[] = [
  {
    title: 'Preheat the pan',
    detail: 'Medium-high. Three minutes before anything touches it.',
    minutes: 5,
    cooks: 212,
  },
  {
    title: 'Sear the chicken',
    detail: 'Skin side down. Do not move it for six minutes.',
    minutes: 8,
    cooks: 341,
  },
  {
    title: 'Build the sauce',
    detail: 'Scrape up the fond. Add stock and mustard.',
    minutes: 6,
    cooks: 198,
  },
  {
    title: 'Wilt the greens',
    detail: 'Into the sauce, two handfuls at a time.',
    minutes: 4,
    cooks: 156,
  },
  {
    title: 'Simmer it down',
    detail: 'Low bubble, until it coats a spoon.',
    minutes: 12,
    cooks: 289,
  },
  {
    title: 'Rest & plate',
    detail: 'Off the heat, loose foil, five minutes.',
    minutes: 5,
    cooks: 173,
  },
];

const stepStart = (i: number): number =>
  i === 0 ? ROW_IN + 30 : DING_FRAMES[i - 1];

const stepProgress = (frame: number, i: number): number =>
  interpolate(frame, [stepStart(i), DING_FRAMES[i]], [0, 1], CLAMP);

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------
const StatusBar: FC<{dark?: boolean; airplane?: boolean}> = ({
  dark = false,
  airplane = false,
}) => {
  const ink = dark ? brand.cream : brand.ink;
  const faint = dark ? brand.creamFaint : brand.inkFaint;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 34px 0',
        fontFamily: inter,
      }}
    >
      <span style={{color: ink, fontSize: 23, fontWeight: 700}}>19:42</span>
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        {airplane ? (
          <IconAirplane size={24} color={brand.accent} />
        ) : (
          <IconSignal size={22} color={faint} />
        )}
        <IconBattery size={26} color={faint} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// HOOK screen — burning pan, smoke, "the recipe forgot to preheat"
// ---------------------------------------------------------------------------
const DisasterScreen: FC = () => {
  const frame = useCurrentFrame();
  const chipIn = interpolate(frame, [12, 26], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(180deg, #191310 0%, #241610 52%, #3A1E10 100%)',
        opacity: interpolate(
          frame,
          [DISASTER_OUT[0], DISASTER_OUT[1]],
          [1, 0],
          CLAMP,
        ),
      }}
    >
      <StatusBar dark />

      {/* the culprit */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: chipIn,
          translate: `0px ${(1 - chipIn) * -18}px`,
        }}
      >
        <div
          style={{
            padding: '12px 24px',
            borderRadius: 999,
            backgroundColor: 'rgba(178, 58, 46, 0.18)',
            border: '2px solid rgba(217, 107, 92, 0.55)',
            color: '#F2B9AE',
            fontFamily: inter,
            fontWeight: 600,
            fontSize: 19,
          }}
        >
          Recipe, step 4 — “cook until done”
        </div>
      </div>

      <PanOnFire frame={frame} />
      <SmokeLayer frame={frame} width={SCREEN_W} height={SCREEN_H} tint="#84796F" />

      {/* vignette */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(120% 90% at 50% 42%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.5) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Recipe screen — the clean UI the smoke reveals (3s → 8.3s)
// ---------------------------------------------------------------------------
const RecipeScreen: FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [A_IN, A_IN + 26], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const exit = interpolate(frame, [240, 262], [1, 0], CLAMP);
  const reveal = (delay: number): number =>
    interpolate(frame, [A_IN + delay, A_IN + 14 + delay], [0, 1], {
      ...CLAMP,
      easing: EASE_OUT,
    });

  const pressed = interpolate(
    frame,
    [TAP_FRAME - 2, TAP_FRAME + 1, TAP_FRAME + 9],
    [1, 0.965, 1],
    CLAMP,
  );
  const ctaColor =
    frame >= TAP_FRAME - 2 && frame <= TAP_FRAME + 9
      ? brand.accentPress
      : brand.accent;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.surface,
        padding: 26,
        fontFamily: inter,
        opacity: Math.min(enter, exit),
        scale: interpolate(enter, [0, 1], [0.97, 1], CLAMP),
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{opacity: enter}}>
        <StatusBar />
      </div>

      {/* nav row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 18,
          opacity: reveal(4),
          translate: `0px ${(1 - reveal(4)) * 14}px`,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            backgroundColor: brand.surfaceSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconChevronLeft size={26} color={brand.inkSecondary} />
        </div>
        <span
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: brand.inkSecondary,
            letterSpacing: 0.3,
          }}
        >
          Saved recipes
        </span>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            backgroundColor: brand.surfaceSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconHeart size={26} color={brand.accent} />
        </div>
      </div>

      {/* hero card */}
      <div
        style={{
          marginTop: 20,
          height: 250,
          borderRadius: 28,
          overflow: 'hidden',
          position: 'relative',
          background: `linear-gradient(140deg, ${brand.amberSoft} 0%, ${brand.accentSoft} 62%, #EFD5BC 100%)`,
          opacity: reveal(10),
          translate: `0px ${(1 - reveal(10)) * 20}px`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -30,
            width: 190,
            height: 190,
            borderRadius: '50%',
            backgroundColor: 'rgba(191, 85, 43, 0.14)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 52,
            right: 64,
            width: 110,
            height: 110,
            borderRadius: '50%',
            backgroundColor: 'rgba(200, 130, 31, 0.2)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 26,
            bottom: 22,
            right: 26,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: brand.ink,
              lineHeight: 1.15,
            }}
          >
            Skillet Chicken
            <br />
            &amp; Greens
          </div>
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 19,
              fontWeight: 600,
              color: brand.inkSecondary,
            }}
          >
            <span>42 min · 6 steps</span>
            <IconStar size={17} color={brand.amber} />
            <span>4.8</span>
          </div>
        </div>
      </div>

      {/* tonight label + chips */}
      <div
        style={{
          marginTop: 24,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 2.4,
          color: brand.inkFaint,
          opacity: reveal(18),
        }}
      >
        TONIGHT
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          gap: 10,
          opacity: reveal(22),
          translate: `0px ${(1 - reveal(22)) * 12}px`,
        }}
      >
        {['Cast-iron pan', 'Chicken thighs', 'Leafy greens'].map((c) => (
          <div
            key={c}
            style={{
              padding: '12px 18px',
              borderRadius: 14,
              backgroundColor: brand.surfaceSoft,
              border: `1.5px solid ${brand.hairline}`,
              color: brand.inkSecondary,
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            {c}
          </div>
        ))}
      </div>

      {/* pantry check */}
      <div
        style={{
          marginTop: 24,
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: 2.4,
          color: brand.inkFaint,
          opacity: reveal(26),
        }}
      >
        YOU ALREADY HAVE
      </div>
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          opacity: reveal(30),
          translate: `0px ${(1 - reveal(30)) * 12}px`,
        }}
      >
        {[
          ['Chicken thighs', '450 g, room temp'],
          ['Leafy greens', 'two big handfuls'],
          ['Cast-iron pan', 'well seasoned'],
        ].map(([name, note]) => (
          <div
            key={name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: brand.successSoft,
            }}
          >
            <IconCheck size={20} color={brand.success} />
            <span style={{fontSize: 18, fontWeight: 700, color: brand.ink}}>
              {name}
            </span>
            <span style={{fontSize: 16, fontWeight: 500, color: brand.inkSecondary}}>
              {note}
            </span>
          </div>
        ))}
      </div>

      <div style={{flex: 1}} />

      {/* CTA */}
      <div
        style={{
          position: 'relative',
          height: 94,
          borderRadius: 26,
          backgroundColor: ctaColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 14px 34px rgba(191, 85, 43, 0.35)',
          scale: `${pressed}`,
          opacity: reveal(28),
          translate: `0px ${(1 - reveal(28)) * 16}px`,
        }}
      >
        <span style={{color: '#FFFFFF', fontSize: 27, fontWeight: 700, letterSpacing: 0.3}}>
          Start Cook Mode
        </span>
        <TapRipple frame={frame} at={TAP_FRAME} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Community-time badge (pops with overshoot)
// ---------------------------------------------------------------------------
const TimeBadge: FC<{frame: number; at: number; minutes: number; cooks: number}> = ({
  frame,
  at,
  minutes,
  cooks,
}) => {
  const pop = interpolate(frame, [at, at + 18], [0, 1], {
    ...CLAMP,
    easing: EASE_OVERSHOOT,
  });
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '9px 14px',
        borderRadius: 12,
        backgroundColor: brand.amberSoft,
        opacity: Math.min(1, pop * 1.4),
        scale: pop,
      }}
    >
      <IconClock size={15} color={brand.amber} />
      <div style={{display: 'flex', flexDirection: 'column', lineHeight: 1.15}}>
        <span
          style={{
            fontFamily: inter,
            fontSize: 16,
            fontWeight: 800,
            color: brand.amber,
          }}
        >
          {minutes} min
        </span>
        <span
          style={{
            fontFamily: inter,
            fontSize: 12.5,
            fontWeight: 600,
            color: brand.inkSecondary,
          }}
        >
          {cooks} cooks
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Cook Mode timeline screen (8.3s → end)
// ---------------------------------------------------------------------------
const CookScreen: FC = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [B_IN, B_IN + 18], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const focus = DING_FRAMES.filter((d) => frame >= d).length; // 0..6
  const activeIdx = Math.min(focus, 5);
  const allDone = focus >= 6;
  const lastSwitch = focus === 0 ? ROW_IN + 30 : DING_FRAMES[focus - 1];
  const cardT = frame - (allDone ? DING_FRAMES[5] : lastSwitch);
  const cardEnter = interpolate(cardT, [0, 10], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  // header clock — 40:00 across the demo
  const elapsed = 2400 * interpolate(frame, [ROW_IN + 30, DING_FRAMES[5]], [0, 1], CLAMP);

  // cumulative eased scroll (one row pitch per switch)
  const scroll =
    SCROLL_SWITCHES.reduce(
      (acc, d) =>
        acc +
        interpolate(frame, [d, d + 14], [0, 1], {...CLAMP, easing: EASE_OUT}),
      0,
    ) * 168;

  const timerChipOn = allDone
    ? 0
    : interpolate(cardT, [2, 8, 24, 30], [0, 1, 1, 0], CLAMP);

  const active = STEPS[activeIdx];
  const activeProgress = allDone ? 1 : stepProgress(frame, activeIdx);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.surface,
        padding: 26,
        fontFamily: inter,
        opacity: enter,
        translate: `0px ${(1 - enter) * -22}px`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{opacity: enter}}>
        <StatusBar airplane={frame >= TOGGLE[0]} />
      </div>

      {/* header */}
      <div
        style={{
          marginTop: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{fontSize: 30, fontWeight: 800, color: brand.ink}}>
            Cook Mode
          </div>
          <div style={{fontSize: 17, fontWeight: 600, color: brand.inkFaint, marginTop: 2}}>
            Skillet Chicken &amp; Greens
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            padding: '10px 16px',
            borderRadius: 999,
            backgroundColor: brand.dangerSoft,
          }}
        >
          <div
            style={{
              width: 11,
              height: 11,
              borderRadius: '50%',
              backgroundColor: brand.danger,
            }}
          />
          <span style={{fontSize: 20, fontWeight: 700, color: brand.danger}}>
            {formatClock(elapsed)}
          </span>
        </div>
      </div>

      {/* step N of 6 + progress bar */}
      <div style={{marginTop: 18}}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1.6,
            color: brand.inkSecondary,
          }}
        >
          <span>{allDone ? 'ALL STEPS DONE' : `STEP ${activeIdx + 1} OF 6`}</span>
          <span>40:00 TOTAL</span>
        </div>
        <div
          style={{
            marginTop: 8,
            height: 8,
            borderRadius: 999,
            backgroundColor: brand.hairline,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              borderRadius: 999,
              backgroundColor: brand.accent,
              width: `${(Math.min(focus + activeProgress, 6) / 6) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* current step card */}
      <div
        style={{
          marginTop: 18,
          height: 246,
          borderRadius: 26,
          backgroundColor: brand.canvas,
          border: `2px solid ${brand.hairline}`,
          padding: 22,
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          opacity: Math.max(cardEnter, 0.001),
        }}
      >
        <ProgressRing
          size={158}
          stroke={13}
          progress={activeProgress}
          color={allDone ? brand.success : brand.accent}
          track={brand.hairline}
        >
          {allDone || activeProgress >= 1 ? (
            <IconCheck size={62} color={brand.success} />
          ) : (
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: 33, fontWeight: 800, color: brand.ink}}>
                {formatClock(active.minutes * 60 * (1 - activeProgress))}
              </div>
              <div style={{fontSize: 13, fontWeight: 700, color: brand.inkFaint, letterSpacing: 1.2}}>
                MIN SEC
              </div>
            </div>
          )}
        </ProgressRing>

        <div style={{flex: 1, minWidth: 0}}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: 2.2,
              color: allDone ? brand.success : brand.accent,
            }}
          >
            {allDone ? 'DINNER IS READY' : `STEP ${activeIdx + 1}`}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 28,
              fontWeight: 800,
              color: brand.ink,
              lineHeight: 1.1,
            }}
          >
            {allDone ? 'Zero fires.' : active.title}
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 16.5,
              fontWeight: 500,
              color: brand.inkSecondary,
              lineHeight: 1.3,
            }}
          >
            {allDone
              ? 'Six steps, forty minutes — nothing burned.'
              : active.detail}
          </div>
          <div style={{marginTop: 12, display: 'flex', alignItems: 'center', gap: 10}}>
            {allDone ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 14px',
                  borderRadius: 12,
                  backgroundColor: brand.successSoft,
                  color: brand.success,
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                <IconCheck size={16} color={brand.success} />
                Cooked by the book
              </div>
            ) : (
              <TimeBadge
                frame={frame}
                at={lastSwitch + 6}
                minutes={active.minutes}
                cooks={active.cooks}
              />
            )}
            {timerChipOn > 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 10,
                  backgroundColor: brand.successSoft,
                  color: brand.success,
                  fontSize: 13.5,
                  fontWeight: 700,
                  opacity: timerChipOn,
                }}
              >
                <IconClock size={14} color={brand.success} />
                Timer auto-started
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* step rows */}
      <div
        style={{
          marginTop: 18,
          position: 'relative',
          flex: 1,
          minHeight: 492,
          overflow: 'hidden',
        }}
      >
        <div style={{translate: `0px ${-scroll}px`}}>
          {STEPS.map((s, i) => {
            const inAt = ROW_IN + i * 9;
            const rowIn = interpolate(frame, [inAt, inAt + 14], [0, 1], {
              ...CLAMP,
              easing: EASE_OUT,
            });
            const done = frame >= DING_FRAMES[i];
            const isActive = !allDone && i === activeIdx;
            const p = done ? 1 : isActive ? stepProgress(frame, i) : 0;
            return (
              <div
                key={s.title}
                style={{
                  height: 150,
                  marginBottom: 18,
                  borderRadius: 22,
                  backgroundColor: isActive ? brand.accentSoft : brand.surface,
                  border: `1.5px solid ${isActive ? 'rgba(191,85,43,0.35)' : brand.hairline}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  padding: '0 20px',
                  opacity: rowIn,
                  translate: `${(1 - rowIn) * -36}px 0px`,
                }}
              >
                <ProgressRing
                  size={58}
                  stroke={5.5}
                  progress={p}
                  color={done ? brand.success : brand.accent}
                  track={brand.hairline}
                >
                  {done ? (
                    <IconCheck size={26} color={brand.success} />
                  ) : (
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: isActive ? brand.accent : brand.inkFaint,
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                </ProgressRing>

                <div style={{flex: 1, minWidth: 0}}>
                  <div
                    style={{
                      fontSize: 23,
                      fontWeight: 700,
                      color: done
                        ? brand.inkSecondary
                        : isActive
                          ? brand.ink
                          : brand.inkFaint,
                      textDecoration: done ? 'line-through' : 'none',
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 16,
                      fontWeight: 600,
                      color: brand.inkFaint,
                    }}
                  >
                    {done ? 'Done — nice work' : `Reported by ${s.cooks} cooks`}
                  </div>
                </div>

                {done ? (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: 12,
                      backgroundColor: brand.successSoft,
                      color: brand.success,
                      fontWeight: 800,
                      fontSize: 17,
                      opacity: rowIn,
                    }}
                  >
                    Done
                  </div>
                ) : (
                  <TimeBadge
                    frame={frame}
                    at={inAt + 18}
                    minutes={s.minutes}
                    cooks={s.cooks}
                  />
                )}
              </div>
            );
          })}
        </div>
        {/* scroll fade */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 54,
            background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${brand.surface} 92%)`,
          }}
        />
      </div>

      {/* ---------------- offline beat (40.5s →) ---------------- */}
      <OfflineOverlay frame={frame} />
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Offline overlay — connection toast, airplane toggle, self-drawing check
// ---------------------------------------------------------------------------
const OfflineOverlay: FC<{frame: number}> = ({frame}) => {
  const toast = interpolate(frame, [OFFLINE_TOAST, OFFLINE_TOAST + 12], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const panel = interpolate(frame, [OFFLINE_PANEL, OFFLINE_PANEL + 16], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const knob = interpolate(frame, [TOGGLE[0], TOGGLE[1]], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const scrim = interpolate(frame, [CHECK_IN, CHECK_IN + 10], [0, 0.8], CLAMP);
  const badgePop = interpolate(frame, [CHECK_IN + 2, CHECK_IN + 20], [0, 1], {
    ...CLAMP,
    easing: EASE_OVERSHOOT,
  });
  const checkDraw = interpolate(frame, [CHECK_IN + 6, CHECK_IN + 30], [1, 0], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const textIn = interpolate(frame, [CHECK_IN + 14, CHECK_IN + 28], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });

  return (
    <>
      {/* connection lost toast */}
      <div
        style={{
          position: 'absolute',
          top: 74,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: toast,
          translate: `0px ${(1 - toast) * -30}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 22px',
            borderRadius: 999,
            backgroundColor: brand.dangerSoft,
            color: brand.danger,
            fontFamily: inter,
            fontSize: 19,
            fontWeight: 700,
          }}
        >
          <IconWifiOff size={21} color={brand.danger} />
          No connection
        </div>
      </div>

      {/* airplane panel */}
      <div
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: 20,
          borderRadius: 26,
          backgroundColor: brand.surface,
          border: `2px solid ${brand.hairline}`,
          boxShadow: '0 18px 44px rgba(36, 29, 23, 0.14)',
          padding: 24,
          opacity: panel,
          translate: `0px ${(1 - panel) * 56}px`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
          {/* toggle */}
          <div
            style={{
              width: 88,
              height: 48,
              borderRadius: 999,
              backgroundColor: knob > 0.5 ? brand.amber : brand.hairlineStrong,
              position: 'relative',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 5,
                left: 5 + knob * 40,
                width: 38,
                height: 38,
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 3px 8px rgba(36,29,23,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  scale: `${interpolate(frame, [TOGGLE[1] + 1, TOGGLE[1] + 7], [0, 1], {
                    ...CLAMP,
                    easing: EASE_OVERSHOOT,
                  })}`,
                }}
              >
                <IconAirplane size={22} color={brand.amber} />
              </div>
            </div>
          </div>
          <div>
            <div style={{fontSize: 23, fontWeight: 800, color: brand.ink}}>
              Airplane mode
            </div>
            <div style={{fontSize: 16.5, fontWeight: 600, color: brand.inkSecondary, marginTop: 2}}>
              Recipes stay on this phone
            </div>
          </div>
        </div>

        <div
          style={{
            height: 1.5,
            backgroundColor: brand.hairline,
            margin: '18px 0',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 18,
            fontWeight: 700,
            color: brand.success,
          }}
        >
          <IconPhoneSaved size={24} color={brand.success} />
          148 recipes saved offline
        </div>
      </div>

      {/* success check overlay */}
      {scrim > 0 ? (
        <AbsoluteFill
          style={{
            backgroundColor: brand.canvas,
            opacity: scrim,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            fontFamily: inter,
          }}
        >
          <div
            style={{
              width: 208,
              height: 208,
              borderRadius: '50%',
              backgroundColor: brand.successSoft,
              border: `4px solid ${brand.success}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              scale: `${badgePop}`,
            }}
          >
            <svg width={116} height={96} viewBox="0 0 116 96" fill="none">
              <path
                d="M12 52 L44 82 L104 14"
                stroke={brand.success}
                strokeWidth={11}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={checkDraw}
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: brand.ink,
              opacity: textIn,
              translate: `0px ${(1 - textIn) * 12}px`,
            }}
          >
            Still cooking.
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: brand.inkSecondary,
              opacity: textIn,
            }}
          >
            Cook Mode works without a signal
          </div>
        </AbsoluteFill>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------------------
// Phone stage — bezel, dynamic island, screen crossfades, rise + exit motion
// ---------------------------------------------------------------------------
export const PhoneStage: FC = () => {
  const frame = useCurrentFrame();
  const rise = interpolate(frame, [150, 192], [150, 0], {
    ...CLAMP,
    easing: EASE_OVERSHOOT,
  });
  const riseScale = interpolate(frame, [150, 192], [0.94, 1], {
    ...CLAMP,
    easing: EASE_OVERSHOOT,
  });
  const exitFade = interpolate(
    frame,
    [PHONE_EXIT[0], PHONE_EXIT[1]],
    [1, 0],
    CLAMP,
  );
  const exitLift = interpolate(
    frame,
    [PHONE_EXIT[0], PHONE_EXIT[1]],
    [0, -44],
    CLAMP,
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 230,
          top: 280,
          width: 620,
          height: 1290,
          borderRadius: 84,
          backgroundColor: brand.ink,
          padding: 14,
          boxShadow: '0 34px 90px rgba(20, 14, 10, 0.4)',
          translate: `0px ${rise + exitLift}px`,
          scale: `${riseScale}`,
          opacity: exitFade,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            borderRadius: 70,
            overflow: 'hidden',
            backgroundColor: brand.surface,
          }}
        >
          <DisasterScreen />
          <RecipeScreen />
          <CookScreen />

          {/* smoke clearing over the reveal (3–4.1s) */}
          <SmokeLayer
            frame={frame}
            width={SCREEN_W}
            height={SCREEN_H}
            tint="#9C9082"
            opacity={interpolate(frame, [0, 84, 122], [0.55, 0.55, 0], CLAMP)}
          />

          {/* dynamic island */}
          <div
            style={{
              position: 'absolute',
              top: 16,
              left: '50%',
              translate: '-50% 0px',
              width: 148,
              height: 34,
              borderRadius: 999,
              backgroundColor: '#0C0906',
              zIndex: 6,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
