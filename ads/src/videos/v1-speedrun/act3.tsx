// Act 3 — RecipeReal enters: the new, honestly-timed route (s12–s23).
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {
  C,
  Center,
  CheckIcon,
  EASE_OUT,
  F,
  FlameIcon,
  Headline,
  HUDPanel,
  Kicker,
  KnifeIcon,
  RouteMap,
  RunHud,
  SpongeIcon,
  StarIcon,
  Vignette,
  clamp,
  fmtClock,
  prog,
} from './ui';
import type {HudSplit} from './ui';
import {SAFE} from '../../shared/theme';

const greenSplits = (active?: number): HudSplit[] => {
  const rows: Array<[string, string]> = [
    ['CHOP', '10:00'],
    ['PREHEAT', '5:00'],
    ['SIMMER', '20:00'],
    ['PLATE', '1:12'],
    ['CLEANUP', '12:00'],
  ];
  return rows.map(([name, time], i) => ({
    name,
    time,
    state: i === active ? ('active' as const) : i < (active ?? rows.length) ? ('green' as const) : ('dim' as const),
    delta: i < (active ?? rows.length) ? '00:00' : undefined,
  }));
};

// s12 — NEW ROUTE AVAILABLE modal drops in.
export const S12: React.FC = () => {
  const frame = useCurrentFrame();
  const drop = interpolate(frame, [0, 8], [-620, 0], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center>
        <div style={{translate: `0 ${drop}px`}}>
          <HUDPanel
            style={{
              width: 1150,
              border: `3px solid ${C.terra}`,
              boxShadow: `0 0 110px ${C.terraDim}, 0 30px 90px rgba(0,0,0,0.6)`,
              overflow: 'hidden',
            }}
          >
            <div style={{backgroundColor: C.terra, padding: '20px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontFamily: F.display, fontSize: 64, color: '#101418', letterSpacing: '0.06em'}}>
                NEW ROUTE AVAILABLE
              </span>
              <span style={{fontFamily: F.mono, fontSize: 40, color: '#101418'}}>v2.0 — HONEST</span>
            </div>
            <div style={{padding: '52px 60px', display: 'flex', flexDirection: 'column', gap: 26}}>
              <div style={{fontFamily: F.ui, fontSize: 46, color: C.cream, fontWeight: 500}}>
                RecipeReal — every step timed by real home cooks
              </div>
              <div style={{display: 'flex', gap: 20}}>
                <div style={{fontFamily: F.mono, fontSize: 38, color: C.green, border: `2px solid ${C.green}`, borderRadius: 8, padding: '8px 22px'}}>
                  CLEANUP INCLUDED
                </div>
                <div style={{fontFamily: F.mono, fontSize: 38, color: C.amber, border: `2px solid ${C.amber}`, borderRadius: 8, padding: '8px 22px'}}>
                  PREHEAT INCLUDED
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: 16, fontFamily: F.mono, fontSize: 44, color: C.cream2}}>
                <span>{'> '}</span>
                <span>install route</span>
                <span
                  style={{
                    width: 26,
                    height: 52,
                    backgroundColor: C.terra,
                    opacity: frame % 14 < 7 ? 1 : 0.1,
                  }}
                />
              </div>
            </div>
          </HUDPanel>
        </div>
      </Center>
      <AbsoluteFill style={{backgroundColor: C.green, opacity: interpolate(frame, [0, 10], [0.10, 0], clamp)}} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s13 — phone UI: RecipeReal step list with real durations.
export const S13: React.FC = () => {
  const frame = useCurrentFrame();
  const steps: Array<[string, string, string]> = [
    ['1', 'CHOP', '10:00'],
    ['2', 'PREHEAT', '5:00'],
    ['3', 'SIMMER', '20:00'],
    ['4', 'PLATE', '1:12'],
    ['5', 'CLEANUP', '12:00'],
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 60, top: 110}}>
        <HUDPanel
          style={{
            width: 520,
            height: 840,
            borderRadius: 34,
            border: `3px solid ${C.faint}`,
            overflow: 'hidden',
            rotate: `${interpolate(frame, [0, 10], [4, 1], {...clamp, easing: EASE_OUT})}deg`,
            translate: `0 ${interpolate(frame, [0, 10], [-80, 0], {...clamp, easing: EASE_OUT})}px`,
          }}
        >
          <div style={{backgroundColor: C.terra, padding: '24px 34px'}}>
            <div style={{fontFamily: F.display, fontSize: 56, color: '#101414', letterSpacing: '0.04em'}}>
              RecipeReal
            </div>
            <div style={{fontFamily: F.ui, fontSize: 22, color: 'rgba(16,20,20,0.75)', letterSpacing: '0.2em'}}>
              WEEK NIGHT CHILI — REAL TIMES
            </div>
          </div>
          <div style={{padding: 26, display: 'flex', flexDirection: 'column', gap: 14}}>
            {steps.map(([n, name, time], i) => {
              const p = prog(frame, 6, 8 + i * 3);
              return (
                <div
                  key={n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 18,
                    padding: '16px 22px',
                    borderRadius: 12,
                    border: `2px solid ${C.greenDim}`,
                    opacity: p,
                    translate: `${interpolate(p, [0, 1], [40, 0])}px 0`,
                  }}
                >
                  <span style={{fontFamily: F.mono, fontSize: 34, color: C.cream2}}>{n}</span>
                  <span style={{fontFamily: F.display, fontSize: 42, color: C.cream, flex: 1, letterSpacing: '0.08em'}}>
                    {name}
                  </span>
                  <span style={{fontFamily: F.mono, fontSize: 38, color: C.green}}>{time}</span>
                </div>
              );
            })}
            <div style={{fontFamily: F.ui, fontSize: 22, color: C.cream2, textAlign: 'center', letterSpacing: '0.22em', marginTop: 8}}>
              TOTAL 43:12 — HONEST
            </div>
          </div>
        </HUDPanel>
      </div>
      <div style={{position: 'absolute', right: SAFE + 60, top: 300, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-end'}}>
        <Kicker delay={6}>THE NEW ROUTE</Kicker>
        <Headline size={170} color={C.terra} delay={4}>
          EVERY STEP
        </Headline>
        <Headline size={170} color={C.cream} delay={8}>
          RE-TIMED
        </Headline>
        <div style={{fontFamily: F.mono, fontSize: 44, color: C.cream2, opacity: prog(frame, 14)}}>
          — cleanup and preheat included
        </div>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s14 — leaderboard of 10,000 home cooks.
export const S14: React.FC = () => {
  const frame = useCurrentFrame();
  const runners = [
    {rank: 1, name: 'MamaRosa', time: '43:09', delta: '−00:03', tone: C.gold},
    {rank: 2, name: 'DadCooksDaily', time: '43:31', delta: '+00:19', tone: C.cream},
    {rank: 3, name: 'Batch3Brian', time: '43:44', delta: '+00:32', tone: C.cream},
    {rank: 4, name: 'WeeknightWendy', time: '43:58', delta: '+00:46', tone: C.cream2},
    {rank: 5, name: 'SlowCookerSam', time: '44:12', delta: '+01:00', tone: C.cream2},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 40, top: 130, right: SAFE + 560}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
          <Kicker>VERIFIED LEADERBOARD</Kicker>
          <span style={{fontFamily: F.mono, fontSize: 30, color: C.cream2}}>WEEKNIGHT CHILI — ANY%</span>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24}}>
          {runners.map((r, i) => {
            const p = prog(frame, 7, 3 + i * 4);
            return (
              <div
                key={r.rank}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 28,
                  padding: '16px 30px',
                  borderRadius: 12,
                  border: `2px solid ${r.rank === 1 ? C.gold : C.faint}`,
                  backgroundColor: r.rank === 1 ? 'rgba(232,197,106,0.10)' : 'rgba(243,237,230,0.03)',
                  opacity: p,
                  translate: `0 ${interpolate(p, [0, 1], [-90, 0])}px`,
                }}
              >
                <span style={{fontFamily: F.display, fontSize: 54, color: r.rank === 1 ? C.gold : C.cream2, width: 64}}>
                  {r.rank}
                </span>
                <span style={{fontFamily: F.ui, fontWeight: 700, fontSize: 44, color: r.tone, flex: 1}}>{r.name}</span>
                <span style={{fontFamily: F.mono, fontSize: 50, color: r.tone}}>{r.time}</span>
                <span
                  style={{
                    fontFamily: F.mono,
                    fontSize: 32,
                    padding: '4px 14px',
                    borderRadius: 6,
                    border: `1px solid ${r.delta.startsWith('+') ? C.red : C.green}`,
                    color: r.delta.startsWith('+') ? C.red : C.green,
                  }}
                >
                  {r.delta}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{position: 'absolute', right: SAFE + 30, top: 380, textAlign: 'center'}}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 210,
            color: C.green,
            textShadow: `0 0 70px ${C.greenDim}`,
            scale: `${interpolate(prog(frame, 10, 6), [0, 1], [0.6, 1])}`,
          }}
        >
          {Math.floor(interpolate(frame, [6, 30], [0, 10000], {...clamp, easing: EASE_OUT})).toLocaleString('en-US')}
        </div>
        <Kicker delay={20} style={{fontSize: 34}}>
          RUNNERS TIMED THIS ROUTE
        </Kicker>
      </div>
      <div style={{position: 'absolute', bottom: SAFE - 20, left: SAFE + 40, fontFamily: F.ui, fontSize: 30, color: C.cream2, letterSpacing: '0.16em'}}>
        REAL KITCHENS · REAL TIMERS · NO CHEATS
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s15 — split rail cascades green checks, n=10,000 sub-labels.
export const S15: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: Array<[string, string]> = [
    ['CHOP', '10:00'],
    ['PREHEAT', '5:00'],
    ['SIMMER', '20:00'],
    ['PLATE', '1:12'],
    ['CLEANUP', '12:00'],
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 60, top: 220, width: 1000, display: 'flex', flexDirection: 'column', gap: 16}}>
        <Kicker>RE-VERIFICATION SWEEP</Kicker>
        {rows.map(([name, time], i) => {
          const p = prog(frame, 6, 3 + i * 4);
          const checked = frame >= 8 + i * 4;
          return (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 26,
                padding: '14px 30px',
                borderRadius: 12,
                border: `2px solid ${checked ? C.green : C.faint}`,
                backgroundColor: checked ? C.greenDim : 'transparent',
                opacity: p,
              }}
            >
              <div style={{width: 70, height: 70}}>
                <CheckIcon size={70} color={C.green} draw={interpolate(frame, [8 + i * 4, 14 + i * 4], [0, 1], clamp)} />
              </div>
              <span style={{fontFamily: F.display, fontSize: 58, color: checked ? C.cream : C.cream2, flex: 1, letterSpacing: '0.08em'}}>
                {name}
              </span>
              <span style={{fontFamily: F.mono, fontSize: 52, color: checked ? C.green : C.cream2}}>{time}</span>
              <span style={{fontFamily: F.ui, fontSize: 24, color: C.cream2, letterSpacing: '0.12em'}}>n=10,000</span>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', right: SAFE + 40, top: 430}}>
        <Headline size={150} color={C.terra} delay={10}>
          RE-VERIFIED
        </Headline>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s16 — CHOP recalibrates 4:00 → 10:00, red flips green.
export const S16: React.FC = () => {
  const frame = useCurrentFrame();
  const fixed = frame >= 8;
  const secs = interpolate(frame, [8, 18], [240, 600], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 36}}>
        <Kicker>SPLIT 01 — RECALIBRATED</Kicker>
        <HUDPanel style={{padding: '40px 70px', border: `3px solid ${fixed ? C.green : C.red}`}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
            <KnifeIcon size={150} color={fixed ? C.green : C.cream} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start'}}>
              <div style={{fontFamily: F.mono, fontSize: 54, color: C.cream2, textDecoration: 'line-through', textDecorationColor: C.red, textDecorationThickness: 5}}>
                BLOG 4:00
              </div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 190,
                  lineHeight: 1,
                  color: fixed ? C.green : C.red,
                  textShadow: `0 0 60px ${fixed ? C.greenDim : C.redDim}`,
                }}
              >
                {fixed ? fmtClock(secs) : '4:00'}
              </div>
              <div style={{fontFamily: F.ui, fontSize: 34, color: fixed ? C.green : C.red, letterSpacing: '0.2em'}}>
                {fixed ? 'REAL TIME' : 'RECOUNTING…'}
              </div>
            </div>
          </div>
        </HUDPanel>
        <div style={{display: 'flex', gap: 24}}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 40,
              padding: '8px 24px',
              borderRadius: 8,
              border: `2px solid ${C.red}`,
              color: C.red,
              opacity: fixed ? 0.25 : 1,
            }}
          >
            +6:00
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 40,
              padding: '8px 24px',
              borderRadius: 8,
              border: `2px solid ${C.green}`,
              color: C.green,
              opacity: fixed ? 1 : 0.25,
              scale: `${interpolate(frame, [18, 24], [0.6, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)})}`,
            }}
          >
            DELTA RESET
          </div>
        </div>
      </Center>
      <RunHud timer="--:--" pace="idle" splits={greenSplits(0)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s17 — preheat returns to the route, amber segment + flame lights.
export const S17: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <Kicker>ROUTE PATCH v2.0</Kicker>
        <div style={{display: 'flex', alignItems: 'center', gap: 50}}>
          <FlameIcon size={190} color={C.amber} />
          <RouteMap
            drawFrames={8}
            segments={['drawn', 'amber', 'drawn', 'drawn', 'drawn']}
            nodes={['on', 'amber', 'on', 'on', 'on']}
            width={980}
          />
        </div>
        <Headline size={140} color={C.amber} delay={6}>
          PREHEAT — BACK IN
        </Headline>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 60,
            color: C.amber,
            border: `3px solid ${C.amber}`,
            borderRadius: 10,
            padding: '10px 34px',
            scale: `${interpolate(frame, [10, 16], [0.5, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)})}`,
            opacity: interpolate(frame, [10, 13], [0, 1], clamp),
          }}
        >
          +5:00 — NOW COUNTED
        </div>
      </Center>
      <RunHud timer="--:--" pace="idle" splits={greenSplits(1)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s18 — cleanup split flips to an honest 12:00.
export const S18: React.FC = () => {
  const frame = useCurrentFrame();
  const fixed = frame >= 8;
  const secs = interpolate(frame, [8, 17], [0, 720], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 36}}>
        <Kicker>THE HIDDEN SPLIT, TIMED</Kicker>
        <HUDPanel style={{padding: '44px 80px', border: `3px solid ${fixed ? C.green : C.faint}`, position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -40,
              fontFamily: F.display,
              fontSize: 170,
              color: C.cream2,
              opacity: interpolate(frame, [8, 16], [0.8, 0], clamp),
              scale: `${interpolate(frame, [8, 16], [1, 1.7], clamp)}`,
            }}
          >
            ?
          </div>
          <div style={{display: 'flex', alignItems: 'center', gap: 60}}>
            <SpongeIcon size={210} color={C.green} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <div style={{fontFamily: F.display, fontSize: 110, color: C.cream, letterSpacing: '0.06em'}}>CLEANUP</div>
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 200,
                  lineHeight: 1,
                  color: fixed ? C.green : C.cream2,
                  textShadow: fixed ? `0 0 70px ${C.greenDim}` : 'none',
                }}
              >
                {fixed ? fmtClock(secs) : '0:00?'}
              </div>
              <div style={{fontFamily: F.ui, fontSize: 34, color: fixed ? C.green : C.cream2, letterSpacing: '0.2em'}}>
                {fixed ? 'DISHES · COUNTER · PAN' : 'CLAIMED: ZERO'}
              </div>
            </div>
          </div>
          {/* sparkles */}
          {Array.from({length: 6}).map((_, i) => {
            const t = frame - (10 + i * 2);
            if (t < 0) return null;
            const p = interpolate(t, [0, 12], [0, 1], clamp);
            const x = 120 + random(`s18-sp-${i}`) * 700;
            const y = 40 + random(`s18-sy-${i}`) * 260;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y,
                  width: 18,
                  height: 18,
                  backgroundColor: 'transparent',
                  opacity: 1 - p,
                  rotate: `${p * 90}deg`,
                }}
              >
                <StarIcon size={26} color={C.green} />
              </div>
            );
          })}
        </HUDPanel>
      </Center>
      <RunHud timer="--:--" pace="idle" splits={greenSplits(5)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s19 — timer dial macro with ±2s honest tolerance band.
export const S19: React.FC = () => {
  const frame = useCurrentFrame();
  const hand = interpolate(frame, [0, 39], [-40, 40], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <Kicker>FRAME PERFECT? NO.</Kicker>
        <div style={{position: 'relative', width: 460, height: 460}}>
          <svg width={460} height={460} viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="88" fill="#161B21" stroke={C.faint} strokeWidth="2" />
            {/* ±2s tolerance band */}
            <path
              d="M100 12 A88 88 0 0 1 131 18"
              fill="none"
              stroke={C.amber}
              strokeWidth="12"
              opacity={0.85}
              strokeDasharray="120"
              strokeDashoffset={120 * (1 - interpolate(frame, [4, 14], [0, 1], {...clamp, easing: EASE_OUT}))}
            />
            <path d="M100 6 L100 22" stroke={C.cream} strokeWidth="4" />
            {Array.from({length: 60}).map((_, i) => {
              const a = (i / 60) * Math.PI * 2;
              const r1 = i % 5 === 0 ? 72 : 78;
              return (
                <line
                  key={i}
                  x1={100 + Math.sin(a) * r1}
                  y1={100 - Math.cos(a) * r1}
                  x2={100 + Math.sin(a) * 84}
                  y2={100 - Math.cos(a) * 84}
                  stroke={C.faint}
                  strokeWidth={i % 5 === 0 ? 2.5 : 1}
                />
              );
            })}
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="30"
              stroke={C.terra}
              strokeWidth="5"
              strokeLinecap="round"
              style={{rotate: `${hand}deg`, transformOrigin: '100px 100px'}}
            />
            <circle cx="100" cy="100" r="8" fill={C.terra} />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingTop: 120,
            }}
          >
            <span style={{fontFamily: F.mono, fontSize: 96, color: C.cream}}>10:00</span>
            <span style={{fontFamily: F.mono, fontSize: 38, color: C.amber}}>± 2s TOLERANCE</span>
          </div>
        </div>
        <div style={{display: 'flex', gap: 20}}>
          <div style={{fontFamily: F.mono, fontSize: 34, color: C.cream2, border: `2px solid ${C.faint}`, borderRadius: 8, padding: '8px 22px'}}>
            NO EXPLOITS
          </div>
          <div style={{fontFamily: F.mono, fontSize: 34, color: C.cream2, border: `2px solid ${C.faint}`, borderRadius: 8, padding: '8px 22px'}}>
            NO GUESSTIMATES
          </div>
        </div>
      </Center>
      <Vignette />
    </AbsoluteFill>
  );
};

