// OUTRO (42–50s): all three cooks nod, logo + "Actually thirty minutes.",
// and the Beginner winks (SVG eyelid) with a playful pop.

import type {FC} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {COOKS, COOK_ORDER, CookBust} from './characters';
import {anton, inter} from './fonts';
import {NOD_WINDOWS, SCENES, WINK_AT} from './timeline';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const OutroCook: FC<{index: number}> = ({index}) => {
  const local = useCurrentFrame();
  const f = local + SCENES.outroStart;
  const cook = COOK_ORDER[index];
  const enter = interpolate(local, [18 + index * 6, 36 + index * 6], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.34, 1.4, 0.64, 1),
  });

  return (
    <div
      style={{
        width: 252,
        height: 252,
        borderRadius: 999,
        backgroundColor: COOKS[cook].soft,
        border: `4px solid ${brand.surface}`,
        boxShadow: '0 22px 50px rgba(36,29,23,0.16)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: enter,
        translate: `0px ${(1 - enter) * 40}px`,
        scale: `${0.8 + 0.2 * enter}`,
      }}
    >
      <div style={{marginTop: 34}}>
        <CookBust
          cook={cook}
          f={f}
          nodWindows={NOD_WINDOWS[cook]}
          winkAt={cook === 'beginner' ? WINK_AT : undefined}
          width={178}
        />
      </div>
    </div>
  );
};

export const OutroScene: FC = () => {
  const local = useCurrentFrame();

  const toplineIn = interpolate(local, [8, 24], [0, 1], CLAMP);
  const wordmarkIn = interpolate(local, [30, 54], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const taglineIn = interpolate(local, [60, 80], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const underlineW = interpolate(local, [78, 102], [0, 190], {
    ...CLAMP,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  return (
    <>
      <div
        style={{
          position: 'absolute',
          top: 470,
          width: '100%',
          textAlign: 'center',
          fontFamily: inter,
          fontSize: 38,
          fontWeight: 600,
          color: brand.inkSecondary,
          opacity: toplineIn,
        }}
      >
        One recipe. Three cooks.
      </div>
      <div
        style={{
          position: 'absolute',
          top: 640,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 42,
        }}
      >
        {COOK_ORDER.map((_, i) => (
          <OutroCook key={i} index={i} />
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 1080,
          width: '100%',
          textAlign: 'center',
          fontFamily: anton,
          fontSize: 116,
          lineHeight: 1,
          opacity: wordmarkIn,
          translate: `0px ${(1 - wordmarkIn) * 44}px`,
        }}
      >
        <span style={{color: brand.ink}}>Recipe</span>
        <span style={{color: brand.accent}}>Real</span>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 1230,
          width: '100%',
          textAlign: 'center',
          fontFamily: inter,
          fontSize: 48,
          fontWeight: 600,
          color: brand.ink,
          opacity: taglineIn,
          translate: `0px ${(1 - taglineIn) * 26}px`,
        }}
      >
        Actually thirty minutes.
      </div>
      <div
        style={{
          position: 'absolute',
          top: 1318,
          left: '50%',
          width: underlineW,
          height: 8,
          borderRadius: 4,
          backgroundColor: brand.accent,
          translate: `-${underlineW / 2}px 0px`,
        }}
      />
    </>
  );
};
