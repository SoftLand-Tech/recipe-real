// ACT 5: THE PRICE GAG (s29-s35) — classic infomercial countdown to FREE.
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import type {FC} from 'react';
import {brand} from '../../shared/theme';
import {Starburst} from './fx';
import {bebas, space} from './fonts';

const center = {display: 'flex', alignItems: 'center', justifyContent: 'center'} as const;

const Rays: FC<{rotate: number; color?: string}> = ({rotate, color = 'rgba(200,130,31,0.16)'}) => (
  <div style={{position: 'absolute', inset: 0, ...center}}>
    {new Array(20).fill(0).map((_, i) => (
      <div
        key={i}
        style={{
          position: 'absolute',
          width: 2500,
          height: 220,
          backgroundColor: color,
          rotate: `${(i / 20) * 180 + rotate}deg`,
        }}
      />
    ))}
  </div>
);

const PriceCard: FC<{
  price: string;
  sub?: string;
  strike?: boolean;
  color?: string;
  style?: React.CSSProperties;
}> = ({price, sub, strike, color = brand.surface, style}) => (
  <div
    style={{
      backgroundColor: color,
      borderRadius: 24,
      padding: '44px 80px',
      border: `8px solid ${brand.ink}`,
      boxShadow: '0 30px 60px rgba(36,29,23,0.3)',
      textAlign: 'center',
      position: 'relative',
      ...style,
    }}
  >
    <div style={{fontFamily: bebas, fontSize: 260, color: brand.ink, lineHeight: 0.9, position: 'relative'}}>
      {price}
      {strike ? (
        <div
          style={{
            position: 'absolute',
            left: -20,
            right: -20,
            top: '46%',
            height: 22,
            backgroundColor: brand.danger,
            rotate: '-7deg',
            borderRadius: 10,
          }}
        />
      ) : null}
    </div>
    {sub ? (
      <div style={{fontFamily: space, fontWeight: 500, fontSize: 34, color: brand.inkSecondary}}>{sub}</div>
    ) : null}
  </div>
);

/* s29 — "How much would you pay?" + $99 slam. */
export const Scene29: FC = () => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [0, 6], [1.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.5, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      <Rays rotate={interpolate(frame, [0, 30], [0, 6])} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 120,
          textAlign: 'center',
          fontFamily: bebas,
          fontSize: 140,
          color: brand.cream,
          letterSpacing: 4,
        }}
      >
        HOW MUCH WOULD YOU PAY?
      </div>
      <AbsoluteFill style={{...center, scale: `${slam}`, top: 40}}>
        <PriceCard price="$99" sub="for recipes that lie to you?" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s30 — $99 struck, $49 slams. SFX: cash register. */
export const Scene30: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      <Rays rotate={interpolate(frame, [0, 20], [4, 10])} />
      <div
        style={{
          position: 'absolute',
          left: 300,
          top: 300,
          scale: `${interpolate(frame, [0, 30], [1, 0.86])}`,
          rotate: `${interpolate(frame, [0, 12], [0, -7])}deg`,
        }}
      >
        <PriceCard price="$99" strike color={brand.darkSurface} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 280,
          top: 380,
          scale: `${interpolate(frame, [0, 6], [1.7, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1.6, 0.4, 1),
          })}`,
        }}
      >
        <PriceCard price="$49" sub="half the lies, same chicken" />
      </div>
    </AbsoluteFill>
  );
};

