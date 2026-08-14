import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {EASE_OUT_QUINT} from './ui';

type Step = {label: string; minutes: number; snap: number};

const STEPS: Step[] = [
  {label: 'PREP', minutes: 8, snap: 30},
  {label: 'SEAR', minutes: 10, snap: 48},
  {label: 'SIMMER', minutes: 14, snap: 66},
  {label: 'REST', minutes: 3, snap: 84},
];
const CLEANUP: Step = {label: 'CLEANUP', minutes: 3, snap: 222};
const PX_PER_MIN = 16;

const snapProgress = (frame: number, snap: number): number =>
  interpolate(frame, [snap, snap + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });

const StepRow: FC<{
  step: Step;
  frame: number;
  top: number;
  color: string;
  dashed?: boolean;
  dropFromAbove?: boolean;
}> = ({step, frame, top, color, dashed, dropFromAbove}) => {
  const p = snapProgress(frame, step.snap);
  if (p <= 0) {
    return null;
  }
  const settle = interpolate(frame, [step.snap, step.snap + 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.3, 1.3, 0.4, 1),
  });
  const x = dropFromAbove ? 0 : -70 * (1 - p);
  const y = dropFromAbove ? -620 * (1 - settle) : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 120,
        right: 90,
        height: 96,
        display: 'flex',
        alignItems: 'center',
        gap: 26,
        opacity: p,
        translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`,
      }}
    >
      <div
        style={{
          width: 210,
          fontFamily: inter,
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: '0.18em',
          color: dashed ? brand.amberBright : brand.creamSecondary,
        }}
      >
        {step.label}
      </div>
      <div
        style={{
          width: step.minutes * PX_PER_MIN * settle,
          height: dashed ? 46 : 54,
          backgroundColor: dashed ? 'rgba(224,164,71,0.16)' : color,
          border: dashed ? `2px dashed ${brand.amberBright}` : undefined,
          borderRadius: 8,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          opacity: p,
        }}
      >
        <span
          style={{
            fontFamily: anton,
            fontSize: 52,
            color: dashed ? brand.amberBright : brand.cream,
          }}
        >
          {Math.round(step.minutes * settle)}
        </span>
        <span
          style={{
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 22,
            color: brand.creamFaint,
          }}
        >
          MIN
        </span>
      </div>
    </div>
  );
};

/** 32-42s — hero card + step timeline snapping in, running total, cleanup dock. */
const TimelineScene: FC = () => {
  const frame = useCurrentFrame();
  // Continuity with the push-in: the card lands from zoomed.
  const heroScale = interpolate(frame, [0, 18], [2.6, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const heroOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const allSteps = [...STEPS, CLEANUP];
  // Running total counts continuously as each step docks.
  const totalMinutes = allSteps.reduce(
    (acc, s) => acc + s.minutes * snapProgress(frame, s.snap),
    0,
  );
  const totalPulses = allSteps.map((s) => {
    const t = frame - (s.snap + 16);
    return t >= 0 && t <= 10 ? Math.sin((Math.PI * t) / 10) : 0;
  });
  const totalPop = 1 + 0.06 * Math.max(...totalPulses, 0);
  const cleanupDone = frame >= CLEANUP.snap + 16;
  const accounted = interpolate(frame, [248, 268], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* Hero card, landed from the push-in. */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 220,
          width: 640,
          height: 280,
          backgroundColor: brand.darkSurfaceSoft,
          border: `2px solid rgba(217,110,63,0.85)`,
          borderRadius: 22,
          padding: '30px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          scale: heroScale.toFixed(3),
          opacity: heroOpacity,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span
            style={{
              fontFamily: anton,
              fontSize: 56,
              color: brand.cream,
            }}
          >
            ONE-PAN PASTA
          </span>
          <span
            style={{
              fontFamily: inter,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: '0.2em',
              color: brand.accentBright,
            }}
          >
            REAL
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span style={{fontFamily: anton, fontSize: 110, color: brand.accentBright, lineHeight: 1}}>
            38<span style={{fontSize: 44}}> MIN</span>
          </span>
          <span
            style={{
              fontFamily: inter,
              fontWeight: 600,
              fontSize: 20,
              color: brand.creamFaint,
            }}
          >
            crowd-reported · 1,204 cooks
          </span>
        </div>
      </div>

      {/* Connector */}
      <div
        style={{
          position: 'absolute',
          top: 446,
          left: 539,
          width: 2,
          height: interpolate(frame, [14, 30], [0, 130], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          backgroundColor: brand.darkSurfaceSoft,
        }}
      />

      {/* Steps snap in left-to-right. */}
      {STEPS.map((step, i) => (
        <StepRow
          key={step.label}
          step={step}
          frame={frame}
          top={600 + i * 120}
          color={brand.accentBright}
        />
      ))}

      {/* Cleanup drops in last, heavier. */}
      <StepRow
        step={CLEANUP}
        frame={frame}
        top={1116}
        color={brand.amberBright}
        dashed
        dropFromAbove
      />
      <div
        style={{
          position: 'absolute',
          top: 1080,
          left: 120,
          right: 90,
          height: 2,
          backgroundColor: brand.darkSurfaceSoft,
          opacity: interpolate(frame, [210, 222], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
        }}
      />

      {/* Running total. */}
      <div
        style={{
          position: 'absolute',
          top: 1330,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          scale: totalPop.toFixed(3),
        }}
      >
        <div
          style={{
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: '0.4em',
            color: brand.creamFaint,
          }}
        >
          {cleanupDone ? 'FINAL TIME' : 'RUNNING TOTAL'}
        </div>
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: anton,
              fontSize: 150,
              lineHeight: 1.05,
              color: cleanupDone ? brand.accentBright : brand.cream,
            }}
          >
            {Math.round(totalMinutes)}
          </span>
          <span
            style={{
              fontFamily: anton,
              fontSize: 54,
              color: brand.creamFaint,
            }}
          >
            MIN
          </span>
        </div>
        {/* Mini progress bar to 38. */}
        <div
          style={{
            marginTop: 14,
            width: 640,
            height: 6,
            backgroundColor: brand.darkSurfaceSoft,
            borderRadius: 3,
          }}
        >
          <div
            style={{
              width: `${((totalMinutes / 38) * 100).toFixed(1)}%`,
              height: '100%',
              borderRadius: 3,
              backgroundColor: cleanupDone ? brand.accentBright : brand.creamSecondary,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 26,
            letterSpacing: '0.3em',
            color: brand.creamSecondary,
            opacity: accounted,
            translate: `0px ${((1 - accounted) * 14).toFixed(1)}px`,
          }}
        >
          EVERY MINUTE, ACCOUNTED FOR
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default TimelineScene;
