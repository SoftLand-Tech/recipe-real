// ACT 6: END CARD (s36-s41) — wordmark, tagline, badges, B/W wink, iris out.
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import type {FC} from 'react';
import {brand, SAFE} from '../../shared/theme';
import {FilmGrain, IrisOverlay} from './fx';
import {bebas, space} from './fonts';

const center = {display: 'flex', alignItems: 'center', justifyContent: 'center'} as const;

const Wordmark: FC<{size?: number}> = ({size = 250}) => (
  <div
    style={{
      fontFamily: bebas,
      fontSize: size,
      color: brand.ink,
      letterSpacing: 4,
      lineHeight: 0.95,
    }}
  >
    Recipe<span style={{color: brand.accent}}>Real</span>
  </div>
);

/* s36 — logo lockup slam. VO: "RecipeReal. Cook the truth." */
export const Scene36: FC = () => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [0, 6], [1.45, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.5, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 40%, rgba(248,233,222,0.9) 0%, rgba(251,248,243,0) 60%)',
        }}
      />
      <AbsoluteFill style={{...center, flexDirection: 'column', scale: `${slam}`}}>
        <Wordmark size={300} />
        <div
          style={{
            width: interpolate(frame, [4, 20], [0, 900]),
            height: 14,
            backgroundColor: brand.accent,
            marginTop: 24,
            borderRadius: 7,
          }}
        />
        <div
          style={{
            fontFamily: space,
            fontWeight: 700,
            fontSize: 56,
            letterSpacing: 12,
            color: brand.inkSecondary,
            marginTop: 34,
            opacity: interpolate(frame, [10, 20], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          COOK THE TRUTH.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s37 — underline sweep + whisk mark draws in. */
export const Scene37: FC = () => {
  const frame = useCurrentFrame();
  const dash = 340;
  const drawn = interpolate(frame, [0, 16], [dash, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <AbsoluteFill style={{...center, flexDirection: 'column'}}>
        <Wordmark size={260} />
        <svg viewBox="0 0 360 120" style={{width: 360, marginTop: 26}}>
          <path
            d="M60 14 L300 14"
            stroke={brand.accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${dash}`}
            strokeDashoffset={drawn}
          />
          {/* whisk glyph */}
          <g>
            <path d="M180 44 L180 104" stroke={brand.ink} strokeWidth="9" strokeLinecap="round" />
            <path d="M150 48 Q180 20 210 48" stroke={brand.ink} strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M158 52 Q180 96 202 52" stroke={brand.ink} strokeWidth="6" fill="none" strokeLinecap="round" />
          </g>
        </svg>
        <div
          style={{
            fontFamily: space,
            fontWeight: 700,
            fontSize: 54,
            letterSpacing: 12,
            color: brand.inkSecondary,
            marginTop: 20,
            opacity: interpolate(frame, [6, 14], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          COOK THE TRUTH.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s38 — stat line + three mini badges. VO. */
export const Scene38: FC = () => {
  const frame = useCurrentFrame();
  const badges = ['REAL TIMES', 'COOK MODE', 'OFFLINE'];
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <AbsoluteFill style={{...center, flexDirection: 'column'}}>
        <Wordmark size={190} />
        <div
          style={{
            fontFamily: space,
            fontWeight: 500,
            fontSize: 46,
            color: brand.inkSecondary,
            marginTop: 26,
            opacity: interpolate(frame, [0, 8], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          timed by <span style={{color: brand.accent, fontWeight: 700}}>10,000 real cooks</span>
        </div>
        <div style={{display: 'flex', gap: 34, marginTop: 60}}>
          {badges.map((b, i) => {
            const p = interpolate(frame, [4 + i * 4, 10 + i * 4], [0.4, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.2, 1.6, 0.4, 1),
            });
            return (
              <div
                key={b}
                style={{
                  scale: `${p}`,
                  opacity: interpolate(p, [0.4, 1], [0, 1], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }),
                  fontFamily: space,
                  fontWeight: 700,
                  fontSize: 38,
                  color: brand.ink,
                  backgroundColor: brand.surface,
                  border: `3px solid ${brand.hairlineStrong}`,
                  borderRadius: 999,
                  padding: '22px 44px',
                }}
              >
                {b}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s39 — store badges slide in. */
export const Scene39: FC = () => {
  const frame = useCurrentFrame();
  const store = (side: 'l' | 'r') => ({
    translate: `${interpolate(frame, [0, 10], [side === 'l' ? -700 : 700, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.2, 1, 0.3, 1),
    })}px 0`,
  });
  const badgeStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    backgroundColor: brand.ink,
    borderRadius: 22,
    padding: '30px 54px',
  };
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <AbsoluteFill style={{...center, flexDirection: 'column', gap: 46}}>
        <Wordmark size={170} />
        <div style={{display: 'flex', gap: 54}}>
          <div style={{...badgeStyle, ...store('l')}}>
            <svg viewBox="0 0 24 24" style={{width: 64, height: 64}}>
              <path
                d="M16.7 12.9c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.9-1.6 0-3.1 1-4 2.4-1.7 2.9-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.3-.9-2.3-3.8zM14.4 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.9-1 3 1.1.1 2.2-.6 2.8-1.4z"
                fill={brand.canvas}
              />
            </svg>
            <div>
              <div style={{fontFamily: space, fontSize: 24, color: brand.creamSecondary}}>Download on the</div>
              <div style={{fontFamily: space, fontWeight: 700, fontSize: 42, color: brand.canvas}}>App Store</div>
            </div>
          </div>
          <div style={{...badgeStyle, ...store('r')}}>
            <svg viewBox="0 0 24 24" style={{width: 60, height: 64}}>
              <path d="M4 2.8v18.4c0 .6.7 1 1.2.7l15-9.2c.5-.3.5-1 0-1.3L5.2 2.1C4.7 1.8 4 2.2 4 2.8z" fill={brand.canvas} />
            </svg>
            <div>
              <div style={{fontFamily: space, fontSize: 24, color: brand.creamSecondary}}>Get it on</div>
              <div style={{fontFamily: space, fontWeight: 700, fontSize: 42, color: brand.canvas}}>Google Play</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s40 — full CTA pulse + ONE frame of B/W grain wink. SFX: ding. */
export const Scene40: FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame * 0.5) * 0.02;
  const wink = frame === 12;
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <AbsoluteFill style={{...center, flexDirection: 'column', scale: `${pulse}`}}>
        <Wordmark size={220} />
        <div style={{fontFamily: space, fontWeight: 700, fontSize: 50, letterSpacing: 10, color: brand.inkSecondary, marginTop: 26}}>
          COOK THE TRUTH.
        </div>
        <div
          style={{
            marginTop: 56,
            fontFamily: bebas,
            fontSize: 90,
            color: '#fff',
            backgroundColor: brand.accent,
            padding: '20px 90px',
            borderRadius: 999,
            scale: `${1 + Math.sin(frame * 0.5) * 0.03}`,
            boxShadow: '0 24px 48px rgba(191,85,43,0.4)',
          }}
        >
          DOWNLOAD FREE
        </div>
      </AbsoluteFill>
      {wink ? (
        <AbsoluteFill style={{filter: 'grayscale(1) contrast(1.2)'}}>
          <FilmGrain intensity={2.2} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/* s41 — end hold, gentle iris out to black. Absorbs remainder frames. */
export const Scene41: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <AbsoluteFill
        style={{
          ...center,
          flexDirection: 'column',
          scale: `${interpolate(frame, [0, 60], [1, 0.86], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.quad),
          })}`,
        }}
      >
        <Wordmark size={200} />
        <div
          style={{
            width: 520,
            height: 10,
            backgroundColor: brand.accent,
            marginTop: 22,
            borderRadius: 5,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: SAFE,
            right: SAFE,
            bottom: SAFE + 10,
            textAlign: 'center',
            fontFamily: space,
            fontSize: 30,
            color: brand.inkFaint,
            opacity: interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'}),
          }}
        >
          times calibrated by real home cooks, cleanup included
        </div>
      </AbsoluteFill>
      <IrisOverlay
        progress={interpolate(frame, [18, 72], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.inOut(Easing.quad),
        })}
      />
    </AbsoluteFill>
  );
};
