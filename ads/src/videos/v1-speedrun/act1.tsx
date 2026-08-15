// Act 1 — HOOK: the failed run (s01–s05).
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {
  C,
  Center,
  EASE_OUT,
  F,
  GlitchBars,
  Headline,
  HUDPanel,
  Kicker,
  Scanlines,
  Stamp,
  StarIcon,
  Vignette,
  clamp,
  jitter,
  prog,
} from './ui';
import {SAFE} from '../../shared/theme';

// s01 — GAME OVER panel slams down, FAILED stamp, buzzer jitter.
export const S01: React.FC = () => {
  const frame = useCurrentFrame();
  const slam = interpolate(frame, [0, 6], [1.6, 1], {easing: EASE_OUT, ...clamp});
  const j = jitter(frame, 's01', frame >= 6 && frame <= 15 ? 4 : 0);
  const flash = interpolate(frame, [0, 4], [0.5, 0], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: '#05070A'}}>
      <AbsoluteFill style={{backgroundColor: C.red, opacity: flash}} />
      <Center>
        <div style={{scale: `${slam}`, translate: `${j.x}px ${j.y}px`}}>
          <HUDPanel
            style={{
              width: 1080,
              padding: '56px 72px 64px',
              border: `4px solid ${C.red}`,
              boxShadow: `0 0 120px ${C.redDim}, 0 24px 80px rgba(0,0,0,0.6)`,
              textAlign: 'center',
            }}
          >
            <div style={{fontFamily: F.display, fontSize: 190, lineHeight: 0.9, color: C.red, letterSpacing: '0.04em'}}>
              GAME OVER
            </div>
            <div style={{height: 3, backgroundColor: C.faint, margin: '30px 0'}} />
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: F.mono}}>
              <span style={{fontSize: 44, color: C.cream2, letterSpacing: '0.1em'}}>RECIPE PROMISED</span>
              <span style={{fontSize: 64, color: C.amber}}>15:00</span>
            </div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontFamily: F.mono, marginTop: 18}}>
              <span style={{fontSize: 44, color: C.cream2, letterSpacing: '0.1em'}}>ELAPSED</span>
              <span style={{fontSize: 96, color: C.red, textShadow: `0 0 40px ${C.redDim}`}}>43:12</span>
            </div>
          </HUDPanel>
        </div>
      </Center>
      <div style={{position: 'absolute', top: 300, left: 1080, scale: `${interpolate(prog(frame, 6, 7), [0, 1], [2.4, 1])}`, opacity: prog(frame, 7) > 0 ? 1 : 0}}>
        <Stamp text="FAILED" color={C.red} size={110} rotate={-10} delay={7} />
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s02 — the blog's pretty recipe card promising 15:00.
export const S02: React.FC = () => {
  const frame = useCurrentFrame();
  const cardIn = interpolate(frame, [0, 8], [1, 1], {...clamp, easing: EASE_OUT});
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{flexDirection: 'row', gap: 110}}>
        <div
          style={{
            width: 640,
            backgroundColor: '#FBF8F3',
            borderRadius: 18,
            overflow: 'hidden',
            rotate: `${interpolate(frame, [0, 8], [-7, -2], {...clamp, easing: EASE_OUT})}deg`,
            scale: `${interpolate(frame, [0, 8], [1.3, 1], {...clamp, easing: EASE_OUT})}`,
            opacity: interpolate(frame, [0, 4], [0, 1], clamp),
            boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
            translate: `0 ${interpolate(frame, [0, 8], [-120, 0], {...clamp, easing: EASE_OUT})}px`,
          }}
        >
          <div style={{height: 16, backgroundColor: '#B5A897'}} />
          <div
            style={{
              height: 300,
              margin: 28,
              borderRadius: 12,
              background: `linear-gradient(140deg, #D96E3F 0%, #A4471F 55%, #6E6357 100%)`,
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '58%',
                translate: '-50% -50%',
                width: 220,
                height: 90,
                border: '7px solid #FBF8F3',
                borderRadius: '50%',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '26%',
                translate: '-50% -50%',
                width: 0,
                height: 0,
                borderLeft: '26px solid transparent',
                borderRight: '26px solid transparent',
                borderBottom: `44px solid #FBF8F3`,
              }}
            />
          </div>
          <div style={{padding: '0 40px 40px'}}>
            <div style={{fontFamily: F.ui, fontWeight: 700, fontSize: 58, color: '#241D17'}}>Weeknight Chili</div>
            <div style={{display: 'flex', gap: 8, margin: '14px 0'}}>
              {[1, 1, 1, 1, 0].map((f, i) => (
                <StarIcon key={i} size={34} filled={f === 1} color={C.amber} />
              ))}
              <span style={{fontFamily: F.ui, fontSize: 26, color: '#6E6357', marginLeft: 10}}>2,481 reviews</span>
            </div>
            <div style={{height: 2, backgroundColor: '#ECE4D8', margin: '18px 0'}} />
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontFamily: F.ui, fontSize: 30, letterSpacing: '0.2em', color: '#6E6357'}}>TOTAL TIME</span>
              <span style={{fontFamily: F.mono, fontSize: 96, color: '#BF552B'}}>15:00</span>
            </div>
            <div style={{fontFamily: F.ui, fontSize: 26, color: '#9C9082', fontStyle: 'italic', marginTop: 8}}>
              “perfect for busy weeknights!”
            </div>
          </div>
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: 30, alignItems: 'center'}}>
          <Kicker delay={8}>THE CLAIM</Kicker>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 200,
              color: C.amber,
              textShadow: `0 0 60px ${C.amberDim}`,
              scale: `${interpolate(frame, [8, 18], [0.4, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)})}`,
              opacity: interpolate(frame, [8, 12], [0, 1], clamp),
            }}
          >
            15:00
          </div>
          <Kicker delay={12} style={{color: C.amber}}>
            MINUTES, THEY SAY
          </Kicker>
        </div>
      </Center>
      <Vignette />
      <div style={{position: 'absolute', inset: 0, scale: `${cardIn}`}} />
    </AbsoluteFill>
  );
};

