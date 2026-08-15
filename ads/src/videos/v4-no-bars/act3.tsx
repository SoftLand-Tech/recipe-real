// ACT 3 · CLOUD APP GAG — gray CloudRecipe buffers forever; RecipeReal snaps in.
import {FC} from 'react';
import {Easing, interpolate, useCurrentFrame} from 'remotion';
import {
  CREAM,
  CREAM_DIM,
  CloudIcon,
  CrossedCloudIcon,
  FONT_DISPLAY,
  FONT_UI,
  HandNote,
  Kicker,
  PhoneShell,
  Pot,
  SAFE,
  SceneBg,
  SpinnerRing,
  Steam,
  SweatDrop,
  TERRA,
  Vignette,
  clampIn,
  easeOut,
  easeOvershoot,
} from './ui';
import {KitchenBg} from './backdrops';

const GRAY_TEXT = '#9AA0A6';
const GRAY_LINE = 'rgba(154,160,166,0.25)';

/** Generic gray competitor phone content. */
const CloudRecipeApp: FC<{buffering: boolean; percent: boolean}> = ({buffering, percent}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', top: 96, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30, padding: '30px 34px'}}>
      <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 42, color: GRAY_TEXT, letterSpacing: 1}}>CloudRecipe</div>
      <div style={{height: 2, width: '100%', backgroundColor: GRAY_LINE}} />
      {buffering ? (
        <>
          <SpinnerRing size={150} color={GRAY_TEXT} />
          <div style={{fontFamily: FONT_UI, fontSize: 27, color: GRAY_TEXT}}>Buffering… step 2 of 14</div>
          {percent && (
            <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 64, color: GRAY_TEXT, fontVariantNumeric: 'tabular-nums'}}>
              {frame % 12 < 2 ? '1' : '0'}%
            </div>
          )}
          {!percent && <div style={{fontFamily: FONT_UI, fontSize: 24, color: GRAY_TEXT, opacity: 0.7}}>fetching from the cloud…</div>}
        </>
      ) : (
        <>
          <div style={{display: 'flex', gap: 14, width: '100%'}}>
            {[0, 1, 2].map((r) => (
              <div key={r} style={{flex: 1, height: 12, borderRadius: 6, backgroundColor: GRAY_LINE}} />
            ))}
          </div>
          <div style={{width: '100%', height: 150, borderRadius: 16, backgroundColor: GRAY_LINE}} />
          <div style={{width: '86%', height: 12, borderRadius: 6, backgroundColor: GRAY_LINE}} />
          <div style={{width: '70%', height: 12, borderRadius: 6, backgroundColor: GRAY_LINE}} />
          <div style={{width: '92%', height: 12, borderRadius: 6, backgroundColor: GRAY_LINE}} />
        </>
      )}
    </div>
  );
};

/* s15 — MEANWHILE: a cloud recipe app. */
export const S15: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#101010'}} />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, rgba(154,160,166,0.08) 0%, rgba(0,0,0,0) 60%)'}} />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 120,
          translate: `${interpolate(frame, [0, 12], [640, 0], {...clampIn, easing: easeOut})}px -50%`,
        }}
      >
        <PhoneShell width={440} gray>
          <CloudRecipeApp buffering percent={false} />
        </PhoneShell>
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="MEANWHILE, IN THE CLOUD" />
      </div>
      <div
        style={{
          position: 'absolute',
          right: SAFE,
          bottom: 160,
          fontFamily: FONT_DISPLAY,
          fontSize: 120,
          color: '#3A3F44',
          letterSpacing: 4,
          opacity: interpolate(frame, [8, 16], [0, 1], clampIn),
        }}
      >
        CLOUD RECIPE APP
      </div>
      <Vignette />
    </>
  );
};

/* s16 — buffering, spinner wobbles, sweat drop. */
export const S16: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#101010'}} />
      <div style={{position: 'absolute', left: 300, top: 90, scale: `${interpolate(frame, [0, 10], [1, 1.18], clampIn)}`, transformOrigin: '300px 480px'}}>
        <PhoneShell width={440} gray>
          <div style={{position: 'absolute', top: 96, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
            <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 40, color: GRAY_TEXT}}>CloudRecipe</div>
            <SpinnerRing size={190} color={GRAY_TEXT} wobble={Math.min(18, frame * 0.7)} />
            <div style={{fontFamily: FONT_UI, fontSize: 30, color: GRAY_TEXT}}>Buffering… step 2 of 14</div>
            <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 88, color: GRAY_TEXT, fontVariantNumeric: 'tabular-nums'}}>
              {frame % 14 < 2 ? '1' : '0'}%
            </div>
          </div>
        </PhoneShell>
      </div>
      <SweatDrop x={648} y={250} />
      <div style={{position: 'absolute', right: SAFE, top: 300, maxWidth: 700, textAlign: 'left'}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 170, color: '#4A5055', lineHeight: 0.95}}>BUFFERING</div>
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 40, color: GRAY_TEXT, letterSpacing: 6, marginTop: 18}}>
          0% · OF STEP 2 OF 14
        </div>
      </div>
      <HandNote text="it's thinking" x={1330} y={830} rotate={-4} size={62} />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="CONNECTED APPS NEED… CONNECTION" />
      </div>
      <Vignette />
    </>
  );
};

