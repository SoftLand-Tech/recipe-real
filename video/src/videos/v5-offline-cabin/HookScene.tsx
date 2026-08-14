// HOOK (0-3s): extreme close-up on a phone's signal bars dying one by one,
// then the screen settles into dim blue. Exits with a scale-up fade at 3s.
import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {inter} from './fonts';
import {BEAT, noise} from './timing';

const HOOK_BLUE = '#2C3E56'; // desaturated steel blue the screen settles into
const BAR_ALIVE = '#7391B4';
const BAR_DEAD = '#26303E';

const BAR_WIDTH = 92;
const BAR_GAP = 30;
const BAR_HEIGHTS = [150, 240, 330, 420];

const SignalBar: FC<{index: number; frame: number}> = ({index, frame}) => {
  const {barDie} = BEAT;
  const dieFrame = barDie[3 - index]; // tallest bar dies first
  const isLoneBar = index === 0;

  // Pre-death flicker (the lone bar flickers hard from the 2nd drop onward).
  const flickerFrom = isLoneBar ? barDie[1] : dieFrame - 18;
  const flicker =
    frame >= flickerFrom && frame < dieFrame
      ? (isLoneBar ? 0.3 : 0.55) +
        (isLoneBar ? 0.7 : 0.45) * noise(`bar${index}`, frame, 3)
      : 1;

  const dying = frame >= dieFrame;
  const height = dying
    ? interpolate(frame, [dieFrame, dieFrame + 7], [BAR_HEIGHTS[index], 16], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      })
    : BAR_HEIGHTS[index];
  const settleOpacity = dying
    ? interpolate(frame, [dieFrame, dieFrame + 7], [1, 0.3], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <div
      style={{
        width: BAR_WIDTH,
        height: height,
        borderRadius: 12,
        backgroundColor: dying ? BAR_DEAD : BAR_ALIVE,
        opacity: flicker * settleOpacity,
      }}
    />
  );
};

const HookScene: FC = () => {
  const frame = useCurrentFrame();

  // Exit: push in and fade out as the cabin is revealed behind.
  const exitOpacity = interpolate(frame, [90, 132], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const exitScale = interpolate(frame, [90, 132], [1, 1.16], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });

  // The screen settles into dim blue as the last bar dies.
  const blueSettle = interpolate(frame, [60, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const scanFlicker = 0.35 + 0.25 * noise('scan', frame, 5);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#171310',
        opacity: exitOpacity,
        scale: `${exitScale}`,
      }}
    >
      {/* Phone close-up panel */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 180,
          width: 900,
          height: 1560,
          borderRadius: 80,
          background: 'linear-gradient(180deg, #0D1420 0%, #0A0E16 100%)',
          border: '2px solid #1D2735',
          boxShadow: '0 60px 140px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* Status row */}
        <div
          style={{
            position: 'absolute',
            top: 84,
            left: 72,
            right: 72,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: inter,
            fontSize: 42,
            fontWeight: 600,
            color: '#5E6E82',
            letterSpacing: 2,
          }}
        >
          <span>18:47</span>
          <span>Carrier</span>
        </div>

        {/* Signal bars, bottom-aligned on a baseline */}
        <div
          style={{
            position: 'absolute',
            top: 560,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: BAR_GAP,
          }}
        >
          {BAR_HEIGHTS.map((_, i) => (
            <SignalBar key={i} index={i} frame={frame} />
          ))}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 1010,
            left: 90,
            right: 90,
            height: 3,
            backgroundColor: '#1B2534',
          }}
        />

        {/* "No Service" */}
        <div
          style={{
            position: 'absolute',
            top: 1064,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontFamily: inter,
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: 10,
            color: '#5E6E82',
            opacity: interpolate(frame, [BEAT.noService, BEAT.noService + 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          NO SERVICE
        </div>

        {/* Faint scanlines + flicker */}
        <AbsoluteFill
          style={{
            background:
              'repeating-linear-gradient(180deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 2px, transparent 2px, transparent 7px)',
            opacity: scanFlicker,
          }}
        />

        {/* Settle into dim blue */}
        <AbsoluteFill
          style={{
            backgroundColor: HOOK_BLUE,
            opacity: 0.62 * blueSettle,
          }}
        />
      </div>

      {/* Whole-canvas blue tint + vignette */}
      <AbsoluteFill style={{backgroundColor: HOOK_BLUE, opacity: 0.35 * blueSettle}} />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(75% 55% at 50% 46%, transparent 55%, rgba(10,8,6,0.62) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

export default HookScene;
