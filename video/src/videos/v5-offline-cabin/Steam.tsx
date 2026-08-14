// SVG steam wisps rising above the pan: translateY loops + turbulent alpha
// from deterministic smoothed noise. Pure function of frame.
import type {FC} from 'react';
import {interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {cab, noise, BEAT} from './timing';

const WISP_PATHS = [
  'M 64 250 C 34 206, 94 168, 64 122 C 38 84, 86 52, 64 12',
  'M 70 252 C 96 208, 44 166, 70 120 C 94 82, 48 48, 70 10',
  'M 66 248 C 40 204, 92 164, 66 118 C 42 82, 90 50, 66 14',
];

type SteamProps = {
  x: number;
  y: number;
};

const Steam: FC<SteamProps> = ({x, y}) => {
  const frame = useCurrentFrame();
  const start = cab(BEAT.steamStart);
  const t = frame - start;
  const appear = interpolate(t, [0, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Wisps ease off once the plate lands and the wash warms the scene.
  const ease = interpolate(frame, [cab(BEAT.plate), cab(BEAT.plate) + 90], [1, 0.45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0, opacity: appear * ease}}>
      {WISP_PATHS.map((d, i) => {
        const cycle = 210 + i * 48;
        const p = (frame * (1.05 + i * 0.16) + i * 74) % cycle;
        const envelope = interpolate(p, [0, 44, cycle - 70, cycle], [0, 1, 0.65, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const turbulence = 0.5 + 0.5 * noise(`steam-${i}`, frame, 5);
        const sway = Math.sin((frame + i * 37) / 26) * (13 + i * 6);
        return (
          <svg
            key={i}
            width={140}
            height={260}
            style={{
              position: 'absolute',
              left: -70 + (i - 1) * 46,
              top: -250,
              translate: `${sway}px ${-p}px`,
              opacity: 0.36 * envelope * turbulence,
              filter: 'blur(7px)',
            }}
          >
            <path
              d={d}
              stroke={brand.cream}
              strokeWidth={11 - i * 2}
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        );
      })}
    </div>
  );
};

export default Steam;
