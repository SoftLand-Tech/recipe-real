// ACT 4 · the release — v2.0 banner, changelog, breaking change.
import {FC, type ReactNode} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, CLAMP, Check, Chip, EASE_OUT, F, GridBg, POP, Scanlines, countUp, prog, shake} from './ui';

/* s24 (31f) — version badge morph */
export const S24: FC = () => {
  const frame = useCurrentFrame();
  const oldOut = interpolate(frame, [0, 8], [1, 0.25], CLAMP);
  const newIn = prog(frame, 8, 16, POP);
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: 450,
          background: `radial-gradient(circle, rgba(217,110,63,${interpolate(frame, [8, 20], [0, 0.3], CLAMP)}) 0%, transparent 65%)`,
        }}
      />
      {[10, 17].map((at) => (
        <div
          key={at}
          style={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: 210,
            border: `3px solid ${C.terra}`,
            scale: interpolate(frame, [at, at + 20], [0.4, 2.1], CLAMP),
            opacity: interpolate(frame, [at, at + 20], [0.7, 0], CLAMP),
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: 110,
          color: C.dim,
          border: `6px solid ${C.dim}`,
          borderRadius: 24,
          padding: '18px 48px',
          rotate: '-6deg',
          scale: interpolate(oldOut, [0, 1], [1, 0.55]),
          translate: '-330px 0px',
          opacity: oldOut,
          textDecoration: frame >= 4 ? 'line-through' : 'none',
        }}
      >
        v1.0
      </div>
      <div
        style={{
          position: 'absolute',
          fontFamily: F.display,
          fontSize: 420,
          lineHeight: 1,
          color: '#FFF3ED',
          backgroundColor: C.terra,
          borderRadius: 44,
          padding: '10px 110px 44px',
          rotate: `${interpolate(newIn, [0, 1], [8, -3])}deg`,
          scale: interpolate(newIn, [0, 1], [0.2, 1]),
          opacity: interpolate(frame, [8, 11], [0, 1], CLAMP),
          translate: shake(frame, 16, 10, 10),
          boxShadow: '0 0 80px rgba(217,110,63,0.4)',
        }}
      >
        v2.0
      </div>
      <div
        style={{
          position: 'absolute',
          marginTop: 430,
          fontFamily: F.base,
          fontWeight: 600,
          fontSize: 44,
          letterSpacing: 12,
          color: C.dim,
          opacity: interpolate(frame, [18, 24], [0, 1], CLAMP),
        }}
      >
        R E L E A S E
      </div>
    </AbsoluteFill>
  );
};

/* changelog shell shared by s25–s29 */
const Changelog: FC<{children: ReactNode; sub?: string}> = ({children, sub}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines opacity={0.22} />
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 30, opacity: interpolate(frame, [0, 6], [0, 1], CLAMP)}}>
          <div style={{fontFamily: F.display, fontSize: 92, lineHeight: 1, color: C.text, letterSpacing: 4}}>CHANGELOG</div>
          <Chip label="v2.0 · recipereal/recipes" color={C.terra} size={28} />
        </div>
        <div style={{width: 1420, height: 2, backgroundColor: C.line, scale: `${interpolate(frame, [2, 12], [0, 1], CLAMP)} 1`}} />
        {sub ? (
          <div style={{fontFamily: F.mono, fontSize: 30, color: C.faint, opacity: interpolate(frame, [0, 8], [0, 0.9], CLAMP)}}>
            {sub}
          </div>
        ) : null}
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Entry: FC<{kind: string; color: string; children: ReactNode; at?: number}> = ({kind, color, children, at = 1}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 1420,
        backgroundColor: C.panel,
        border: `1px solid ${C.line}`,
        borderLeft: `12px solid ${color}`,
        borderRadius: 14,
        padding: '30px 40px',
        display: 'flex',
        alignItems: 'center',
        gap: 34,
        translate: `${interpolate(prog(frame, at, at + 9, EASE_OUT), [0, 1], [620, 0])}px 0px`,
        opacity: interpolate(frame, [at, at + 6], [0, 1], CLAMP),
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: 34,
          color,
          border: `2px solid ${color}`,
          borderRadius: 8,
          padding: '6px 18px',
          minWidth: 190,
          textAlign: 'center',
        }}
      >
        {kind}
      </div>
      <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap'}}>{children}</div>
    </div>
  );
};

