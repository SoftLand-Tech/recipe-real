// Act 4 — the honest run (s24–s33): splits land on prediction.
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {
  C,
  Center,
  Confetti,
  EASE_OUT,
  F,
  FlameIcon,
  Headline,
  HUDPanel,
  Kicker,
  PlateIcon,
  PotIcon,
  RunHud,
  Stamp,
  Vignette,
  clamp,
  fmtClock,
  jitter,
  prog,
} from './ui';
import type {HudSplit} from './ui';
import {SAFE} from '../../shared/theme';

type SplitDef = {name: string; time: string};

const SPLIT_DEFS: SplitDef[] = [
  {name: 'CHOP', time: '10:00'},
  {name: 'PREHEAT', time: '5:00'},
  {name: 'SIMMER', time: '20:00'},
  {name: 'PLATE', time: '1:12'},
  {name: 'CLEANUP', time: '12:00'},
];

const hudSplits = (done: number, active: number, gold = false): HudSplit[] =>
  SPLIT_DEFS.map((s, i) => ({
    name: s.name,
    time: s.time,
    state: i === active ? 'active' : i < done ? (gold && i === done - 1 ? 'gold' : 'green') : 'dim',
    delta: i < done ? '00:00' : undefined,
    sub: i === active ? 'RUNNING' : undefined,
  }));

// s24 — GO! The honest run starts.
export const S24: React.FC = () => {
  const frame = useCurrentFrame();
  const timerSec = interpolate(frame, [0, 38], [0, 26], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <AbsoluteFill style={{backgroundColor: C.green, opacity: interpolate(frame, [0, 6], [0.35, 0], clamp)}} />
      <Center>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 460,
            color: C.green,
            lineHeight: 0.9,
            textShadow: `0 0 110px ${C.greenDim}`,
            scale: `${interpolate(frame, [0, 8], [2.2, 1], {...clamp, easing: EASE_OUT})}`,
            letterSpacing: '0.02em',
          }}
        >
          GO!
        </div>
        <Kicker delay={4}>HONEST ROUTE — TIMER RUNNING</Kicker>
      </Center>
      <RunHud timer={fmtClock(timerSec)} pace="green" splits={hudSplits(0, 0)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s25 — chop lands at 10:00 exactly.
export const S25: React.FC = () => {
  const frame = useCurrentFrame();
  const landed = frame >= 10;
  const j = jitter(frame, 's25', landed && frame < 15 ? 3 : 0);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 50, top: 330, display: 'flex', flexDirection: 'column', gap: 26}}>
        <Kicker>SPLIT 01 — CHOP</Kicker>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 300,
            lineHeight: 1,
            color: landed ? C.green : C.cream,
            textShadow: landed ? `0 0 80px ${C.greenDim}` : 'none',
            translate: `${j.x}px ${j.y}px`,
          }}
        >
          {fmtClock(interpolate(frame, [0, 10], [540, 600], {...clamp, easing: EASE_OUT}))}
        </div>
        <div style={{height: 80}}>
          {landed ? (
            <div
              style={{
                display: 'inline-block',
                fontFamily: F.mono,
                fontSize: 56,
                color: '#0F1215',
                backgroundColor: C.green,
                borderRadius: 8,
                padding: '8px 26px',
                scale: `${interpolate(frame, [10, 16], [0.3, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)})}`,
              }}
            >
              LANDED +0:00
            </div>
          ) : null}
        </div>
        <div style={{fontFamily: F.ui, fontSize: 40, color: C.cream2, letterSpacing: '0.14em', opacity: prog(frame, 12)}}>
          PREDICTED 10:00 — ACTUAL 10:00
        </div>
      </div>
      <RunHud timer="10:00" pace="green" splits={hudSplits(1, 1)} />
      {landed ? <Confetti seed="s25" count={26} originX={78} originY={38} power={0.5} delay={10} /> : null}
      <Vignette />
    </AbsoluteFill>
  );
};

