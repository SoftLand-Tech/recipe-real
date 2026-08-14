import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {ANTON, CLAMP, TIMER_BOX, TimerDigits, jitter, shakeAmp} from './common';

/** 0.8s — accusation text hits with the glass-crack SFX. */
const ACCUSE_BEAT = 24;
/** 2.0s — pattern interrupt: the timer starts glitching red. */
const GLITCH_BEAT = 60;

/** Horizontal slice offsets (as % from top, 8% tall) used while glitching. */
const BANDS = [16, 36, 58, 76];

export const HookScene: FC = () => {
  const frame = useCurrentFrame();
  const glitching = frame >= GLITCH_BEAT;
  const flicker = glitching && random(`flick:${Math.floor(frame / 2)}`) > 0.4;
  const shake = shakeAmp(frame, 6, 9) + shakeAmp(frame, ACCUSE_BEAT, 12);

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 30%, ${brand.accentBright}1a, transparent 55%)`,
        }}
      />
      <AbsoluteFill
        style={{
          translate: `${jitter('hook-x', frame, shake)}px ${jitter('hook-y', frame, shake)}px`,
        }}
      >
        {/* Giant timer, slamming in at scale 3 -> 1 */}
        <div
          style={{
            position: 'absolute',
            top: TIMER_BOX.top,
            left: TIMER_BOX.side,
            right: TIMER_BOX.side,
            height: TIMER_BOX.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: interpolate(frame, [0, 3], [0, 1], CLAMP),
            scale: interpolate(frame, [0, 9], [3, 1], {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              ...CLAMP,
            }),
            translate: glitching
              ? `${jitter('timer-gx', frame, 8, 2)}px 0px`
              : '0px 0px',
          }}
        >
          {/* Displaced glitch slices over the digits */}
          {glitching &&
            BANDS.map((top, i) => (
              <div
                key={top}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  clipPath: `inset(${top}% 0 ${100 - top - 8}% 0)`,
                  translate: `${jitter(`band-${i}`, frame, 30, 2)}px 0px`,
                }}
              >
                <TimerDigits
                  size={380}
                  color={i % 2 === 0 ? brand.dangerBright : brand.cream}
                />
              </div>
            ))}
          {/* Chromatic ghost copies while glitching */}
          {glitching && (
            <>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  translate: '-14px 0px',
                  opacity: 0.4,
                }}
              >
                <TimerDigits size={380} color={brand.dangerBright} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  translate: '14px 0px',
                  opacity: 0.3,
                }}
              >
                <TimerDigits size={380} color={brand.accentBright} />
              </div>
            </>
          )}
          <TimerDigits size={380} color={flicker ? brand.dangerBright : brand.cream} />
        </div>

        {/* The accusation — slams in on the crack */}
        <div
          style={{
            position: 'absolute',
            top: 1140,
            left: TIMER_BOX.side,
            right: TIMER_BOX.side,
            textAlign: 'center',
            fontFamily: ANTON,
            fontSize: 122,
            lineHeight: 1.18,
            color: brand.cream,
            opacity: interpolate(frame, [ACCUSE_BEAT, ACCUSE_BEAT + 3], [0, 1], CLAMP),
            translate: `0px ${interpolate(frame, [ACCUSE_BEAT, ACCUSE_BEAT + 7], [70, 0], {
              easing: Easing.bezier(0.16, 1, 0.3, 1),
              ...CLAMP,
            })}px`,
          }}
        >
          THIS RECIPE IS
          <br />
          <span style={{color: brand.dangerBright}}>LYING</span> TO YOU.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
