// SpeedrunTruth — shared HUD kit: fonts, palette, motion helpers, game-UI components.
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import type {CSSProperties, ReactNode} from 'react';
import {FC as ReactFC, useMemo} from 'react';
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadVt} from '@remotion/google-fonts/VT323';
import {brand, SAFE} from '../../shared/theme';

const bebas = loadBebas('normal', {weights: ['400'], subsets: ['latin']});
const grotesk = loadGrotesk('normal', {weights: ['400', '500', '700'], subsets: ['latin']});
const vt = loadVt('normal', {weights: ['400'], subsets: ['latin']});

export const F = {
  display: bebas.fontFamily,
  ui: grotesk.fontFamily,
  mono: vt.fontFamily,
};

// Palette — navy-black speedrun base, brand accents.
export const C = {
  base: '#101418',
  panel: '#161B21',
  panelHi: '#1D242C',
  cream: brand.cream,
  cream2: brand.creamSecondary,
  faint: 'rgba(243,237,230,0.16)',
  fainter: 'rgba(243,237,230,0.08)',
  green: brand.successBright,
  greenDim: 'rgba(111,169,127,0.30)',
  amber: brand.amberBright,
  amberDim: 'rgba(224,164,71,0.30)',
  red: brand.dangerBright,
  redDim: 'rgba(217,107,92,0.30)',
  terra: brand.accentBright,
  terraDim: 'rgba(217,110,63,0.30)',
  gold: '#E8C56A',
} as const;

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_POP = Easing.bezier(0.34, 1.56, 0.64, 1);

export const label: CSSProperties = {
  fontFamily: F.ui,
  fontSize: 30,
  fontWeight: 700,
  letterSpacing: '0.22em',
  color: C.cream2,
  textTransform: 'uppercase',
};

export const fmtClock = (totalSeconds: number): string => {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Deterministic per-frame jitter offsets. */
export const jitter = (frame: number, seed: string, amp: number) => ({
  x: (random(`${seed}-x-${frame}`) - 0.5) * 2 * amp,
  y: (random(`${seed}-y-${frame}`) - 0.5) * 2 * amp,
});

/** Eased 0→1 progress over `frames` frames from scene start. */
export const prog = (frame: number, frames: number, from = 0) =>
  interpolate(frame, [from, from + frames], [0, 1], {...clamp, easing: EASE_OUT});

// ---------------------------------------------------------------------------
// Backdrop & overlays
// ---------------------------------------------------------------------------

export const Backdrop: ReactFC<{tone?: 'base' | 'danger' | 'green'}> = ({tone = 'base'}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.base,
        backgroundImage: `linear-gradient(${tone === 'danger' ? 'rgba(217,107,92,0.10)' : tone === 'green' ? 'rgba(111,169,127,0.07)' : 'rgba(243,237,230,0.02)'} 0%, transparent 45%),
          repeating-linear-gradient(0deg, transparent 0 119px, ${C.fainter} 119px 120px),
          repeating-linear-gradient(90deg, transparent 0 119px, ${C.fainter} 119px 120px)`,
      }}
    />
  );
};

export const Scanlines: ReactFC<{opacity?: number}> = ({opacity = 0.10}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.55) 0 1px, transparent 1px 4px)`,
      opacity,
      pointerEvents: 'none',
    }}
  />
);

export const Vignette: ReactFC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 65% at 50% 46%, transparent 55%, rgba(5,7,9,0.62) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

/** Horizontal glitch slices — offset re-rolls every 2 frames, deterministic. */
export const GlitchBars: ReactFC<{count?: number; seed: string; colors?: string[]}> = ({
  count = 5,
  seed,
  colors = [C.red, C.cream, C.terra],
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}).map((_, i) => {
        const roll = random(`${seed}-${Math.floor(frame / 2)}-${i}`);
        const top = random(`${seed}-y-${i}`) * 100;
        const h = 4 + random(`${seed}-h-${i}`) * 14;
        const shift = (roll - 0.5) * 220;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${top}%`,
              left: 0,
              right: 0,
              height: h,
              backgroundColor: colors[i % colors.length],
              opacity: 0.5 * roll,
              translate: `${shift}px 0`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Game-UI atoms
// ---------------------------------------------------------------------------

