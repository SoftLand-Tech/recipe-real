// ACT 6 · end card — release badge, tagline, CTA.
import {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, CLAMP, Chip, F, GridBg, POP, prog} from './ui';

/* s38 (63f) — logo as release badge */
export const S38: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
      <GridBg drift={1.1} opacity={0.8} />
      {[8, 18, 30].map((at) => (
        <div
          key={at}
          style={{
            position: 'absolute',
            width: 620,
            height: 620,
            borderRadius: 90,
            border: `3px solid ${C.terra}`,
            scale: interpolate(frame, [at, at + 26], [0.5, 1.7], CLAMP),
            opacity: interpolate(frame, [at, at + 26], [0.55, 0], CLAMP),
          }}
        />
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 40,
          backgroundColor: C.terra,
          borderRadius: 40,
          padding: '56px 90px',
          rotate: `${interpolate(prog(frame, 0, 10, POP), [0, 1], [7, -3])}deg`,
          scale: interpolate(prog(frame, 0, 10, POP), [0, 1], [0.3, 1]),
          boxShadow: '0 0 110px rgba(217,110,63,0.45), 14px 16px 0 rgba(0,0,0,0.4)',
        }}
      >
        <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 150, color: '#FFF6F2', letterSpacing: -2}}>
          RecipeReal
        </div>
        <div
          style={{
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 56,
            color: C.terra,
            backgroundColor: '#FFF6F2',
            borderRadius: 16,
            padding: '10px 26px',
          }}
        >
          v2.0
        </div>
      </div>
      <div style={{display: 'flex', gap: 24, marginTop: 70, opacity: interpolate(frame, [24, 32], [0, 1], CLAMP)}}>
        <Chip label="10,406 cooks" color={C.green} size={30} />
        <Chip label="43:00 honest" color={C.dim} size={30} />
        <Chip label="0 excuses" color={C.dim} size={30} />
      </div>
    </AbsoluteFill>
  );
};

/* s39 (20f) — tagline */
export const S39: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 40,
            color: C.dim,
            opacity: interpolate(frame, [0, 4], [0, 1], CLAMP),
          }}
        >
          v2.0 of every recipe.
        </div>
        <div
          style={{
            position: 'relative',
            fontFamily: F.display,
            fontSize: 230,
            lineHeight: 1,
            color: C.text,
            letterSpacing: 8,
            scale: interpolate(prog(frame, 2, 9, POP), [0, 1], [1.35, 1]),
            opacity: interpolate(frame, [2, 5], [0, 1], CLAMP),
          }}
        >
          COOK THE TRUTH.
          <div
            style={{
              position: 'absolute',
              left: 0,
              bottom: -16,
              height: 16,
              width: interpolate(frame, [9, 17], [0, 1420], CLAMP),
              backgroundColor: C.terra,
              borderRadius: 8,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* s40 (70f) — CTA end card (absorbs remainder) */
export const S40: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
      <GridBg drift={0.7} opacity={0.6} />
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 54}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            backgroundColor: C.terra,
            borderRadius: 26,
            padding: '26px 52px',
            rotate: '-2deg',
            scale: interpolate(prog(frame, 0, 9, POP), [0, 1], [0.4, 1]),
            boxShadow: '0 0 70px rgba(217,110,63,0.35), 10px 12px 0 rgba(0,0,0,0.4)',
          }}
        >
          <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 84, color: '#FFF6F2'}}>RecipeReal</div>
          <div
            style={{
              fontFamily: F.mono,
              fontWeight: 700,
              fontSize: 34,
              color: C.terra,
              backgroundColor: '#FFF6F2',
              borderRadius: 10,
              padding: '4px 16px',
            }}
          >
            v2.0
          </div>
        </div>
        <div
          style={{
            fontFamily: F.base,
            fontWeight: 700,
            fontSize: 88,
            color: '#FFF6F2',
            backgroundColor: C.terra,
            borderRadius: 22,
            padding: '30px 110px',
            scale: 1 + 0.03 * Math.sin((frame / 30) * Math.PI * 2),
            boxShadow: '0 0 80px rgba(217,110,63,0.45)',
          }}
        >
          Download free
        </div>
        <div style={{display: 'flex', gap: 26, opacity: interpolate(frame, [10, 18], [0, 1], CLAMP)}}>
          {['App Store', 'Google Play'].map((s) => (
            <div
              key={s}
              style={{
                fontFamily: F.base,
                fontWeight: 600,
                fontSize: 40,
                color: C.text,
                border: `3px solid ${C.dim}`,
                borderRadius: 16,
                padding: '18px 54px',
                display: 'flex',
                alignItems: 'center',
                gap: 18,
              }}
            >
              <div style={{width: 30, height: 30, borderRadius: 8, backgroundColor: C.dim}} />
              {s}
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 30,
            color: C.faint,
            opacity: interpolate(frame, [16, 24], [0, 1], CLAMP),
          }}
        >
          every timer, verified by 10,000 home cooks
        </div>
      </div>
    </AbsoluteFill>
  );
};
