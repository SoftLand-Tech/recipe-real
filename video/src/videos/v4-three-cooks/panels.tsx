// PANELS (3.67–31.4s): panels re-enter one at a time under the hovering card.
// Each cook performs their line — panel scales 1 -> 1.06 while its voice plays.

import type {FC} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {COOKS, COOK_ORDER, CookBust, type CookId} from './characters';
import {inter} from './fonts';
import {MiniCard, TickingClock, TimerDial} from './props';
import {PANEL_ENTER, PROP_WINDOWS, SCENES, SPEAKING, type Window2} from './timeline';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

const PANEL_X = [39, 379, 719] as const;
const PANEL_W = 322;
const PANEL_TOP = 566;
const PANEL_H = 1210;

const CAPTIONS: Record<CookId, string> = {
  optimist: 'It said thirty minutes. Thirty!',
  realist: 'Thirty… plus twenty of chopping I didn\u2019t count.',
  beginner: 'Wait — when do I preheat the oven?!',
};

/** Trapezoid envelope: 0 -> 1 while the voice is playing. */
const speechEnv = (f: number, w: Window2): number =>
  Math.min(
    interpolate(f, [w[0] - 2, w[0] + 16], [0, 1], CLAMP),
    interpolate(f, [w[1] - 6, w[1] + 2], [1, 0], CLAMP),
  );

const Panel: FC<{index: number}> = ({index}) => {
  const local = useCurrentFrame();
  const f = local + SCENES.panelsStart;
  const cook = COOK_ORDER[index];
  const c = COOKS[cook];
  const speaking = SPEAKING[cook];

  // Re-enter, one at a time.
  const enter = interpolate(f, [PANEL_ENTER[index], PANEL_ENTER[index] + 16], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const enterX = (1 - enter) * (index === 0 ? -90 : index === 2 ? 90 : 0);
  const enterY = (1 - enter) * (index === 1 ? 80 : 0);

  // Exit as everything merges into the RecipeReal UI.
  const exit = interpolate(f, [900, 942], [0, 1], {
    ...CLAMP,
    easing: Easing.in(Easing.cubic),
  });
  const exitX = exit * (index === 0 ? -560 : index === 2 ? 560 : 0);
  const exitY = exit * (index === 1 ? 140 : 0);

  // Speaking: panel scales 1 -> 1.06 and lifts slightly.
  const env = speechEnv(f, speaking);

  const captionOpacity =
    env *
    Math.min(
      interpolate(f, [speaking[0] - 2, speaking[0] + 6], [0, 1], CLAMP),
      interpolate(f, [speaking[1] - 10, speaking[1]], [1, 0], CLAMP),
    );

  return (
    <div
      style={{
        position: 'absolute',
        left: PANEL_X[index],
        top: PANEL_TOP,
        width: PANEL_W,
        height: PANEL_H,
        boxSizing: 'border-box',
        backgroundColor: c.soft,
        border: `3px solid ${brand.hairlineStrong}`,
        borderRadius: 30,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 26,
        opacity: Math.min(enter * 1.6, 1) * (1 - exit),
        translate: `${enterX + exitX}px ${enterY + exitY - env * 10}px`,
        scale: `${(0.85 + 0.15 * enter) * (1 + 0.06 * env) * (1 - 0.08 * exit)}`,
        boxShadow:
          env > 0.02
            ? '0 30px 60px rgba(36,29,23,0.22)'
            : '0 12px 30px rgba(36,29,23,0.1)',
        zIndex: env > 0.02 ? 3 : 2,
      }}
    >
      <div
        style={{
          fontFamily: inter,
          fontSize: 21,
          fontWeight: 700,
          letterSpacing: 3,
          color: c.dark,
          backgroundColor: 'rgba(255,255,255,0.75)',
          borderRadius: 999,
          padding: '8px 20px',
        }}
      >
        {c.name}
      </div>
      <div style={{marginTop: 26}}>
        <CookBust cook={cook} f={f} speaking={speaking} width={244} />
      </div>
      <div style={{position: 'relative', width: 300, height: 330, marginTop: 8}}>
        {cook === 'optimist' ? <TimerDial f={f} window={PROP_WINDOWS.optimist} /> : null}
        {cook === 'realist' ? <TickingClock f={f} window={PROP_WINDOWS.realist} /> : null}
        {cook === 'beginner' ? <MiniCard f={f} window={PROP_WINDOWS.beginner} /> : null}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 26,
          left: 18,
          width: 286,
          backgroundColor: 'rgba(255,255,255,0.92)',
          border: `2px solid ${brand.hairlineStrong}`,
          borderRadius: 18,
          padding: '12px 14px',
          fontFamily: inter,
          fontSize: 23,
          fontWeight: 500,
          lineHeight: 1.25,
          color: brand.ink,
          textAlign: 'center',
          opacity: captionOpacity,
        }}
      >
        {CAPTIONS[cook]}
      </div>
    </div>
  );
};

export const PanelsScene: FC = () => {
  return (
    <>
      {COOK_ORDER.map((_, i) => (
        <Panel key={i} index={i} />
      ))}
    </>
  );
};
