// Cabin kitchen at dusk (3s-50s). Parallax layers drift on a slow sine with
// differential amplitudes; a pull-back scale settles over the first 3s.
// Cabin-local frame. Layers back-to-front: wall/window, lamp, ghost timer ring,
// counter/stove/board, pan+steam, knife, phone, plate, foreground.
import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import PhoneScreen from './PhoneScreen';
import Steam from './Steam';
import {BEAT, cab, noise, ringFlash, ringProgress} from './timing';

// Cabin-local beats.
const CHOPS = BEAT.chops.map((c) => cab(c)); // [240, 255, 270]
const PAN_SETTLE = cab(BEAT.panSettle); // 330
const SIZZLE = cab(BEAT.sizzleStart); // 360
const RING_IN = cab(BEAT.ringDone[0]) - 90; // 585
const RING_OUT = cab(BEAT.ringDone[4]) + 60; // 975
const WASH = cab(BEAT.wash); // 1050
const PLATE = cab(BEAT.plate); // 1080

const knifeAngle = (t: number): number => {
  let angle = -16; // raised
  for (const c of CHOPS) {
    const x = t - c;
    if (x >= 0 && x <= 3) {
      angle = interpolate(x, [0, 3], [-16, 14], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.quad),
      });
    } else if (x > 3 && x <= 12) {
      angle = interpolate(x, [3, 12], [14, -16], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });
    }
  }
  return angle;
};