// s26 — preheat lands at five, parallel lane Gantt.
export const S26: React.FC = () => {
  const frame = useCurrentFrame();
  const landed = frame >= 8;
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', left: SAFE + 50, top: 300, display: 'flex', flexDirection: 'column', gap: 30}}>
        <Kicker>SPLIT 02 — PREHEAT (PARALLEL LANE)</Kicker>
        <HUDPanel style={{padding: '44px 56px', display: 'flex', flexDirection: 'column', gap: 26}}>
          <GanttLane label="CHOP" color={C.green} width={820} progress={interpolate(frame, [0, 30], [0, 1], clamp)} />
          <GanttLane label="PREHEAT" color={C.amber} width={820} progress={interpolate(frame, [0, 8], [0, 1], {...clamp, easing: EASE_OUT})} />
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <FlameIcon size={110} color={C.amber} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              <span style={{fontFamily: F.mono, fontSize: 110, lineHeight: 1, color: landed ? C.green : C.cream}}>
                05:00
              </span>
              <span style={{fontFamily: F.mono, fontSize: 34, color: landed ? C.green : C.cream2}}>
                {landed ? 'Δ 00:00 — OVEN READY EARLY' : 'OVEN HEATING…'}
              </span>
            </div>
          </div>
        </HUDPanel>
      </div>
      <RunHud timer="10:00" pace="green" splits={hudSplits(2, 2)} />
      <Vignette />
    </AbsoluteFill>
  );
};

const GanttLane: React.FC<{label: string; color: string; width: number; progress: number}> = ({label, color, width, progress}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: 24}}>
    <span style={{fontFamily: F.ui, fontSize: 30, color: C.cream2, letterSpacing: '0.16em', width: 170}}>{label}</span>
    <div style={{width, height: 46, borderRadius: 8, border: `2px solid ${C.faint}`, position: 'relative', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: `${progress * 100}%`,
          backgroundColor: `${color}66`,
          borderRight: `4px solid ${color}`,
        }}
      />
    </div>
  </div>
);

