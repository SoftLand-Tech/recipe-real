// HOOK (0–2.83s): three panels slam in already mid-chaos — mouths flapping,
// panels shaking — then a hard cut to black (handled by FreezeScene).

import type {FC} from 'react';
import {Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {anton} from './fonts';
import {COOKS, COOK_ORDER, CookBust} from './characters';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const BUBBLES = [
  {text: '30 MINUTES!!', size: 52},
  {text: 'THIRTY?!\nTRY AN HOUR!', size: 38},
  {text: 'WHEN DO I\nPREHEAT?!', size: 40},
] as const;

const HookPanel: FC<{index: number}> = ({index}) => {
  const f = useCurrentFrame();
  const cook = COOK_ORDER[index];
  const c = COOKS[cook];

  const slam = interpolate(f, [0, 5], [1.16, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.2, 0.9, 0.3, 1),
  });
  const shakeAmp = interpolate(f, [0, 5], [0.35, 1], CLAMP);
  const tx = (random(`hook-x-${index}`, f) - 0.5) * 16 * shakeAmp;
  const ty = (random(`hook-y-${index}`, f) - 0.5) * 12 * shakeAmp;
  const rot = (random(`hook-r-${index}`, f) - 0.5) * 2 * shakeAmp;
  const bubbleRot = (random(`hook-b-${index}`, f) - 0.5) * 5 * shakeAmp;
  const bubblePop = interpolate(f, [index * 2, index * 2 + 5], [0.5, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: index * 360,
        top: 0,
        width: 358,
        height: 1920,
        boxSizing: 'border-box',
        backgroundColor: c.soft,
        borderRight: index < 2 ? `3px solid ${brand.canvas}` : undefined,
        overflow: 'hidden',
        scale: `${slam}`,
        translate: `${tx}px ${ty}px`,
        rotate: `${rot}deg`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 20,
          width: 318,
          backgroundColor: brand.surface,
          border: `4px solid ${brand.ink}`,
          borderRadius: 24,
          padding: '18px 14px',
          boxShadow: '0 16px 34px rgba(36,29,23,0.2)',
          rotate: `${bubbleRot}deg`,
          scale: `${bubblePop}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            bottom: -16,
            left: 54,
            width: 26,
            height: 26,
            backgroundColor: brand.surface,
            borderRight: `4px solid ${brand.ink}`,
            borderBottom: `4px solid ${brand.ink}`,
            rotate: '45deg',
          }}
        />
        <div
          style={{
            fontFamily: anton,
            fontSize: BUBBLES[index].size,
            lineHeight: 1.08,
            color: brand.ink,
            textAlign: 'center',
            whiteSpace: 'pre-line',
          }}
        >
          {BUBBLES[index].text}
        </div>
      </div>
      <div style={{position: 'absolute', top: 980, left: 29}}>
        <CookBust cook={cook} f={f} speaking={[0, 84]} width={300} />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          width: '100%',
          textAlign: 'center',
          fontFamily: anton,
          fontSize: 34,
          letterSpacing: 4,
          color: c.dark,
          opacity: 0.75,
        }}
      >
        {c.name}
      </div>
    </div>
  );
};

export const HookScene: FC = () => {
  return (
    <>
      {COOK_ORDER.map((_, i) => (
        <HookPanel key={i} index={i} />
      ))}
    </>
  );
};
