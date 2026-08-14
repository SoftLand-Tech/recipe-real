import type {FC} from 'react';
import {loadFont as loadAntonFont} from '@remotion/google-fonts/Anton';
import {loadFont as loadInterFont} from '@remotion/google-fonts/Inter';
import {interpolate, random} from 'remotion';
import {brand} from '../../shared/theme';

const {fontFamily: anton} = loadAntonFont();
const {fontFamily: inter} = loadInterFont('normal', {
  weights: ['400', '500', '600', '700', '800'],
  subsets: ['latin'],
});

/** Slam typography (headlines, timers). */
export const ANTON = anton;
/** UI / mockup text. */
export const INTER = inter;

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/** Deterministic signed jitter in [-amp, amp], re-rolled every `step` frames. */
export const jitter = (seed: string, frame: number, amp: number, step = 1): number =>
  (random(`${seed}:${Math.floor(frame / step)}`) - 0.5) * 2 * amp;

/** Decaying shake amplitude after an impact at frame `start`. */
export const shakeAmp = (
  frame: number,
  start: number,
  peak = 16,
  decay = 12,
): number =>
  frame < start ? 0 : interpolate(frame, [start, start + decay], [peak, 0], CLAMP);

/** Timer geometry shared by the hook and shatter scenes for a seamless handoff. */
export const TIMER_BOX = {top: 470, height: 430, side: 60} as const;

export const TimerDigits: FC<{size?: number; color?: string}> = ({
  size = 380,
  color = brand.cream,
}) => (
  <div
    style={{
      fontFamily: ANTON,
      fontSize: size,
      lineHeight: 1,
      color,
      letterSpacing: size * 0.02,
      whiteSpace: 'nowrap',
    }}
  >
    15:00
  </div>
);

/** Styled text wordmark — "Recipe" cream, "Real" terracotta. */
export const Wordmark: FC<{size: number}> = ({size}) => (
  <div
    style={{
      fontFamily: INTER,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: -size * 0.02,
      lineHeight: 1,
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{color: brand.cream}}>Recipe</span>
    <span style={{color: brand.accentBright}}>Real</span>
  </div>
);