// s27 — simmer: pot with bubbles, timeline fills to 30:00.
export const S27: React.FC = () => {
  const frame = useCurrentFrame();
  const timerSec = interpolate(frame, [0, 53], [600, 1800], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 44}}>
        <div style={{position: 'relative'}}>
          <PotIcon size={260} color={C.cream} />
          {Array.from({length: 9}).map((_, i) => {
            const period = 22 + Math.floor(random(`s27-p-${i}`) * 12);
            const t = frame % period;
            const p = t / period;
            const bx = 40 + random(`s27-x-${i}`) * 180;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: bx,
                  top: 40 - p * 150,
                  width: 12 + random(`s27-r-${i}`) * 16,
                  height: 12 + random(`s27-r-${i}`) * 16,
                  borderRadius: '50%',
                  border: `3px solid ${C.cream2}`,
                  opacity: interpolate(p, [0, 0.2, 0.85, 1], [0, 0.8, 0.8, 0], clamp),
                }}
              />
            );
          })}
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 26}}>
          <div style={{fontFamily: F.mono, fontSize: 64, color: C.cream2}}>AUTO-TIMER</div>
          <div style={{fontFamily: F.mono, fontSize: 64, color: C.green, border: `3px solid ${C.green}`, borderRadius: 10, padding: '6px 24px'}}>
            20:00 LOCKED
          </div>
        </div>
        <div style={{width: 1100, height: 22, borderRadius: 11, border: `2px solid ${C.faint}`, position: 'relative'}}>
          <div
            style={{
              position: 'absolute',
              inset: 2,
              width: `${interpolate(frame, [0, 53], [33, 100], clamp) * 1}%`,
              backgroundColor: C.greenDim,
              borderRight: `5px solid ${C.green}`,
              borderRadius: 9,
            }}
          />
        </div>
      </Center>
      <RunHud timer={fmtClock(timerSec)} pace="green" splits={hudSplits(2, 2)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s28 — live delta flickers around zero.
export const S28: React.FC = () => {
  const frame = useCurrentFrame();
  const third = Math.floor(frame / 9);
  const readouts = [
    {text: '−00:04', color: C.green},
    {text: '+00:02', color: C.red},
    {text: '00:00', color: C.green},
  ];
  const r = readouts[Math.min(2, third)];
  const pts = Array.from({length: 40}).map((_, i) => {
    const wig = (random(`s28-w-${i}`) - 0.5) * 70;
    const settle = interpolate(i, [0, 39], [0, 1], clamp);
    return {x: i * 30, y: 130 + wig * (1 - settle * 0.7)};
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 30}}>
        <Kicker>LIVE DELTA — VS PREDICTED</Kicker>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 240,
            lineHeight: 1,
            color: r.color,
            textShadow: `0 0 70px ${r.color === C.green ? C.greenDim : C.redDim}`,
            scale: `${1 + (frame % 9 === 0 ? 0.05 : 0)}`,
          }}
        >
          {r.text}
        </div>
        <HUDPanel style={{padding: '26px 40px'}}>
          <svg width={1160} height={260} viewBox="0 0 1200 260">
            <line x1="0" y1="130" x2="1200" y2="130" stroke={C.faint} strokeWidth="2" strokeDasharray="8 10" />
            <path
              d={path}
              fill="none"
              stroke={r.color}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={40 * 30}
              strokeDashoffset={40 * 30 * (1 - interpolate(frame, [0, 24], [0, 1], {...clamp, easing: EASE_OUT}))}
            />
          </svg>
        </HUDPanel>
        <div style={{fontFamily: F.ui, fontSize: 38, color: C.cream2, letterSpacing: '0.16em'}}>
          HUGGING ZERO — EXACTLY AS PREDICTED
        </div>
      </Center>
      <RunHud timer="31:14" pace="green" splits={hudSplits(3, 3)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s29 — split rail close-up, timer rushing toward the finish.
export const S29: React.FC = () => {
  const frame = useCurrentFrame();
  const timerSec = interpolate(frame, [0, 29], [1814, 2570], clamp);
  const pulse = 0.86 + 0.14 * Math.abs(Math.sin(frame / 3));
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div style={{position: 'absolute', right: -260, top: 120, scale: '1.9', transformOrigin: 'top right', opacity: pulse}}>
        <div style={{width: 470, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 40}}>
          <div style={{...{fontFamily: F.ui, fontSize: 30, letterSpacing: '0.22em', color: C.cream2}, textAlign: 'right'}}>SPLITS</div>
          {hudSplits(4, 4).map((s) => (
            <div
              key={s.name}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                borderRadius: 10,
                border: `2px solid ${s.state === 'green' ? C.green : s.state === 'active' ? C.cream2 : C.faint}`,
                backgroundColor: s.state === 'green' ? C.greenDim : 'rgba(243,237,230,0.05)',
              }}
            >
              <span style={{fontFamily: F.display, fontSize: 44, letterSpacing: '0.08em', color: s.state === 'dim' ? 'rgba(243,237,230,0.3)' : C.cream}}>
                {s.name}
              </span>
              <div style={{display: 'flex', gap: 12, alignItems: 'center'}}>
                <span style={{fontFamily: F.mono, fontSize: 44, color: s.state === 'green' ? C.green : C.cream2}}>{s.time}</span>
                {s.delta ? (
                  <span style={{fontFamily: F.mono, fontSize: 26, color: C.green, border: `1px solid ${C.green}`, borderRadius: 6, padding: '2px 8px'}}>
                    {s.delta}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{position: 'absolute', left: SAFE + 50, top: 340, display: 'flex', flexDirection: 'column', gap: 24}}>
        <Kicker>FINAL STRETCH</Kicker>
        <div style={{fontFamily: F.mono, fontSize: 260, color: C.cream, lineHeight: 1}}>{fmtClock(timerSec)}</div>
        <div style={{display: 'flex', gap: 8}}>
          {Array.from({length: 14}).map((_, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 44,
                backgroundColor: frame % 6 < 3 && i === Math.min(13, Math.floor(frame / 2) % 14) ? C.green : C.faint,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        <div style={{fontFamily: F.display, fontSize: 120, color: C.terra, letterSpacing: '0.04em', opacity: prog(frame, 6)}}>
          NOTHING TO GUESS
        </div>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s30 — final split lands exactly on 43:12. Gold flash.
export const S30: React.FC = () => {
  const frame = useCurrentFrame();
  const landed = frame >= 6;
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <AbsoluteFill style={{backgroundColor: C.cream, opacity: interpolate(frame, [0, 4], [0.9, 0], clamp)}} />
      <Center style={{gap: 30}}>
        <Kicker>FINAL SPLIT — CLEANUP</Kicker>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 330,
            lineHeight: 1,
            color: C.gold,
            textShadow: `0 0 100px rgba(232,197,106,0.4)`,
            scale: `${interpolate(frame, [6, 14], [1.6, 1], {...clamp, easing: EASE_OUT})}`,
          }}
        >
          43:12
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 110,
            color: C.green,
            letterSpacing: '0.06em',
            opacity: interpolate(frame, [14, 18], [0, 1], clamp),
          }}
        >
          EXACTLY AS PREDICTED
        </div>
        <div style={{display: 'flex', gap: 18}}>
          {['CHOP', 'PREHEAT', 'SIMMER', 'PLATE', 'CLEANUP'].map((n, i) => (
            <div
              key={n}
              style={{
                fontFamily: F.mono,
                fontSize: 32,
                color: landed ? C.green : C.cream2,
                border: `2px solid ${landed ? C.green : C.faint}`,
                borderRadius: 8,
                padding: '8px 18px',
                opacity: prog(frame, 4, 6 + i * 2),
              }}
            >
              {n} 00:00
            </div>
          ))}
        </div>
      </Center>
      {landed ? <Confetti seed="s30" count={36} originX={50} originY={30} power={0.7} delay={6} /> : null}
      <RunHud timer="43:12" pace="amber" splits={hudSplits(5, -1, true)} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s31 — NEW PERSONAL BEST celebration with confetti burst.
export const S31: React.FC = () => {
  const frame = useCurrentFrame();
  const j = jitter(frame, 's31', frame < 8 ? 5 : 0);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 26}}>
        <div style={{translate: `${j.x}px ${j.y}px`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26}}>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 160,
              color: C.gold,
              letterSpacing: '0.05em',
              lineHeight: 0.95,
              textShadow: '0 0 80px rgba(232,197,106,0.35)',
              scale: `${interpolate(frame, [0, 10], [1.8, 1], {...clamp, easing: EASE_OUT})}`,
            }}
          >
            NEW PERSONAL BEST
          </div>
          <HUDPanel style={{padding: '30px 90px', border: `3px solid ${C.gold}`}}>
            <div style={{fontFamily: F.mono, fontSize: 320, lineHeight: 1, color: C.gold}}>43:12</div>
          </HUDPanel>
          <div style={{fontFamily: F.ui, fontSize: 42, color: C.cream, letterSpacing: '0.2em'}}>
            YOUR BEST RUN — HONESTLY TIMED
          </div>
        </div>
      </Center>
      <Confetti seed="s31" count={110} power={1.5} delay={2} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s32 — VERIFIED stamp over the time.
export const S32: React.FC = () => {
  const frame = useCurrentFrame();
  const seal = interpolate(frame, [2, 16], [0, 1], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <div style={{position: 'relative'}}>
          <svg width={760} height={760} viewBox="0 0 200 200" style={{position: 'absolute', left: '50%', top: '50%', translate: '-50% -50%'}}>
            <circle
              cx="100"
              cy="100"
              r="92"
              fill="none"
              stroke={C.terra}
              strokeWidth="3"
              strokeDasharray="3 7"
              opacity={0.8}
            />
            <circle
              cx="100"
              cy="100"
              r="82"
              fill="none"
              stroke={C.terra}
              strokeWidth="6"
              strokeDasharray={2 * Math.PI * 82}
              strokeDashoffset={2 * Math.PI * 82 * (1 - seal)}
            />
          </svg>
          <div style={{fontFamily: F.mono, fontSize: 290, color: C.cream, lineHeight: 1, textAlign: 'center'}}>43:12</div>
        </div>
        <Stamp text="VERIFIED" color={C.terra} size={140} rotate={-7} delay={6} />
        <div style={{fontFamily: F.mono, fontSize: 40, color: C.cream2, opacity: prog(frame, 14)}}>
          signed off by 10,000 runners
        </div>
      </Center>
      <Confetti seed="s32" count={36} power={0.5} delay={0} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s33 — finish line: checkered wipe, plate with steam, GG.
export const S33: React.FC = () => {
  const frame = useCurrentFrame();
  const wipe = interpolate(frame, [0, 12], [1, 0], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <div style={{position: 'relative'}}>
          <PlateIcon size={280} color={C.cream} />
          {[0, 1, 2].map((i) => {
            const t = (frame + i * 9) % 27;
            const p = t / 27;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 90 + i * 55,
                  top: 30 - p * 110,
                  width: 14,
                  height: 52,
                  borderRadius: 8,
                  backgroundColor: C.cream2,
                  opacity: interpolate(p, [0, 0.3, 0.9, 1], [0, 0.7, 0.7, 0], clamp),
                }}
              />
            );
          })}
        </div>
        <Headline size={170} color={C.cream} delay={4}>
          GG — DINNER SECURED
        </Headline>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 44,
            color: C.terra,
            border: `3px solid ${C.terra}`,
            borderRadius: 10,
            padding: '8px 28px',
            opacity: prog(frame, 10),
          }}
        >
          RUN TIME 43:12 — FROZEN
        </div>
      </Center>
      {/* checkered wipe rows */}
      {[0, 1].map((row) => (
        <div
          key={row}
          style={{
            position: 'absolute',
            top: row === 0 ? 0 : 1080 - 140,
            left: 0,
            right: 0,
            height: 140,
            display: 'flex',
            translate: `${(row === 0 ? -1920 : 1920) * wipe}px 0`,
            opacity: 0.9,
          }}
        >
          {Array.from({length: 16}).map((_, i) => (
            <div key={i} style={{width: 120, height: 140, backgroundColor: (i + row) % 2 === 0 ? C.cream : '#0A0C0F'}} />
          ))}
        </div>
      ))}
      <Vignette />
    </AbsoluteFill>
  );
};
