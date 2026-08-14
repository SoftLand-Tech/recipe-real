import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {EASE_OUT_QUINT} from './ui';

const PX_PER_MIN = 20.75;
const CHART_LEFT = 140;
const xOf = (minutes: number): number => CHART_LEFT + minutes * PX_PER_MIN;

const GRAY = {start: 18, end: 64, value: 20};
const ORANGE = {start: 33, end: 111, value: 38};
const HATCH_START = 162;
const HATCH_END = 198;

const CountUp: FC<{frame: number; start: number; end: number; value: number}> = ({
  frame,
  start,
  end,
  value,
}) => {
  const progress = interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1.25, 0.36, 1),
  });
  return <>{Math.round(value * progress)}</>;
};

/** 8-18s — bar race: thin gray BLOGGER: 20 vs thick orange REAL: 38. */
const BarsScene: FC = () => {
  const frame = useCurrentFrame();

  const grayProgress = interpolate(frame, [GRAY.start, GRAY.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1.25, 0.36, 1),
  });
  const orangeProgress = interpolate(frame, [ORANGE.start, ORANGE.end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.2, 1.18, 0.3, 1),
  });
  const grayWidth = grayProgress * PX_PER_MIN * GRAY.value;
  const orangeWidth = orangeProgress * PX_PER_MIN * ORANGE.value;

  // "The lie" hatched gap between the promise line and the real bar end.
  const hatchDraw = interpolate(frame, [HATCH_START, HATCH_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.5, 0, 0.4, 1),
  });
  const promiseLine = interpolate(frame, [HATCH_START, HATCH_START + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const realLine = interpolate(
    frame,
    [HATCH_START + 12, HATCH_START + 24],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const lieLabel = interpolate(frame, [HATCH_START + 18, HATCH_START + 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });

  const headerOpacity = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const axisOpacity = interpolate(frame, [40, 60], [0, 0.9], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const grayValue = Math.round(GRAY.value * grayProgress);
  const orangeValue = Math.round(ORANGE.value * orangeProgress);

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: headerOpacity,
          translate: `0px ${((1 - headerOpacity) * 24).toFixed(1)}px`,
        }}
      >
        <div
          style={{
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: '0.4em',
            color: brand.creamFaint,
          }}
        >
          SAME 1,000 RECIPES
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: anton,
            fontSize: 96,
            lineHeight: 1.05,
            color: brand.cream,
          }}
        >
          PROMISED <span style={{color: brand.dangerBright}}>VS.</span> REAL
        </div>
      </div>

      {/* Blogger row */}
      <div style={{position: 'absolute', top: 760, left: CHART_LEFT, right: 0}}>
        <div
          style={{
            fontFamily: inter,
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: '0.3em',
            color: brand.creamFaint,
            opacity: interpolate(frame, [10, 26], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          BLOGGER
        </div>
        <div
          style={{
            marginTop: 16,
            width: grayWidth,
            height: 54,
            backgroundColor: brand.creamFaint,
            opacity: 0.9,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 50,
            left: grayWidth + 24,
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            opacity: grayProgress > 0.02 ? 1 : 0,
          }}
        >
          <span style={{fontFamily: anton, fontSize: 62, color: brand.cream}}>
            <CountUp frame={frame} start={GRAY.start} end={GRAY.end} value={GRAY.value} />
          </span>
          <span
            style={{
              fontFamily: inter,
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: '0.1em',
              color: brand.creamFaint,
            }}
          >
            MIN
          </span>
        </div>
      </div>

      {/* Real cooks row */}
      <div style={{position: 'absolute', top: 1030, left: CHART_LEFT, right: 0}}>
        <div
          style={{
            fontFamily: inter,
            fontWeight: 800,
            fontSize: 32,
            letterSpacing: '0.3em',
            color: brand.accentBright,
            opacity: interpolate(frame, [24, 40], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          REAL COOKS
        </div>
        <div
          style={{
            marginTop: 16,
            width: orangeWidth,
            height: 128,
            background: `linear-gradient(180deg, ${brand.accentBright} 0%, #C25832 100%)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 76,
            left: 0,
            width: orangeWidth - 26,
            textAlign: 'right',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'flex-end',
            gap: 10,
            opacity: orangeProgress > 0.05 ? 1 : 0,
          }}
        >
          <span style={{fontFamily: anton, fontSize: 74, color: '#171310' }}>
            <CountUp frame={frame} start={ORANGE.start} end={ORANGE.end} value={ORANGE.value} />
          </span>
          <span
            style={{
              fontFamily: inter,
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: '0.1em',
              color: 'rgba(23,19,16,0.72)',
            }}
          >
            MIN
          </span>
        </div>
      </div>

      {/* "The lie" hatched gap */}
      <div
        style={{
          position: 'absolute',
          top: 920,
          left: xOf(GRAY.value),
          width: (ORANGE.value - GRAY.value) * PX_PER_MIN,
          height: 64,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            transformOrigin: 'left center',
            transform: `scaleX(${hatchDraw.toFixed(3)})`,
            background: `repeating-linear-gradient(135deg, ${brand.dangerBright} 0px, ${brand.dangerBright} 7px, transparent 7px, transparent 18px)`,
            border: `2px dashed ${brand.dangerBright}`,
            opacity: 0.85,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: 852,
          left: xOf(GRAY.value),
          width: (ORANGE.value - GRAY.value) * PX_PER_MIN,
          textAlign: 'center',
          fontFamily: inter,
          fontWeight: 800,
          fontSize: 34,
          letterSpacing: '0.24em',
          color: brand.dangerBright,
          opacity: lieLabel,
          translate: `0px ${((1 - lieLabel) * 14).toFixed(1)}px`,
        }}
      >
        THE LIE · +18 MIN
      </div>

      {/* Promise / reality dashed hairlines */}
      <div
        style={{
          position: 'absolute',
          top: 700,
          left: xOf(GRAY.value),
          width: 2,
          height: 660 * promiseLine,
          borderLeft: `2px dashed rgba(217,107,92,0.55)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 700,
          left: xOf(ORANGE.value),
          width: 2,
          height: 660 * realLine,
          borderLeft: `2px dashed rgba(217,107,92,0.4)`,
        }}
      />

      {/* Axis */}
      <div
        style={{
          position: 'absolute',
          top: 1372,
          left: CHART_LEFT,
          width: PX_PER_MIN * 40,
          height: 2,
          backgroundColor: brand.darkSurfaceSoft,
          opacity: axisOpacity,
        }}
      />
      {[0, 10, 20, 30, 40].map((tick) => (
        <div
          key={tick}
          style={{
            position: 'absolute',
            top: 1388,
            left: xOf(tick) - 20,
            width: 40,
            textAlign: 'center',
            fontFamily: inter,
            fontWeight: 600,
            fontSize: 26,
            color: brand.creamFaint,
            opacity: axisOpacity,
          }}
        >
          {tick}
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          top: 1470,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: inter,
          fontWeight: 700,
          fontSize: 26,
          letterSpacing: '0.3em',
          color: brand.creamFaint,
          opacity: axisOpacity,
        }}
      >
        MINUTES · MEAN OF CROWD REPORTS
      </div>
    </AbsoluteFill>
  );
};

export default BarsScene;
