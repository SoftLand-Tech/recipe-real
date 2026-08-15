// ACT 5 · deploy — install, cook, pass.
import {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, CLAMP, Check, Chip, EASE_IO, EASE_OUT, F, GridBg, Phone, POP, ScreenRow, countUp, prog, shake} from './ui';

/* s32 (28f) — update banner on phone */
export const S32: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <GridBg drift={0.5} opacity={0.6} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70}}>
        <Phone>
          <div
            style={{
              position: 'absolute',
              top: 130,
              left: 26,
              right: 26,
              backgroundColor: C.panel,
              border: `2px solid ${C.terra}`,
              borderRadius: 18,
              padding: '30px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              translate: `0px ${interpolate(prog(frame, 0, 9, EASE_OUT), [0, 1], [-420, 0])}px`,
              boxShadow: '0 0 50px rgba(217,110,63,0.25)',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 30, color: C.terra}}>RecipeReal 2.0</div>
              <div style={{flex: 1}} />
              <Chip label="READY" color="#FFF3ED" bg={C.terra} size={22} />
            </div>
            <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 38, color: C.text, lineHeight: 1.25}}>
              Honest timers. Cleanup included.
            </div>
            <div
              style={{
                alignSelf: 'stretch',
                textAlign: 'center',
                fontFamily: F.base,
                fontWeight: 700,
                fontSize: 34,
                color: '#FFF6F2',
                backgroundColor: C.terra,
                borderRadius: 14,
                padding: '16px 0',
                scale: frame >= 18 && frame < 23 ? 0.94 : 1,
                boxShadow: `0 0 ${interpolate(frame, [6, 24], [10, 34], CLAMP)}px rgba(217,110,63,0.5)`,
              }}
            >
              Install
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              top: 96,
              left: 30,
              fontFamily: F.mono,
              fontSize: 26,
              color: C.faint,
            }}
          >
            tonight&apos;s dinner
          </div>
        </Phone>
        <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
          <div style={{fontFamily: F.mono, fontSize: 46, color: C.dim}}>deploy</div>
          <svg width="70" height="40" viewBox="0 0 70 40">
            <path d="M4 20 H54 M40 6 L56 20 L40 34" stroke={C.green} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 46, color: C.green}}>kitchen</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s33 (24f) — SFX-only: install progress */
