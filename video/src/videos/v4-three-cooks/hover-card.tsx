// HOVER CARD (3.67s–31.6s): the frozen card lifts from center to hover above
// the three panels, bobbing gently, then dives back to center to become the UI.

import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {SCENES} from './timeline';
import {RecipeCard} from './RecipeCard';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const HoverCardScene: FC = () => {
  const local = useCurrentFrame();
  const f = local + SCENES.panelsStart; // absolute composition frame

  // Center -> hover position (comp 110–142)
  const lift = interpolate(f, [110, 142], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });
  // Dive back to center as everything merges (comp 900–940)
  const dive = interpolate(f, [900, 940], [0, 1], {
    ...CLAMP,
    easing: Easing.bezier(0.45, 0, 0.55, 1),
  });

  const hoverY = interpolate(lift * (1 - dive), [0, 1], [0, -560]);
  const bob = lift >= 1 && dive <= 0 ? Math.sin(f / 26) * 8 : 0;
  // Center: scale 1 -> hover: 0.52 -> dives back to 1 as it becomes the UI.
  const scale = 1 - 0.48 * lift + 0.48 * dive;
  const opacity =
    1 - interpolate(f, [930, 944], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
      <div style={{translate: `0px ${hoverY + bob}px`, scale: `${scale}`, opacity}}>
        <RecipeCard />
      </div>
    </AbsoluteFill>
  );
};
