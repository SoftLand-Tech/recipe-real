// Shared primitives for PatchNotes — fonts, palette, terminal chrome, typewriter, stamps.
import {type CSSProperties, type ReactNode, FC} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {loadFont as loadSpaceGrotesk} from '@remotion/google-fonts/SpaceGrotesk';
import {loadFont as loadBebas} from '@remotion/google-fonts/BebasNeue';
import {loadFont as loadJetBrains} from '@remotion/google-fonts/JetBrainsMono';
import {brand} from '../../shared/theme';

const sg = loadSpaceGrotesk('normal', {weights: ['400', '500', '600', '700'], subsets: ['latin']});
const bb = loadBebas('normal', {weights: ['400'], subsets: ['latin']});
const jb = loadJetBrains('normal', {weights: ['400', '500', '700'], subsets: ['latin']});

export const F = {
  base: sg.fontFamily,
  display: bb.fontFamily,
  mono: jb.fontFamily,
};

export const C = {
  bg: '#0D1117',
  panel: '#161B22',
  panel2: '#1C2128',
  panel3: '#222831',
  line: '#30363D',
  text: '#E6EDF3',
  dim: '#8B949E',
  faint: '#6E7681',
  green: brand.successBright, // #6FA97F phosphor
  greenDeep: '#3F7D52',
  terra: brand.accentBright, // #D96E3F release/truth color
  red: brand.dangerBright, // #D96B5C
  amber: brand.amberBright,
  dialog: '#DDE1E6',
  dialogBar: '#B9BFC7',
  ink: '#241D17',
};

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IO = Easing.bezier(0.45, 0, 0.55, 1);
export const POP = Easing.bezier(0.34, 1.56, 0.64, 1);

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

/** interpolated, clamped progress 0→1 over [f0, f1] */
export const prog = (frame: number, f0: number, f1: number, easing = EASE_OUT): number =>
  interpolate(frame, [f0, f1], [0, 1], {...CLAMP, easing});

/** damped impact shake, returns a CSS `translate` value */
export const shake = (frame: number, at: number, mag = 10, dur = 10): string => {
  const t = frame - at;
  if (t < 0 || t > dur) return '0px 0px';
  const decay = 1 - t / dur;
  const x = Math.sin(t * 2.6) * mag * decay;
  const y = Math.cos(t * 3.3) * mag * 0.5 * decay;
  return `${x.toFixed(2)}px ${y.toFixed(2)}px`;
};

/** integer count-up with locale commas */
export const countUp = (
  frame: number,
  from: number,
  to: number,
  f0: number,
  f1: number,
): string => {
  const v = Math.round(interpolate(frame, [f0, f1], [from, to], {...CLAMP, easing: Easing.out(Easing.cubic)}));
  return v.toLocaleString('en-US');
};

/* ── backgrounds ─────────────────────────────────────────────────────── */

export const GridBg: FC<{drift?: number; opacity?: number}> = ({drift = 0, opacity = 1}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        backgroundImage:
          'linear-gradient(rgba(111,169,127,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(111,169,127,0.055) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
        backgroundPosition: `${(frame * drift).toFixed(1)}px 0px`,
      }}
    />
  );
};

export const Scanlines: FC<{opacity?: number}> = ({opacity = 0.5}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      opacity,
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0px, rgba(255,255,255,0.028) 1px, transparent 1px, transparent 4px)',
      pointerEvents: 'none',
    }}
  />
);

export const Vignette: FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.5) 100%)',
      pointerEvents: 'none',
    }}
  />
);

/** Act-1 desktop backdrop: ghost windows + taskbar */
export const DesktopBg: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', inset: 0, backgroundColor: C.bg}}>
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 110,
          width: 560,
          height: 380,
          border: `1px solid ${C.line}`,
          backgroundColor: 'rgba(22,27,34,0.55)',
          borderRadius: 10,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 170,
          top: 210,
          width: 620,
          height: 420,
          border: `1px solid ${C.line}`,
          backgroundColor: 'rgba(22,27,34,0.45)',
          borderRadius: 10,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 64,
          backgroundColor: 'rgba(13,17,23,0.92)',
          borderTop: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 36,
          gap: 18,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: i === 1 ? 'rgba(217,110,63,0.25)' : 'rgba(48,54,61,0.6)',
              border: `1px solid ${C.line}`,
            }}
          />
        ))}
        <div style={{flex: 1}} />
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 26,
            color: C.dim,
            marginRight: 48,
            opacity: interpolate(frame, [0, 30], [0.4, 0.85], CLAMP),
          }}
        >
          19:42 · hungry
        </div>
      </div>
      <Vignette />
    </div>
  );
};