/* s25 (42f) — fixed: 15 → 43 */
export const S25: FC = () => {
  const frame = useCurrentFrame();
  return (
    <Changelog sub="commit a41f9c2 · reviewed by 10,406 cooks">
      <Entry kind="fixed" color={C.green}>
        <div style={{fontFamily: F.base, fontWeight: 500, fontSize: 48, color: C.dim}}>total time:</div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 110,
            lineHeight: 1,
            color: C.dim,
            textDecoration: frame >= 14 ? 'line-through' : 'none',
          }}
        >
          15 min
        </div>
        <svg width="72" height="46" viewBox="0 0 72 46">
          <path d="M6 23 H58 M44 7 L62 23 L44 39" stroke={C.green} strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 150,
            lineHeight: 1,
            color: C.green,
            scale: interpolate(prog(frame, 16, 23, POP), [0, 1], [0.6, 1]),
          }}
        >
          43 min
        </div>
        <div style={{flex: 1}} />
        <div style={{fontFamily: F.mono, fontSize: 30, color: C.faint}}>+cleanup included</div>
      </Entry>
    </Changelog>
  );
};

/* s26 (41f) — added: cleanup, honest minutes */
export const S26: FC = () => {
  const frame = useCurrentFrame();
  return (
    <Changelog sub="commit 5c8ba17 · no dish left behind">
      <Entry kind="added" color={C.terra} at={2}>
        <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 54, color: C.text}}>cleanup</div>
        <div
          style={{
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 64,
            color: '#FFF3ED',
            backgroundColor: C.terra,
            borderRadius: 12,
            padding: '8px 26px',
          }}
        >
          +{countUp(frame, 0, 20, 8, 24)}:00
        </div>
        <div style={{fontFamily: F.mono, fontSize: 36, color: C.dim}}>honest minutes, counted</div>
        <div style={{flex: 1}} />
        <Check size={52} start={26} />
      </Entry>
    </Changelog>
  );
};

/* s27 (45f) — removed: lying dependencies */
export const S27: FC = () => {
  const frame = useCurrentFrame();
  const deps = ['guesswork', 'optimism', 'aspirational prose', '“just 5 min”'];
  return (
    <Changelog sub="commit 9f01d44 · dependencies pruned">
      <Entry kind="removed" color={C.red} at={2}>
        <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 54, color: C.text}}>lying dependencies:</div>
        <div style={{display: 'flex', gap: 18, flexWrap: 'wrap'}}>
          {deps.map((d, i) => {
            const at = 8 + i * 5;
            return (
              <div
                key={d}
                style={{
                  fontFamily: F.mono,
                  fontSize: 36,
                  color: C.red,
                  backgroundColor: 'rgba(217,107,92,0.1)',
                  border: `2px solid ${C.red}`,
                  borderRadius: 10,
                  padding: '10px 22px',
                  textDecoration: frame >= at ? 'line-through' : 'none',
                  rotate: `${interpolate(frame, [at + 6, at + 14], [0, 9], CLAMP)}deg`,
                  translate: `0px ${interpolate(frame, [at + 6, at + 16], [0, 60], {...CLAMP, easing: EASE_OUT})}px`,
                  opacity: interpolate(frame, [at, at + 6], [1, 1], CLAMP) * interpolate(frame, [at + 8, at + 18], [1, 0.25], CLAMP),
                }}
              >
                {d}
              </div>
            );
          })}
        </div>
      </Entry>
    </Changelog>
  );
};

/* s28 (36f) — added: cook mode, auto timers */
export const S28: FC = () => {
  const frame = useCurrentFrame();
  const needle = interpolate(frame, [4, 24], [-60, 200], CLAMP);
  return (
    <Changelog sub="commit d3e77a9 · timers, timed themselves">
      <Entry kind="added" color={C.terra} at={2}>
        <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 54, color: C.text}}>Cook Mode</div>
        <div style={{fontFamily: F.mono, fontSize: 36, color: C.dim}}>auto timers per step</div>
        <div style={{flex: 1}} />
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="62" fill="none" stroke={C.line} strokeWidth="10" />
          <circle
            cx="75"
            cy="75"
            r="62"
            fill="none"
            stroke={C.terra}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={390}
            strokeDashoffset={390 - 390 * interpolate(frame, [4, 24], [0, 0.72], CLAMP)}
            transform="rotate(-90 75 75)"
          />
          <line
            x1="75"
            y1="75"
            x2={75 + 44 * Math.sin((needle * Math.PI) / 180)}
            y2={75 - 44 * Math.cos((needle * Math.PI) / 180)}
            stroke={C.text}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="75" cy="75" r="8" fill={C.terra} />
        </svg>
        <Check size={52} start={26} />
      </Entry>
    </Changelog>
  );
};

