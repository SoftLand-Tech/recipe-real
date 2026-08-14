// RecipeReal — "Cook Mode Walkthrough" product demo.
// 50s (1500 frames) @ 30fps, 1080×1920, light kitchen palette.
import type {FC, ReactNode} from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {at, brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {
  CLAMP,
  EASE_OUT,
  EASE_OVERSHOOT,
  IconClock,
  IconEye,
  IconPhoneSaved,
  Pill,
  fadeIO,
} from './bits';
import {DING_FRAMES, TAP_FRAME, PhoneStage} from './phone';

// ---------------------------------------------------------------------------
// Background — ember dark → warm kitchen light, carried by the reveal
// ---------------------------------------------------------------------------
const Background: FC = () => {
  const frame = useCurrentFrame();
  const bg = interpolateColors(
    frame,
    [90, 138],
    [brand.darkCanvas, brand.canvas],
  );
  const ember = interpolate(frame, [0, 90, 126], [1, 1, 0], CLAMP);
  const warm = interpolate(frame, [110, 150], [0, 1], CLAMP);
  return (
    <>
      <AbsoluteFill style={{backgroundColor: bg}} />
      {/* hook: embers behind the phone */}
      <AbsoluteFill
        style={{
          opacity: ember,
          background:
            'radial-gradient(85% 55% at 50% 88%, rgba(178, 58, 46, 0.34) 0%, rgba(23, 19, 16, 0) 70%)',
        }}
      />
      {/* light mode: soft warm kitchen glow */}
      <AbsoluteFill
        style={{
          opacity: warm,
          background: `radial-gradient(90% 50% at 50% -8%, ${brand.amberSoft} 0%, rgba(251, 248, 243, 0) 62%)`,
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Top captions — one per beat, each in its own Sequence
// ---------------------------------------------------------------------------
const CaptionHost: FC<{children: ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      top: 96,
      left: 0,
      right: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
    }}
  >
    {children}
  </div>
);

/** Entrance wrapper — reads its own (Sequence-local) frame. */
const CaptionIn: FC<{children: ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [0, 12], [0, 1], {...CLAMP, easing: EASE_OUT});
  return (
    <div
      style={{
        opacity: v,
        translate: `0px ${(1 - v) * 18}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}
    >
      {children}
    </div>
  );
};

const HookCaption: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{opacity: fadeIO(frame, 87, 10, 16)}}>
      <CaptionIn>
        <div
          style={{
            padding: '12px 26px',
            borderRadius: 999,
            border: '2px solid rgba(217, 107, 92, 0.6)',
            backgroundColor: 'rgba(178, 58, 46, 0.2)',
            color: brand.dangerBright,
            fontFamily: inter,
            fontSize: 25,
            fontWeight: 700,
            letterSpacing: 2.5,
          }}
        >
          STEP 4 JUST SAYS “COOK”
        </div>
        <div
          style={{
            fontFamily: anton,
            fontSize: 96,
            lineHeight: 1.02,
            color: brand.cream,
          }}
        >
          Your dinner
          <br />
          is on fire.
        </div>
      </CaptionIn>
    </div>
  );
};

const CookModeCaption: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{opacity: fadeIO(frame, 102, 10, 16)}}>
      <CaptionIn>
        <div
          style={{
            fontFamily: inter,
            fontSize: 27,
            fontWeight: 800,
            letterSpacing: 9,
            color: brand.accent,
          }}
        >
          RECIPEREAL
        </div>
        <div
          style={{fontFamily: anton, fontSize: 112, lineHeight: 1, color: brand.ink}}
        >
          Cook Mode.
        </div>
      </CaptionIn>
    </div>
  );
};

const TapCaption: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: fadeIO(frame, 96, 8, 14),
        fontFamily: inter,
        fontSize: 66,
        fontWeight: 800,
        color: brand.ink,
      }}
    >
      Tap start.
    </div>
  );
};

const TimelineCaption: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: fadeIO(frame, 138, 10, 16),
        fontFamily: inter,
        fontSize: 58,
        fontWeight: 800,
        color: brand.ink,
      }}
    >
      Your recipe, as a timeline.
    </div>
  );
};

const RealTimesCaption: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: fadeIO(frame, 132, 10, 16),
        fontFamily: inter,
        fontSize: 58,
        fontWeight: 800,
        color: brand.ink,
      }}
    >
      Real times from real cooks.
    </div>
  );
};

const NoSignalCaption: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        opacity: fadeIO(frame, 132, 10, 16),
        fontFamily: inter,
        fontSize: 58,
        fontWeight: 800,
        color: brand.ink,
      }}
    >
      No signal? No problem.
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bottom pills (fade against their own Sequence-local frame)
// ---------------------------------------------------------------------------
const BottomPillHost: FC<{children: ReactNode}> = ({children}) => (
  <div
    style={{
      position: 'absolute',
      top: 1668,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'center',
    }}
  >
    {children}
  </div>
);

const FadePill: FC<{duration: number; icon: ReactNode; children: ReactNode}> = ({
  duration,
  icon,
  children,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{opacity: fadeIO(frame, duration, 8, 12)}}>
      <Pill
        bg={brand.surface}
        color={brand.ink}
        border={brand.hairlineStrong}
        icon={icon}
      >
        {children}
      </Pill>
    </div>
  );
};

// ---------------------------------------------------------------------------
// End card — "Zero fires." + wordmark + store badges
// ---------------------------------------------------------------------------
const StoreBadge: FC<{label: string; eyebrow: string; delay: number}> = ({
  label,
  eyebrow,
  delay,
}) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [delay, delay + 18], [0, 1], {
    ...CLAMP,
    easing: EASE_OVERSHOOT,
  });
  return (
    <div
      style={{
        width: 336,
        height: 98,
        borderRadius: 22,
        backgroundColor: brand.ink,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        scale: `${pop}`,
        opacity: Math.min(1, pop * 1.6),
      }}
    >
      <span
        style={{
          fontFamily: inter,
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: 2.6,
          color: brand.creamSecondary,
        }}
      >
        {eyebrow}
      </span>
      <span
        style={{
          fontFamily: inter,
          fontSize: 31,
          fontWeight: 700,
          color: '#FFFFFF',
        }}
      >
        {label}
      </span>
    </div>
  );
};

const EndCard: FC = () => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [0, 22], [0, 1], {...CLAMP, easing: EASE_OUT});
  const eyebrowIn = interpolate(frame, [6, 18], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const titleIn = interpolate(frame, [12, 30], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  const wordIn = interpolate(frame, [28, 44], [0, 1], {
    ...CLAMP,
    easing: EASE_OUT,
  });
  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.canvas,
        opacity: v,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(80% 46% at 50% 38%, ${brand.amberSoft} 0%, rgba(251, 248, 243, 0) 68%)`,
        }}
      />
      <div
        style={{
          fontFamily: inter,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: 8,
          color: brand.inkSecondary,
          opacity: eyebrowIn,
          translate: `0px ${(1 - eyebrowIn) * 14}px`,
        }}
      >
        SIX STEPS · FORTY MINUTES
      </div>
      <div
        style={{
          marginTop: 26,
          fontFamily: anton,
          fontSize: 172,
          lineHeight: 1,
          color: brand.ink,
          opacity: titleIn,
          translate: `0px ${(1 - titleIn) * 40}px`,
        }}
      >
        Zero fires<span style={{color: brand.accent}}>.</span>
      </div>
      <div
        style={{
          marginTop: 44,
          fontFamily: inter,
          fontSize: 64,
          fontWeight: 800,
          color: brand.ink,
          opacity: wordIn,
        }}
      >
        Recipe<span style={{color: brand.accent}}>Real</span>
      </div>
      <div style={{marginTop: 56, display: 'flex', gap: 24}}>
        <StoreBadge label="App Store" eyebrow="DOWNLOAD ON THE" delay={38} />
        <StoreBadge label="Google Play" eyebrow="GET IT ON" delay={48} />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------
const CookModeDemo: FC = () => {
  return (
    <AbsoluteFill style={{fontFamily: inter}}>
      <Background />
      <PhoneStage />

      {/* ---------------- top captions ---------------- */}
      <Sequence from={9} durationInFrames={87} layout="none">
        <CaptionHost>
          <HookCaption />
        </CaptionHost>
      </Sequence>
      <Sequence from={102} durationInFrames={102} layout="none">
        <CaptionHost>
          <CookModeCaption />
        </CaptionHost>
      </Sequence>
      <Sequence from={210} durationInFrames={96} layout="none">
        <CaptionHost>
          <TapCaption />
        </CaptionHost>
      </Sequence>
      <Sequence from={312} durationInFrames={138} layout="none">
        <CaptionHost>
          <TimelineCaption />
        </CaptionHost>
      </Sequence>
      <Sequence from={456} durationInFrames={132} layout="none">
        <CaptionHost>
          <RealTimesCaption />
        </CaptionHost>
      </Sequence>
      <Sequence from={1230} durationInFrames={132} layout="none">
        <CaptionHost>
          <NoSignalCaption />
        </CaptionHost>
      </Sequence>

      {/* ---------------- bottom pills ---------------- */}
      <Sequence from={558} durationInFrames={132} layout="none">
        <BottomPillHost>
          <FadePill duration={132} icon={<IconClock size={32} color={brand.accent} />}>
            Timers start themselves
          </FadePill>
        </BottomPillHost>
      </Sequence>
      <Sequence from={690} durationInFrames={114} layout="none">
        <BottomPillHost>
          <FadePill duration={114} icon={<IconEye size={32} color={brand.amber} />}>
            Your screen stays awake
          </FadePill>
        </BottomPillHost>
      </Sequence>
      <Sequence from={1296} durationInFrames={84} layout="none">
        <BottomPillHost>
          <FadePill
            duration={84}
            icon={<IconPhoneSaved size={32} color={brand.success} />}
          >
            Recipes live on your phone
          </FadePill>
        </BottomPillHost>
      </Sequence>

      {/* ---------------- end card ---------------- */}
      <Sequence from={at(46)} durationInFrames={120}>
        <EndCard />
      </Sequence>

      {/* ---------------- audio ---------------- */}
      {/* narration — calm, ~140 wpm (0.9× playback of a 29s read) */}
      <Sequence from={0}>
        <Audio
          src={staticFile('audio/v2/narration.mp3')}
          playbackRate={0.9}
          volume={(f: number) =>
            interpolate(f, [0, 6], [0, 0.71], {extrapolateRight: 'clamp'})
          }
        />
      </Sequence>
      {/* hook: fire + smoke alarm */}
      <Sequence from={at(0.1)}>
        <Audio src={staticFile('audio/v2/sfx-fire.mp3')} volume={0.35} />
      </Sequence>
      <Sequence from={at(1.4)}>
        <Audio src={staticFile('audio/v2/sfx-alarm.mp3')} volume={0.3} />
      </Sequence>
      <Sequence from={at(2.3)}>
        <Audio src={staticFile('audio/v2/sfx-alarm.mp3')} volume={0.3} />
      </Sequence>
      {/* relief chime on the reveal */}
      <Sequence from={at(3.05)}>
        <Audio src={staticFile('audio/v2/sfx-relief.mp3')} volume={0.3} />
      </Sequence>
      {/* crisp tap on "Start Cook Mode" */}
      <Sequence from={TAP_FRAME - 1}>
        <Audio src={staticFile('audio/v2/sfx-tap.mp3')} volume={0.3} />
      </Sequence>
      {/* step-complete ding-dong chimes (reused per step) */}
      {DING_FRAMES.map((d) => (
        <Sequence key={d} from={d}>
          <Audio src={staticFile('audio/v2/sfx-ding.mp3')} volume={0.26} />
        </Sequence>
      ))}
      {/* soft success chime with the self-drawing check */}
      <Sequence from={1294}>
        <Audio src={staticFile('audio/v2/sfx-success.mp3')} volume={0.3} />
      </Sequence>
    </AbsoluteFill>
  );
};

export default CookModeDemo;
