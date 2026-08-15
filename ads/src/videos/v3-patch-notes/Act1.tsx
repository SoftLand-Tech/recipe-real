// ACT 1 · the crash — dinner.exe stops responding.
import {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {C, Caret, CLAMP, Cursor, DesktopBg, EASE_IO, EASE_OUT, F, Panel, POP, Scanlines, TypeText, prog, shake} from './ui';

/* s01 (42f) — crash dialog slams in */
export const S01: FC = () => {
  const frame = useCurrentFrame();
  const enter = prog(frame, 0, 9, EASE_OUT);
  return (
    <AbsoluteFill>
      <DesktopBg />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 860,
            backgroundColor: C.dialog,
            borderRadius: 12,
            border: '2px solid #9AA1AA',
            boxShadow: '12px 14px 0 rgba(0,0,0,0.5)',
            overflow: 'hidden',
            scale: interpolate(enter, [0, 1], [1.35, 1]),
            rotate: `${interpolate(frame, [0, 12], [5, 0], {...CLAMP, easing: EASE_OUT})}deg`,
            translate: shake(frame, 6, 12, 12),
            opacity: interpolate(frame, [0, 2], [0, 1], CLAMP),
          }}
        >
          <div
            style={{
              height: 64,
              background: `linear-gradient(180deg, ${C.dialogBar}, #A8AFB8)`,
              borderBottom: '1px solid #8F979F',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 22,
              fontFamily: F.mono,
              fontSize: 27,
              color: '#2B2F36',
            }}
          >
            dinner.exe — not responding
            <div style={{flex: 1}} />
            <div
              style={{
                width: 40,
                height: 40,
                marginRight: 12,
                borderRadius: 6,
                backgroundColor: C.red,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontFamily: F.base,
                fontWeight: 700,
              }}
            >
              ✕
            </div>
          </div>
          <div style={{padding: '44px 48px 40px', display: 'flex', gap: 34, alignItems: 'flex-start'}}>
            <svg width="92" height="82" viewBox="0 0 92 82" style={{flexShrink: 0, marginTop: 4}}>
              <path
                d="M46 6 L86 74 L6 74 Z"
                fill="#E0A447"
                stroke="#8A5B10"
                strokeWidth="4"
                strokeLinejoin="round"
              />
              <rect x="42" y="30" width="8" height="24" rx="3" fill="#241D17" />
              <circle cx="46" cy="63" r="5" fill="#241D17" />
            </svg>
            <div>
              <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 46, color: C.ink, lineHeight: 1.15}}>
                dinner.exe has stopped responding
              </div>
              <div style={{fontFamily: F.mono, fontSize: 29, color: '#4A5158', marginTop: 18, lineHeight: 1.35}}>
                recipe_v1 (blog) is not responding.
                <br />
                expected: 15:00 · elapsed: 43:00 and counting
              </div>
            </div>
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '0 44px 38px'}}>
            <div
              style={{
                fontFamily: F.base,
                fontWeight: 600,
                fontSize: 32,
                color: '#3A4048',
                border: '2px solid #9AA1AA',
                borderRadius: 8,
                padding: '10px 34px',
                backgroundColor: '#ECEEF0',
              }}
            >
              Wait
            </div>
            <div
              style={{
                fontFamily: F.base,
                fontWeight: 700,
                fontSize: 32,
                color: '#FFF6F2',
                border: '3px solid #A4471F',
                borderRadius: 8,
                padding: '10px 34px',
                backgroundColor: C.terra,
                boxShadow: '4px 5px 0 rgba(0,0,0,0.25)',
              }}
            >
              Force quit
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s02 (20f) — SFX-only: force quit click */
export const S02: FC = () => {
  const frame = useCurrentFrame();
  const cursorP = prog(frame, 0, 11, EASE_OUT);
    const out = interpolate(frame, [14, 19], [1, 0], {...CLAMP, easing: EASE_IO});
  return (
    <AbsoluteFill>
      <DesktopBg />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            width: 860,
            backgroundColor: C.dialog,
            borderRadius: 12,
            border: '2px solid #9AA1AA',
            boxShadow: '12px 14px 0 rgba(0,0,0,0.5)',
            overflow: 'hidden',
            opacity: out,
            scale: interpolate(out, [0, 1], [0.88, 1]),
            rotate: `${interpolate(out, [0, 1], [3, 0])}deg`,
          }}
        >
          <div
            style={{
              height: 64,
              background: `linear-gradient(180deg, ${C.dialogBar}, #A8AFB8)`,
              display: 'flex',
              alignItems: 'center',
              paddingLeft: 22,
              fontFamily: F.mono,
              fontSize: 27,
              color: '#2B2F36',
            }}
          >
            dinner.exe — not responding
          </div>
          <div style={{padding: '44px 48px 40px', display: 'flex', gap: 34}}>
            <svg width="92" height="82" viewBox="0 0 92 82" style={{flexShrink: 0, marginTop: 4}}>
              <path d="M46 6 L86 74 L6 74 Z" fill="#E0A447" stroke="#8A5B10" strokeWidth="4" strokeLinejoin="round" />
              <rect x="42" y="30" width="8" height="24" rx="3" fill="#241D17" />
              <circle cx="46" cy="63" r="5" fill="#241D17" />
            </svg>
            <div style={{fontFamily: F.base, fontWeight: 700, fontSize: 46, color: C.ink, lineHeight: 1.15}}>
              dinner.exe has stopped responding
            </div>
          </div>
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '0 44px 38px', position: 'relative'}}>
            <div
              style={{
                fontFamily: F.base,
                fontWeight: 600,
                fontSize: 32,
                color: '#3A4048',
                border: '2px solid #9AA1AA',
                borderRadius: 8,
                padding: '10px 34px',
                backgroundColor: '#ECEEF0',
              }}
            >
              Wait
            </div>
            <div
              style={{
                fontFamily: F.base,
                fontWeight: 700,
                fontSize: 32,
                color: '#FFF6F2',
                border: '3px solid #A4471F',
                borderRadius: 8,
                padding: '10px 34px',
                backgroundColor: C.terra,
                boxShadow: '4px 5px 0 rgba(0,0,0,0.25)',
                scale: frame >= 11 && frame < 15 ? 0.94 : 1,
              }}
            >
              Force quit
            </div>
            <Cursor
              size={46}
              style={{
                position: 'absolute',
                left: interpolate(cursorP, [0, 1], [420, 700]),
                top: interpolate(cursorP, [0, 1], [10, -6]),
                zIndex: 4,
              }}
            />
            {frame >= 11 ? (
              <div
                style={{
                  position: 'absolute',
                  left: 742,
                  top: 22,
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  border: `4px solid ${C.terra}`,
                  scale: interpolate(frame, [11, 18], [0.3, 2.2], CLAMP),
                  opacity: interpolate(frame, [11, 18], [0.9, 0], CLAMP),
                }}
              />
            ) : null}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s03 (33f) — stack trace types in */