/* ── terminal / panels ───────────────────────────────────────────────── */

export const Panel: FC<{
  title?: string;
  width: number | string;
  height?: number | string;
  children: ReactNode;
  style?: CSSProperties;
  barColor?: string;
  tab?: string;
}> = ({title, width, height, children, style, barColor = C.panel2, tab}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width,
        height,
        backgroundColor: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        boxShadow: '10px 12px 0 rgba(0,0,0,0.4)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div
        style={{
          height: 58,
          backgroundColor: barColor,
          borderBottom: `1px solid ${C.line}`,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 22,
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{width: 18, height: 18, borderRadius: 9, backgroundColor: '#3fb950', opacity: 0.75}} />
        <div style={{width: 18, height: 18, borderRadius: 9, backgroundColor: C.amber, opacity: 0.75}} />
        <div style={{width: 18, height: 18, borderRadius: 9, backgroundColor: C.red, opacity: 0.75}} />
        {tab ? (
          <div
            style={{
              marginLeft: 16,
              fontFamily: F.mono,
              fontSize: 24,
              color: C.text,
              backgroundColor: C.panel,
              border: `1px solid ${C.line}`,
              borderBottom: 'none',
              borderRadius: '8px 8px 0 0',
              padding: '6px 18px 10px',
              marginTop: 18,
            }}
          >
            {tab}
          </div>
        ) : null}
        {title ? (
          <div style={{marginLeft: tab ? 18 : 26, fontFamily: F.mono, fontSize: 24, color: C.dim}}>{title}</div>
        ) : null}
        <div style={{flex: 1}} />
        <div
          style={{
            marginRight: 24,
            fontFamily: F.mono,
            fontSize: 20,
            color: C.faint,
            opacity: interpolate(frame, [0, 20], [0.3, 0.9], CLAMP),
          }}
        >
          ●
        </div>
      </div>
      <div style={{flex: 1, position: 'relative'}}>{children}</div>
    </div>
  );
};

/* ── typewriter ──────────────────────────────────────────────────────── */

export const Caret: FC<{color?: string; size?: number}> = ({color = C.green, size = 34}) => {
  const frame = useCurrentFrame();
  return (
    <span
      style={{
        display: 'inline-block',
        width: size * 0.55,
        height: size,
        backgroundColor: color,
        marginLeft: 6,
        verticalAlign: 'text-bottom',
        opacity: frame % 16 < 8 ? 1 : 0,
      }}
    />
  );
};

export const TypeText: FC<{
  text: string;
  start?: number;
  cps?: number;
  style?: CSSProperties;
  caret?: boolean;
  caretColor?: string;
}> = ({text, start = 0, cps = 36, style, caret = false, caretColor}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor(((frame - start) * cps) / 30));
  const shown = text.slice(0, Math.min(text.length, n));
  return (
    <div style={{...style}}>
      {shown}
      {caret && frame >= start ? <Caret color={caretColor ?? (style?.color as string) ?? C.green} size={(style?.fontSize as number) ?? 34} /> : null}
    </div>
  );
};

/* ── atoms ───────────────────────────────────────────────────────────── */

export const Chip: FC<{
  label: string;
  color?: string;
  bg?: string;
  borderColor?: string;
  size?: number;
  style?: CSSProperties;
}> = ({label, color = C.text, bg = 'transparent', borderColor, size = 26, style}) => (
  <div
    style={{
      fontFamily: F.mono,
      fontSize: size,
      color,
      backgroundColor: bg,
      border: `2px solid ${borderColor ?? color}`,
      borderRadius: 8,
      padding: '6px 16px',
      whiteSpace: 'nowrap',
      ...style,
    }}
  >
    {label}
  </div>
);

