// Act 5 — the comparison (s34–s38) and Act 6 — end card (s39–s41).
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {
  C,
  Center,
  CheckIcon,
  Confetti,
  EASE_OUT,
  F,
  GlitchBars,
  Headline,
  HUDPanel,
  Kicker,
  Scanlines,
  Stamp,
  Vignette,
  clamp,
  jitter,
  prog,
} from './ui';
import {SAFE} from '../../shared/theme';

const cardBase = {
  width: 620,
  borderRadius: 20,
  overflow: 'hidden' as const,
};

// s34 — left card: the fantasy route.
export const S34: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div
        style={{
          position: 'absolute',
          left: SAFE + 120,
          top: 180,
          ...cardBase,
          translate: `${interpolate(frame, [0, 7], [-1100, 0], {...clamp, easing: EASE_OUT})}px 0`,
          rotate: `${interpolate(frame, [0, 7], [-9, -3], {...clamp, easing: EASE_OUT})}deg`,
          border: `5px solid ${C.red}`,
          backgroundColor: '#1A1114',
          backgroundImage: `repeating-linear-gradient(-45deg, ${C.redDim} 0 18px, transparent 18px 38px)`,
          boxShadow: `0 0 90px ${C.redDim}`,
        }}
      >
        <div style={{padding: '34px 44px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center'}}>
          <div style={{fontFamily: F.display, fontSize: 72, color: C.red, letterSpacing: '0.08em'}}>FANTASY ROUTE</div>
          <div style={{fontFamily: F.mono, fontSize: 300, lineHeight: 1, color: C.red, textShadow: `0 0 60px ${C.redDim}`}}>
            15:00
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 38,
              color: C.red,
              border: `3px solid ${C.red}`,
              borderRadius: 10,
              padding: '8px 26px',
              opacity: prog(frame, 10),
            }}
          >
            CHEATED RUN
          </div>
          <div style={{fontFamily: F.ui, fontSize: 28, color: C.cream2, textAlign: 'center', lineHeight: 1.5, marginTop: 10}}>
            preheat? untimed.
            <br />
            cleanup? imaginary.
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', right: SAFE + 100, top: 420, textAlign: 'right'}}>
        <Kicker delay={6}>WHAT THE BLOG SAYS</Kicker>
        <Headline size={130} color={C.red} delay={8}>
          TOO GOOD
        </Headline>
        <Headline size={130} color={C.cream} delay={11}>
          TO BE TRUE
        </Headline>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s35 — right card: the verified route.
