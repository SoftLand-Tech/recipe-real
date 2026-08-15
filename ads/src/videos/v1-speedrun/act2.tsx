// Act 2 — the fantasy route (s06–s11): blog splits are a cheated run.
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {
  C,
  Center,
  DeltaBadge,
  DishStackIcon,
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
  Stamp,
  Vignette,
  clamp,
  fmtClock,
  jitter,
  prog,
} from './ui';
import type {HudSplit} from './ui';
import {SAFE} from '../../shared/theme';

const dimSplits = (overrides: HudSplit[]): HudSplit[] => {
  const names = ['CHOP', 'PREHEAT', 'SIMMER', 'PLATE', 'CLEANUP'];
  return names.map((n) => overrides.find((o) => o.name === n) ?? {name: n, time: '--:--', state: 'dim' as const});
};

// s06 — 3-2-1-GO countdown, route draws, HUD boots.
export const S06: React.FC = () => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / 7); // 3, 2, 1, GO!
  const label = ['3', '2', '1', 'GO!'][Math.min(3, step)];
  const isGo = step >= 3;
  const pop = interpolate(frame % 7, [0, 6], [1.5, 1], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 40, top: 260, display: 'flex', flexDirection: 'column', gap: 30}}>
        <Kicker>FANTASY ROUTE — LOADING</Kicker>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 360,
            lineHeight: 1,
            color: isGo ? C.red : C.cream,
            scale: `${pop}`,
            textShadow: isGo ? `0 0 60px ${C.redDim}` : 'none',
          }}
        >
          {label}
        </div>
        <div style={{fontFamily: F.ui, fontSize: 34, color: C.cream2, letterSpacing: '0.2em'}}>
          BLOG ROUTE — “JUST 15 MINUTES”
        </div>
      </div>
      <div style={{position: 'absolute', right: SAFE + 40, bottom: 150, scale: `${prog(frame, 4) * 0.9 + 0.1}`}}>
        <RouteMap drawFrames={20} nodes={['on', 'off', 'on', 'off', 'on', 'off']} width={900} />
      </div>
      <RunHud
        timer="00:00"
        pace="idle"
        splits={dimSplits([{name: 'CHOP', time: '4:00', state: 'active', sub: 'BLOG CLAIM'}])}
      />
      <Vignette />
    </AbsoluteFill>
  );
};

// s07 — CHOP split row slams, blog claim 4:00, knife + onion grid.
export const S07: React.FC = () => {
  const frame = useCurrentFrame();
  const timerSec = interpolate(frame, [0, 43], [0, 240], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 40, top: 330, display: 'flex', flexDirection: 'column', gap: 26}}>
        <Kicker>SPLIT 01</Kicker>
        <div style={{display: 'flex', alignItems: 'center', gap: 34}}>
          <KnifeIcon size={170} color={C.cream} />
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            <div style={{fontFamily: F.display, fontSize: 150, color: C.cream, lineHeight: 0.9, letterSpacing: '0.03em'}}>
              CHOP
            </div>
            <div style={{fontFamily: F.mono, fontSize: 90, color: C.amber}}>
              BLOG: 4:00
            </div>
          </div>
        </div>
        {/* onion-cell grid being chopped */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 64px)', gap: 10, width: 440}}>
          {Array.from({length: 12}).map((_, i) => {
            const flick = random(`s07-cell-${i}-${Math.floor(frame / 4)}`);
            return (
              <div
                key={i}
                style={{
                  width: 64,
                  height: 44,
                  borderRadius: 8,
                  border: `2px solid ${C.faint}`,
                  backgroundColor: flick > 0.6 ? `${C.terra}33` : C.fainter,
                  opacity: interpolate(prog(frame, 4, i), [0, 1], [0, 1]),
                }}
              />
            );
          })}
        </div>
      </div>
      <RunHud
        timer={fmtClock(timerSec)}
        pace="amber"
        splits={dimSplits([{name: 'CHOP', time: '4:00', state: 'active', sub: 'BLOG CLAIM'}])}
      />
      <Vignette />
    </AbsoluteFill>
  );
};

// s08 — counter races 4:00 → 10:00, +6:00 SLOWER badge pops.
export const S08: React.FC = () => {
  const frame = useCurrentFrame();
  const secs = interpolate(frame, [0, 30], [240, 600], {...clamp, easing: Easing.bezier(0.3, 0, 0.2, 1)});
  const landed = frame >= 30;
  const j = jitter(frame, 's08', landed && frame < 36 ? 4 : 0);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 40, top: 300, display: 'flex', flexDirection: 'column', gap: 24}}>
        <Kicker>REAL CHOP TIME</Kicker>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 300,
            lineHeight: 1,
            color: landed ? C.red : C.cream,
            textShadow: landed ? `0 0 80px ${C.redDim}` : 'none',
            translate: `${j.x}px ${j.y}px`,
          }}
        >
          {fmtClock(secs)}
        </div>
        <div style={{height: 76}}>
          {landed ? <DeltaBadge text="+6:00 SLOWER" tone="red" delay={30} /> : null}
        </div>
      </div>
      {/* onion cells draining */}
      <div
        style={{
          position: 'absolute',
          right: SAFE + 640,
          top: 340,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 58px)',
          gap: 10,
        }}
      >
        {Array.from({length: 12}).map((_, i) => {
          const gone = i < Math.floor(interpolate(frame, [0, 30], [0, 12], clamp));
          return (
            <div
              key={i}
              style={{
                width: 58,
                height: 40,
                borderRadius: 8,
                border: `2px solid ${gone ? C.fainter : C.faint}`,
                backgroundColor: gone ? 'transparent' : `${C.terra}33`,
              }}
            />
          );
        })}
      </div>
      <RunHud
        timer="10:00"
        pace="red"
        splits={dimSplits([
          {name: 'CHOP', time: '10:00', state: 'red', delta: '+6:00', sub: 'TOOK 10'},
        ])}
      />
      <Vignette />
    </AbsoluteFill>
  );
};

