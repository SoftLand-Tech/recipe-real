// FREEZE (2.83–3.67s): hard cut to black, the recipe card frozen center.
// No entrance animation — the cut IS the transition.

import type {FC} from 'react';
import {AbsoluteFill} from 'remotion';
import {RecipeCard} from './RecipeCard';

export const FreezeScene: FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#000', justifyContent: 'center', alignItems: 'center'}}>
      <RecipeCard />
    </AbsoluteFill>
  );
};