export const S35: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <div
        style={{
          position: 'absolute',
          right: SAFE + 120,
          top: 180,
          ...cardBase,
          border: `5px solid ${C.terra}`,
          backgroundColor: '#1A1512',
          boxShadow: `0 0 90px ${C.terraDim}`,
          translate: `${interpolate(frame, [0, 7], [1100, 0], {...clamp, easing: EASE_OUT})}px 0`,
          rotate: `${interpolate(frame, [0, 7], [9, 3], {...clamp, easing: EASE_OUT})}deg`,
        }}
      >
        <div style={{padding: '34px 44px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center'}}>
          <div style={{fontFamily: F.display, fontSize: 72, color: C.terra, letterSpacing: '0.08em'}}>VERIFIED ROUTE</div>
          <div style={{display: 'flex', alignItems: 'center', gap: 20}}>
            <div style={{width: 92, height: 92}}>
              <CheckIcon size={92} color={C.terra} draw={interpolate(frame, [6, 16], [0, 1], clamp)} />
            </div>
            <div style={{fontFamily: F.mono, fontSize: 300, lineHeight: 1, color: C.terra, textShadow: `0 0 60px ${C.terraDim}`}}>
              43:12
            </div>
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 38,
              color: C.cream,
              border: `3px solid ${C.terra}`,
              borderRadius: 10,
              padding: '8px 26px',
              opacity: prog(frame, 10),
            }}
          >
            n = 10,000 RUNS
          </div>
          <div style={{fontFamily: F.ui, fontSize: 28, color: C.cream2, textAlign: 'center', lineHeight: 1.5, marginTop: 10}}>
            every step timed.
            <br />
            cleanup included.
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: SAFE + 100, top: 420}}>
        <Kicker delay={6}>WHAT DINNER TAKES</Kicker>
        <Headline size={130} color={C.terra} delay={8}>
          THE REAL
        </Headline>
        <Headline size={130} color={C.cream} delay={11}>
          NUMBER
        </Headline>
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s36 — cards collide, VS burst, delta ribbon.
export const S36: React.FC = () => {
  const frame = useCurrentFrame();
  const j = jitter(frame, 's36', frame >= 8 && frame < 13 ? 5 : 0);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 0}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 0, translate: `${j.x}px ${j.y}px`}}>
          <div
            style={{
              ...cardBase,
              width: 540,
              border: `4px solid ${C.red}`,
              backgroundColor: '#1A1114',
              backgroundImage: `repeating-linear-gradient(-45deg, ${C.redDim} 0 16px, transparent 16px 34px)`,
              padding: '30px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              translate: `${interpolate(frame, [0, 8], [-500, 0], {...clamp, easing: EASE_OUT})}px 0`,
              zIndex: 1,
            }}
          >
            <div style={{fontFamily: F.display, fontSize: 50, color: C.red, letterSpacing: '0.1em'}}>FANTASY</div>
            <div style={{fontFamily: F.mono, fontSize: 170, color: C.red}}>15:00</div>
          </div>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 210,
              color: C.cream,
              margin: '0 -26px',
              zIndex: 3,
              scale: `${interpolate(frame, [6, 14], [0.2, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)})}`,
              textShadow: '0 0 70px rgba(243,237,230,0.35)',
            }}
          >
            VS
          </div>
          <div
            style={{
              ...cardBase,
              width: 540,
              border: `4px solid ${C.terra}`,
              backgroundColor: '#1A1512',
              padding: '30px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              translate: `${interpolate(frame, [0, 8], [500, 0], {...clamp, easing: EASE_OUT})}px 0`,
              zIndex: 2,
            }}
          >
            <div style={{fontFamily: F.display, fontSize: 50, color: C.terra, letterSpacing: '0.1em'}}>VERIFIED</div>
            <div style={{fontFamily: F.mono, fontSize: 170, color: C.terra}}>43:12</div>
          </div>
        </div>
      </Center>
      <div
        style={{
          position: 'absolute',
          bottom: 190,
          left: '50%',
          translate: '-50% 0',
          fontFamily: F.mono,
          fontSize: 62,
          color: C.red,
          backgroundColor: '#101418',
          border: `3px solid ${C.red}`,
          borderRadius: 14,
          padding: '14px 44px',
          whiteSpace: 'nowrap',
          opacity: prog(frame, 12),
          scale: `${interpolate(frame, [12, 18], [0.7, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)})}`,
        }}
      >
        +28:12 THE BLOG NEVER TIMED
      </div>
      <Vignette />
    </AbsoluteFill>
  );
};