export const S33: FC = () => {
  const frame = useCurrentFrame();
  const pct = Math.round(interpolate(frame, [0, 17], [0, 100], {...CLAMP, easing: EASE_IO}));
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Phone>
          <ScreenRow style={{justifyContent: 'center', gap: 34, top: 320}}>
            <div style={{fontFamily: F.mono, fontSize: 30, color: C.dim, textAlign: 'center'}}>installing honesty…</div>
            <div style={{width: '100%', height: 30, backgroundColor: '#2C343C', borderRadius: 15, overflow: 'hidden'}}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  backgroundColor: C.green,
                  borderRadius: 15,
                }}
              />
            </div>
            <div
              style={{
                fontFamily: F.mono,
                fontWeight: 700,
                fontSize: 74,
                color: C.text,
                lineHeight: 1,
              }}
            >
              {pct}%
            </div>
            <div style={{height: 90, display: 'flex', alignItems: 'center'}}>
              {frame >= 18 ? <Check size={76} start={18} dur={5} /> : null}
            </div>
            {frame >= 20 ? (
              <Chip label="INSTALLED" color="#DFF2E4" bg={C.greenDeep} size={26} style={{alignSelf: 'center'}} />
            ) : null}
          </ScreenRow>
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s34 (50f) — cook mode: 43:00 verified */
export const S34: FC = () => {
  const frame = useCurrentFrame();
  const remaining = Math.round(interpolate(frame, [4, 44], [43 * 60, 27 * 60], CLAMP));
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Phone>
          <ScreenRow top={120}>
            <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 34, color: C.terra, letterSpacing: 3}}>COOK MODE</div>
              <div style={{flex: 1}} />
              <Chip label="ON" color="#DFF2E4" bg={C.greenDeep} size={22} />
            </div>
            <div style={{display: 'flex', justifyContent: 'center', marginTop: 40}}>
              <div style={{position: 'relative', width: 340, height: 340}}>
                <svg width="340" height="340" viewBox="0 0 340 340">
                  <circle cx="170" cy="170" r="140" fill="none" stroke={C.line} strokeWidth="18" />
                  <circle
                    cx="170"
                    cy="170"
                    r="140"
                    fill="none"
                    stroke={C.green}
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray={880}
                    strokeDashoffset={880 - 880 * interpolate(frame, [4, 44], [0, 0.42], CLAMP)}
                    transform="rotate(-90 170 170)"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 92, color: C.text, lineHeight: 1}}>
                    {mm}:{ss}
                  </div>
                  <div style={{fontFamily: F.mono, fontSize: 26, color: C.faint}}>verified total</div>
                </div>
              </div>
            </div>
            <div style={{display: 'flex', justifyContent: 'center', marginTop: 26}}>
              <Chip label="verified by 10,406 cooks" color={C.green} size={24} />
            </div>
            <div
              style={{
                marginTop: 20,
                backgroundColor: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                padding: '22px 26px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div style={{width: 16, height: 16, borderRadius: 8, backgroundColor: C.terra, boxShadow: '0 0 18px rgba(217,110,63,0.8)'}} />
              <div style={{fontFamily: F.base, fontSize: 32, color: C.text}}>step 4 of 7 — simmer</div>
              <div style={{flex: 1}} />
              <div style={{fontFamily: F.mono, fontSize: 30, color: C.green}}>auto</div>
            </div>
          </ScreenRow>
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s35 (31f) — timers run themselves */
export const S35: FC = () => {
  const frame = useCurrentFrame();
  const steps = [
    {t: 'chop', d: '10:00'},
    {t: 'preheat', d: '5:00'},
    {t: 'simmer', d: '20:00'},
    {t: 'rest + cleanup', d: '8:00'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Phone>
          <ScreenRow top={130}>
            <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 34, color: C.terra, letterSpacing: 3, marginBottom: 8 }}>
              TONIGHT
            </div>
            {steps.map((s, i) => {
              const done = frame >= 3 + i * 5;
              const active = !done && (i === 0 || frame >= 3 + (i - 1) * 5);
              return (
                <div
                  key={s.t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    backgroundColor: active ? 'rgba(217,110,63,0.14)' : C.panel,
                    border: `2px solid ${active ? C.terra : C.line}`,
                    borderRadius: 14,
                    padding: '20px 24px',
                    translate: active ? shake(frame, 3 + i * 5, 4, 6) : '0px 0px',
                  }}
                >
                  <div style={{width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    {done ? <Check size={40} start={3 + i * 5} dur={5} /> : <div style={{width: 18, height: 18, borderRadius: 9, backgroundColor: active ? C.terra : C.line}} />}
                  </div>
                  <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 36, color: done ? C.faint : C.text, textDecoration: done ? 'line-through' : 'none'}}>
                    {s.t}
                  </div>
                  <div style={{flex: 1}} />
                  <div style={{fontFamily: F.mono, fontSize: 32, color: done ? C.green : C.dim}}>{s.d}</div>
                </div>
              );
            })}
          </ScreenRow>
        </Phone>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s36 (27f) — dinner: passing */
export const S36: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 1150,
            backgroundColor: 'rgba(63,125,82,0.12)',
            border: `3px solid ${C.greenDeep}`,
            borderRadius: 20,
            boxShadow: `0 0 ${interpolate(frame, [2, 20], [0, 90], CLAMP)}px rgba(111,169,127,0.25)`,
            padding: '54px 70px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 30,
            scale: interpolate(prog(frame, 0, 8, POP), [0, 1], [0.85, 1]),
            translate: shake(frame, 9, 8, 9),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
            <Check size={120} start={2} dur={7} />
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 110, color: C.green, lineHeight: 1}}>
              dinner: passing
            </div>
          </div>
          <div style={{display: 'flex', gap: 26, opacity: interpolate(frame, [12, 18], [0, 1], CLAMP)}}>
            <Chip label={`build #${countUp(frame, 8401, 8402, 12, 18)}`} color={C.dim} size={30} />
            <Chip label="0 failed" color={C.dim} size={30} />
            <Chip label="1 eaten" color={C.terra} size={30} />
          </div>
          <div style={{fontFamily: F.mono, fontSize: 30, color: C.faint, opacity: interpolate(frame, [16, 22], [0, 1], CLAMP)}}>
            runtime: 43:00 as advertised · cleanup: done
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s37 (45f) — ship dinner, not excuses */
export const S37: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: '#0A0D12', alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          scale: interpolate(frame, [0, 44], [1, 1.035], CLAMP),
        }}
      >
        <div
          style={{
            fontFamily: F.display,
            fontSize: 250,
            lineHeight: 1,
            color: C.text,
            letterSpacing: 6,
            scale: interpolate(prog(frame, 0, 8, POP), [0, 1], [1.4, 1]),
          }}
        >
          SHIP DINNER.
        </div>
        <div
          style={{
            position: 'relative',
            fontFamily: F.display,
            fontSize: 250,
            lineHeight: 1,
            color: C.terra,
            letterSpacing: 6,
            scale: interpolate(prog(frame, 9, 17, POP), [0, 1], [1.4, 1]),
            opacity: interpolate(frame, [9, 12], [0, 1], CLAMP),
          }}
        >
          NOT EXCUSES.
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: -18,
              height: 14,
              width: interpolate(frame, [22, 34], [0, 1150], CLAMP),
              backgroundColor: C.terra,
              borderRadius: 7,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
