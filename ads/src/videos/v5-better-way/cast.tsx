// Black-and-white cast + props for the 1950s act: cook, kitchen, smoke,
// recipe card, clock, burnt chicken, dishes mountain, alarm, timer, bulb.
import {interpolate, useCurrentFrame} from 'remotion';
import type {FC} from 'react';
import {BW} from './fx';
import {bebas} from './fonts';

/* ---------------- The Cook (50s housewife, SVG) ---------------- */

export type Pose = 'horror' | 'scream' | 'stare' | 'hands' | 'wait';

export const Cook: FC<{pose: Pose; scale?: number; style?: React.CSSProperties}> = ({
  pose,
  scale = 1,
  style,
}) => {
  const eyes =
    pose === 'hands' ? (
      // closed, crying arcs
      <>
        <path d="M166 110 q14 10 28 0" stroke={BW.ink} strokeWidth="6" fill="none" />
        <path d="M206 110 q14 10 28 0" stroke={BW.ink} strokeWidth="6" fill="none" />
      </>
    ) : (
      <>
        <circle cx="180" cy="112" r={pose === 'scream' ? 11 : 9} fill={BW.ink} />
        <circle cx="222" cy="112" r={pose === 'scream' ? 11 : 9} fill={BW.ink} />
      </>
    );
  const browsUp = pose === 'horror' || pose === 'scream';
  const mouth =
    pose === 'scream' ? (
      <ellipse cx="201" cy="154" rx="17" ry="27" fill={BW.ink} />
    ) : pose === 'horror' ? (
      <ellipse cx="201" cy="152" rx="14" ry="19" fill={BW.ink} />
    ) : pose === 'hands' ? (
      <path d="M186 156 q15 14 30 0" stroke={BW.ink} strokeWidth="7" fill="none" />
    ) : (
      <path d="M186 152 q15 -12 30 0" stroke={BW.ink} strokeWidth="7" fill="none" />
    );
  const armAngles: Record<Pose, [number, number]> = {
    horror: [128, -128],
    scream: [140, -140],
    stare: [18, -18],
    hands: [156, -156],
    wait: [8, -8],
  };
  const [la, ra] = armAngles[pose];
  const arm = (side: 'l' | 'r'): React.ReactNode => (
    <g transform={`rotate(${side === 'l' ? la : ra} ${side === 'l' ? 155 : 247} 208)`}>
      <rect
        x={side === 'l' ? 146 : 238}
        y={200}
        width={18}
        height={150}
        rx={9}
        fill={BW.paper}
        stroke={BW.ink}
        strokeWidth={5}
      />
      <circle
        cx={side === 'l' ? 155 : 247}
        cy={356}
        r={15}
        fill={BW.paper}
        stroke={BW.ink}
        strokeWidth={5}
      />
    </g>
  );
  return (
    <svg
      viewBox="0 0 400 580"
      style={{width: 400 * scale, height: 580 * scale, ...style}}
    >
      {/* hair bun + head */}
      <circle cx="200" cy="52" r="34" fill={BW.dark} stroke={BW.ink} strokeWidth="5" />
      <circle cx="200" cy="122" r="56" fill={BW.paper} stroke={BW.ink} strokeWidth="5" />
      <path d="M144 108 a56 56 0 0 1 112 0 q-10 -22 -56 -22 q-46 0 -56 22 Z" fill={BW.dark} />
      {/* brows */}
      {browsUp ? (
        <>
          <path d="M164 88 l32 -10" stroke={BW.ink} strokeWidth="6" />
          <path d="M206 78 l32 10" stroke={BW.ink} strokeWidth="6" />
        </>
      ) : (
        <>
          <path d="M164 90 l32 4" stroke={BW.ink} strokeWidth="6" />
          <path d="M206 94 l32 -4" stroke={BW.ink} strokeWidth="6" />
        </>
      )}
      {eyes}
      {mouth}
      {/* pearls */}
      <circle cx="188" cy="182" r="5" fill={BW.light} stroke={BW.ink} strokeWidth="3" />
      <circle cx="202" cy="188" r="5" fill={BW.light} stroke={BW.ink} strokeWidth="3" />
      <circle cx="216" cy="182" r="5" fill={BW.light} stroke={BW.ink} strokeWidth="3" />
      {/* dress */}
      <path
        d="M155 186 L247 186 L292 470 L110 470 Z"
        fill={BW.paper}
        stroke={BW.ink}
        strokeWidth="5"
      />
      {/* apron */}
      <path
        d="M170 250 L232 250 L258 452 L144 452 Z"
        fill={BW.light}
        stroke={BW.ink}
        strokeWidth="5"
      />
      <path d="M170 250 q32 16 62 0" stroke={BW.ink} strokeWidth="5" fill="none" />
      {arm('l')}
      {arm('r')}
      {/* shoes */}
      <ellipse cx="166" cy="482" rx="26" ry="12" fill={BW.dark} stroke={BW.ink} strokeWidth="4" />
      <ellipse cx="238" cy="482" rx="26" ry="12" fill={BW.dark} stroke={BW.ink} strokeWidth="4" />
    </svg>
  );
};

