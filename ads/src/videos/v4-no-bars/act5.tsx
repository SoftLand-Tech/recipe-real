// ACT 5 · NOWHERE PLATING — steam, all-checked list, calibrated times, the bite.
import {FC} from 'react';
import {Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {
  CREAM,
  CREAM_DIM,
  CrossedCloudIcon,
  FONT_DISPLAY,
  FONT_UI,
  HandNote,
  Kicker,
  PhoneShell,
  Plate,
  SAFE,
  SceneBg,
  SignalIcon,
  Steam,
  TERRA,
  Vignette,
  clampIn,
  easeOut,
} from './ui';
import {KitchenBg, NowhereBg} from './backdrops';

/** Simple stylized cook — silhouette with terracotta apron. */
const Cook: FC<{x: number; y: number; scale?: number; armDeg?: number; nod?: number}> = ({x, y, scale = 1, armDeg = -20, nod = 0}) => (
  <div style={{position: 'absolute', left: x, top: y, scale: `${scale}`}}>
    {/* head */}
    <div style={{position: 'absolute', left: 40, top: 0, width: 110, height: 110, borderRadius: '50%', backgroundColor: '#14100C', rotate: `${nod}deg`, transformOrigin: '50% 120%'}}>
      <div style={{position: 'absolute', left: 16, top: 44, width: 78, height: 30, borderRadius: 12, backgroundColor: '#F3EDE6'}} />
    </div>
    {/* body */}
    <div style={{position: 'absolute', left: 0, top: 100, width: 190, height: 240, borderRadius: '60px 60px 20px 20px', backgroundColor: '#14100C' }} />
    {/* apron */}
    <div style={{position: 'absolute', left: 34, top: 150, width: 122, height: 170, borderRadius: '16px 16px 8px 8px', backgroundColor: TERRA, opacity: 0.92 }} />
    {/* arm + ladle */}
    <div style={{position: 'absolute', left: 120, top: 140, width: 130, height: 34, borderRadius: 18, backgroundColor: '#14100C', rotate: `${armDeg}deg`, transformOrigin: '0% 50%' }}>
      <div style={{position: 'absolute', right: -86, top: 4, width: 96, height: 12, borderRadius: 6, backgroundColor: '#B98A5E'}} />
      <div style={{position: 'absolute', right: -104, top: -10, width: 34, height: 34, borderRadius: '4px 4px 16px 16px', border: '5px solid #B98A5E', borderBottom: 'none'}} />
    </div>
  </div>
);

/* s35 — plating in the middle of nowhere. */
export const S35: FC = () => {
  const frame = useCurrentFrame();
  const arm = interpolate(frame, [0, 12, 24], [-30, 10, -14], {...clampIn, easing: Easing.inOut(Easing.quad)});
  return (
    <>
      <NowhereBg />
      {/* lone table */}
      <div style={{position: 'absolute', left: 560, top: 700, width: 800, height: 26, borderRadius: 8, backgroundColor: '#0F0C09', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }} />
      <div style={{position: 'absolute', left: 640, top: 726, width: 20, height: 190, backgroundColor: '#0F0C09'}} />
      <div style={{position: 'absolute', left: 1250, top: 726, width: 20, height: 190, backgroundColor: '#0F0C09'}} />
      <Cook x={1020} y={330} scale={1.15} armDeg={arm} />
      {/* plated dinner + steam */}
      <div style={{position: 'absolute', left: 640, top: 620, scale: `${interpolate(frame, [2, 12], [0.9, 1], {...clampIn, easing: easeOut})}` }}>
        <Plate size={380} />
        <Steam x={120} y={-130} scale={1.2} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 130,
          translate: '-50% 0',
          fontFamily: FONT_DISPLAY,
          fontSize: 120,
          color: CREAM,
          letterSpacing: 5,
          opacity: interpolate(frame, [3, 11], [0, 1], clampIn),
        }}
      >
        MIDDLE OF NOWHERE. DINNER ANYWAY.
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="STEP 9 · PLATE" color={TERRA} />
      </div>
      <SignalIcon alive={0} size={0} dim="rgba(0,0,0,0)" />
      <Vignette />
    </>
  );
};