// s20 — the honest board: all green, deltas zero.
export const S20: React.FC = () => {
  const frame = useCurrentFrame();
  const rows: Array<[string, string]> = [
    ['CHOP', '10:00'],
    ['PREHEAT', '5:00'],
    ['SIMMER', '20:00'],
    ['PLATE', '1:12'],
    ['CLEANUP', '12:00'],
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 30}}>
        <Headline size={190} color={C.green} delay={0}>
          HONEST. ALWAYS.
        </Headline>
        <HUDPanel style={{padding: '36px 60px', display: 'flex', gap: 22, border: `2px solid ${C.greenDim}`}}>
          {rows.map(([name, time], i) => (
            <div
              key={name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '18px 24px',
                borderRadius: 12,
                border: `2px solid ${C.green}`,
                backgroundColor: C.greenDim,
                opacity: prog(frame, 6, 4 + i * 3),
              }}
            >
              <span style={{fontFamily: F.display, fontSize: 44, color: C.cream, letterSpacing: '0.08em'}}>{name}</span>
              <span style={{fontFamily: F.mono, fontSize: 46, color: C.green}}>{time}</span>
              <span style={{fontFamily: F.mono, fontSize: 28, color: C.green}}>Δ 00:00</span>
            </div>
          ))}
        </HUDPanel>
        <div style={{fontFamily: F.mono, fontSize: 54, color: C.terra, letterSpacing: '0.06em'}}>
          TOTAL 43:12 — NO FANTASY MATH
        </div>
      </Center>
      <AbsoluteFill
        style={{backgroundColor: C.green, opacity: 0.10 + 0.06 * Math.abs(Math.sin(frame / 9)), pointerEvents: "none"}}
      />
      <Vignette />
    </AbsoluteFill>
  );
};