// s03 — run timer snaps 15:00 → 43:12 with screen shake.
export const S03: React.FC = () => {
  const frame = useCurrentFrame();
  const snapped = frame >= 8;
  const j = jitter(frame, 's03', snapped && frame <= 18 ? 7 : 0);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 26}}>
        <Kicker>{snapped ? 'ELAPSED — REAL TIME' : 'PROMISED'}</Kicker>
        <div style={{position: 'relative', height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 330,
              color: C.cream2,
              opacity: snapped ? 0.18 : 0.85,
              position: 'absolute',
            }}
          >
            15:00
          </div>
          {snapped ? (
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 400,
                color: C.red,
                textShadow: `0 0 90px ${C.redDim}`,
                position: 'absolute',
                scale: `${interpolate(frame, [8, 14], [1.5, 1], {...clamp, easing: EASE_OUT})}`,
                translate: `${j.x}px ${j.y}px`,
              }}
            >
              43:12
            </div>
          ) : null}
        </div>
        <div
          style={{
            width: 900,
            height: 10,
            backgroundColor: C.red,
            scale: `${interpolate(frame, [8, 16], [0, 1], clamp)} 1`,
          }}
        />
        <div style={{fontFamily: F.ui, fontSize: 38, color: C.red, fontWeight: 700, letterSpacing: '0.18em'}}>
          +28:12 OVER PROMISE
        </div>
      </Center>
      <AbsoluteFill style={{backgroundColor: C.red, opacity: interpolate(frame, [8, 20], [0.22, 0], clamp)}} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s04 — smash cut: THAT TIME WAS A CHEATED RUN.
export const S04: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: '#0A0C0F'}}>
      <AbsoluteFill style={{backgroundColor: C.red, opacity: interpolate(frame, [0, 3], [0.85, 0], clamp)}} />
      <Center style={{gap: 10}}>
        <Headline size={210} color={C.cream} delay={1}>
          THAT TIME WAS
        </Headline>
        <Headline size={210} color={C.red} delay={4}>
          A CHEATED RUN.
        </Headline>
      </Center>
      <GlitchBars count={6} seed="s04" />
      <Scanlines opacity={0.14} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s05 — title card: ANY% COOK — THE SPEEDRUN.
export const S05: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 31], [1.0, 1.035], clamp);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{scale: `${drift}`, gap: 20}}>
        <Kicker delay={2}>RECIPEREAL PRESENTS</Kicker>
        <Headline size={300} color={C.cream} delay={0}>
          ANY% COOK
        </Headline>
        <div
          style={{
            width: 1080,
            height: 6,
            backgroundColor: C.terra,
            scale: `${interpolate(frame, [4, 16], [0, 1], {...clamp, easing: EASE_OUT})} 1`,
          }}
        />
        <Headline size={130} color={C.terra} delay={6}>
          THE SPEEDRUN
        </Headline>
      </Center>
      {/* corner brackets */}
      {[
        {top: SAFE, left: SAFE, borderTop: true, borderLeft: true},
        {top: SAFE, right: SAFE, borderTop: true, borderRight: true},
        {bottom: SAFE, left: SAFE, borderBottom: true, borderLeft: true},
        {bottom: SAFE, right: SAFE, borderBottom: true, borderRight: true},
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 90,
            height: 90,
            borderColor: C.terra,
            borderTopWidth: pos.borderTop ? 6 : 0,
            borderBottomWidth: pos.borderBottom ? 6 : 0,
            borderLeftWidth: pos.borderLeft ? 6 : 0,
            borderRightWidth: pos.borderRight ? 6 : 0,
            borderStyle: 'solid',
            top: pos.top,
            left: pos.left,
            right: pos.right,
            bottom: pos.bottom,
            opacity: interpolate(frame, [6 + i, 10 + i], [0, 1], clamp),
          }}
        />
      ))}
      <Scanlines opacity={0.12} />
      <Vignette />
    </AbsoluteFill>
  );
};