/* s36 — cook times calibrated by thousands of real home cooks. */
export const S36: FC = () => {
  const frame = useCurrentFrame();
  const stats = [
    {n: '4,212', label: 'HOME COOKS TIMED IT'},
    {n: '38,410', label: 'TIMED STEPS LOGGED'},
    {n: '12 MIN', label: 'CLEANUP, COUNTED'},
  ];
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', left: 130, top: 150}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 150, color: CREAM, lineHeight: 0.95}}>HONEST TIMES.</div>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 150, color: TERRA, lineHeight: 0.95}}>BY REAL COOKS.</div>
        <div style={{display: 'flex', gap: 60, marginTop: 60}}>
          {stats.map((s, i) => (
            <div
              key={s.n}
              style={{
                opacity: interpolate(frame, [6 + i * 5, 14 + i * 5], [0, 1], clampIn),
                translate: `0px ${interpolate(frame, [6 + i * 5, 14 + i * 5], [24, 0], {...clampIn, easing: easeOut})}px`,
              }}
            >
              <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 96, color: CREAM, fontVariantNumeric: 'tabular-nums'}}>{s.n}</div>
              <div style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 26, letterSpacing: 4, color: CREAM_DIM, marginTop: 8}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop: 54, display: 'flex', alignItems: 'center', gap: 18}}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
            <svg key={c} width={40} height={40} viewBox="0 0 30 30" style={{opacity: interpolate(frame, [2 + c * 2, 6 + c * 2], [0, 1], clampIn)}}>
              <circle cx="15" cy="15" r="13" fill={TERRA} />
              <path d="M 8 12 L 13 17 L 22 7" fill="none" stroke="#171310" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ))}
          <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 30, letterSpacing: 3, color: CREAM_DIM}}>9 / 9 STEPS CHECKED</span>
        </div>
      </div>
      <HandNote text="yes, cleanup too" x={1330} y={840} rotate={-4} size={60} />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="EVERY STEP TIMED BY REAL PEOPLE" />
      </div>
      <Vignette />
    </>
  );
};

/* s37 — cleanup included badge. */
export const S37: FC = () => {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame, [2, 8], [1.45, 1], {...clampIn, easing: Easing.bezier(0.2, 1.4, 0.4, 1)});
  return (
    <>
      <SceneBg loc="base" />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 420,
          translate: '-50% -50%',
          rotate: `${interpolate(frame, [2, 8], [-6, -2], clampIn)}deg`,
          scale: `${stamp}`,
          border: `10px solid ${TERRA}`,
          padding: '30px 64px 40px',
          backgroundColor: 'rgba(23,19,16,0.85)',
          boxShadow: '0 0 90px rgba(217,110,63,0.3)',
        }}
      >
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 170, color: CREAM, letterSpacing: 6, whiteSpace: 'nowrap'}}>CLEANUP: 12 MIN</div>
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 44, color: TERRA, letterSpacing: 10, textAlign: 'center', marginTop: 6}}>
          COUNTED. INCLUDED.
        </div>
      </div>
      {/* sponge with bubbles */}
      <div style={{position: 'absolute', right: 300, bottom: 170, rotate: '-8deg'}}>
        <div style={{width: 150, height: 100, borderRadius: 18, backgroundColor: TERRA, border: '4px solid rgba(243,237,230,0.25)'}} />
        {Array.from({length: 5}).map((_, b) => {
          const p = ((frame + b * 9) % 30) / 30;
          return (
            <div
              key={b}
              style={{
                position: 'absolute',
                left: 20 + random(`sb-${b}`) * 110,
                top: -p * 150,
                width: 14 + b * 4,
                height: 14 + b * 4,
                borderRadius: 999,
                border: '3px solid rgba(243,237,230,0.5)',
                opacity: interpolate(p, [0, 0.3, 1], [0, 0.9, 0], clampIn),
              }}
            />
          );
        })}
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="THE PART EVERYONE SKIPS" />
      </div>
      <Vignette />
    </>
  );
};