// s37 — fantasy card shatters, red X.
export const S37: React.FC = () => {
  const frame = useCurrentFrame();
  const shatter = frame >= 8;
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 30}}>
        <div
          style={{
            position: 'relative',
            ...cardBase,
            width: 700,
            border: `5px solid ${C.red}`,
            backgroundColor: '#1A1114',
            backgroundImage: `repeating-linear-gradient(-45deg, ${C.redDim} 0 18px, transparent 18px 38px)`,
            padding: '36px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            opacity: shatter ? 0.35 : 1,
            scale: `${shatter ? 1.04 : 1}`,
          }}
        >
          <div style={{fontFamily: F.display, fontSize: 56, color: C.red, letterSpacing: '0.1em'}}>FANTASY ROUTE</div>
          <div style={{fontFamily: F.mono, fontSize: 230, lineHeight: 1, color: C.red}}>15:00</div>
          {/* cracks */}
          <svg width={700} height={340} viewBox="0 0 700 340" style={{position: 'absolute', inset: 0}}>
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={['M350 0 L330 90 L390 150 L300 240 L340 340', 'M80 40 L200 120 L150 210 L260 300', 'M640 30 L540 110 L600 200 L480 300'][
                  i
                ]}
                fill="none"
                stroke={C.red}
                strokeWidth="5"
                strokeDasharray="600"
                strokeDashoffset={600 * (1 - interpolate(frame, [8 + i, 15 + i], [0, 1], clamp))}
              />
            ))}
          </svg>
        </div>
        {/* fragments */}
        {shatter
          ? Array.from({length: 10}).map((_, i) => {
              const p = interpolate(frame, [8, 30], [0, 1], clamp);
              const ang = random(`s37-a-${i}`) * Math.PI * 2;
              const dist = 200 + random(`s37-d-${i}`) * 520;
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: 960 + Math.cos(ang) * dist * p,
                    top: 540 + Math.sin(ang) * dist * p,
                    width: 40 + random(`s37-w-${i}`) * 70,
                    height: 34,
                    backgroundColor: C.redDim,
                    border: `2px solid ${C.red}`,
                    rotate: `${random(`s37-r-${i}`) * 400 * p}deg`,
                    opacity: 1 - p,
                  }}
                />
              );
            })
          : null}
        <div style={{position: 'relative'}}>
          <Headline size={150} color={C.red} delay={2}>
            STOP RUNNING
          </Headline>
          <Headline size={150} color={C.cream} delay={5}>
            FANTASY ROUTES
          </Headline>
          {/* big X over the ghost time */}
          {frame >= 10 ? (
            <div style={{position: 'absolute', left: '50%', top: '-46%', translate: '-50% 0', width: 620, height: 340}}>
              {[45, -45].map((r) => (
                <div
                  key={r}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 600,
                    height: 26,
                    backgroundColor: C.red,
                    rotate: `${r}deg`,
                    translate: '-50% -50%',
                    scale: `${interpolate(frame, [10, 16], [0, 1], {...clamp, easing: EASE_OUT})} 1`,
                    boxShadow: `0 0 40px ${C.redDim}`,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </Center>
      <GlitchBars count={5} seed="s37" colors={[C.red, C.redDim, C.cream]} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s38 — the verified card stands, big check draws.
export const S38: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <div
          style={{
            ...cardBase,
            border: `5px solid ${C.terra}`,
            backgroundColor: '#1A1512',
            boxShadow: `0 0 120px ${C.terraDim}`,
            padding: '44px 84px',
            display: 'flex',
            alignItems: 'center',
            gap: 54,
            scale: `${interpolate(frame, [0, 12], [0.7, 1.12], {...clamp, easing: EASE_OUT})}`,
          }}
        >
          <div style={{width: 190, height: 190}}>
            <CheckIcon size={190} color={C.green} draw={interpolate(frame, [6, 20], [0, 1], {...clamp, easing: EASE_OUT})} />
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            <div style={{fontFamily: F.display, fontSize: 64, color: C.terra, letterSpacing: '0.08em'}}>VERIFIED ROUTE</div>
            <div style={{fontFamily: F.mono, fontSize: 220, lineHeight: 1, color: C.terra}}>43:12</div>
            <div style={{fontFamily: F.ui, fontSize: 36, color: C.cream, letterSpacing: '0.14em'}}>
              43:12. EVERY TIME YOU COOK.
            </div>
          </div>
        </div>
        <Headline size={170} color={C.green} delay={10}>
          RUN REAL ONES
        </Headline>
      </Center>
      <AbsoluteFill style={{backgroundColor: C.green, opacity: interpolate(frame, [0, 20], [0.12, 0.03], clamp)}} />
      <Vignette />
    </AbsoluteFill>
  );
};

// ------------------------- ACT 6 — end card -------------------------

const Logo: React.FC<{size?: number; delay?: number}> = ({size = 300, delay = 0}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{display: 'flex', alignItems: 'baseline', gap: 4}}>
      <span
        style={{
          fontFamily: F.display,
          fontSize: size,
          lineHeight: 0.9,
          color: C.cream,
          letterSpacing: '0.01em',
          opacity: interpolate(frame, [delay, delay + 6], [0, 1], clamp),
          translate: `0 ${interpolate(frame, [delay, delay + 8], [40, 0], {...clamp, easing: EASE_OUT})}px`,
        }}
      >
        Recipe
      </span>
      <span
        style={{
          fontFamily: F.display,
          fontSize: size,
          lineHeight: 0.9,
          color: C.terra,
          textShadow: `0 0 70px ${C.terraDim}`,
          opacity: interpolate(frame, [delay + 2, delay + 8], [0, 1], clamp),
          translate: `0 ${interpolate(frame, [delay + 2, delay + 10], [40, 0], {...clamp, easing: EASE_OUT})}px`,
        }}
      >
        Real
      </span>
    </div>
  );
};

const StoreBadge: React.FC<{label: string; delay: number; play?: boolean}> = ({label, delay, play}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        border: `2px solid ${C.faint}`,
        borderRadius: 14,
        padding: '16px 34px',
        opacity: interpolate(frame, [delay, delay + 6], [0, 1], clamp),
        translate: `0 ${interpolate(frame, [delay, delay + 8], [30, 0], {...clamp, easing: EASE_OUT})}px`,
      }}
    >
      {play ? (
        <svg width={44} height={44} viewBox="0 0 24 24">
          <path d="M6 4 L20 12 L6 20 Z" fill={C.cream} />
        </svg>
      ) : (
        <svg width={44} height={44} viewBox="0 0 24 24" fill="none">
          <rect x="7" y="2.5" width="10" height="19" rx="2.5" stroke={C.cream} strokeWidth="1.8" />
          <path d="M10.5 5.5 L13.5 5.5" stroke={C.cream} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
      <span style={{fontFamily: F.ui, fontWeight: 500, fontSize: 40, color: C.cream}}>{label}</span>
    </div>
  );
};

