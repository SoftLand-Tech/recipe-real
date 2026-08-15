// ACT 3 · the community patch — forks, PRs, CI, diffs.
import {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {
  C,
  CLAMP,
  Check,
  Chip,
  EASE_OUT,
  F,
  GridBg,
  Panel,
  POP,
  Scanlines,
  TypeText,
  countUp,
  prog,
  shake,
} from './ui';

/* s12 (27f) — git blame */
export const S12: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines opacity={0.4} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Panel title="recipereal — zsh" width={1240} height={520} style={{scale: interpolate(prog(frame, 0, 7), [0, 1], [0.97, 1])}}>
          <div style={{padding: '40px 48px', display: 'flex', flexDirection: 'column', gap: 24}}>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <div style={{fontFamily: F.mono, fontSize: 46, color: C.green}}>$&nbsp;</div>
              <TypeText
                text="git blame dinner.md"
                start={1}
                cps={26}
                caret
                caretColor={C.green}
                style={{fontFamily: F.mono, fontSize: 46, color: C.text}}
              />
            </div>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 36,
                color: C.dim,
                opacity: interpolate(frame, [17, 22], [0, 1], CLAMP),
                minHeight: 44,
              }}
            >
              scanning 15 years of copy-paste…
            </div>
          </div>
        </Panel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s13 (29f) — blame output */
export const S13: FC = () => {
  const frame = useCurrentFrame();
  const lines = [
    {t: '0a1f (blog_template · 2009) serves: 4', c: C.dim},
    {t: '0a1f (blog_template · 2009) ready in: 15 min', c: C.text, hl: true},
    {t: 'b2e7 (nobody, ever) tested: false', c: C.dim},
    {t: 'c31d (seo_dept) added: 900-word preamble', c: C.dim},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines opacity={0.4} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Panel title="git blame dinner.md" width={1420} height={560}>
          <div style={{padding: '38px 48px', display: 'flex', flexDirection: 'column', gap: 22}}>
            {lines.map((l, i) => (
              <div
                key={i}
                style={{
                  fontFamily: F.mono,
                  fontSize: 38,
                  color: l.c,
                  borderRadius: 8,
                  padding: '8px 18px',
                  alignSelf: 'flex-start',
                  opacity: interpolate(frame, [i * 4, i * 4 + 4], [0, 1], CLAMP),
                  backgroundColor:
                    l.hl && frame >= 12 ? `rgba(217,110,63,${interpolate(frame, [12, 18], [0, 0.22], CLAMP)})` : 'transparent',
                  border: l.hl && frame >= 12 ? `2px solid ${C.terra}` : '2px solid transparent',
                  translate: shake(frame, l.hl ? 18 : -99, 7, 8),
                }}
              >
                {l.t}
              </div>
            ))}
          </div>
        </Panel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s14 (35f) — open-sourced */
export const S14: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <GridBg drift={0.8} />
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 28, opacity: interpolate(frame, [0, 6], [0, 1], CLAMP)}}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="14" r="9" fill="none" stroke={C.terra} strokeWidth="5" />
            <circle cx="13" cy="46" r="9" fill="none" stroke={C.terra} strokeWidth="5" />
            <circle cx="51" cy="46" r="9" fill="none" stroke={C.terra} strokeWidth="5" />
            <path d="M32 23 L32 36 M13 55 L13 58 L51 58 L51 55 M32 36 L13 48 M32 36 L51 48" stroke={C.terra} strokeWidth="5" fill="none" />
          </svg>
          <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 84, color: C.text}}>recipereal / recipes</div>
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 24}}>
          <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 130, color: C.green, lineHeight: 1}}>
            {countUp(frame, 0, 10000, 4, 26)}
          </div>
          <div style={{fontFamily: F.mono, fontSize: 44, color: C.dim}}>forks tonight</div>
        </div>
        <Chip
          label="open source · timings welcome"
          color="#FFF3ED"
          bg={C.terra}
          size={34}
          style={{
            opacity: interpolate(frame, [26, 31], [0, 1], CLAMP),
            scale: interpolate(prog(frame, 26, 32, POP), [0, 1], [0.6, 1]),
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s15 (55f) — PR feed + contributor counter */
export const S15: FC = () => {
  const frame = useCurrentFrame();
  const prs = [
    {n: '#481', t: 're-time: chop', d: '+6 min'},
    {n: '#512', t: 'add preheat step', d: '+5 min'},
    {n: '#588', t: 'count cleanup', d: '+20 min'},
    {n: '#604', t: 'simmer, re-measured', d: '+4 min'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 34}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 30, opacity: interpolate(frame, [0, 6], [0, 1], CLAMP)}}>
          <div style={{fontFamily: F.mono, fontSize: 42, color: C.dim}}>recent merges</div>
          <div style={{width: 700, height: 2, backgroundColor: C.line}} />
          <div style={{fontFamily: F.mono, fontSize: 42, color: C.green}}>4 of 12,440</div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
          {prs.map((p, i) => {
            const enter = prog(frame, i * 5, i * 5 + 8);
            const merged = frame >= i * 5 + 9;
            return (
              <div
                key={p.n}
                style={{
                  width: 980,
                  backgroundColor: merged ? 'rgba(63,125,82,0.14)' : C.panel,
                  border: `1px solid ${merged ? C.greenDeep : C.line}`,
                  borderRadius: 10,
                  padding: '16px 26px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 22,
                  translate: `${interpolate(enter, [0, 1], [560, 0])}px 0px`,
                  opacity: interpolate(frame, [i * 5, i * 5 + 5], [0, 1], CLAMP),
                }}
              >
                <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: C.dim}}>{p.n}</div>
                <div style={{fontFamily: F.base, fontSize: 36, color: C.text}}>{p.t}</div>
                <div style={{flex: 1}} />
                <div style={{fontFamily: F.mono, fontSize: 32, color: C.green}}>{p.d}</div>
                <div style={{width: 44, height: 44, display: 'flex', alignItems: 'center'}}>
                  {merged ? <Check size={40} start={i * 5 + 9} dur={6} /> : null}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 22, opacity: interpolate(frame, [26, 32], [0, 1], CLAMP)}}>
          <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 96, color: C.text, lineHeight: 1}}>
            {countUp(frame, 9998, 10000, 28, 42)}
          </div>
          <div style={{fontFamily: F.mono, fontSize: 38, color: C.green}}>contributors and counting</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s16 (50f) — PR detail: re-timed by 4,182 cooks */
