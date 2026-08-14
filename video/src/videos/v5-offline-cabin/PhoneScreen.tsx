// The RecipeReal phone screen propped on the cabin counter.
// Cabin-local frame. Shows: offline status -> airplane mode, Cook Mode glow,
// a timer ring completing every 2s (25.5s-33.5s), and steps checking off.
import type {FC} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {inter} from './fonts';
import {BEAT, cab, ringFlash, ringProgress} from './timing';

// Cabin-local beat frames.
const AIRPLANE = cab(BEAT.airplane); // 90
const COOK_MODE = cab(BEAT.cookMode); // 210
const RING_FIRST = cab(BEAT.ringDone[0]) - 60; // 615
const RING_LAST = cab(BEAT.ringDone[4]); // 915
const STEP_CHECKS = [
  cab(BEAT.ringDone[0]), // 675
  cab(BEAT.ringDone[1]), // 735
  cab(BEAT.ringDone[2]), // 795
  cab(BEAT.ringDone[3]), // 855
  cab(BEAT.finalStep), // 1140 — final step checks off at 41s
];
const STEPS = [
  'Heat the skillet',
  'Sear the chicken',
  'Toss the aromatics',
  'Simmer the sauce',
  'Plate and serve',
];

const AIRPLANE_PATH =
  'M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';

const PhoneScreen: FC = () => {
  const frame = useCurrentFrame();
  const progress = ringProgress(frame);
  const flash = ringFlash(frame);
  const cookOn = frame >= COOK_MODE;
  const cookPop = interpolate(frame, [COOK_MODE, COOK_MODE + 22], [0.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
  });
  const cookPulse = 0.85 + 0.15 * Math.sin(frame / 16);

  // Timer label: recipe time before the ring phase, per-cycle countdown during.
  const cycleEnd = RING_FIRST + 60 * Math.floor((frame - RING_FIRST) / 60) + 60;
  const remaining = Math.max(0, Math.ceil((cycleEnd - frame) / 30));
  const timerLabel =
    frame < RING_FIRST ? '8:00' : frame <= RING_LAST ? `0:0${remaining}` : '0:00';

  const ringColor = flash > 0 ? brand.successBright : brand.accentBright;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #12161D 0%, #0D1015 100%)',
        overflow: 'hidden',
        fontFamily: inter,
      }}
    >
      {/* Status bar */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          right: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: brand.creamFaint,
          fontSize: 20,
          fontWeight: 600,
        }}
      >
        <span>18:47</span>
        {/* Dead signal glyph until airplane mode replaces it */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
            position: 'relative',
            opacity: interpolate(frame, [AIRPLANE, AIRPLANE + 10], [1, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          {[10, 16, 22].map((h) => (
            <div
              key={h}
              style={{width: 5, height: h, borderRadius: 2, backgroundColor: brand.creamFaint, opacity: 0.55}}
            />
          ))}
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: -8,
              right: -8,
              bottom: -4,
            }}
          >
            <svg width={44} height={36} viewBox="0 0 44 36">
              <line x1={4} y1={32} x2={40} y2={4} stroke={brand.creamFaint} strokeWidth={3} />
            </svg>
          </div>
        </div>
        {/* Airplane mode slides on */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: interpolate(frame, [AIRPLANE, AIRPLANE + 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            translate: `${interpolate(frame, [AIRPLANE, AIRPLANE + 18], [44, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            })}px 0px`,
          }}
        >
          <svg width={26} height={26} viewBox="0 0 24 24" fill={brand.amberBright}>
            <path d={AIRPLANE_PATH} />
          </svg>
          <span style={{fontSize: 18, letterSpacing: 1}}>Offline</span>
        </div>
      </div>

      {/* App header */}
      <div
        style={{
          position: 'absolute',
          top: 84,
          left: 28,
          right: 28,
        }}
      >
        <div style={{color: brand.creamFaint, fontSize: 19, fontWeight: 600, letterSpacing: 3}}>
          RECIPEREAL
        </div>
        <div style={{color: brand.cream, fontSize: 30, fontWeight: 700, lineHeight: 1.2, marginTop: 8}}>
          Cast-Iron Skillet Chicken
        </div>
      </div>

      {/* Cook Mode pill */}
      <div
        style={{
          position: 'absolute',
          top: 232,
          left: 28,
          opacity: cookOn ? cookPulse : 0,
          scale: `${cookOn ? cookPop : 0.6}`,
        }}
      >
        <div
          style={{
            border: `2px solid ${brand.accentBright}`,
            color: brand.accentBright,
            borderRadius: 999,
            padding: '12px 26px',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 5,
            boxShadow: `0 0 ${16 + 10 * Math.sin(frame / 16)}px rgba(217, 110, 63, 0.55)`,
          }}
        >
          COOK MODE
        </div>
      </div>

      {/* Timer ring */}
      <div
        style={{
          position: 'absolute',
          top: 306,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{position: 'relative', width: 116, height: 116}}>
          <svg width={116} height={116} viewBox="0 0 116 116">
            <circle cx={58} cy={58} r={47} fill="none" stroke="#2A241D" strokeWidth={9} />
            <circle
              cx={58}
              cy={58}
              r={47}
              fill="none"
              stroke={ringColor}
              strokeWidth={9}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 47}
              strokeDashoffset={2 * Math.PI * 47 * (1 - progress)}
              transform="rotate(-90 58 58)"
              opacity={interpolate(frame, [RING_FIRST - 30, RING_FIRST], [0.25, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: flash > 0 ? brand.successBright : brand.cream,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {timerLabel}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{position: 'absolute', top: 442, left: 28, right: 28, display: 'flex', flexDirection: 'column', gap: 10}}>
        {STEPS.map((label, i) => {
          const checked = frame >= STEP_CHECKS[i];
          const checking = frame >= STEP_CHECKS[i] && frame < STEP_CHECKS[i] + 16;
          return (
            <div key={label} style={{display: 'flex', alignItems: 'center', gap: 13, opacity: checked ? 1 : 0.55}}>
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: 999,
                  border: `2px solid ${checked ? brand.successBright : '#3A322A'}`,
                  backgroundColor: checked ? brand.successBright : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  scale: `${checking ? 1 + 0.25 * (1 - (frame - STEP_CHECKS[i]) / 16) : 1}`,
                }}
              >
                {checked ? (
                  <svg width={14} height={14} viewBox="0 0 16 16">
                    <path
                      d="M3 8.5 6.5 12 13 4.5"
                      fill="none"
                      stroke={brand.darkCanvas}
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </div>
              <span
                style={{
                  color: checked ? brand.cream : brand.creamSecondary,
                  fontSize: 19,
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PhoneScreen;