const GhostRing: FC = () => {
  const frame = useCurrentFrame();
  const progress = ringProgress(frame);
  const flash = ringFlash(frame);
  const visible = interpolate(frame, [RING_IN, RING_IN + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  }) * interpolate(frame, [RING_OUT, RING_OUT + 60], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const R = 300;
  const C = 2 * Math.PI * R;
  return (
    <div
      style={{
        position: 'absolute',
        left: 520 - R,
        top: 620 - R,
        width: 2 * R,
        height: 2 * R,
        opacity: visible * 0.9,
        scale: `${1 + 0.05 * flash}`,
      }}
    >
      <svg width={2 * R} height={2 * R} viewBox={`0 0 ${2 * R} ${2 * R}`}>
        <circle cx={R} cy={R} r={R - 6} fill="none" stroke={brand.creamFaint} strokeWidth={3} opacity={0.4} />
        <circle
          cx={R}
          cy={R}
          r={R - 6}
          fill="none"
          stroke={flash > 0 ? brand.cream : brand.accentBright}
          strokeWidth={5 + 3 * flash}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          transform={`rotate(-90 ${R} ${R})`}
          opacity={0.5 + 0.5 * flash}
        />
      </svg>
    </div>
  );
};

const CabinScene: FC = () => {
  const frame = useCurrentFrame();
  const drift = (amp: number, phase: number): number => Math.sin((frame + phase) / 90) * amp;

  const pullBack = interpolate(frame, [0, 180], [1.16, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const wash = interpolate(frame, [WASH, WASH + 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
  const cool = interpolate(frame, [WASH, WASH + 240], [0.26, 0.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const flameIn = interpolate(frame, [SIZZLE, SIZZLE + 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.darkCanvas,
        opacity: interpolate(frame, [0, 60], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }),
      }}
    >
      <AbsoluteFill style={{scale: `${pullBack}`}}>
        {/* ---- Wall + window (farthest) ---- */}
        <AbsoluteFill
          style={{
            translate: `0px ${drift(3, 0)}px`,
            background:
              'repeating-linear-gradient(90deg, #241C15 0px, #241C15 114px, #1D1611 114px, #1D1611 120px)',
          }}
        >
          {/* Shelf with jar silhouettes */}
          <div
            style={{
              position: 'absolute',
              left: 70,
              top: 200,
              width: 340,
              height: 14,
              backgroundColor: '#33271D',
              borderRadius: 4,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 24 + i * 120,
                  top: -74,
                  width: 64,
                  height: 74,
                  borderRadius: '14px 14px 6px 6px',
                  backgroundColor: '#1B1510',
                  border: '2px solid #2A211A',
                }}
              />
            ))}
          </div>

          {/* Window onto dusk */}
          <div
            style={{
              position: 'absolute',
              left: 150,
              top: 300,
              width: 780,
              height: 700,
              borderRadius: 14,
              border: '26px solid #33271D',
              boxShadow: '0 0 0 6px #241B14, 0 40px 90px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            <AbsoluteFill
              style={{
                background:
                  'linear-gradient(180deg, #161D33 0%, #2C2444 42%, #5C3438 74%, #7A4433 100%)',
              }}
            />
            {/* Low-sun glow */}
            <div
              style={{
                position: 'absolute',
                left: 90,
                top: 300,
                width: 600,
                height: 420,
                background:
                  'radial-gradient(closest-side, rgba(224,164,71,0.5), rgba(224,164,71,0) 72%)',
              }}
            />
            {/* Moon */}
            <div
              style={{
                position: 'absolute',
                left: 545,
                top: 88,
                width: 52,
                height: 52,
                borderRadius: 999,
                backgroundColor: brand.cream,
                opacity: 0.6,
                boxShadow: '0 0 44px rgba(243,237,230,0.35)',
              }}
            />
            {/* Tree line */}
            <svg
              width={780}
              height={220}
              viewBox="0 0 780 220"
              style={{position: 'absolute', left: 0, bottom: 0}}
            >
              <path
                d="M0 220 L0 150 L48 92 L96 148 L150 66 L205 140 L262 84 L318 150 L372 70 L430 144 L488 96 L540 152 L598 62 L655 138 L712 88 L760 146 L780 120 L780 220 Z"
                fill="#120E16"
              />
            </svg>
            {/* Mullions */}
            <div style={{position: 'absolute', left: 371, top: 0, width: 18, height: 700, backgroundColor: '#33271D'}} />
            <div style={{position: 'absolute', left: 0, top: 316, width: 780, height: 18, backgroundColor: '#33271D'}} />
          </div>
        </AbsoluteFill>

        {/* ---- Pendant lamp ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(5, 40)}px`}}>
          <div style={{position: 'absolute', left: 827, top: 0, width: 6, height: 560, backgroundColor: '#1A140F'}} />
          <svg width={200} height={120} viewBox="0 0 200 120" style={{position: 'absolute', left: 730, top: 550}}>
            <path d="M60 116 L140 116 L118 46 L82 46 Z" fill="#241C15" stroke="#3A2E24" strokeWidth={3} />
          </svg>
          {/* Bulb + glow (warms up with the wash) */}
          <div
            style={{
              position: 'absolute',
              left: 830 - 70,
              top: 666 - 70,
              width: 140,
              height: 140,
              borderRadius: 999,
              background: 'radial-gradient(closest-side, rgba(224,164,71,0.55), rgba(224,164,71,0) 72%)',
              opacity: wash * (0.85 + 0.15 * Math.sin(frame / 24)),
            }}
          />
          <svg width={1080} height={700} viewBox="0 0 1080 700" style={{position: 'absolute', left: 0, top: 660, opacity: wash * 0.5}}>
            <defs>
              <linearGradient id="coneGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(224,164,71,0.35)" />
                <stop offset="100%" stopColor="rgba(224,164,71,0)" />
              </linearGradient>
            </defs>
            <polygon points="800,10 862,10 1005,570 657,570" fill="url(#coneGrad)" />
          </svg>
        </AbsoluteFill>

        {/* ---- Ghost timer ring (UI overlay, floats mid-scene) ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(6, 80)}px`}}>
          <GhostRing />
        </AbsoluteFill>

        {/* ---- Counter, stove, cutting board ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(7, 120)}px`}}>
          {/* Counter top + face */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 1230,
              right: 0,
              height: 72,
              backgroundColor: '#4A382B',
              borderTop: '5px solid #6A5138',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 1302,
              right: 0,
              bottom: 0,
              background:
                'repeating-linear-gradient(90deg, #201913 0px, #201913 150px, #191310 150px, #191310 156px)',
            }}
          />
          {/* Camp stove */}
          <div
            style={{
              position: 'absolute',
              left: 110,
              top: 1120,
              width: 390,
              height: 116,
              borderRadius: 18,
              backgroundColor: '#1B1613',
              border: '3px solid #2E2620',
            }}
          >
            <div style={{position: 'absolute', left: 24, top: 18, width: 150, height: 34, borderRadius: 10, backgroundColor: '#241D18'}} />
            <div style={{position: 'absolute', left: 34, top: 66, width: 22, height: 22, borderRadius: 999, backgroundColor: '#3A2E24'}} />
            <div style={{position: 'absolute', left: 66, top: 66, width: 22, height: 22, borderRadius: 999, backgroundColor: '#3A2E24'}} />
          </div>
          {/* Burner flame glow under the pan */}
          <div
            style={{
              position: 'absolute',
              left: 175,
              top: 1092,
              width: 260,
              height: 96,
              background: 'radial-gradient(closest-side, rgba(224,164,71,0.6), rgba(224,164,71,0) 75%)',
              opacity: flameIn * (0.75 + 0.25 * noise('flame', frame, 3)),
            }}
          />
          {/* Cutting board */}
          <div
            style={{
              position: 'absolute',
              left: 620,
              top: 1206,
              width: 310,
              height: 62,
              borderRadius: 14,
              backgroundColor: '#5A4534',
              border: '3px solid #6B5340',
            }}
          />
          {/* Carrot pieces appear one per chop */}
          {[
            {x: 668, y: 1194, r: 18},
            {x: 706, y: 1200, r: -12},
            {x: 744, y: 1192, r: 24},
          ].map((piece, i) => {
            const at = CHOPS[i];
            const pop = interpolate(frame, [at, at + 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.back()),
            });
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: piece.x,
                  top: piece.y,
                  width: 38,
                  height: 17,
                  borderRadius: 8,
                  backgroundColor: '#C97B3D',
                  rotate: `${piece.r}deg`,
                  scale: `${pop}`,
                  opacity: pop,
                }}
              />
            );
          })}
        </AbsoluteFill>

        {/* ---- Pan (+ steam) ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(9, 160)}px`}}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              translate: `0px ${interpolate(frame, [PAN_SETTLE, PAN_SETTLE + 10, PAN_SETTLE + 18, PAN_SETTLE + 26], [-52, 4, -2, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px`,
            }}
          >
            {/* Handle */}
            <div
              style={{
                position: 'absolute',
                left: 428,
                top: 1094,
                width: 178,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#2A231D',
                rotate: '-4deg',
              }}
            />
            {/* Skillet body */}
            <svg width={340} height={110} viewBox="0 0 340 110" style={{position: 'absolute', left: 135, top: 1052}}>
              <ellipse cx={170} cy={62} rx={158} ry={44} fill="#191512" stroke="#3B332C" strokeWidth={7} />
              <ellipse cx={170} cy={56} rx={126} ry={29} fill="#221C16" />
            </svg>
            {/* Oil bubbles popping after the sizzle starts */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const cycle = 22 + i * 7;
              const phase = (frame - SIZZLE + i * 13) % cycle;
              if (frame < SIZZLE || phase >= 11) {
                return null;
              }
              const pop = interpolate(phase, [0, 5, 11], [0, 1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 205 + i * 27 + noise(`bubble${i}`, i, 1) * 10,
                    top: 1092 + (i % 3) * 9,
                    width: 15,
                    height: 9,
                    borderRadius: 999,
                    backgroundColor: brand.amberBright,
                    opacity: 0.4 * pop,
                    scale: `${0.6 + 0.6 * pop}`,
                  }}
                />
              );
            })}
          </div>
          <Steam x={305} y={1096} />
        </AbsoluteFill>

        {/* ---- Knife ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(9, 200)}px`}}>
          <div
            style={{
              position: 'absolute',
              left: 640,
              top: 1106,
              width: 460,
              height: 120,
              rotate: `${knifeAngle(frame)}deg`,
              transformOrigin: '280px 30px',
            }}
          >
            <svg width={460} height={120} viewBox="0 0 460 120">
              {/* Blade pointing left from the pivot at (280, 30) */}
              <path d="M280 16 L28 22 L14 34 L30 44 L280 46 Z" fill="#B7B2AC" stroke="#8E8880" strokeWidth={2} />
              <path d="M30 41 L270 43" stroke="#E5E1DA" strokeWidth={3} />
              {/* Handle */}
              <rect x={280} y={14} width={150} height={32} rx={14} fill="#241C15" stroke="#3A2E24" strokeWidth={3} />
            </svg>
          </div>
        </AbsoluteFill>

        {/* ---- Plate lands at 39s ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(10, 240)}px`}}>
          <div
            style={{
              position: 'absolute',
              left: 645,
              top: 1128,
              opacity: interpolate(frame, [PLATE, PLATE + 8], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
              translate: `0px ${interpolate(frame, [PLATE, PLATE + 10, PLATE + 18, PLATE + 26], [-80, 3, -2, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}px`,
            }}
          >
            <svg width={260} height={120} viewBox="0 0 260 120">
              <ellipse cx={130} cy={92} rx={128} ry={26} fill="#E8DFD2" />
              <ellipse cx={130} cy={86} rx={100} ry={18} fill="none" stroke="#CFC3B2" strokeWidth={4} />
              <ellipse cx={104} cy={78} rx={34} ry={13} fill="#8A5A34" />
              <ellipse cx={140} cy={72} rx={30} ry={12} fill="#7A4C2B" />
              <circle cx={122} cy={66} r={5} fill={brand.successBright} />
              <circle cx={152} cy={70} r={4} fill={brand.successBright} />
            </svg>
          </div>
        </AbsoluteFill>

        {/* ---- Phone (nearest hero prop) ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(12, 280)}px`}}>
          {/* Cook Mode glow behind the phone */}
          <div
            style={{
              position: 'absolute',
              left: 80,
              top: 860,
              width: 470,
              height: 760,
              background:
                'radial-gradient(closest-side, rgba(217,110,63,0.32), rgba(217,110,63,0) 72%)',
              opacity:
                interpolate(frame, [cab(BEAT.cookMode), cab(BEAT.cookMode) + 50], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }) *
                (0.8 + 0.2 * Math.sin(frame / 18)),
            }}
          />
          {/* Stand wedge */}
          <svg width={140} height={70} viewBox="0 0 140 70" style={{position: 'absolute', left: 250, top: 1548}}>
            <path d="M10 66 L130 66 L70 4 Z" fill="#1B1510" stroke="#2A211A" strokeWidth={3} />
          </svg>
          {/* Body */}
          <div
            style={{
              position: 'absolute',
              left: 140,
              top: 908,
              width: 352,
              height: 672,
              borderRadius: 40,
              backgroundColor: '#0B0E13',
              border: '3px solid #262019',
              rotate: '-3deg',
              boxShadow: `0 30px 70px rgba(0,0,0,0.55), 0 0 ${
                frame >= cab(BEAT.cookMode) ? 34 + 12 * Math.sin(frame / 18) : 0
              }px rgba(217,110,63,0.35)`,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 16,
                top: 16,
                width: 320,
                height: 640,
                borderRadius: 24,
                overflow: 'hidden',
              }}
            >
              <PhoneScreen />
            </div>
          </div>
          {/* Contact shadow */}
          <div
            style={{
              position: 'absolute',
              left: 190,
              top: 1572,
              width: 260,
              height: 34,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.5)',
              filter: 'blur(10px)',
            }}
          />
        </AbsoluteFill>

        {/* ---- Foreground silhouettes (nearest) ---- */}
        <AbsoluteFill style={{translate: `0px ${drift(22, 320)}px`}}>
          <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position: 'absolute', inset: 0, filter: 'blur(14px)', opacity: 0.92}}>
            <path d="M-40 1920 L-40 1560 C 120 1500, 260 1600, 360 1540 C 300 1680, 160 1760, 120 1920 Z" fill="#0B0805" />
            <path d="M1120 1920 L1120 1520 C 980 1460, 840 1580, 740 1500 C 800 1660, 940 1780, 980 1920 Z" fill="#0B0805" />
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>

      {/* ---- Overlays: cool dusk grade, warm golden wash, vignette ---- */}
      <AbsoluteFill style={{backgroundColor: `rgba(14,18,30,${cool})`, opacity: 1 - wash * 0.4}} />
      <AbsoluteFill
        style={{
          opacity: wash,
          background:
            'radial-gradient(120% 80% at 50% 18%, rgba(224,164,71,0.5), rgba(224,164,71,0.14) 42%, rgba(23,19,16,0) 68%), linear-gradient(to top, rgba(224,164,71,0.34), rgba(224,164,71,0.06) 45%, rgba(224,164,71,0) 65%)',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(78% 60% at 50% 46%, transparent 52%, rgba(10,8,6,0.6) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

export default CabinScene;