/* s17 — spinner strains, stalls mid-turn. */
export const S17: FC = () => {
  const frame = useCurrentFrame();
  const stallTilt = interpolate(frame, [20, 30], [0, 16], {...clampIn, easing: Easing.bezier(0.5, 1.6, 0.5, 1)});
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#101010'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 170, display: 'flex', justifyContent: 'center'}}>
        <div style={{rotate: `${stallTilt}deg`}}>
          <SpinnerRing size={330} color={GRAY_TEXT} stallAt={22} wobble={Math.max(0, 10 - frame * 0.4)} />
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 620, textAlign: 'center'}}>
        <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 90, color: GRAY_TEXT, fontVariantNumeric: 'tabular-nums'}}>
          {frame % 16 < 2 ? '1' : '0'}%
        </div>
        <div style={{fontFamily: FONT_UI, fontSize: 34, color: GRAY_TEXT, letterSpacing: 4, marginTop: 14}}>STILL THINKING…</div>
      </div>
      <SweatDrop x={1210} y={240} />
      <SweatDrop x={740} y={300} />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="ANY MINUTE NOW" />
      </div>
      <Vignette />
    </>
  );
};

/* s18 — spinner gives up: error cloud with rain. */
export const S18: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#101010'}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 200,
          display: 'flex',
          justifyContent: 'center',
          rotate: `${interpolate(frame, [0, 14], [0, 3], clampIn)}deg`,
          opacity: interpolate(frame, [10, 20], [1, 0.55], clampIn),
        }}
      >
        <CloudIcon size={340} color={GRAY_TEXT} rain />
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: 600, textAlign: 'center'}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 190, color: '#4A5055', lineHeight: 0.95}}>NO CONNECTION</div>
        <div style={{fontFamily: FONT_UI, fontWeight: 500, fontSize: 38, color: GRAY_TEXT, letterSpacing: 6, marginTop: 16}}>
          THE CLOUD CAN&apos;T HELP DOWN HERE
        </div>
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="GIVE UP, LITTLE CLOUD" />
      </div>
      <Vignette />
    </>
  );
};

/* s19 — RecipeReal snaps in instantly. */
export const S19: FC = () => {
  const frame = useCurrentFrame();
  const snap = interpolate(frame, [0, 7], [0, 1], {...clampIn, easing: easeOvershoot});
  const flash = interpolate(frame, [0, 4, 14], [0, 0.85, 0], clampIn);
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', inset: 0, backgroundColor: TERRA, opacity: flash * 0.25}} />
      <div style={{position: 'absolute', left: '50%', top: 110, translate: '-50% 0', scale: `${interpolate(snap, [0, 1], [1.14, 1])}`}}>
        <PhoneShell width={430}>
          <div style={{position: 'absolute', top: 92, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24}}>
            <div style={{fontFamily: FONT_DISPLAY, fontSize: 54, letterSpacing: 2}}>
              <span style={{color: CREAM}}>Recipe</span>
              <span style={{color: TERRA}}>Real</span>
            </div>
            <div style={{height: 2, width: '82%', backgroundColor: 'rgba(243,237,230,0.14)'}} />
            <div
              style={{
                width: '84%',
                backgroundColor: 'rgba(44,37,29,0.9)',
                border: `2px solid ${TERRA}`,
                borderRadius: 18,
                padding: '22px 26px',
                opacity: interpolate(frame, [4, 9], [0, 1], clampIn),
              }}
            >
              <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: TERRA}}>STEP 2 · 6:00</div>
              <div style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 38, color: CREAM, marginTop: 6}}>Brown the chicken</div>
              <div style={{fontFamily: FONT_UI, fontSize: 24, color: CREAM_DIM, marginTop: 10, lineHeight: 1.4}}>
                Skin side down. Don&apos;t move it. Timer&apos;s running.
              </div>
            </div>
            <div style={{display: 'flex', gap: 12, opacity: interpolate(frame, [8, 14], [0, 1], clampIn)}}>
              {[0, 1, 2, 3].map((r) => (
                <div key={r} style={{width: 10, height: 10, borderRadius: 999, backgroundColor: r < 2 ? TERRA : 'rgba(243,237,230,0.2)' }} />
              ))}
            </div>
          </div>
        </PhoneShell>
      </div>
      <div style={{position: 'absolute', right: SAFE, top: 320, textAlign: 'right'}}>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 190, color: CREAM, lineHeight: 0.92}}>LOADED</div>
        <div style={{fontFamily: FONT_DISPLAY, fontSize: 190, color: TERRA, lineHeight: 0.92}}>INSTANTLY</div>
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="NO INTERNET REQUIRED" color={TERRA} />
      </div>
      <Vignette />
    </>
  );
};