/* ---------------- Kitchen background ---------------- */

export const RetroKitchen: FC<{dim?: number}> = ({dim = 0}) => (
  <div style={{position: 'absolute', inset: 0}}>
    {/* wall */}
    <div style={{position: 'absolute', inset: 0, backgroundColor: BW.light}} />
    {/* wall tiles strip */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 330,
        height: 96,
        backgroundColor: BW.paper,
        backgroundImage: `linear-gradient(${BW.mid} 2px, transparent 2px), linear-gradient(90deg, ${BW.mid} 2px, transparent 2px)`,
        backgroundSize: '48px 48px',
        opacity: 0.85,
      }}
    />
    {/* window */}
    <div
      style={{
        position: 'absolute',
        left: 1120,
        top: 120,
        width: 320,
        height: 230,
        backgroundColor: BW.mid,
        border: `14px solid ${BW.paper}`,
        boxShadow: `0 0 0 4px ${BW.ink}`,
      }}
    >
      <div style={{position: 'absolute', left: '50%', top: 0, bottom: 0, width: 6, backgroundColor: BW.paper}} />
      <div style={{position: 'absolute', top: '50%', left: 0, right: 0, height: 6, backgroundColor: BW.paper}} />
    </div>
    {/* hanging pot */}
    <div style={{position: 'absolute', left: 150, top: 0, width: 8, height: 130, backgroundColor: BW.dark}} />
    <div
      style={{
        position: 'absolute',
        left: 96,
        top: 126,
        width: 116,
        height: 78,
        borderRadius: '8px 8px 30px 30px',
        backgroundColor: BW.dark,
      }}
    />
    {/* oven */}
    <div
      style={{
        position: 'absolute',
        left: 330,
        top: 426,
        width: 420,
        height: 460,
        backgroundColor: BW.dark,
        border: `8px solid ${BW.ink}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 36,
          top: 36,
          width: 348,
          height: 210,
          border: `6px solid ${BW.mid}`,
          borderRadius: 8,
          backgroundColor: BW.ink,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 290,
          width: 300,
          height: 120,
          border: `6px solid ${BW.mid}`,
          borderRadius: 8,
          backgroundColor: BW.ink,
        }}
      />
    </div>
    {/* counter */}
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 250,
        backgroundColor: BW.paper,
        borderTop: `10px solid ${BW.mid}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 250,
        backgroundColor: BW.ink,
        opacity: dim,
      }}
    />
  </div>
);

/* ---------------- Rising smoke ---------------- */