/** Bordered, rotated stamp text. */
export const Stamp: ReactFC<{
  text: string;
  color?: string;
  size?: number;
  rotate?: number;
  delay?: number;
}> = ({text, color = C.red, size = 120, rotate = -8, delay = 0}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 7, delay);
  const j = jitter(frame, `stamp-${text}`, frame > delay && frame < delay + 8 ? 3 : 0);
  return (
    <div
      style={{
        fontFamily: F.display,
        fontSize: size,
        lineHeight: 1,
        color,
        border: `8px solid ${color}`,
        padding: '18px 42px',
        letterSpacing: '0.06em',
        rotate: `${interpolate(p, [0, 1], [rotate - 6, rotate])}deg`,
        scale: interpolate(p, [0, 1], [1.9, 1]),
        opacity: p > 0 ? 1 : 0,
        translate: `${j.x}px ${j.y}px`,
        boxShadow: `0 0 60px ${color}44, inset 0 0 30px ${color}22`,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

/** Delta badge pill: +06:00 red / −00:04 green style. */
export const DeltaBadge: ReactFC<{text: string; tone?: 'red' | 'green' | 'amber'; delay?: number}> = ({
  text,
  tone = 'red',
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 8, delay);
  const color = tone === 'red' ? C.red : tone === 'amber' ? C.amber : C.green;
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontSize: 44,
        color: '#0F1215',
        backgroundColor: color,
        padding: '6px 20px',
        borderRadius: 8,
        fontWeight: 700,
        scale: interpolate(p, [0, 1], [0.3, 1]),
        opacity: p,
        boxShadow: `0 0 34px ${color}66`,
        whiteSpace: 'nowrap',
      }}
    >
      {text}
    </div>
  );
};

export const HUDPanel: ReactFC<{children: ReactNode; style?: CSSProperties}> = ({children, style}) => (
  <div
    style={{
      backgroundColor: 'rgba(22,27,33,0.94)',
      border: `2px solid ${C.faint}`,
      borderRadius: 14,
      boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
      ...style,
    }}
  >
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Persistent run HUD: big timer top-center + split rail on the right
// ---------------------------------------------------------------------------

export type SplitState = 'dim' | 'active' | 'red' | 'green' | 'gold' | 'q';

export type HudSplit = {
  name: string;
  time: string;
  delta?: string;
  state: SplitState;
  sub?: string;
};

const splitColors: Record<SplitState, {text: string; bg: string; border: string}> = {
  dim: {text: 'rgba(243,237,230,0.30)', bg: 'transparent', border: C.fainter},
  active: {text: C.cream, bg: 'rgba(243,237,230,0.07)', border: C.cream2},
  red: {text: C.red, bg: C.redDim, border: C.red},
  green: {text: C.green, bg: C.greenDim, border: C.green},
  gold: {text: C.gold, bg: 'rgba(232,197,106,0.22)', border: C.gold},
  q: {text: C.cream2, bg: 'transparent', border: C.faint},
};

export const RunHud: ReactFC<{
  timer: string;
  pace?: 'idle' | 'red' | 'green' | 'amber';
  splits: HudSplit[];
  runLabel?: string;
}> = ({timer, pace = 'idle', splits, runLabel = 'ANY% DINNER — WEEKNIGHT CHILI'}) => {
  const frame = useCurrentFrame();
  const boot = prog(frame, 5);
  const timerColor = pace === 'red' ? C.red : pace === 'green' ? C.green : pace === 'amber' ? C.amber : C.cream;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* Timer block top-center */}
      <div
        style={{
          position: 'absolute',
          top: SAFE - 24,
          left: '50%',
          translate: `-50% ${interpolate(boot, [0, 1], [-56, 0])}px`,
          textAlign: 'center',
          opacity: boot,
        }}
      >
        <div style={{...label, fontSize: 22, marginBottom: 2}}>{runLabel}</div>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 132,
            lineHeight: 1,
            color: timerColor,
            textShadow: `0 0 44px ${timerColor}55`,
            fontWeight: 700,
          }}
        >
          {timer}
        </div>
        <div
          style={{
            ...label,
            fontSize: 20,
            color: timerColor,
            opacity: 0.9,
          }}
        >
          {pace === 'red' ? 'BEHIND PACE' : pace === 'green' ? 'ON PACE' : pace === 'amber' ? 'RECORD PACE' : 'RUN TIMER'}
        </div>
      </div>

      {/* Split rail right */}
      <div
        style={{
          position: 'absolute',
          right: SAFE - 10,
          top: 300,
          width: 470,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          opacity: boot,
        }}
      >
        <div style={{...label, fontSize: 20, marginBottom: 4, textAlign: 'right'}}>SPLITS</div>
        {splits.map((s, i) => (
          <SplitRow key={s.name} split={s} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const SplitRow: ReactFC<{split: HudSplit; index: number}> = ({split, index}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 6, 2 + index * 2);
  const col = splitColors[split.state];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        padding: '10px 18px',
        borderRadius: 10,
        border: `2px solid ${col.border}`,
        backgroundColor: col.bg,
        opacity: interpolate(p, [0, 1], [0.15, 1]),
        translate: `0 ${interpolate(p, [0, 1], [-14, 0])}px`,
      }}
    >
      <div style={{display: 'flex', flexDirection: 'column', minWidth: 0}}>
        <span style={{fontFamily: F.display, fontSize: 38, letterSpacing: '0.08em', color: col.text}}>
          {split.name}
        </span>
        {split.sub ? (
          <span style={{fontFamily: F.ui, fontSize: 18, color: C.cream2, letterSpacing: '0.14em'}}>{split.sub}</span>
        ) : null}
      </div>
      <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
        <span style={{fontFamily: F.mono, fontSize: 40, color: col.text}}>{split.time}</span>
        {split.delta ? (
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 26,
              padding: '2px 10px',
              borderRadius: 6,
              color: split.delta.startsWith('+') ? C.red : C.green,
              border: `1px solid ${split.delta.startsWith('+') ? C.red : C.green}`,
            }}
          >
            {split.delta}
          </span>
        ) : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Route map (SVG polyline with nodes)