export const Check: FC<{size?: number; color?: string; start?: number; dur?: number; style?: CSSProperties}> = ({
  size = 44,
  color = C.green,
  start = 0,
  dur = 8,
  style,
}) => {
  const frame = useCurrentFrame();
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" style={{...style}}>
      <path
        d="M13 27l9 9 17-18"
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={64}
        strokeDashoffset={interpolate(frame, [start, start + dur], [64, 0], CLAMP)}
      />
    </svg>
  );
};

export const Stamp: FC<{
  label: string;
  color?: string;
  at?: number;
  rotate?: number;
  size?: number;
  style?: CSSProperties;
}> = ({label, color = C.red, at = 0, rotate = -12, size = 120, style}) => {
  const frame = useCurrentFrame();
  const p = prog(frame, at, at + 7, POP);
  return (
    <div
      style={{
        fontFamily: F.display,
        fontSize: size,
        lineHeight: 1,
        color,
        border: `${Math.round(size / 12)}px solid ${color}`,
        borderRadius: 12,
        padding: `${Math.round(size / 6)}px ${Math.round(size / 3)}px`,
        letterSpacing: 6,
        rotate: `${rotate}deg`,
        scale: interpolate(p, [0, 1], [2.4, 1]),
        opacity: interpolate(frame, [at - 1, at], [0, 0.94], CLAMP),
        translate: shake(frame, at + 7, 9, 9),
        textShadow: '0 0 1px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {label}
    </div>
  );
};

export const Cursor: FC<{size?: number; style?: CSSProperties}> = ({size = 52, style}) => (
  <svg width={size} height={size * 1.25} viewBox="0 0 44 56" style={style}>
    <path d="M6 4 L6 44 L16 34 L23 50 L30 47 L23 31 L36 31 Z" fill="#E6EDF3" stroke="#0D1117" strokeWidth="2.5" />
  </svg>
);

export const SevBadge: FC<{label?: string; style?: CSSProperties}> = ({label = 'SEV-1', style}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: F.mono,
        fontWeight: 700,
        fontSize: 26,
        color: '#FFE8E4',
        backgroundColor: C.red,
        borderRadius: 7,
        padding: '5px 14px',
        boxShadow: `0 0 ${interpolate(frame, [0, 20], [0, 18], CLAMP)}px rgba(217,107,92,0.55)`,
        ...style,
      }}
    >
      {label}
    </div>
  );
};

/** issue tracker card shell */
export const IssueCard: FC<{
  number: string;
  title: string;
  children?: ReactNode;
  width?: number;
  style?: CSSProperties;
}> = ({number, title, children, width = 1180, style}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width,
        backgroundColor: C.panel,
        border: `1px solid ${C.line}`,
        borderLeft: `10px solid ${C.red}`,
        borderRadius: 14,
        boxShadow: '10px 12px 0 rgba(0,0,0,0.4)',
        padding: '34px 44px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        ...style,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
        <div
          style={{
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 40,
            color: '#FFE8E4',
            backgroundColor: C.red,
            borderRadius: 10,
            padding: '6px 18px',
          }}
        >
          {number}
        </div>
        <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 52, color: C.text, lineHeight: 1.1}}>{title}</div>
        <div style={{flex: 1}} />
        <SevBadge style={{opacity: interpolate(frame, [0, 10], [0, 1], CLAMP)}} />
      </div>
      {children}
    </div>
  );
};

/** phone mockup shell */
export const Phone: FC<{children: ReactNode; style?: CSSProperties}> = ({children, style}) => (
  <div
    style={{
      width: 430,
      height: 860,
      backgroundColor: '#05070A',
      borderRadius: 58,
      border: `10px solid ${C.line}`,
      boxShadow: '16px 20px 0 rgba(0,0,0,0.45)',
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        translate: '-50% 0',
        width: 150,
        height: 30,
        backgroundColor: '#05070A',
        borderRadius: 16,
        zIndex: 5,
      }}
    />
    <div style={{position: 'absolute', inset: 0, backgroundColor: C.bg}}>{children}</div>
  </div>
);

export const ScreenRow: FC<{children: ReactNode; style?: CSSProperties; top?: number}> = ({children, style, top = 96}) => (
  <div
    style={{
      position: 'absolute',
      top,
      left: 26,
      right: 26,
      bottom: 30,
      display: 'flex',
      flexDirection: 'column',
      gap: 18,
      ...style,
    }}
  >
    {children}
  </div>
);
