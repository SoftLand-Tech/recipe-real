// RECIPEREAL UI (31–50s): panels merge into one surface showing three
// personalized estimates — "For you: 30 / 42 / 51 min" — counting up.

import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {COOKS, COOK_ORDER, CookBust, type CookId} from './characters';
import {anton, inter} from './fonts';
import {CHIME_AT, ESTIMATES, FOOTER_AT, SCENES} from './timeline';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const ROW_META: Record<CookId, {title: string; sub: string}> = {
  optimist: {title: 'The Optimist', sub: 'Cooks every day'},
  realist: {title: 'The Realist', sub: 'Counts every chop'},
  beginner: {title: 'The Beginner', sub: 'First time, guided'},
};

const EstimateRow: FC<{index: number}> = ({index}) => {
  const local = useCurrentFrame();
  const f = local + SCENES.uiStart;
  const cook = COOK_ORDER[index];
  const est = ESTIMATES[index];
  const meta = ROW_META[cook];

  const appear = interpolate(local, [52 + index * 12, 72 + index * 12], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const value = Math.round(
    interpolate(f, [est.start, est.end], [0, est.target], {
      ...CLAMP,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    }),
  );
  const landed = f >= est.end ? 1 : 0;
  const pulse = interpolate(f, [est.end, est.end + 6, est.end + 14], [1, 1.06, 1], CLAMP);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 22,
        backgroundColor: COOKS[cook].soft,
        border: `3px solid ${brand.hairline}`,
        borderRadius: 26,
        padding: '16px 26px',
        opacity: appear,
        translate: `0px ${(1 - appear) * 26}px`,
      }}
    >
      <div
        style={{
          width: 118,
          height: 118,
          borderRadius: 999,
          backgroundColor: brand.surface,
          border: `3px solid ${brand.hairlineStrong}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div style={{marginTop: 14}}>
          <CookBust cook={cook} f={f} width={96} />
        </div>
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontFamily: inter, fontSize: 32, fontWeight: 700, color: brand.ink}}>{meta.title}</div>
        <div style={{fontFamily: inter, fontSize: 23, color: brand.inkSecondary}}>{meta.sub}</div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 6,
            fontFamily: inter,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 2,
            color: landed ? brand.success : brand.inkFaint,
            border: `2px solid ${landed ? brand.success : brand.hairlineStrong}`,
            borderRadius: 999,
            padding: '2px 12px',
          }}
        >
          {landed ? 'CALIBRATED' : 'MEASURING…'}
        </div>
      </div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 8, scale: `${pulse}`, flexShrink: 0}}>
        <span style={{fontFamily: anton, fontSize: 86, lineHeight: 1, color: brand.ink}}>{value}</span>
        <span style={{fontFamily: anton, fontSize: 28, color: brand.inkSecondary}}>MIN</span>
      </div>
    </div>
  );
};

export const EstimateScene: FC = () => {
  const local = useCurrentFrame();
  const f = local + SCENES.uiStart;

  const enter = interpolate(local, [0, 30], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  // Exit comp 1271–1295: clears out just before the outro begins at 1297.
  const exit = interpolate(local, [341, 365], [0, 1], {
    ...CLAMP,
    easing: Easing.in(Easing.cubic),
  });
  const labelIn = interpolate(local, [34, 50], [0, 1], CLAMP);
  const chimePulse = interpolate(f, [CHIME_AT, CHIME_AT + 6, CHIME_AT + 16], [1, 1.02, 1], CLAMP);
  const footerIn = interpolate(f, [FOOTER_AT, FOOTER_AT + 20], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div
        style={{
          width: 880,
          backgroundColor: brand.surface,
          borderRadius: 44,
          border: `4px solid ${brand.hairlineStrong}`,
          boxShadow: '0 40px 90px rgba(36,29,23,0.18)',
          padding: '44px 50px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          opacity: Math.min(enter * 1.2, 1) * (1 - exit),
          translate: `0px ${(1 - enter) * -46 - exit * 120}px`,
          scale: `${(0.7 + 0.3 * enter) * chimePulse * (1 - 0.05 * exit)}`,
        }}
      >
        <div style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
          <div style={{fontFamily: anton, fontSize: 44}}>
            <span style={{color: brand.ink}}>Recipe</span>
            <span style={{color: brand.accent}}>Real</span>
          </div>
          <div
            style={{
              fontFamily: inter,
              fontSize: 19,
              fontWeight: 700,
              letterSpacing: 3,
              color: brand.accent,
              backgroundColor: brand.accentSoft,
              borderRadius: 999,
              padding: '8px 18px',
            }}
          >
            TONIGHT
          </div>
        </div>
        <div style={{width: '100%', marginTop: 6}}>
          <div style={{fontFamily: anton, fontSize: 52, color: brand.ink, lineHeight: 1.05}}>One-Pan Pasta</div>
          <div style={{fontFamily: inter, fontSize: 26, color: brand.inkSecondary, marginTop: 4}}>
            How long it’ll actually take — for you.
          </div>
        </div>
        <div
          style={{
            width: '100%',
            marginTop: 10,
            fontFamily: inter,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 5,
            color: brand.inkSecondary,
            opacity: labelIn,
          }}
        >
          FOR YOU:
        </div>
        <div style={{width: '100%', display: 'flex', flexDirection: 'column', gap: 16}}>
          {COOK_ORDER.map((_, i) => (
            <EstimateRow key={i} index={i} />
          ))}
        </div>
        <div
          style={{
            width: '100%',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            backgroundColor: brand.accentSoft,
            borderRadius: 20,
            padding: '16px 22px',
            opacity: footerIn,
            translate: `0px ${(1 - footerIn) * 18}px`,
          }}
        >
          <div style={{width: 7, height: 52, borderRadius: 4, backgroundColor: brand.accent, flexShrink: 0}} />
          <div style={{fontFamily: inter, fontSize: 25, color: brand.ink, lineHeight: 1.3}}>
            Calibrated by cooks at your level — step by step.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