/* s31 — countdown digits fly. VO: "Ninety-nine? Forty-nine? No." */
export const Scene31: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      <Rays rotate={interpolate(frame, [0, 30], [8, 16])} color="rgba(178,58,46,0.14)" />
      <div
        style={{
          position: 'absolute',
          left: 300,
          top: 300,
          translate: `${interpolate(frame, [0, 8], [0, -900])}px 0`,
          rotate: `${interpolate(frame, [0, 8], [0, -30])}deg`,
          opacity: interpolate(frame, [6, 8], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        <PriceCard price="$99" strike color={brand.darkSurface} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 320,
          top: 360,
          translate: `${interpolate(frame, [0, 8], [0, 900])}px 0`,
          rotate: `${interpolate(frame, [0, 8], [0, 24])}deg`,
          opacity: interpolate(frame, [6, 8], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        <PriceCard price="$49" color={brand.darkSurface} />
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          ...center,
          scale: `${interpolate(frame, [24, 30], [0.2, 1.05], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1.6, 0.4, 1),
          })}`,
          opacity: interpolate(frame, [24, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        <div style={{fontFamily: bebas, fontSize: 320, color: brand.cream}}>NO.</div>
      </div>
    </AbsoluteFill>
  );
};

/* s32 — the beat... FREE detonates. VO: "It's free." */
export const Scene32: FC = () => {
  const frame = useCurrentFrame();
  const boom = interpolate(frame, [8, 14], [0.2, 1.12], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.8, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <Rays rotate={interpolate(frame, [0, 21], [0, 14])} color="rgba(200,130,31,0.2)" />
      <AbsoluteFill style={{...center, scale: `${boom}`}}>
        <Starburst size={980} fill={brand.amber} inner={0.66} rotate={interpolate(frame, [8, 21], [-10, 4])} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            translate: '-50% -50%',
            fontFamily: bebas,
            fontSize: 380,
            color: '#fff',
            letterSpacing: 10,
            textShadow: '0 14px 0 rgba(36,29,23,0.28)',
          }}
        >
          FREE.
        </div>
      </AbsoluteFill>
      {/* the beat: empty drum before the boom */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 140,
          textAlign: 'center',
          fontFamily: space,
          fontWeight: 700,
          fontSize: 44,
          color: brand.inkSecondary,
          opacity: interpolate(frame, [0, 2, 6, 8], [0, 1, 1, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      >
        (wait for it)
      </div>
    </AbsoluteFill>
  );
};

/* s33 — stunned pause: FREE?! echo. VO: "Free?!" */
export const Scene33: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      {[0, 1, 2].map((i) => {
        const p = interpolate(frame, [i * 5, i * 5 + 8], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <AbsoluteFill
            key={i}
            style={{
              ...center,
              scale: `${interpolate(p, [0, 1], [1.05, 0.7 - i * 0.08])}`,
              opacity: interpolate(p, [0, 1], [1 - i * 0.3, 0.2 - i * 0.06], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            <div
              style={{
                fontFamily: bebas,
                fontSize: 420 - i * 70,
                color: i === 0 ? brand.amberBright : brand.accentBright,
                letterSpacing: 8,
              }}
            >
              FREE?!
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/* s34 — applause, confetti shower over FREE. SFX: applause. */
export const Scene34: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: brand.canvas}}>
      <Rays rotate={interpolate(frame, [0, 20], [14, 26])} color="rgba(191,85,43,0.14)" />
      {new Array(40).fill(0).map((_, i) => {
        const x0 = random(`cx-${i}`) * 1920;
        const delay = random(`cd-${i}`) * 6;
        const y = interpolate(frame, [delay, delay + 22], [-60, 1140], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.quad),
        });
        const rot = random(`cr-${i}`) * 360 + frame * (random(`cs-${i}`) * 14 - 7);
        const colors = [brand.accent, brand.amber, brand.success, brand.ink];
        const c = colors[i % colors.length];
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x0,
              top: y,
              width: 22,
              height: 34,
              backgroundColor: c,
              rotate: `${rot}deg`,
              borderRadius: 4,
            }}
          />
        );
      })}
      <AbsoluteFill style={{...center}}>
        <Starburst size={760} fill={brand.amber} inner={0.7} rotate={interpolate(frame, [0, 20], [4, -6])} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            translate: '-50% -50%',
            fontFamily: bebas,
            fontSize: 300,
            color: '#fff',
            letterSpacing: 10,
          }}
        >
          FREE.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s35 — parody hotline sticker: DOWNLOAD NOW. VO. */
export const Scene35: FC = () => {
  const frame = useCurrentFrame();
  const blink = frame % 16 < 8;
  const slam = interpolate(frame, [0, 6], [1.5, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.5, 0.4, 1),
  });
  return (
    <AbsoluteFill style={{backgroundColor: brand.ink}}>
      <Rays rotate={interpolate(frame, [0, 48], [26, 40])} color="rgba(200,130,31,0.15)" />
      <AbsoluteFill style={{...center}}>
        <div
          style={{
            rotate: '3deg',
            scale: `${slam}`,
            backgroundColor: brand.amber,
            border: `${blink ? 14 : 10}px dashed ${blink ? '#fff' : brand.ink}`,
            padding: '70px 110px',
            textAlign: 'center',
            boxShadow: '0 40px 80px rgba(0,0,0,0.45)',
          }}
        >
          <div style={{fontFamily: bebas, fontSize: 250, color: '#fff', lineHeight: 0.9, letterSpacing: 6}}>
            DOWNLOAD NOW
          </div>
          <div
            style={{
              fontFamily: space,
              fontWeight: 700,
              fontSize: 40,
              color: brand.ink,
              letterSpacing: 4,
              marginTop: 18,
            }}
          >
            RECIPEREAL — FREE — REAL COOK TIMES
          </div>
          <div
            style={{
              fontFamily: space,
              fontWeight: 500,
              fontSize: 30,
              color: 'rgba(36,29,23,0.72)',
              marginTop: 22,
            }}
          >
            operators are standing by (it's an app store)
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