// ---------------------------------------------------------------------------

const ROUTE_POINTS = [
  {x: 60, y: 250},
  {x: 300, y: 120},
  {x: 560, y: 300},
  {x: 820, y: 110},
  {x: 1060, y: 260},
  {x: 1240, y: 150},
];

export const RouteMap: ReactFC<{
  /** Per-segment style: 5 segments between 6 nodes */
  segments?: Array<'none' | 'drawn' | 'gap' | 'red' | 'amber'>;
  nodes?: Array<'off' | 'on' | 'amber'>;
  width?: number;
  drawFrames?: number;
  glitchGap?: boolean;
}> = ({segments = ['drawn', 'drawn', 'drawn', 'drawn', 'drawn'], nodes = ['on', 'on', 'on', 'on', 'on', 'on'], width = 1100, drawFrames = 14}) => {
  const frame = useCurrentFrame();
  const seg = useMemo(() => {
    const res: {x1: number; y1: number; x2: number; y2: number; len: number}[] = [];
    for (let i = 0; i < ROUTE_POINTS.length - 1; i++) {
      const a = ROUTE_POINTS[i];
      const b = ROUTE_POINTS[i + 1];
      res.push({x1: a.x, y1: a.y, x2: b.x, y2: b.y, len: Math.hypot(b.x - a.x, b.y - a.y)});
    }
    return res;
  }, []);
  const drawP = prog(frame, drawFrames);
  return (
    <svg width={width} height={(width / 1300) * 420} viewBox="0 0 1300 420" style={{overflow: 'visible'}}>
      {seg.map((s, i) => {
        const style = segments[i] ?? 'drawn';
        const localP = interpolate(drawP, [0, 1], [Math.min(1, (i * 0.9) / 5), Math.min(1, (i + 1) / 5 + 0.1)], clamp);
        const color = style === 'red' ? C.red : style === 'amber' ? C.amber : style === 'gap' ? C.faint : C.green;
        return (
          <g key={i}>
            <line
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={style === 'gap' ? C.faint : color}
              strokeWidth={style === 'gap' ? 3 : 8}
              strokeLinecap="round"
              strokeDasharray={style === 'gap' ? '14 18' : `${s.len}`}
              strokeDashoffset={style === 'gap' ? 0 : s.len * (1 - localP)}
              opacity={style === 'gap' ? 0.5 : 1}
            />
            {style === 'red' ? (
              <line
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={C.red}
                strokeWidth={26}
                strokeLinecap="round"
                strokeDasharray="10 16"
                opacity={0.28}
              />
            ) : null}
          </g>
        );
      })}
      {ROUTE_POINTS.map((p, i) => {
        const st = nodes[i] ?? 'on';
        const on = st !== 'off';
        const color = st === 'amber' ? C.amber : st === 'on' ? C.green : C.faint;
        return (
          <g key={`n${i}`} opacity={on ? 1 : 0.5}>
            <circle cx={p.x} cy={p.y} r={20} fill="#101418" stroke={color} strokeWidth={6} />
            {on ? <circle cx={p.x} cy={p.y} r={7} fill={color} /> : null}
          </g>
        );
      })}
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Confetti — deterministic burst
// ---------------------------------------------------------------------------

export const Confetti: ReactFC<{
  seed: string;
  count?: number;
  originX?: number;
  originY?: number;
  power?: number;
  gravity?: number;
  delay?: number;
  colors?: string[];
}> = ({seed, count = 70, originX = 50, originY = 50, power = 1, gravity = 900, delay = 0, colors}) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - delay);
  const palette = colors ?? [C.green, C.amber, C.terra, C.cream, C.gold];
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}).map((_, i) => {
        const angle = random(`${seed}-a-${i}`) * Math.PI * 2;
        const speed = (0.35 + random(`${seed}-s-${i}`) * 0.65) * 620 * power;
        const size = 9 + random(`${seed}-z-${i}`) * 12;
        const dur = 1.1 + random(`${seed}-d-${i}`) * 1.6;
        const p = t / (dur * 30);
        if (p > 1.15) return null;
        const x = originX + (Math.cos(angle) * speed * p) / 19.2;
        const y = originY + (Math.sin(angle) * speed * p) / 10.8 + (gravity * p * p) / 19.2;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size * (random(`${seed}-r-${i}`) > 0.5 ? 1 : 0.45),
              backgroundColor: palette[i % palette.length],
              rotate: `${random(`${seed}-rot-${i}`) * 360 + t * (6 + random(`${seed}-spin-${i}`) * 14)}deg`,
              opacity: interpolate(p, [0, 0.06, 0.8, 1.1], [0, 1, 1, 0], clamp),
              borderRadius: 2,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Icons (SVG, stroke style)
// ---------------------------------------------------------------------------

const iconStroke = {strokeWidth: 7, strokeLinecap: 'round', strokeLinejoin: 'round'} as const;

export const KnifeIcon: ReactFC<{size?: number; color?: string}> = ({size = 140, color = C.cream}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path d="M20 78 L64 34 L80 50 L36 94 Z" stroke={color} {...iconStroke} />
    <path d="M64 34 L84 14 L92 22 L72 42" stroke={color} {...iconStroke} fill="rgba(243,237,230,0.12)" />
    <path d="M30 70 L44 84" stroke={color} strokeWidth={4} />
  </svg>
);

export const FlameIcon: ReactFC<{size?: number; color?: string}> = ({size = 140, color = C.amber}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <path
      d="M50 8 C58 28 78 36 78 60 C78 78 65 90 50 90 C35 90 22 78 22 60 C22 44 34 38 40 26 C43 36 48 40 50 46 C54 38 52 22 50 8 Z"
      stroke={color}
      {...iconStroke}
      fill={`${color}22`}
    />
    <path d="M50 78 C43 78 38 72 38 64 C38 57 44 54 47 48 C50 54 56 57 58 64 C59 71 56 78 50 78 Z" fill={color} opacity={0.85} />
  </svg>
);

export const PotIcon: ReactFC<{size?: number; color?: string}> = ({size = 180, color = C.cream}) => (
  <svg width={size} height={size} viewBox="0 0 120 100" fill="none">
    <rect x="18" y="30" width="84" height="56" rx="10" stroke={color} {...iconStroke} />
    <path d="M8 44 L18 44 M102 44 L112 44 M8 44 L8 58 M112 44 L112 58" stroke={color} {...iconStroke} />
    <path d="M34 30 L34 18 L86 18 L86 30" stroke={color} {...iconStroke} />
    <path d="M60 12 L60 4" stroke={color} {...iconStroke} />
  </svg>
);

export const SpongeIcon: ReactFC<{size?: number; color?: string}> = ({size = 140, color = C.green}) => (
  <svg width={size} height={size * 0.72} viewBox="0 0 120 86" fill="none">
    <rect x="8" y="22" width="104" height="52" rx="14" stroke={color} {...iconStroke} fill={`${color}18`} />
    <circle cx="34" cy="42" r="5" fill={color} opacity="0.7" />
    <circle cx="58" cy="54" r="5" fill={color} opacity="0.7" />
    <circle cx="84" cy="40" r="5" fill={color} opacity="0.7" />
    <path d="M30 22 C36 8 46 8 52 22" stroke={color} {...iconStroke} />
  </svg>
);

export const DishStackIcon: ReactFC<{size?: number; color?: string}> = ({size = 150, color = C.cream2}) => (
  <svg width={size} height={size} viewBox="0 0 120 110" fill="none">
    <ellipse cx="60" cy="88" rx="52" ry="14" stroke={color} {...iconStroke} />
    <ellipse cx="60" cy="66" rx="44" ry="12" stroke={color} {...iconStroke} />
    <ellipse cx="60" cy="46" rx="36" ry="10" stroke={color} {...iconStroke} />
    <ellipse cx="60" cy="28" rx="27" ry="8" stroke={color} {...iconStroke} />
  </svg>
);

export const PlateIcon: ReactFC<{size?: number; color?: string}> = ({size = 170, color = C.cream}) => (
  <svg width={size} height={size} viewBox="0 0 120 110" fill="none">
    <ellipse cx="60" cy="62" rx="54" ry="26" stroke={color} {...iconStroke} />
    <ellipse cx="60" cy="62" rx="30" ry="14" stroke={color} {...iconStroke} />
    <path d="M42 30 C40 20 48 16 46 8" stroke={color} {...iconStroke} opacity="0.8" />
    <path d="M60 26 C58 16 66 12 64 4" stroke={color} {...iconStroke} opacity="0.8" />
    <path d="M78 30 C76 20 84 16 82 8" stroke={color} {...iconStroke} opacity="0.8" />
  </svg>
);

export const CheckIcon: ReactFC<{size?: number; color?: string; draw?: number}> = ({size = 64, color = C.green, draw = 1}) => {
  const len = 90;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path
        d="M20 54 L42 74 L82 28"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - draw)}
      />
    </svg>
  );
};