export const Smoke: FC<{x: number; y: number; count?: number; scale?: number}> = ({
  x,
  y,
  count = 5,
  scale = 1,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
      {new Array(count).fill(0).map((_, i) => {
        const cycle = 80;
        const t = ((frame * 1.15 + i * (cycle / count)) % cycle) / cycle;
        const rise = interpolate(t, [0, 1], [0, -320 * scale], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const size = interpolate(t, [0, 1], [26 * scale, 120 * scale], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const drift = Math.sin(t * 5 + i * 1.7) * 40 * scale;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: drift - size / 2,
              top: rise - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              backgroundColor: 'rgba(190,186,178,0.34)',
              filter: `blur(${10 * scale}px)`,
              opacity: interpolate(t, [0, 0.2, 0.85, 1], [0, 0.75, 0.5, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
        );
      })}
    </div>
  );
};

/* ---------------- Recipe card ("15 MIN") ---------------- */

export const RecipeCard: FC<{scale?: number; stampPulse?: number; rotate?: number}> = ({
  scale = 1,
  stampPulse = 1,
  rotate = -4,
}) => (
  <div
    style={{
      width: 560 * scale,
      height: 420 * scale,
      backgroundColor: BW.paper,
      border: `4px solid ${BW.ink}`,
      boxShadow: '18px 22px 0 rgba(0,0,0,0.45)',
      rotate: `${rotate}deg`,
      padding: 44 * scale,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12 * scale,
    }}
  >
    <div
      style={{
        fontFamily: bebas,
        fontSize: 56 * scale,
        color: BW.ink,
        letterSpacing: 4,
      }}
    >
      EASY ROAST CHICKEN
    </div>
    <div
      style={{
        fontFamily: bebas,
        fontSize: 30 * scale,
        color: BW.mid,
        letterSpacing: 6,
      }}
    >
      READY IN
    </div>
    <div
      style={{
        fontFamily: bebas,
        fontSize: 150 * scale,
        lineHeight: 1,
        color: BW.ink,
        border: `${7 * scale}px solid ${BW.ink}`,
        padding: `${4 * scale}px ${26 * scale}px`,
        scale: `${stampPulse}`,
        backgroundColor: 'rgba(255,255,255,0.35)',
      }}
    >
      15 MIN
    </div>
    <div style={{fontFamily: bebas, fontSize: 26 * scale, color: BW.mid, letterSpacing: 3}}>
      SERVES 4 · ONE PAN
    </div>
  </div>
);

/* ---------------- Wall clock ---------------- */

export const RetroClock: FC<{minuteDeg: number; hourDeg: number; size?: number}> = ({
  minuteDeg,
  hourDeg,
  size = 460,
}) => (
  <svg viewBox="0 0 400 400" style={{width: size, height: size}}>
    <circle cx="200" cy="200" r="188" fill={BW.paper} stroke={BW.ink} strokeWidth="12" />
    <circle cx="200" cy="200" r="160" fill="none" stroke={BW.mid} strokeWidth="3" />
    {new Array(12).fill(0).map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 === 0 ? 138 : 150;
      return (
        <line
          key={i}
          x1={200 + Math.sin(a) * r1}
          y1={200 - Math.cos(a) * r1}
          x2={200 + Math.sin(a) * 162}
          y2={200 - Math.cos(a) * 162}
          stroke={BW.ink}
          strokeWidth={i % 3 === 0 ? 10 : 5}
        />
      );
    })}
    <g transform={`rotate(${hourDeg} 200 200)`}>
      <line x1="200" y1="200" x2="200" y2="110" stroke={BW.ink} strokeWidth="16" strokeLinecap="round" />
    </g>
    <g transform={`rotate(${minuteDeg} 200 200)`}>
      <line x1="200" y1="214" x2="200" y2="70" stroke={BW.ink} strokeWidth="10" strokeLinecap="round" />
    </g>
    <circle cx="200" cy="200" r="14" fill={BW.ink} />
  </svg>
);

/* ---------------- Burnt chicken ---------------- */

export const BurntChicken: FC<{tearY?: number; width?: number}> = ({tearY, width = 520}) => (
  <svg viewBox="0 0 560 360" style={{width, height: (360 / 560) * width}}>
    <ellipse cx="280" cy="308" rx="250" ry="42" fill={BW.light} stroke={BW.ink} strokeWidth="7" />
    <path
      d="M150 270 Q110 210 170 180 Q150 120 230 118 Q260 70 330 92 Q410 74 420 150 Q480 170 452 230 Q500 260 430 282 Q300 306 150 270 Z"
      fill={BW.ink}
      stroke="#000"
      strokeWidth="6"
    />
    {/* char highlights */}
    <path d="M230 150 Q270 120 320 140 Q300 170 250 165 Z" fill="#3B362F" />
    <path d="M330 200 Q370 185 395 215 Q360 235 330 220 Z" fill="#3B362F" />
    {/* drumstick sticks */}
    <path d="M420 150 L482 108" stroke={BW.ink} strokeWidth="16" strokeLinecap="round" />
    <circle cx="492" cy="100" r="18" fill={BW.ink} />
    <path d="M180 220 L128 190" stroke={BW.ink} strokeWidth="14" strokeLinecap="round" />
    <circle cx="118" cy="184" r="15" fill={BW.ink} />
    {/* the tear */}
    {tearY !== undefined ? (
      <g transform={`translate(0 ${tearY})`}>
        <path
          d="M300 168 Q288 196 300 210 Q314 222 326 208 Q336 194 324 170 Q312 152 300 168 Z"
          fill={BW.paper}
          stroke={BW.ink}
          strokeWidth="5"
        />
      </g>
    ) : null}
  </svg>
);

/* ---------------- Dishes mountain ---------------- */

export const DishesMountain: FC<{width?: number}> = ({width = 1300}) => (
  <svg viewBox="0 0 1300 620" style={{width, height: (620 / 1300) * width}}>
    {[
      {y: 540, w: 1240},
      {y: 480, w: 1080},
      {y: 425, w: 900},
      {y: 372, w: 720},
      {y: 322, w: 560},
      {y: 278, w: 420},
      {y: 240, w: 300},
      {y: 208, w: 200},
      {y: 182, w: 120},
    ].map((p, i) => (
      <g key={i}>
        <ellipse
          cx={650 + (i % 2 === 0 ? 14 : -20)}
          cy={p.y}
          rx={p.w / 2}
          ry={34}
          fill={i % 2 === 0 ? BW.dark : '#38332C'}
          stroke={BW.ink}
          strokeWidth="6"
        />
        <ellipse
          cx={650 + (i % 2 === 0 ? 14 : -20)}
          cy={p.y - 8}
          rx={p.w / 2 - 26}
          ry={24}
          fill="none"
          stroke={BW.mid}
          strokeWidth="4"
        />
      </g>
    ))}
    {/* pot on the peak */}
    <rect x="590" y="96" width="120" height="84" rx="10" fill={BW.dark} stroke={BW.ink} strokeWidth="6" />
    <rect x="616" y="76" width="68" height="24" rx="10" fill="none" stroke={BW.ink} strokeWidth="8" />
    <ellipse cx="470" cy="262" rx="70" ry="26" fill="#38332C" stroke={BW.ink} strokeWidth="6" />
    <ellipse cx="830" cy="240" rx="56" ry="22" fill="#38332C" stroke={BW.ink} strokeWidth="6" />
  </svg>
);

/* ---------------- Ceiling smoke alarm ---------------- */

export const SmokeAlarm: FC<{size?: number}> = ({size = 220}) => (
  <svg viewBox="0 0 220 150" style={{width: size, height: (150 / 220) * size}}>
    <rect x="104" y="0" width="12" height="34" fill={BW.dark} />
    <circle cx="110" cy="86" r="52" fill={BW.paper} stroke={BW.ink} strokeWidth="7" />
    <circle cx="110" cy="86" r="30" fill={BW.mid} />
    <circle cx="110" cy="86" r="12" fill={BW.ink} />
  </svg>
);

/* ---------------- Oven dial + egg timer ---------------- */

export const OvenDial: FC<{deg: number; size?: number}> = ({deg, size = 300}) => (
  <svg viewBox="0 0 300 300" style={{width: size, height: size}}>
    <circle cx="150" cy="150" r="140" fill={BW.paper} stroke={BW.ink} strokeWidth="12" />
    {new Array(10).fill(0).map((_, i) => {
      const a = ((i / 9) * 260 - 220) * (Math.PI / 180);
      return (
        <line
          key={i}
          x1={150 + Math.cos(a) * 108}
          y1={150 + Math.sin(a) * 108}
          x2={150 + Math.cos(a) * 128}
          y2={150 + Math.sin(a) * 128}
          stroke={BW.ink}
          strokeWidth="8"
        />
      );
    })}
    <g transform={`rotate(${deg} 150 150)`}>
      <path d="M150 40 L162 158 L138 158 Z" fill={BW.ink} />
    </g>
    <circle cx="150" cy="150" r="18" fill={BW.dark} />
  </svg>
);

export const EggTimer: FC<{deg: number; size?: number}> = ({deg, size = 420}) => (
  <svg viewBox="0 0 300 300" style={{width: size, height: size}}>
    <circle cx="150" cy="150" r="142" fill={BW.paper} stroke={BW.ink} strokeWidth="12" />
    {['60', '30', '15', '45'].map((label, i) => {
      const a = ((i / 4) * -360 + 90) * (Math.PI / 180);
      return (
        <text
          key={label}
          x={150 + Math.cos(a) * 104}
          y={150 + Math.sin(a) * 104 + 12}
          textAnchor="middle"
          fontFamily="Bebas Neue"
          fontSize="40"
          fill={BW.ink}
        >
          {label}
        </text>
      );
    })}
    <g transform={`rotate(${deg} 150 150)`}>
      <line x1="150" y1="150" x2="150" y2="42" stroke={BW.ink} strokeWidth="12" strokeLinecap="round" />
    </g>
    <circle cx="150" cy="150" r="16" fill={BW.ink} />
  </svg>
);

/* ---------------- Swinging bulb ---------------- */

export const SwingBulb: FC<{deg: number}> = ({deg}) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: -8,
      width: 10,
      height: 560,
      translate: '-50% 0',
      rotate: `${deg}deg`,
      transformOrigin: '50% 0%',
    }}
  >
    <div style={{position: 'absolute', left: 0, top: 0, bottom: 60, width: 6, marginLeft: 2, backgroundColor: BW.dark}} />
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 0,
        translate: '-50% 0',
        width: 56,
        height: 76,
        borderRadius: '28px 28px 34px 34px',
        backgroundColor: BW.paper,
        border: `5px solid ${BW.ink}`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: -30,
        translate: '-50% 0',
        width: 260,
        height: 90,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(237,234,226,0.5) 0%, rgba(237,234,226,0) 70%)',
      }}
    />
  </div>
);