// s09 — route map with missing preheat segment circled in red.
export const S09: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40, paddingBottom: 60}}>
        <Kicker>ROUTING ERROR</Kicker>
        <div style={{position: 'relative'}}>
          <RouteMap
            drawFrames={8}
            segments={['drawn', 'gap', 'drawn', 'drawn', 'drawn']}
            nodes={['on', 'off', 'on', 'on', 'on']}
            width={1250}
          />
          {/* red circle around the gap */}
          <svg width={1250} height={404} viewBox="0 0 1300 420" style={{position: 'absolute', inset: 0}}>
            <circle
              cx={(300 + 560) / 2}
              cy={(120 + 300) / 2}
              r={190}
              fill="none"
              stroke={C.red}
              strokeWidth={9}
              strokeDasharray={1194}
              strokeDashoffset={1194 * (1 - interpolate(frame, [4, 14], [0, 1], {...clamp, easing: EASE_OUT}))}
              style={{rotate: `${interpolate(frame, [0, 33], [0, 8], clamp)}deg`, transformOrigin: '430px 210px'}}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              left: 280,
              top: -46,
              fontFamily: F.display,
              fontSize: 64,
              color: C.red,
              letterSpacing: '0.08em',
              opacity: prog(frame, 8),
            }}
          >
            PREHEAT — MISSING
          </div>
        </div>
        <Headline size={120} color={C.cream} delay={10}>
          NOT IN THEIR ROUTE
        </Headline>
      </Center>
      {/* flame stranded off-route */}
      <div style={{position: 'absolute', right: SAFE + 60, top: 170, opacity: 0.35}}>
        <FlameIcon size={130} color={C.cream2} />
        <div style={{...{fontFamily: F.ui, fontSize: 22, color: C.cream2, letterSpacing: '0.18em'}, textAlign: 'center'}}>
          STRANDED
        </div>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s10 — +5:00 PENALTY stamp, gap fills red hatched, timer jumps.
export const S10: React.FC = () => {
  const frame = useCurrentFrame();
  const timer = frame < 6 ? '10:00' : '15:00';
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 44}}>
        <div style={{display: 'flex', gap: 36, alignItems: 'center'}}>
          <Stamp text="+5:00" color={C.red} size={170} rotate={-9} delay={1} />
          <Stamp text="PENALTY" color={C.cream} size={92} rotate={4} delay={8} />
        </div>
        <div style={{opacity: prog(frame, 10)}}>
          <RouteMap
            drawFrames={6}
            segments={['drawn', 'red', 'drawn', 'drawn', 'drawn']}
            nodes={['on', 'on', 'on', 'on', 'on']}
            width={1050}
          />
        </div>
        <div style={{fontFamily: F.mono, fontSize: 44, color: C.red, opacity: prog(frame, 12)}}>
          OVEN sat COLD for 5:00
        </div>
      </Center>
      <RunHud
        timer={timer}
        pace="red"
        splits={dimSplits([
          {name: 'CHOP', time: '10:00', state: 'red', delta: '+6:00'},
          {name: 'PREHEAT', time: '5:00', state: 'red', delta: '+5:00', sub: 'UNTIMED'},
        ])}
      />
      <Vignette />
    </AbsoluteFill>
  );
};

// s11 — cleanup: the split nobody times, claimed 0:00, big question mark.
export const S11: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 40, top: 320, display: 'flex', alignItems: 'center', gap: 60}}>
        <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>
          <Kicker>FINAL SPLIT — UNLISTED</Kicker>
          <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 320,
                color: C.cream2,
                lineHeight: 1,
                opacity: interpolate(frame, [4, 14], [0.3, 1], clamp),
              }}
            >
              ?
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <div style={{fontFamily: F.mono, fontSize: 56, color: C.cream2, textDecoration: 'line-through', textDecorationColor: C.red, textDecorationThickness: 5}}>
                CLAIMED 0:00
              </div>
              <div style={{fontFamily: F.mono, fontSize: 72, color: C.red}}>REAL: ???</div>
            </div>
          </div>
          <Headline size={110} color={C.cream} delay={8}>
            NOBODY TIMES IT
          </Headline>
        </div>
        <HUDPanel style={{padding: '44px 52px', display: 'flex', gap: 46, alignItems: 'center'}}>
          <DishStackIcon size={170} color={C.cream2} />
          <SpongeIcon size={190} color={C.green} />
        </HUDPanel>
      </div>
      <RunHud
        timer="15:00"
        pace="red"
        splits={dimSplits([
          {name: 'CHOP', time: '10:00', state: 'red', delta: '+6:00'},
          {name: 'PREHEAT', time: '5:00', state: 'red', delta: '+5:00'},
          {name: 'CLEANUP', time: '0:00?', state: 'q', delta: '+?'},
        ])}
      />
      <Vignette />
    </AbsoluteFill>
  );
};