export const StarIcon: ReactFC<{size?: number; color?: string; filled?: boolean}> = ({size = 30, color = C.amber, filled = true}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color} strokeWidth={2}>
    <path d="M12 2 L15 9 L22 9.5 L17 14.5 L18.5 22 L12 18 L5.5 22 L7 14.5 L2 9.5 L9 9 Z" />
  </svg>
);

export const SignalIcon: ReactFC<{size?: number; color?: string; slashed?: boolean}> = ({size = 150, color = C.cream, slashed = true}) => (
  <svg width={size} height={size} viewBox="0 0 120 100" fill="none">
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={16 + i * 24} y={70 - i * 18} width={16} height={18 + i * 18} rx={3} stroke={color} strokeWidth={5} fill={i < 1 ? `${color}55` : 'none'} />
    ))}
    {slashed ? (
      <>
        <circle cx="60" cy="50" r="52" stroke={C.red} strokeWidth={7} />
        <path d="M23 13 L97 87" stroke={C.red} strokeWidth={7} strokeLinecap="round" />
      </>
    ) : null}
  </svg>
);

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export const Center: ReactFC<{children: ReactNode; style?: CSSProperties}> = ({children, style}) => (
  <AbsoluteFill
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 34,
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

/** Headline in Bebas with slam entrance. */
export const Headline: ReactFC<{
  children: ReactNode;
  size?: number;
  color?: string;
  delay?: number;
  style?: CSSProperties;
}> = ({children, size = 170, color = C.cream, delay = 0, style}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 8, delay);
  return (
    <div
      style={{
        fontFamily: F.display,
        fontSize: size,
        lineHeight: 0.94,
        color,
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        textAlign: 'center',
        scale: interpolate(p, [0, 1], [1.45, 1]),
        opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Kicker: ReactFC<{children: ReactNode; delay?: number; style?: CSSProperties}> = ({children, delay = 0, style}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, 8, delay);
  return (
    <div
      style={{
        ...label,
        opacity: interpolate(p, [0, 1], [0, 1]),
        translate: `0 ${interpolate(p, [0, 1], [16, 0])}px`,
        textAlign: 'center',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