/* s29 (34f) — added: offline-first */
export const S29: FC = () => {
  const frame = useCurrentFrame();
  return (
    <Changelog sub="commit 71cc920 · works in the dead zone">
      <Entry kind="added" color={C.green} at={2}>
        <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 54, color: C.text}}>offline-first recipes</div>
        <div style={{flex: 1}} />
        <div style={{position: 'relative', width: 220, height: 110, display: 'flex', alignItems: 'flex-end', gap: 14}}>
          {[26, 44, 62, 80].map((h, i) => (
            <div
              key={h}
              style={{
                width: 34,
                height: h,
                backgroundColor: C.dim,
                borderRadius: 6,
                opacity: interpolate(frame, [2 + i * 2, 6 + i * 2], [0.3, 0.9], CLAMP),
              }}
            />
          ))}
          <svg width="220" height="110" viewBox="0 0 220 110" style={{position: 'absolute', inset: 0}}>
            <line
              x1="18"
              y1="96"
              x2={interpolate(frame, [8, 18], [18, 196], CLAMP)}
              y2={interpolate(frame, [8, 18], [96, 18], CLAMP)}
              stroke={C.red}
              strokeWidth="9"
              strokeLinecap="round"
              opacity={interpolate(frame, [8, 11], [0, 1], CLAMP)}
            />
          </svg>
        </div>
        <Chip label="still cooking" color="#DFF2E4" bg={C.greenDeep} size={30} style={{opacity: interpolate(frame, [20, 25], [0, 1], CLAMP)}} />
      </Entry>
    </Changelog>
  );
};

/* s30 (47f) — breaking change banner */
export const S30: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center'}}>
      <GridBg drift={0.6} opacity={0.5} />
      <div
        style={{
          position: 'absolute',
          top: 300,
          left: 0,
          right: 0,
          height: 190,
          backgroundColor: C.terra,
          translate: `${interpolate(prog(frame, 0, 10, EASE_OUT), [0, 1], [-1920, 0])}px 0px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 60px rgba(217,110,63,0.35)',
        }}
      >
        <div style={{fontFamily: F.display, fontSize: 150, color: '#FFF6F2', letterSpacing: 10}}>BREAKING CHANGE</div>
      </div>
      <div
        style={{
          marginTop: 210,
          fontFamily: F.display,
          fontSize: 230,
          lineHeight: 1,
          color: C.text,
          letterSpacing: 4,
          translate: shake(frame, 18, 10, 10),
          scale: interpolate(prog(frame, 12, 19, POP), [0, 1], [0.7, 1]),
          opacity: interpolate(frame, [12, 15], [0, 1], CLAMP),
        }}
      >
        DINNER NOW WORKS.
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: F.mono,
          fontSize: 34,
          color: C.faint,
          opacity: interpolate(frame, [30, 36], [0, 1], CLAMP),
        }}
      >
        per semver, this is major
      </div>
    </AbsoluteFill>
  );
};

/* s31 (42f) — no more fantasy estimates */
export const S31: FC = () => {
  const frame = useCurrentFrame();
  const words = [
    {t: 'NO MORE', c: C.text, at: 0, w: 0},
    {t: 'FANTASY', c: C.dim, at: 5, w: 780},
    {t: 'ESTIMATES.', c: C.dim, at: 10, w: 1060},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: '#0A0D12', alignItems: 'center', justifyContent: 'center'}}>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
        {words.map((w) => (
          <div
            key={w.t}
            style={{
              fontFamily: F.display,
              fontSize: 215,
              lineHeight: 1,
              color: w.c,
              letterSpacing: 6,
              scale: interpolate(prog(frame, w.at, w.at + 7, POP), [0, 1], [1.5, 1]),
              opacity: interpolate(frame, [w.at, w.at + 4], [0, 1], CLAMP),
              position: 'relative',
            }}
          >
            {w.t}
            {w.w > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  left: -14,
                  top: '46%',
                  height: 14,
                  width: interpolate(frame, [22, 30], [0, w.w], CLAMP),
                  backgroundColor: C.red,
                  rotate: '-3deg',
                  borderRadius: 7,
                }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 130,
          fontFamily: F.mono,
          fontSize: 36,
          color: C.green,
          opacity: interpolate(frame, [32, 38], [0, 1], CLAMP),
        }}
      >
        estimates: now measured
      </div>
    </AbsoluteFill>
  );
};