/* s38 — the bite. (SFX-only punch) */
export const S38: FC = () => {
  const frame = useCurrentFrame();
  const forkIn = interpolate(frame, [0, 8], [-260, 0], {...clampIn, easing: Easing.in(Easing.quad)});
  const bit = frame >= 12;
  return (
    <>
      <KitchenBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(23,19,16,0.25)'}} />
      <div style={{position: 'absolute', left: '50%', top: 470, translate: '-50% 0'}}>
        <div style={{scale: `${interpolate(frame, [0, 10], [1.2, 1.45], clampIn)}`}}>
          <Plate size={720} bite={bit} />
        </div>
      </div>
      {/* fork entering */}
      <div style={{position: 'absolute', left: 1050, top: 200, translate: `${forkIn}px ${forkIn * 0.5}px`, rotate: '18deg'}}>
        <svg width="70" height="330" viewBox="0 0 70 330">
          <rect x="26" y="90" width="18" height="240" rx="9" fill="#C8BFAF" />
          <path d="M8 0 L8 84 M35 0 L35 84 M62 0 L62 84" stroke="#C8BFAF" strokeWidth="12" strokeLinecap="round" />
          <path d="M8 92 Q35 104 62 92 L62 110 Q35 122 8 110 Z" fill="#C8BFAF" />
        </svg>
      </div>
      {/* crumbs fly */}
      {Array.from({length: 8}).map((_, i) => {
        const p = interpolate(frame, [12, 12 + 8 + i], [0, 1], clampIn);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 1160 + p * (60 + random(`cr-${i}`) * 220),
              top: 520 - p * (120 + random(`cy-${i}`) * 160),
              width: 10 + random(`cs-${i}`) * 8,
              height: 10 + random(`cs-${i}`) * 8,
              borderRadius: 4,
              backgroundColor: '#B4522B',
              rotate: `${p * 320}deg`,
              opacity: bit ? interpolate(p, [0, 0.3, 1], [0, 1, 0], clampIn) : 0,
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: SAFE,
          top: SAFE,
          fontFamily: FONT_DISPLAY,
          fontSize: 100,
          color: CREAM,
          opacity: interpolate(frame, [12, 18], [0, 1], clampIn),
        }}
      >
        THE FIRST BITE
      </div>
      <Vignette />
    </>
  );
};

/* s39 — satisfied cook, worth the walk. */
export const S39: FC = () => {
  const frame = useCurrentFrame();
  const nod = Math.sin(frame * 0.5) * 4 * interpolate(frame, [0, 6], [0, 1], clampIn);
  return (
    <>
      <NowhereBg />
      <Cook x={860} y={420} scale={1.2} armDeg={-34} nod={nod} />
      <div style={{position: 'absolute', left: 700, top: 640}}>
        <Plate size={330} bite />
        <Steam x={100} y={-110} scale={0.9} />
      </div>
      <div style={{position: 'absolute', left: '50%', top: 170, translate: '-50% 0', textAlign: 'center'}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 160, color: CREAM, letterSpacing: 4}}>WORTH THE WALK</div>
      </div>
      <HandNote text="would cook here again" x={1120} y={300} rotate={-4} size={58} />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="0 BARS · 1 PERFECT DINNER" color={TERRA} />
      </div>
      <Vignette />
    </>
  );
};

/* s40 — your recipes live on your phone. */
export const S40: FC = () => {
  const frame = useCurrentFrame();
  const recipes = ['Weeknight stew', 'Skillet chicken', 'Charred beans', 'One-pan eggs', 'Braised ribs', 'Campfire rice', 'Desert chili', 'Polar stew'];
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', left: '50%', top: 100, translate: '-50% 0'}}>
        <PhoneShell width={470}>
          <div style={{position: 'absolute', top: 84, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '0 30px'}}>
            <div style={{fontFamily: FONT_DISPLAY, fontSize: 52, letterSpacing: 2}}>
              <span style={{color: CREAM}}>Recipe</span>
              <span style={{color: TERRA}}>Real</span>
            </div>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, width: '100%', marginTop: 6}}>
              {recipes.map((r, i) => (
                <div
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: 'rgba(44,37,29,0.9)',
                    border: `2px solid ${i === 0 ? TERRA : 'rgba(243,237,230,0.1)'}`,
                    borderRadius: 14,
                    padding: '14px 16px',
                    opacity: interpolate(frame, [3 + i * 2, 7 + i * 2], [0, 1], clampIn),
                    translate: `0px ${interpolate(frame, [3 + i * 2, 7 + i * 2], [14, 0], {...clampIn, easing: easeOut})}px`,
                  }}
                >
                  <div style={{width: 34, height: 34, borderRadius: 8, backgroundColor: i % 2 ? '#B4522B' : '#6FA97F', flexShrink: 0}} />
                  <span style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 21, color: CREAM}}>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </PhoneShell>
      </div>
      <div style={{position: 'absolute', left: SAFE, top: 300, maxWidth: 820}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 190, color: CREAM, lineHeight: 0.92}}>YOUR RECIPES</div>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 190, color: TERRA, lineHeight: 0.92}}>LIVE ON YOUR PHONE</div>
        <div style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 34, color: CREAM_DIM, letterSpacing: 3, marginTop: 26}}>
          1,200 RECIPES · ZERO CLOUD · WORKS AT 35,000 FT
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 170,
          bottom: 130,
          opacity: interpolate(frame, [0, 12], [0.8, 0], clampIn),
          translate: `${interpolate(frame, [0, 12], [0, 80], clampIn)}px ${interpolate(frame, [0, 12], [0, -60], clampIn)}px`,
        }}
      >
        <CrossedCloudIcon size={190} />
      </div>
      <Vignette />
    </>
  );
};
