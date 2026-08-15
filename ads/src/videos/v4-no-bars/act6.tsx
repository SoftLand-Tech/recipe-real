// ACT 6 · END CARD — wordmark, tagline, CTA.
import {FC} from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
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
  Steam,
  TERRA,
  Vignette,
  Wordmark,
  clampIn,
  easeOut,
} from './ui';
import {KitchenBg} from './backdrops';

/* s41 — wordmark reveal; cloud pops away. */
export const S41: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(217,110,63,0.14) 0%, rgba(23,19,16,0) 55%)'}} />
      <div
        style={{
          position: 'absolute',
          right: 240,
          top: 200,
          opacity: interpolate(frame, [0, 8], [0.85, 0], clampIn),
          translate: `${interpolate(frame, [0, 8], [0, 140], clampIn)}px ${interpolate(frame, [0, 8], [0, -90], clampIn)}px`,
          rotate: `${interpolate(frame, [0, 8], [0, 24], clampIn)}deg`,
        }}
      >
        <div style={{width: 190, height: 120, borderRadius: 100, backgroundColor: '#3A3F44'}} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 380,
          display: 'flex',
          justifyContent: 'center',
          scale: `${interpolate(frame, [0, 10], [1.16, 1], {...clampIn, easing: easeOut})}`,
          opacity: interpolate(frame, [0, 7], [0, 1], clampIn),
        }}
      >
        <Wordmark size={250} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 760, textAlign: 'center'}}>
        <span
          style={{
            fontFamily: FONT_UI,
            fontWeight: 700,
            fontSize: 52,
            letterSpacing: 12,
            color: CREAM_DIM,
            opacity: interpolate(frame, [6, 14], [0, 1], clampIn),
          }}
        >
          NOT THE CLOUD
        </span>
      </div>
      <Vignette />
    </>
  );
};

/* s42 — tagline lockup over the dinner tableau. */
export const S42: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <KitchenBg />
      <div style={{position: 'absolute', inset: 0, backgroundColor: 'rgba(23,19,16,0.72)'}} />
      <div style={{position: 'absolute', left: '50%', top: 700, translate: '-50% 0'}}>
        <Plate size={430} />
        <Steam x={130} y={-150} scale={1.2} />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 250, textAlign: 'center'}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 260, color: CREAM, letterSpacing: 8, lineHeight: 0.95}}>NO BARS.</div>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 260, color: TERRA, letterSpacing: 8, lineHeight: 0.95}}>FULL DINNER.</div>
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="THE WHOLE POINT" color={TERRA} />
      </div>
      <Vignette strength={0.6} />
    </>
  );
};

/* s43 — CTA + store badges. */
export const S43: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(217,110,63,0.12) 0%, rgba(23,19,16,0) 55%)'}} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 330,
          translate: '-50% 0',
          scale: `${interpolate(frame, [0, 9], [0.85, 1], {...clampIn, easing: easeOut})}`,
          opacity: interpolate(frame, [0, 6], [0, 1], clampIn),
        }}
      >
        <div
          style={{
            backgroundColor: TERRA,
            borderRadius: 999,
            padding: '30px 90px 38px',
            boxShadow: '0 24px 70px rgba(217,110,63,0.45)',
          }}
        >
          <span style={{fontFamily: FONT_DISPLAY, fontSize: 130, color: '#171310', letterSpacing: 6, whiteSpace: 'nowrap'}}>DOWNLOAD FREE</span>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 620,
          display: 'flex',
          justifyContent: 'center',
          gap: 40,
          opacity: interpolate(frame, [6, 13], [0, 1], clampIn),
        }}
      >
        {[
          {name: 'App Store', glyph: 'apple'},
          {name: 'Google Play', glyph: 'play'},
        ].map((b) => (
          <div
            key={b.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              border: '3px solid rgba(243,237,230,0.35)',
              borderRadius: 22,
              padding: '22px 46px',
            }}
          >
            {b.glyph === 'apple' ? (
              <svg width="48" height="56" viewBox="0 0 48 56">
                <path
                  d="M33 12 C 30 4, 22 2, 18 4 C 20 12, 26 15, 31 14 C 38 13, 44 19, 44 28 C 44 40, 34 52, 26 52 C 23 52, 21 50, 17 50 C 13 50, 11 52, 8 52 C 2 52, 0 44, 0 38 C 0 26, 8 16, 16 15 L 18 15 C 20 15, 24 14, 26 9 L 27 6 L 28 6 C 29 9, 31 11, 33 12 Z"
                  fill={CREAM}
                />
              </svg>
            ) : (
              <svg width="52" height="56" viewBox="0 0 52 56">
                <polygon points="6,4 46,28 6,52" fill={CREAM} />
                <polygon points="6,4 46,28 6,28" fill={CREAM_DIM} opacity="0.6" />
              </svg>
            )}
            <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 44, color: CREAM, letterSpacing: 2}}>{b.name}</span>
          </div>
        ))}
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="EVERY STEP. HONEST TIMES. NO BARS REQUIRED." />
      </div>
      <Vignette />
    </>
  );
};

/* s44 — end hold. */
export const S44: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(217,110,63,0.16) 0%, rgba(23,19,16,0) 55%)'}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 330,
          display: 'flex',
          justifyContent: 'center',
          scale: `${interpolate(frame, [0, 14], [1.04, 1], clampIn)}`,
        }}
      >
        <Wordmark size={300} />
      </div>
      {/* the zero-bars icon winks on the tail of the wordmark */}
      <div
        style={{
          position: 'absolute',
          right: 380,
          top: 400,
          opacity: interpolate(frame, [8, 14, 20, 26, 32, 40], [0, 1, 0.3, 1, 0.3, 0.9], clampIn),
        }}
      >
        <NoServiceIcon size={90} color={TERRA} />
      </div>
      <Steam x={860} y={640} scale={1.2} color="rgba(217,110,63,0.35)" />
      <div style={{position: 'absolute', left: 0, right: 0, top: 720, textAlign: 'center'}}>
        <span style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 46, letterSpacing: 16, color: CREAM_DIM}}>NO BARS. FULL DINNER.</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, bottom: SAFE, textAlign: 'center'}}>
        <span style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 30, letterSpacing: 6, color: LOC.base.accent}}>
          RECIPE REAL · OFFLINE-FIRST COOKING
        </span>
      </div>
      <Vignette strength={0.6} />
    </>
  );
};