const TRACE: {text: string; color: string; start: number; bold?: boolean}[] = [
  {text: 'Traceback (most recent dinner):', color: C.red, start: 0, bold: true},
  {text: '  at preheat (missing)', color: C.dim, start: 5},
  {text: '  at chop (claimed 4 min, took 10)', color: C.dim, start: 9},
  {text: '  at bake (oven cold — see #102)', color: C.dim, start: 13},
  {text: '  at cleanup (not implemented)', color: C.dim, start: 17},
  {text: 'FatalError: hunger at 19:42', color: C.terra, start: 22, bold: true},
];

export const S03: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Panel title="dinner — stack trace" width={1380} height={660} style={{scale: interpolate(prog(frame, 0, 7), [0, 1], [0.96, 1])}}>
          <div style={{padding: '36px 46px', display: 'flex', flexDirection: 'column', gap: 20}}>
            {TRACE.map((l, i) => (
              <TypeText
                key={i}
                text={l.text}
                start={l.start}
                cps={46}
                caret={i === TRACE.length - 1}
                caretColor={l.color}
                style={{
                  fontFamily: F.mono,
                  fontWeight: l.bold ? 700 : 400,
                  fontSize: 40,
                  color: l.color,
                  lineHeight: 1.2,
                  minHeight: 48,
                }}
              />
            ))}
          </div>
        </Panel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s04 (54f) — reported 15:00 vs actual 43:00 */
export const S04: FC = () => {
  const frame = useCurrentFrame();
  const actualP = prog(frame, 22, 30, POP);
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines opacity={0.35} />
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 44, paddingTop: 30}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 40, opacity: interpolate(frame, [0, 8], [0, 1], CLAMP)}}>
          <div style={{fontFamily: F.mono, fontSize: 38, color: C.dim}}>recipe_v1 (blog) reported:</div>
          <div style={{position: 'relative', fontFamily: F.display, fontSize: 170, lineHeight: 1, color: C.dim}}>
            15:00
            <div
              style={{
                position: 'absolute',
                left: -8,
                top: '48%',
                height: 12,
                width: interpolate(frame, [14, 21], [0, 330], CLAMP),
                backgroundColor: C.red,
                rotate: '-4deg',
                borderRadius: 6,
              }}
            />
          </div>
        </div>
        <div
          style={{
            width: 1240,
            height: 2,
            backgroundColor: C.line,
            scale: `${interpolate(frame, [8, 18], [0, 1], CLAMP)} 1`,
          }}
        />
        <div style={{display: 'flex', alignItems: 'baseline', gap: 40, translate: shake(frame, 30, 12, 9)}}>
          <div style={{fontFamily: F.mono, fontSize: 38, color: C.green}}>actual (10,406 cooks):</div>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 250,
              lineHeight: 1,
              color: C.terra,
              scale: interpolate(actualP, [0, 1], [1.45, 1]),
              textShadow: '0 0 42px rgba(217,110,63,0.35)',
            }}
          >
            43:00
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 26, marginTop: 6}}>
          <div style={{width: 320, height: 40, backgroundColor: '#2C343C', borderRadius: 6, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${interpolate(frame, [26, 38], [0, 100], CLAMP)}%`, backgroundColor: C.dim}} />
          </div>
          <div style={{width: 920, height: 40, backgroundColor: '#2C343C', borderRadius: 6, overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${interpolate(frame, [28, 42], [0, 100], CLAMP)}%`, backgroundColor: C.terra}} />
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontWeight: 700,
              fontSize: 36,
              color: C.red,
              backgroundColor: 'rgba(217,107,92,0.12)',
              border: `2px solid ${C.red}`,
              borderRadius: 8,
              padding: '4px 16px',
              opacity: interpolate(frame, [42, 46], [0, 1], CLAMP),
            }}
          >
            +28:00 of your evening
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