/* s20 — every step already on the phone; checks cascade. */
export const S20: FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <SceneBg loc="base" />
      <div style={{position: 'absolute', left: 130, top: 170}}>
        <StepListBig />
      </div>
      <div style={{position: 'absolute', right: 150, top: 150, scale: `${interpolate(frame, [0, 9], [1.1, 1], {...clampIn, easing: easeOut})}`, opacity: interpolate(frame, [0, 6], [0, 1], clampIn)}}>
        <PhoneShell width={340} />
      </div>
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="EVERY STEP · ALREADY LOADED" color={TERRA} />
      </div>
      <Vignette />
    </>
  );
};

const StepListBig: FC = () => {
  const frame = useCurrentFrame();
  const steps = [
    {label: 'Prep the vegetables', minutes: '6:00'},
    {label: 'Brown the chicken', minutes: '6:00'},
    {label: 'Simmer the sauce', minutes: '8:00'},
    {label: 'Rest the meat', minutes: '5:00'},
    {label: 'Season to taste', minutes: '1:00'},
    {label: 'Plate and serve', minutes: '2:00'},
  ];
  const rows = steps.map((s, i) => {
    const at = 2 + i * 3;
    const pop = interpolate(frame, [at, at + 5], [0, 1], {
      ...clampIn,
      easing: Easing.bezier(0.34, 1.5, 0.64, 1),
    });
    const inRow = interpolate(frame, [at - 2, at], [30, 0], {...clampIn, easing: easeOut});
    return (
      <div key={s.label} style={{display: 'flex', alignItems: 'center', gap: 24, translate: `0px ${inRow}px`}}>
        <svg width={40} height={40} viewBox="0 0 30 30" style={{scale: `${pop}`, flexShrink: 0}}>
          <circle cx="15" cy="15" r="13" fill={TERRA} stroke={TERRA} strokeWidth="2.5" />
          <path d="M 8 12 L 13 17 L 22 7" fill="none" stroke="#171310" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 44, color: CREAM, width: 560}}>{s.label}</span>
        <span style={{fontFamily: FONT_UI, fontWeight: 700, fontSize: 38, color: CREAM_DIM, fontVariantNumeric: 'tabular-nums'}}>{s.minutes}</span>
      </div>
    );
  });
  return (
    <div>
      <div style={{fontFamily: FONT_DISPLAY, fontSize: 110, color: CREAM, marginBottom: 30}}>ON THE PHONE. ALL OF IT.</div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 22}}>{rows}</div>
    </div>
  );
};

/* s21 — WORKS OFFLINE badge stamps in. */
export const S21: FC = () => {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame, [2, 9], [1.5, 1], {...clampIn, easing: Easing.bezier(0.2, 1.4, 0.4, 1)});
  return (
    <>
      <SceneBg loc="base" />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 380,
          translate: '-50% -50%',
          opacity: interpolate(frame, [0, 12], [0.6, 0.12], clampIn),
          scale: `${interpolate(frame, [0, 14], [1.4, 1.1], clampIn)}`,
        }}
      >
        <CrossedCloudIcon size={520} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 380,
          translate: '-50% -50%',
          rotate: `${interpolate(frame, [2, 9], [-7, -2], clampIn)}deg`,
          scale: `${stamp}`,
        }}
      >
        <div
          style={{
            border: `10px solid ${TERRA}`,
            padding: '28px 60px 34px',
            boxShadow: `0 0 90px rgba(217,110,63,0.35)`,
            backgroundColor: 'rgba(23,19,16,0.85)',
          }}
        >
          <div style={{fontFamily: FONT_DISPLAY, fontSize: 190, color: CREAM, letterSpacing: 8, whiteSpace: 'nowrap'}}>WORKS OFFLINE</div>
        </div>
      </div>
      <HandNote text="no cloud required" x={1220} y={700} rotate={-5} size={64} />
      <div style={{position: 'absolute', left: SAFE, bottom: SAFE}}>
        <Kicker text="OFFLINE-FIRST, BY DESIGN" />
      </div>
      <Vignette />
    </>
  );
};

/* s22 — back to dinner: lid lifts, steam burst. */
export const S22: FC = () => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [0, 14], [0, 90], {...clampIn, easing: easeOut});
  return (
    <>
      <KitchenBg />
      <div style={{position: 'absolute', left: '50%', top: 420, translate: '-50% 0'}}>
        <Pot size={420} lidLift={lift} bubbles />
        <Steam x={140} y={40 - lift} scale={1.7} spread={1.5} />
        <Steam x={330} y={40 - lift} scale={1.3} spread={1.2} />
      </div>
      <div style={{position: 'absolute', left: SAFE, top: SAFE}}>
        <Kicker text="BACK TO DINNER" color={TERRA} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: SAFE,
          bottom: SAFE,
          fontFamily: FONT_UI,
          fontWeight: 700,
          fontSize: 36,
          letterSpacing: 4,
          color: CREAM_DIM,
        }}
      >
        TIMER RUNNING · STEP 6 SOON
      </div>
      <Vignette />
    </>
  );
};