// s21 — Cook Mode: auto timers, step card + queue.
export const S21: React.FC = () => {
  const frame = useCurrentFrame();
  const sweep = interpolate(frame, [0, 46], [0, 0.72], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 60, top: 240, display: 'flex', flexDirection: 'column', gap: 26}}>
        <Kicker delay={4}>COOK MODE</Kicker>
        <Headline size={150} color={C.green} delay={2}>
          TIMERS RUN
        </Headline>
        <Headline size={150} color={C.cream} delay={6}>
          THEMSELVES
        </Headline>
        <div style={{fontFamily: F.mono, fontSize: 42, color: C.cream2, opacity: prog(frame, 12)}}>
          next step loads · screen stays on
        </div>
      </div>
      <div style={{position: 'absolute', right: SAFE + 70, top: 130}}>
        <HUDPanel
          style={{
            width: 560,
            height: 820,
            borderRadius: 34,
            overflow: 'hidden',
            border: `3px solid ${C.greenDim}`,
            rotate: `${interpolate(frame, [0, 10], [-3, -1], {...clamp, easing: EASE_OUT})}deg`,
          }}
        >
          <div style={{backgroundColor: C.green, padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontFamily: F.display, fontSize: 46, color: '#0F1215', letterSpacing: '0.08em'}}>COOK MODE</span>
            <span style={{fontFamily: F.mono, fontSize: 28, color: '#0F1215'}}>AUTO</span>
          </div>
          <div style={{padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
            <div style={{position: 'relative', width: 300, height: 300}}>
              <svg width={300} height={300} viewBox="0 0 200 200" style={{transform: 'rotate(-90deg)'}}>
                <circle cx="100" cy="100" r="84" fill="none" stroke={C.fainter} strokeWidth="14" />
                <circle
                  cx="100"
                  cy="100"
                  r="84"
                  fill="none"
                  stroke={C.green}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 84}
                  strokeDashoffset={2 * Math.PI * 84 * (1 - sweep)}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{fontFamily: F.mono, fontSize: 84, color: C.cream}}>{fmtClock(600 * (1 - sweep))}</span>
                <span style={{fontFamily: F.ui, fontSize: 24, color: C.cream2, letterSpacing: '0.2em'}}>CHOPPING</span>
              </div>
            </div>
            <div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
              <div style={{fontFamily: F.mono, fontSize: 34, color: C.green, border: `2px solid ${C.green}`, borderRadius: 8, padding: '6px 18px'}}>
                STEP 1 / 5
              </div>
              <div style={{fontFamily: F.mono, fontSize: 30, color: C.cream2}}>UP NEXT: SIMMER</div>
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 10, width: '100%', opacity: 0.75}}>
              {[['SIMMER', '20:00'], ['PLATE', '1:12'], ['CLEANUP', '12:00']].map(([n, t], i) => (
                <div
                  key={n}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderRadius: 10,
                    border: `1px solid ${C.fainter}`,
                    fontFamily: F.mono,
                    fontSize: 30,
                    color: C.cream2,
                    opacity: prog(frame, 5, 14 + i * 3),
                  }}
                >
                  <span>{n}</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        </HUDPanel>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s22 — offline: zero bars, recipes stay lit.
export const S22: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 60, top: 280, display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'flex-start'}}>
        <Kicker delay={2}>CONNECTION: LOST</Kicker>
        <div style={{display: 'flex', alignItems: 'center', gap: 40}}>
          <SignalSlashed />
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            <span style={{fontFamily: F.display, fontSize: 170, color: C.cream, lineHeight: 0.9}}>0 BARS</span>
            <span style={{fontFamily: F.mono, fontSize: 56, color: C.green}}>STILL COOKING</span>
          </div>
        </div>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 200px)', gap: 16, opacity: prog(frame, 8)}}>
          {['CHILI', 'PASTA', 'CURRY', 'TACOS', 'SOUP', 'STIRFRY'].map((r, i) => (
            <div
              key={r}
              style={{
                height: 130,
                borderRadius: 12,
                border: `2px solid ${C.green}`,
                backgroundColor: 'rgba(111,169,127,0.10)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: prog(frame, 6, 10 + i * 2),
              }}
            >
              <div style={{width: 64, height: 10, borderRadius: 5, backgroundColor: C.greenDim}} />
              <span style={{fontFamily: F.ui, fontSize: 26, color: C.cream2, letterSpacing: '0.18em'}}>{r}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', right: SAFE + 50, bottom: 170, textAlign: 'right'}}>
        <Headline size={120} color={C.green} delay={8}>
          OFFLINE-FIRST
        </Headline>
        <div style={{fontFamily: F.mono, fontSize: 40, color: C.cream2, opacity: prog(frame, 14)}}>
          recipes cached · timers local
        </div>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

const SignalSlashed: React.FC = () => (
  <svg width={190} height={170} viewBox="0 0 120 100" fill="none">
    {[0, 1, 2, 3].map((i) => (
      <rect
        key={i}
        x={16 + i * 24}
        y={70 - i * 18}
        width={16}
        height={18 + i * 18}
        rx={3}
        stroke={C.cream2}
        strokeWidth={5}
        fill="none"
        opacity={0.5}
      />
    ))}
    <circle cx="60" cy="50" r="52" stroke={C.red} strokeWidth={7} />
    <path d="M23 13 L97 87" stroke={C.red} strokeWidth={7} strokeLinecap="round" />
  </svg>
);

// s23 — run reset: READY with PB target ghost.
export const S23: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 36}}>
        <div
          style={{
            position: 'absolute',
            fontFamily: F.mono,
            fontSize: 430,
            color: 'transparent',
            WebkitTextStroke: `3px ${C.terraDim}`,
            opacity: 0.6,
            letterSpacing: '0.04em',
          }}
        >
          43:12
        </div>
        <Kicker delay={2}>TARGET — PERSONAL BEST</Kicker>
        <Headline size={260} color={C.amber} delay={0}>
          READY?
        </Headline>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 44,
            color: C.terra,
            border: `3px solid ${C.terra}`,
            borderRadius: 10,
            padding: '10px 30px',
            opacity: prog(frame, 8),
          }}
        >
          PB TO BEAT: 43:12
        </div>
      </Center>
      <div style={{position: 'absolute', bottom: 130, left: SAFE + 40, opacity: 0.9}}>
        <RouteMap drawFrames={10} nodes={['off', 'off', 'off', 'off', 'off', 'off']} width={700} />
      </div>
      <RunHud timer="00:00" pace="idle" splits={greenSplits(-1)} />
      <Vignette />
    </AbsoluteFill>
  );
};
