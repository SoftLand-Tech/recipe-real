// The frozen "30 MIN" recipe card — hero of the hook freeze, then hovering scoreboard.

import type {FC} from 'react';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';

export const RecipeCard: FC = () => {
  return (
    <div
      style={{
        width: 560,
        backgroundColor: brand.surface,
        borderRadius: 36,
        border: `4px solid ${brand.hairlineStrong}`,
        boxShadow: '0 34px 70px rgba(36,29,23,0.22)',
        padding: '40px 42px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          fontFamily: inter,
          fontSize: 22,
          letterSpacing: 5,
          color: brand.inkFaint,
          border: `2px solid ${brand.hairlineStrong}`,
          borderRadius: 999,
          padding: '6px 22px',
        }}
      >
        RECIPE NO. 30
      </div>
      <div style={{fontFamily: anton, fontSize: 46, color: brand.ink, lineHeight: 1.1}}>One-Pan Pasta</div>
      <div style={{fontFamily: inter, fontSize: 24, letterSpacing: 6, color: brand.inkSecondary}}>TOTAL TIME</div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 12}}>
        <span style={{fontFamily: anton, fontSize: 188, lineHeight: 0.95, color: brand.ink}}>30</span>
        <span style={{fontFamily: anton, fontSize: 54, color: brand.accent}}>MIN</span>
      </div>
      <div style={{width: '88%', borderTop: `3px dashed ${brand.hairlineStrong}`}} />
      <div style={{fontFamily: inter, fontSize: 27, color: brand.inkSecondary}}>Serves 4 · One pan · Easy</div>
    </div>
  );
};
