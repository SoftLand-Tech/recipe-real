// ACT 2 · the bug tracker — three confirmed issues.
import {FC} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {
  C,
  CLAMP,
  Check,
  Chip,
  EASE_OUT,
  F,
  IssueCard,
  Panel,
  POP,
  Scanlines,
  SevBadge,
  Stamp,
  TypeText,
  countUp,
  prog,
  shake,
} from './ui';

/* s05 (24f) — tracker board wipes in, 3 open */
export const S05: FC = () => {
  const frame = useCurrentFrame();
  const rows = [
    {n: '#101', t: 'chopping — mislabeled timer'},
    {n: '#102', t: 'preheat — step missing'},
    {n: '#103', t: 'cleanup — not implemented'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines opacity={0.3} />
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 30}}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            translate: `0px ${interpolate(prog(frame, 0, 8), [0, 1], [-40, 0])}px`,
            opacity: interpolate(frame, [0, 6], [0, 1], CLAMP),
          }}
        >
          <div style={{fontFamily: F.mono, fontSize: 44, color: C.dim}}>recipe-repo / issues</div>
          <div
            style={{
              fontFamily: F.mono,
              fontWeight: 700,
              fontSize: 44,
              color: '#FFE8E4',
              backgroundColor: C.red,
              borderRadius: 10,
              padding: '4px 22px',
            }}
          >
            {countUp(frame, 0, 3, 4, 12)} open
          </div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.n}
            style={{
              width: 1180,
              backgroundColor: C.panel,
              border: `1px solid ${C.line}`,
              borderLeft: `10px solid ${C.red}`,
              borderRadius: 12,
              padding: '22px 34px',
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              translate: `${interpolate(prog(frame, 3 + i * 3, 11 + i * 3), [0, 1], [520, 0])}px 0px`,
              opacity: interpolate(frame, [3 + i * 3, 8 + i * 3], [0, 1], CLAMP),
            }}
          >
            <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 36, color: C.red}}>{r.n}</div>
            <div style={{fontFamily: F.base, fontWeight: 500, fontSize: 38, color: C.text}}>{r.t}</div>
            <div style={{flex: 1}} />
            <SevBadge />
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s06 (29f) — issue #101 */
export const S06: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <IssueCard
          number="#101"
          title="chopping: labeled 4 min — takes 10"
          style={{
            translate: `${interpolate(prog(frame, 0, 9), [0, 1], [420, 0])}px 0px`,
            opacity: interpolate(frame, [0, 5], [0, 1], CLAMP),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <Chip label="timing" color={C.dim} />
            <Chip label="mislabel" color={C.amber} />
            <Chip label="repro: 100%" color={C.green} />
            <div style={{flex: 1}} />
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: C.panel3,
                border: `2px solid ${C.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: F.base,
                fontWeight: 700,
                fontSize: 30,
                color: C.dim,
              }}
            >
              Y
            </div>
            <div style={{fontFamily: F.mono, fontSize: 30, color: C.dim}}>you, hungry</div>
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 32,
              color: C.dim,
              backgroundColor: '#0D1117',
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '18px 26px',
              lineHeight: 1.5,
            }}
          >
            <span style={{color: C.green}}>expected:</span> 4:00 · <span style={{color: C.red}}>actual:</span> 10:00
            <br />
            <span style={{color: C.faint}}>// onions don&apos;t care about your schedule</span>
          </div>
        </IssueCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s07 (39f) — repro steps, timer snaps 4:00 → 10:00 */
export const S07: FC = () => {
  const frame = useCurrentFrame();
  const flip = frame >= 20;
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <Scanlines opacity={0.3} />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <Panel title="steps to reproduce — #101" width={1240} height={640}>
          <div style={{padding: '34px 48px', display: 'flex', flexDirection: 'column', gap: 26}}>
            <TypeText
              text="1. open recipe (blog, 2 pop-ups)"
              start={0}
              cps={40}
              style={{fontFamily: F.mono, fontSize: 38, color: C.dim, minHeight: 46}}
            />
            <div style={{display: 'flex', alignItems: 'center', gap: 30}}>
              <TypeText
                text="2. chop onions — timer says"
                start={6}
                cps={40}
                style={{fontFamily: F.mono, fontSize: 38, color: C.dim, minHeight: 46}}
              />
              <div
                style={{
                  fontFamily: F.mono,
                  fontWeight: 700,
                  fontSize: 46,
                  color: flip ? '#FFE8E4' : C.text,
                  backgroundColor: flip ? C.red : C.panel3,
                  border: `2px solid ${flip ? C.red : C.line}`,
                  borderRadius: 10,
                  padding: '8px 22px',
                  translate: shake(frame, 20, 10, 10),
                  scale: flip ? interpolate(prog(frame, 20, 26, POP), [0, 1], [1.35, 1]) : 1,
                }}
              >
                {flip ? '10:00' : '4:00'}
              </div>
            </div>
            <TypeText
              text="3. keep chopping. keep chopping."
              start={12}
              cps={40}
              style={{fontFamily: F.mono, fontSize: 38, color: C.dim, minHeight: 46}}
            />
            <TypeText
              text="4. eat crackers at 21:15"
              start={18}
              cps={40}
              style={{fontFamily: F.mono, fontSize: 38, color: C.faint, minHeight: 46}}
            />
          </div>
        </Panel>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s08 (34f) — CONFIRMED stamp */
export const S08: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 36}}>
        <IssueCard
          number="#101"
          title="chopping: labeled 4 min — takes 10"
          width={1180}
          style={{
            scale: 0.82,
            opacity: 0.55,
            translate: '0px -60px',
          }}
        />
        <Stamp label="CONFIRMED" at={6} size={170} rotate={-11} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            opacity: interpolate(frame, [18, 24], [0, 1], CLAMP),
            translate: `0px ${interpolate(prog(frame, 18, 26), [0, 1], [30, 0])}px`,
          }}
        >
          <Check size={46} start={19} />
          <div style={{fontFamily: F.mono, fontSize: 36, color: C.green}}>
            reproduced by 10,406 cooks · 100% failure rate
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s09 (38f) — issue #102, cold oven */
export const S09: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <IssueCard
          number="#102"
          title="preheat: step missing"
          style={{
            translate: `${interpolate(prog(frame, 0, 9), [0, 1], [-420, 0])}px 0px`,
            opacity: interpolate(frame, [0, 5], [0, 1], CLAMP),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <Chip label="oven" color={C.amber} />
            <Chip label="step-0" color={C.dim} />
            <Chip label="assumed" color={C.red} />
            <div style={{flex: 1}} />
            <div style={{fontFamily: F.mono, fontSize: 30, color: C.dim}}>reported by: everyone, weekly</div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 40,
              backgroundColor: '#0D1117',
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '22px 30px',
            }}
          >
            <div>
              <div style={{fontFamily: F.mono, fontSize: 28, color: C.faint}}>repro — step 3 reads:</div>
              <div style={{fontFamily: F.mono, fontSize: 36, color: C.text, marginTop: 8}}>
                &quot;bake at 180°C for 25 min&quot;
              </div>
            </div>
            <div style={{flex: 1}} />
            <div style={{textAlign: 'right'}}>
              <div style={{fontFamily: F.mono, fontSize: 28, color: C.faint}}>your oven:</div>
              <div
                style={{
                  fontFamily: F.display,
                  fontSize: 88,
                  lineHeight: 1,
                  color: C.dim,
                  opacity: interpolate(frame, [10, 16], [0, 1], CLAMP),
                }}
              >
                23°C
              </div>
              <div style={{fontFamily: F.mono, fontSize: 28, color: C.red, marginTop: 4}}>
                needed: 180°C, 12 min ago
              </div>
            </div>
          </div>
        </IssueCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* s10 (24f) — SFX-only: issue #103, infinite dishes */
export const S10: FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <IssueCard
          number="#103"
          title="cleanup: not implemented"
          style={{
            scale: interpolate(prog(frame, 0, 8, POP), [0, 1], [0.9, 1]),
            opacity: interpolate(frame, [0, 4], [0, 1], CLAMP),
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 18}}>
            <Chip label="dishes" color={C.dim} />
            <Chip label="scope-creep" color={C.red} />
            <div style={{flex: 1}} />
            <Chip label="wontfix (blog)" color={C.faint} />
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 40,
              color: C.text,
              backgroundColor: '#0D1117',
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '22px 30px',
              lineHeight: 1.5,
            }}
          >
            <span style={{color: C.faint}}>step 9:</span> while (hungry) {'{ dishes++ }'}
            <CaretBlink /> <span style={{color: C.red}}>// never returns</span>
          </div>
        </IssueCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CaretBlink: FC = () => {
  const frame = useCurrentFrame();
  return <span style={{color: C.green, opacity: frame % 14 < 7 ? 1 : 0}}>▌</span>;
};

/* s11 (38f) — all three confirmed + severity banner */
export const S11: FC = () => {
  const frame = useCurrentFrame();
  const cards = [
    {n: '#101', t: 'chop 4 → 10'},
    {n: '#102', t: 'no preheat'},
    {n: '#103', t: 'no cleanup'},
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      <AbsoluteFill style={{flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40}}>
        <div style={{display: 'flex', gap: 40}}>
          {cards.map((c, i) => (
            <div
              key={c.n}
              style={{
                width: 460,
                backgroundColor: C.panel,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                padding: '30px 32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                position: 'relative',
                translate: `0px ${interpolate(prog(frame, i * 3, i * 3 + 8), [0, 1], [90, 0])}px`,
                opacity: interpolate(frame, [i * 3, i * 3 + 6], [0, 1], CLAMP),
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', gap: 16}}>
                <div style={{fontFamily: F.mono, fontWeight: 700, fontSize: 34, color: C.red}}>{c.n}</div>
                <div style={{fontFamily: F.base, fontWeight: 500, fontSize: 34, color: C.dim}}>{c.t}</div>
              </div>
              <div style={{height: 120, display: 'flex', alignItems: 'center'}}>
                <Stamp label="CONFIRMED" at={6 + i * 6} size={72} rotate={-10 + i * 10} />
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            backgroundColor: C.red,
            borderRadius: 12,
            padding: '16px 60px',
            translate: `0px ${interpolate(prog(frame, 24, 32, EASE_OUT), [0, 1], [-120, 0])}px`,
            opacity: interpolate(frame, [24, 29], [0, 1], CLAMP),
          }}
        >
          <div style={{fontFamily: F.display, fontSize: 110, lineHeight: 1, color: '#FFF3F0', letterSpacing: 4}}>
            SEVERITY: DINNER-BREAKING
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