export const S16: FC = () => {
  const frame = useCurrentFrame();
  const avatars = ['MK', 'JD', 'AR', 'TL', '+9'];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 1180,
            backgroundColor: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            boxShadow: '10px 12px 0 rgba(0,0,0,0.4)',
            padding: '38px 46px',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
            translate: `${interpolate(prog(frame, 0, 8), [0, 1], [240, 0])}px 0px`,
            opacity: interpolate(frame, [0, 5], [0, 1], CLAMP),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 44, color: C.text}}>PR #481</div>
            <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 52, color: C.text}}>re-time: chop</div>
            <div style={{flex: 1}} />
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 34,
                color: '#DFF2E4',
                backgroundColor: C.greenDeep,
                borderRadius: 8,
                padding: '6px 18px',
                opacity: interpolate(frame, [30, 36], [0, 1], CLAMP),
              }}
            >
              MERGED
            </div>
          </div>
          <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 40,
                color: C.red,
                backgroundColor: 'rgba(217,107,92,0.1)',
                borderRadius: 8,
                padding: '10px 22px',
                textDecoration: frame >= 8 ? 'line-through' : 'none',
              }}
            >
              − 4 min
            </div>
            <svg width="52" height="34" viewBox="0 0 52 34">
              <path d="M4 17 H44 M34 5 L46 17 L34 29" stroke={C.green} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div
              style={{
                fontFamily: F.mono,
                fontWeight: 700,
                fontSize: 40,
                color: C.green,
                backgroundColor: 'rgba(63,125,82,0.16)',
                borderRadius: 8,
                padding: '10px 22px',
                scale: interpolate(prog(frame, 10, 16, POP), [0, 1], [0.7, 1]),
                opacity: interpolate(frame, [10, 14], [0, 1], CLAMP),
              }}
            >
              + 10 min
            </div>
            <div style={{flex: 1}} />
            <div style={{fontFamily: F.mono, fontSize: 30, color: C.faint}}>chop.ts · +2 −2</div>
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
            <div style={{fontFamily: F.mono, fontSize: 34, color: C.dim}}>approved by</div>
            {avatars.map((a, i) => (
              <div
                key={a}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: i === 4 ? C.panel3 : C.greenDeep,
                  border: `2px solid ${i === 4 ? C.line : 'rgba(111,169,127,0.6)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: F.base,
                  fontWeight: 700,
                  fontSize: 26,
                  color: i === 4 ? C.dim : '#DFF2E4',
                  opacity: interpolate(frame, [14 + i * 3, 17 + i * 3], [0, 1], CLAMP),
                  scale: interpolate(prog(frame, 14 + i * 3, 18 + i * 3, POP), [0, 1], [0.4, 1]),
                }}
              >
                {a}
              </div>
            ))}
            <div style={{flex: 1}} />
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 44, color: C.green}}>
              {countUp(frame, 0, 4182, 16, 34)}
            </div>
            <div style={{fontFamily: F.mono, fontSize: 34, color: C.dim, marginRight: 8}}>cooks</div>
            <Check size={54} start={38} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* CI pipeline rail, shared by s17/s18 */
const CiRail: FC<{greenAt: number[]}> = ({greenAt}) => {
  const frame = useCurrentFrame();
  const nodes = [
    {label: 'chop', sub: '4,182 cooks'},
    {label: 'preheat', sub: '3,940 cooks'},
    {label: 'plate', sub: '10,406 cooks'},
  ];
  const done = greenAt.filter((g) => frame >= g).length;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
      <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
        <div style={{fontFamily: F.mono, fontSize: 40, color: C.green}}>CI</div>
        <div style={{fontFamily: F.mono, fontSize: 40, color: C.dim}}>/ continuous integration</div>
        <Chip label={`passing ${done}/3`} color={done === 3 ? '#DFF2E4' : C.dim} bg={done === 3 ? C.greenDeep : C.panel2} size={30} />
      </div>
      <div style={{display: 'flex', alignItems: 'center'}}>
        {nodes.map((n, i) => {
          const isGreen = frame >= greenAt[i];
          const p = prog(frame, greenAt[i], greenAt[i] + 4, POP);
          return (
            <div key={n.label} style={{display: 'flex', alignItems: 'center'}}>
              <div
                style={{
                  width: 300,
                  backgroundColor: isGreen ? 'rgba(63,125,82,0.16)' : C.panel,
                  border: `2px solid ${isGreen ? C.greenDeep : C.line}`,
                  borderRadius: 16,
                  padding: '26px 30px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  translate: isGreen ? shake(frame, greenAt[i] + 4, 6, 8) : '0px 0px',
                }}
              >
                <div style={{height: 60, display: 'flex', alignItems: 'center'}}>
                  {isGreen ? (
                    <Check size={56} start={greenAt[i]} dur={5} />
                  ) : (
                    <svg width="52" height="52" viewBox="0 0 52 52" style={{rotate: `${frame * 24}deg`}}>
                      <circle cx="26" cy="26" r="20" fill="none" stroke={C.line} strokeWidth="6" />
                      <path d="M26 6 A20 20 0 0 1 46 26" fill="none" stroke={C.dim} strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 42, color: isGreen ? C.text : C.dim}}>{n.label}</div>
                <div style={{fontFamily: F.mono, fontSize: 27, color: isGreen ? C.green : C.faint}}>
                  {isGreen ? n.sub : 'queued'}
                </div>
                <div style={{scale: isGreen ? interpolate(p, [0, 1], [1.04, 1]) : 1}} />
              </div>
              {i < nodes.length - 1 ? (
                <div style={{width: 150, height: 8, backgroundColor: '#2C343C', margin: '0 18px', borderRadius: 4, overflow: 'hidden'}}>
                  <div
                    style={{
                      height: '100%',
                      width: `${interpolate(frame, [greenAt[i], greenAt[i] + 4], [0, 100], CLAMP)}%`,
                      backgroundColor: C.green,
                    }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* s17 (46f) — CI intro, chop ticks green */
export const S17: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <GridBg drift={0.5} opacity={0.7} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div style={{opacity: interpolate(frame, [0, 6], [0, 1], CLAMP), scale: interpolate(prog(frame, 0, 8), [0, 1], [0.95, 1])}}>
          <CiRail greenAt={[5, 9999, 9999]} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s18 (24f) — SFX-only: remaining checks cascade green */
export const S18: FC = () => (
  <AbsoluteFill style={{backgroundColor: C.bg}}>
    <GridBg drift={0.5} opacity={0.7} />
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <CiRail greenAt={[0, 2, 8]} />
    </AbsoluteFill>
  </AbsoluteFill>
);

/* diff panel, shared by s19/s20 */
const DiffPanel: FC<{tab: string; lines: {mark: string; text: string}[]; startAt: number; hash: string; extraChip?: boolean}> = ({
  tab,
  lines,
  startAt,
  hash,
  extraChip,
}) => {
  const frame = useCurrentFrame();
  return (
    <Panel tab={tab} title={hash} width={1420} height={560}>
      <div style={{padding: '36px 0', display: 'flex', flexDirection: 'column', gap: 14}}>
        {lines.map((l, i) => {
          const add = l.mark === '+';
          const at = startAt + i * 6;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                backgroundColor: add ? 'rgba(63,125,82,0.16)' : 'rgba(217,107,92,0.12)',
                translate: `${interpolate(prog(frame, at, at + 8, EASE_OUT), [0, 1], [add ? 260 : -140, 0])}px 0px`,
                opacity: interpolate(frame, [at, at + 5], [0, 1], CLAMP),
                minHeight: 92,
              }}
            >
              <div style={{width: 110, textAlign: 'right', paddingRight: 24, fontFamily: F.mono, fontSize: 30, color: C.faint}}>
                {41 + i}
              </div>
              <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 44, color: add ? C.green : C.red, width: 70}}>{l.mark}</div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 42,
                  color: add ? '#DFF2E4' : '#F6D9D3',
                  textDecoration: !add && frame >= at + 12 ? 'line-through' : 'none',
                }}
              >
                {l.text}
              </div>
            </div>
          );
        })}
        {extraChip ? (
          <div
            style={{
              alignSelf: 'flex-end',
              marginRight: 44,
              marginTop: 10,
              fontFamily: F.mono,
              fontWeight: 700,
              fontSize: 36,
              color: C.green,
              border: `2px solid ${C.green}`,
              borderRadius: 10,
              padding: '6px 20px',
              opacity: interpolate(frame, [startAt + 14, startAt + 19], [0, 1], CLAMP),
              scale: interpolate(prog(frame, startAt + 14, startAt + 20, POP), [0, 1], [0.7, 1]),
            }}
          >
            +20:00
          </div>
        ) : null}
      </div>
    </Panel>
  );
};

/* s19 (41f) — diff: preheat */
export const S19: FC = () => (
  <AbsoluteFill style={{backgroundColor: C.bg}}>
    <Scanlines opacity={0.25} />
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <DiffPanel
        tab="steps.yaml ×"
        hash="a41f9c2"
        startAt={2}
        lines={[
          {mark: '−', text: 'preheat: omitted'},
          {mark: '+', text: 'preheat: 5 min, verified by 3,940 cooks'},
        ]}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

/* s20 (36f) — diff: cleanup */
export const S20: FC = () => (
  <AbsoluteFill style={{backgroundColor: C.bg}}>
    <Scanlines opacity={0.25} />
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <DiffPanel
        tab="cleanup.ts ×"
        hash="b7d2e80"
        startAt={1}
        extraChip
        lines={[
          {mark: '−', text: 'cleanup: not implemented'},
          {mark: '+', text: 'cleanup: 20 min, counted'},
        ]}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

/* s21 (40f) — diffstat */
export const S21: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 48}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 36, opacity: interpolate(frame, [0, 6], [0, 1], CLAMP)}}>
          <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 150, color: C.green, lineHeight: 1}}>
            +{countUp(frame, 0, 12440, 4, 26)}
          </div>
          <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 150, color: C.red, lineHeight: 1}}>
            −{countUp(frame, 0, 9881, 4, 26)}
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 22, width: 1240}}>
          <div style={{height: 54, backgroundColor: '#2C343C', borderRadius: 8, overflow: 'hidden'}}>
            <div
              style={{
                height: '100%',
                width: `${interpolate(frame, [4, 28], [0, 100], CLAMP)}%`,
                backgroundColor: C.greenDeep,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 18,
                fontFamily: F.mono,
                fontSize: 28,
                color: '#DFF2E4',
              }}
            >
              honest minutes
            </div>
          </div>
          <div style={{height: 54, backgroundColor: '#2C343C', borderRadius: 8, overflow: 'hidden'}}>
            <div
              style={{
                height: '100%',
                width: `${interpolate(frame, [8, 32], [0, 79.4], CLAMP)}%`,
                backgroundColor: '#8F3A30',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 18,
                fontFamily: F.mono,
                fontSize: 28,
                color: '#F6D9D3',
              }}
            >
              deleted lies
            </div>
          </div>
        </div>
        <div style={{fontFamily: F.mono, fontSize: 36, color: C.dim, opacity: interpolate(frame, [30, 36], [0, 1], CLAMP)}}>
          lines of truth shipped to production
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s22 (36f) — code review */
export const S22: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 1150,
            backgroundColor: C.panel,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            boxShadow: '10px 12px 0 rgba(0,0,0,0.4)',
            padding: '36px 44px',
            display: 'flex',
            flexDirection: 'column',
            gap: 26,
            translate: `0px ${interpolate(prog(frame, 0, 8), [0, 1], [80, 0])}px`,
            opacity: interpolate(frame, [0, 5], [0, 1], CLAMP),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 22}}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: C.greenDeep,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: F.base,
                fontWeight: 700,
                fontSize: 34,
                color: '#DFF2E4',
              }}
            >
              M
            </div>
            <div>
              <div style={{fontFamily: F.base, fontWeight: 600, fontSize: 38, color: C.text}}>@maria_cooks</div>
              <div style={{fontFamily: F.mono, fontSize: 28, color: C.faint}}>contributor #2,311 · 14 merges</div>
            </div>
            <div style={{flex: 1}} />
            <Chip
              label="APPROVED"
              color="#DFF2E4"
              bg={C.greenDeep}
              size={32}
              style={{opacity: interpolate(frame, [22, 27], [0, 1], CLAMP), scale: interpolate(prog(frame, 22, 28, POP), [0, 1], [0.6, 1])}}
            />
          </div>
          <div
            style={{
              backgroundColor: '#0D1117',
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: '28px 34px',
              position: 'relative',
            }}
          >
            <TypeText
              text="LGTM. Cooked it myself. Twice."
              start={6}
              cps={30}
              caret
              caretColor={C.green}
              style={{fontFamily: F.mono, fontSize: 52, color: C.text}}
            />
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 30,
                color: C.faint,
                marginTop: 16,
                opacity: interpolate(frame, [20, 26], [0, 1], CLAMP),
              }}
            >
              @dev_dad: +1 — the onions don&apos;t lie
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s23 (30f) — merged into main */
export const S23: FC = () => {
  const frame = useCurrentFrame();
  const draw = (f0: number, dur: number) =>
    interpolate(frame, [f0, f0 + dur], [1, 0], CLAMP);
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <GridBg drift={0.4} opacity={0.5} />
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
        <svg width={1360} height={360} viewBox="0 0 1360 360">
          <path
            d="M60 180 H560"
            stroke={C.line}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M60 60 C300 60, 400 180, 560 180"
            stroke={C.terra}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={520}
            strokeDashoffset={510 * draw(0, 12)}
          />
          <path
            d="M60 300 C300 300, 400 180, 560 180"
            stroke={C.green}
            strokeWidth="10"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={520}
            strokeDashoffset={510 * draw(4, 12)}
          />
          <path
            d="M560 180 H1300"
            stroke={frame >= 18 ? C.green : C.line}
            strokeWidth="10"
            strokeLinecap="round"
          />
          <circle cx="560" cy="180" r="16" fill={frame >= 16 ? C.green : C.line} />
          <circle cx="60" cy="60" r="12" fill={C.terra} />
          <circle cx="60" cy="300" r="12" fill={C.green} />
          <circle cx="60" cy="180" r="12" fill={C.dim} />
          <circle
            cx="560"
            cy="180"
            r={interpolate(frame, [16, 26], [16, 42], CLAMP)}
            fill="none"
            stroke={C.green}
            strokeWidth="3"
            opacity={interpolate(frame, [16, 26], [0.8, 0], CLAMP)}
          />
        </svg>
        <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
          <Chip
            label="merged into main"
            color="#DFF2E4"
            bg={C.greenDeep}
            size={40}
            style={{opacity: interpolate(frame, [12, 17], [0, 1], CLAMP), scale: interpolate(prog(frame, 12, 18, POP), [0, 1], [0.7, 1])}}
          />
          <div
            style={{
              fontFamily: F.display,
              fontSize: 110,
              lineHeight: 1,
              color: '#FFF3ED',
              backgroundColor: C.terra,
              borderRadius: 14,
              padding: '12px 40px 20px',
              letterSpacing: 3,
              rotate: `${interpolate(prog(frame, 19, 24, POP), [0, 1], [10, -6])}deg`,
              scale: interpolate(prog(frame, 19, 24, POP), [0, 1], [1.6, 1]),
              opacity: interpolate(frame, [19, 22], [0, 1], CLAMP),
            }}
          >
            v2.0-rc
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