// s39 — logo reveal + tagline.
export const S39: React.FC = () => {
  const frame = useCurrentFrame();
  const tagline = 'Any% cook. Honest times.';
  const chars = Math.floor(interpolate(frame, [8, 26], [0, tagline.length], clamp));
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 26}}>
        <Logo size={310} delay={0} />
        <div
          style={{
            width: 900,
            height: 5,
            backgroundColor: C.terra,
            scale: `${interpolate(frame, [4, 16], [0, 1], {...clamp, easing: EASE_OUT})} 1`,
          }}
        />
        <div style={{fontFamily: F.ui, fontWeight: 500, fontSize: 64, color: C.cream2, letterSpacing: '0.04em'}}>
          {tagline.slice(0, chars)}
          <span style={{opacity: frame % 12 < 6 ? 1 : 0, color: C.terra}}>|</span>
        </div>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 34,
            color: C.green,
            border: `2px solid ${C.greenDim}`,
            borderRadius: 10,
            padding: '10px 28px',
            opacity: prog(frame, 20),
          }}
        >
          VERIFIED BY 10,000 RUNNERS
        </div>
      </Center>
      <Confetti seed="s39" count={30} power={0.45} delay={4} />
      <Scanlines opacity={0.08} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s40 — CTA + store badges.
export const S40: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + 0.02 * Math.sin(frame / 4);
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <Logo size={190} delay={0} />
        <div
          style={{
            fontFamily: F.display,
            fontSize: 110,
            color: '#101418',
            backgroundColor: C.terra,
            padding: '22px 90px',
            borderRadius: 18,
            letterSpacing: '0.06em',
            scale: `${interpolate(frame, [4, 12], [0.4, 1], {...clamp, easing: Easing.bezier(0.34, 1.56, 0.64, 1)}) * pulse}`,
            boxShadow: `0 0 90px ${C.terraDim}`,
            opacity: interpolate(frame, [4, 8], [0, 1], clamp),
          }}
        >
          DOWNLOAD FREE
        </div>
        <div style={{display: 'flex', gap: 28}}>
          <StoreBadge label="App Store" delay={10} />
          <StoreBadge label="Google Play" delay={13} play />
        </div>
        <div style={{fontFamily: F.mono, fontSize: 36, color: C.cream2, opacity: prog(frame, 18)}}>
          honest timers included · offline recipes too
        </div>
      </Center>
      <Scanlines opacity={0.08} />
      <Vignette />
    </AbsoluteFill>
  );
};

// s41 — final hold: pulse ring, verified badge.
export const S41: React.FC = () => {
  const frame = useCurrentFrame();
  const ringPhase = (frame % 36) / 36;
  return (
    <AbsoluteFill style={{backgroundColor: C.base}}>
      <Center style={{gap: 40}}>
        <div style={{position: 'relative'}}>
          <Logo size={210} delay={0} />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              translate: '-50% -50%',
              width: 900,
              height: 340,
              borderRadius: 28,
              border: `3px solid ${C.terra}`,
              opacity: (1 - ringPhase) * 0.7,
              scale: `${0.8 + ringPhase * 0.5}`,
            }}
          />
        </div>
        <div style={{fontFamily: F.mono, fontSize: 44, color: C.cream2, letterSpacing: '0.08em'}}>
          Any% cook. Honest times.
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 84,
            color: '#101418',
            backgroundColor: C.terra,
            padding: '12px 60px',
            borderRadius: 14,
            letterSpacing: '0.06em',
          }}
        >
          DOWNLOAD FREE
        </div>
      </Center>
      <div
        style={{
          position: 'absolute',
          right: SAFE,
          bottom: SAFE - 20,
          fontFamily: F.mono,
          fontSize: 34,
          color: C.terra,
          border: `2px solid ${C.terraDim}`,
          borderRadius: 10,
          padding: '8px 22px',
        }}
      >
        43:12 — VERIFIED
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${(frame * 2) % 100}%`,
          height: 120,
          background: `linear-gradient(transparent, ${C.fainter}, transparent)`,
        }}
      />
      <Scanlines opacity={0.1} />
      <Vignette />
    </AbsoluteFill>
  );
};
