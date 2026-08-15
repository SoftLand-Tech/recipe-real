// Location scenery layers — every location gets a drawn motif with ambient motion
// from frame 0 (flicker, drift, shimmer, aurora). Deterministic: random() 1 arg.
import {FC} from 'react';
import {interpolate, random, useCurrentFrame} from 'remotion';
import {LOC, clampIn} from './ui';

const fill = {position: 'absolute', inset: 0} as const;

/* ---------------- subway ---------------- */

export const SubwayBg: FC = () => {
  const frame = useCurrentFrame();
  const flicker = random(`fl-${Math.floor(frame / 3)}`) > 0.93 ? 0.35 : 1;
  return (
    <div style={{...fill, background: `linear-gradient(178deg, ${LOC.subway.a} 0%, ${LOC.subway.b} 100%)`}}>
      {/* tunnel arch */}
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <path d="M440 1080 L440 480 Q960 60 1480 480 L1480 1080 Z" fill="rgba(11,18,25,0.85)" />
        <path d="M440 1080 L440 480 Q960 60 1480 480 L1480 1080" fill="none" stroke={LOC.subway.accent} strokeWidth="5" opacity="0.35" />
        {/* rails converging */}
        <line x1="500" y1="1080" x2="860" y2="760" stroke={LOC.subway.accent} strokeWidth="6" opacity="0.5" />
        <line x1="1420" y1="1080" x2="1060" y2="760" stroke={LOC.subway.accent} strokeWidth="6" opacity="0.5" />
        <line x1="960" y1="1080" x2="960" y2="760" stroke="rgba(243,237,230,0.16)" strokeWidth="3" strokeDasharray="26 34" />
        {/* tile wall */}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((t) => (
          <line key={t} x1={480 + t * 130} y1="180" x2={480 + t * 130} y2="480" stroke="rgba(95,168,220,0.14)" strokeWidth="3" />
        ))}
        {[0, 1, 2].map((t) => (
          <line key={`h${t}`} x1="460" y1={200 + t * 100} x2="1460" y2={200 + t * 100} stroke="rgba(95,168,220,0.14)" strokeWidth="3" />
        ))}
        {/* pillars */}
        {[0, 1, 2, 3].map((p) => (
          <rect key={`p${p}`} x={240 + p * 470} y="240" width="54" height="840" fill="rgba(11,18,25,0.9)" stroke="rgba(95,168,220,0.22)" strokeWidth="3" />
        ))}
      </svg>
      {/* flickering ceiling strip */}
      <div
        style={{
          position: 'absolute',
          top: 96,
          left: 620,
          width: 680,
          height: 26,
          borderRadius: 12,
          backgroundColor: '#CFE4F5',
          opacity: 0.85 * flicker,
          boxShadow: `0 0 ${120 * flicker}px 60px rgba(207,228,245,${0.3 * flicker})`,
        }}
      />
      <div style={{...fill, backgroundColor: LOC.subway.a, opacity: 0.28, mixBlendMode: 'multiply'}} />
    </div>
  );
};

/* ---------------- summit ---------------- */

export const SummitBg: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{...fill, background: `linear-gradient(180deg, #EAF3FA 0%, ${LOC.summit.a} 46%, ${LOC.summit.b} 100%)`}}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <circle cx="1520" cy="200" r="90" fill="#FFFFFF" opacity="0.9" />
        <circle cx="1520" cy="200" r="150" fill="#FFFFFF" opacity="0.25" />
        {/* far range */}
        <polygon points="0,760 300,430 560,700 900,380 1240,690 1560,440 1920,730 1920,1080 0,1080" fill={LOC.summit.b} opacity="0.55" />
        {/* snowcaps */}
        <polygon points="300,430 360,500 240,500" fill="#FFFFFF" opacity="0.9" />
        <polygon points="900,380 970,465 830,465" fill="#FFFFFF" opacity="0.95" />
        {/* near ridge */}
        <polygon points="0,900 480,640 980,880 1420,660 1920,920 1920,1080 0,1080" fill="#6E93AE" opacity="0.85" />
        <polygon points="480,640 540,700 420,700" fill="#FFFFFF" opacity="0.85" />
      </svg>
      {/* wind streaks */}
      {[0, 1, 2, 3].map((w) => {
        const p = ((frame * 4 + w * 40) % 220) / 220;
        return (
          <div
            key={w}
            style={{
              position: 'absolute',
              top: 220 + w * 130,
              left: interpolate(p, [0, 1], [-500, 2100]),
              width: 320 + w * 90,
              height: 4,
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.55)',
            }}
          />
        );
      })}
      <div style={{...fill, background: 'linear-gradient(0deg, rgba(23,19,16,0.35) 0%, rgba(23,19,16,0) 40%)'}} />
    </div>
  );
};

/* ---------------- bunker ---------------- */

export const BunkerBg: FC = () => {
  const frame = useCurrentFrame();
  const swing = Math.sin(frame * 0.16) * 5;
  return (
    <div style={{...fill, background: `linear-gradient(180deg, ${LOC.bunker.a} 0%, ${LOC.bunker.b} 100%)`}}>
      {/* hanging bulb */}
      <div style={{position: 'absolute', left: 900, top: 0, width: 6, height: 260, backgroundColor: 'rgba(224,164,71,0.35)', rotate: `${swing}deg`, transformOrigin: '50% 0'}}>
        <div
          style={{
            position: 'absolute',
            bottom: -34,
            left: -17,
            width: 40,
            height: 40,
            borderRadius: '50%',
            backgroundColor: '#F4C875',
            boxShadow: '0 0 140px 80px rgba(224,164,71,0.45)',
          }}
        />
      </div>
      <div style={{position: 'absolute', left: 410, top: -260, width: 1100, height: 900, background: 'radial-gradient(circle at 50% 50%, rgba(224,164,71,0.28) 0%, rgba(21,14,5,0) 62%)'}} />
      {/* shelves of cans */}
      {[0, 1].map((shelf) => (
        <div
          key={shelf}
          style={{
            position: 'absolute',
            left: 90 + shelf * 1330,
            top: 560,
            width: 420,
            height: 300,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {[0, 1, 2].map((row) => (
            <div key={row} style={{position: 'relative', height: 82}}>
              <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 10, backgroundColor: '#3A2A14', border: '2px solid rgba(224,164,71,0.3)'}} />
              <div style={{position: 'absolute', bottom: 8, left: 6, right: 0, display: 'flex', gap: 10, alignItems: 'flex-end'}}>
                {[0, 1, 2, 3, 4].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 40 + random(`can-${shelf}-${row}-${c}`) * 18,
                      height: 42 + random(`ch-${shelf}-${row}-${c}`) * 32,
                      borderRadius: 6,
                      backgroundColor: `rgba(224,164,71,${0.16 + random(`ca-${shelf}-${row}-${c}`) * 0.22})`,
                      border: '2px solid rgba(243,237,230,0.14)',
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
      {/* pipes */}
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <rect x="0" y="120" width="1920" height="26" fill="rgba(224,164,71,0.16)" />
        <rect x="0" y="190" width="1920" height="12" fill="rgba(224,164,71,0.1)" />
        {[200, 700, 1300, 1750].map((x) => (
          <rect key={x} x={x} y="60" width="18" height="70" fill="rgba(224,164,71,0.2)" />
        ))}
      </svg>
      <div style={{...fill, background: 'radial-gradient(ellipse at 50% 110%, rgba(21,14,5,0.2) 0%, rgba(21,14,5,0) 55%)'}} />
    </div>
  );
};

/* ---------------- airplane ---------------- */

export const PlaneBg: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{...fill, background: `linear-gradient(180deg, ${LOC.plane.a} 0%, ${LOC.plane.b} 100%)`}}>
      {/* cabin wall */}
      <div style={{position: 'absolute', inset: 0, backgroundColor: '#0A101E'}} />
      {/* window */}
      <div
        style={{
          position: 'absolute',
          right: 150,
          top: 170,
          width: 560,
          height: 700,
          borderRadius: 280,
          overflow: 'hidden',
          border: '16px solid #1A2438',
          boxShadow: '0 0 120px rgba(143,174,224,0.25), inset 0 0 60px rgba(143,174,224,0.2)',
        }}
      >
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(180deg, #33456E 0%, ${LOC.plane.a} 70%)`}} />
        {[0, 1, 2].map((c) => {
          const p = ((frame * 2.2 + c * 60) % 240) / 240;
          return (
            <div
              key={c}
              style={{
                position: 'absolute',
                top: 380 + c * 90,
                left: interpolate(p, [0, 1], [620, -720]),
                width: 560 + c * 160,
                height: 60 + c * 26,
                borderRadius: 999,
                backgroundColor: 'rgba(226,236,252,0.5)',
                filter: 'blur(2px)',
              }}
            />
          );
        })}
        <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(0deg, rgba(226,236,252,0.55) 0%, rgba(226,236,252,0) 100%)'}} />
      </div>
      {/* wing */}
      <svg width="1100" height="420" viewBox="0 0 1100 420" style={{position: 'absolute', left: -140, bottom: -40}}>
        <polygon points="0,420 1050,190 1100,250 130,420" fill="#16203A" stroke="rgba(143,174,224,0.3)" strokeWidth="4" />
        <circle cx="880" cy="240" r="12" fill={LOC.plane.accent} opacity="0.8" />
      </svg>
      <div style={{...fill, background: 'radial-gradient(ellipse at 70% 40%, rgba(143,174,224,0.12) 0%, rgba(10,16,30,0.55) 100%)'}} />
    </div>
  );
};

/* ---------------- desert ---------------- */

export const DesertBg: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{...fill, background: `linear-gradient(180deg, #F2DCA6 0%, ${LOC.desert.a} 55%, ${LOC.desert.b} 100%)`}}>
      <div
        style={{
          position: 'absolute',
          right: 300,
          top: 130,
          width: 190,
          height: 190,
          borderRadius: '50%',
          backgroundColor: '#FFF3D0',
          boxShadow: '0 0 180px 90px rgba(255,236,178,0.55)',
          scale: `${1 + Math.sin(frame * 0.35) * 0.012}`,
        }}
      />
      {[0, 1, 2].map((d) => {
        const drift = Math.sin(frame * 0.05 + d) * 26;
        return (
          <svg
            key={d}
            width="2100"
            height="360"
            viewBox="0 0 2100 360"
            style={{position: 'absolute', bottom: -80 + d * 110, left: -90 + drift}}
          >
            <path
              d={d === 0 ? 'M0 190 Q 500 40, 1050 150 T 2100 120 L2100 360 L0 360 Z' : d === 1 ? 'M0 240 Q 620 90, 1150 200 T 2100 170 L2100 360 L0 360 Z' : 'M0 300 Q 560 190, 1120 260 T 2100 240 L2100 360 L0 360 Z'}
              fill={d === 0 ? '#C79A54' : d === 1 ? '#A97C3C' : '#8A6434'}
              opacity={0.9 - d * 0.05}
            />
          </svg>
        );
      })}
      {/* heat shimmer bands */}
      {[0, 1, 2, 3].map((s) => (
        <div
          key={s}
          style={{
            position: 'absolute',
            top: 620 + s * 90,
            left: -200,
            width: 2400,
            height: 34,
            backgroundColor: 'rgba(255,255,255,0.16)',
            transform: `skewX(-18deg) translateY(${Math.sin(frame * 0.6 + s * 2) * 10}px)`,
            filter: 'blur(3px)',
          }}
        />
      ))}
      <div style={{...fill, background: 'linear-gradient(0deg, rgba(126,90,46,0.4) 0%, rgba(126,90,46,0) 45%)'}} />
    </div>
  );
};

/* ---------------- polar ---------------- */

export const PolarBg: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{...fill, background: `linear-gradient(180deg, #0E1E2C 0%, ${LOC.polar.b} 62%, ${LOC.polar.a} 100%)`}}>
      {/* stars */}
      {Array.from({length: 26}).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: random(`stx-${i}`) * 1900,
            top: random(`sty-${i}`) * 520,
            width: 3 + random(`sts-${i}`) * 3,
            height: 3 + random(`sts-${i}`) * 3,
            borderRadius: 999,
            backgroundColor: '#EAF4FA',
            opacity: 0.35 + Math.abs(Math.sin(frame * 0.35 + i)) * 0.55,
          }}
        />
      ))}
      {/* aurora ribbons */}
      {[0, 1, 2].map((r) => {
        const shift = Math.sin(frame * 0.05 + r * 2.1) * 90;
        return (
          <svg
            key={r}
            width="2400"
            height="420"
            viewBox="0 0 2400 420"
            style={{position: 'absolute', top: 40 + r * 90, left: -240 + shift, opacity: 0.5 - r * 0.1}}
          >
            <path
              d={`M0 ${200 + r * 40} Q 400 ${60 + r * 30}, 800 ${180 + r * 20} T 1600 ${120 + r * 30} T 2400 ${200 + r * 10} L2400 420 L0 420 Z`}
              fill={r === 1 ? 'rgba(159,232,216,0.4)' : r === 0 ? 'rgba(122,199,224,0.32)' : 'rgba(154,140,220,0.3)'}
              style={{filter: 'blur(4px)'}}
            />
          </svg>
        );
      })}
      {/* ice ground */}
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <polygon points="0,880 400,820 900,870 1400,810 1920,860 1920,1080 0,1080" fill={LOC.polar.a} opacity="0.9" />
        {/* research hut */}
        <rect x="830" y="740" width="260" height="120" fill="#13202B" />
        <polygon points="810,745 1110,745 960,660" fill="#0D1720" />
        <rect x="955" y="600" width="10" height="70" fill="#13202B" />
        <circle cx="960" cy="596" r="10" fill={LOC.polar.accent} opacity="0.9" />
        <rect x="900" y="790" width="46" height="52" fill={LOC.polar.accent} opacity="0.5" />
      </svg>
      <div style={{...fill, background: 'linear-gradient(0deg, rgba(44,66,84,0.5) 0%, rgba(44,66,84,0) 40%)'}} />
    </div>
  );
};

/* ---------------- nowhere (act 5) ---------------- */

export const NowhereBg: FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{...fill, background: 'linear-gradient(180deg, #2B2530 0%, #4A3A33 55%, #241D17 100%)'}}>
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 240,
          width: 120,
          height: 120,
          borderRadius: '50%',
          backgroundColor: '#E8B77A',
          boxShadow: '0 0 160px 70px rgba(232,183,122,0.3)',
          opacity: 0.9,
        }}
      />
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        <polygon points="0,840 500,760 1100,830 1920,740 1920,1080 0,1080" fill="#1B1611" />
        {/* telegraph pole */}
        <rect x="1600" y="560" width="14" height="290" fill="#0F0C09" />
        <rect x="1560" y="600" width="94" height="10" fill="#0F0C09" />
        {[0, 1, 2].map((w) => (
          <path
            key={w}
            d={`M1562 ${612 + w * 26} q 90 18, 184 ${2 + w * 6}`}
            fill="none"
            stroke="#0F0C09"
            strokeWidth="4"
            opacity="0.8"
          />
        ))}
      </svg>
      {/* drifting dust */}
      {[0, 1, 2, 3, 4].map((d) => {
        const p = ((frame * 1.6 + d * 50) % 300) / 300;
        return (
          <div
            key={d}
            style={{
              position: 'absolute',
              top: 700 + d * 60,
              left: interpolate(p, [0, 1], [-100, 2050]),
              width: 160 + d * 40,
              height: 8,
              borderRadius: 8,
              backgroundColor: 'rgba(232,183,122,0.14)',
            }}
          />
        );
      })}
      <div style={{...fill, background: 'radial-gradient(ellipse at 50% 30%, rgba(232,183,122,0.08) 0%, rgba(23,19,16,0.4) 100%)'}} />
    </div>
  );
};

/* ---------------- kitchen (home base) ---------------- */

export const KitchenBg: FC = () => {
  const frame = useCurrentFrame();
  const sway = Math.sin(frame * 0.12) * 2;
  return (
    <div style={{...fill, background: 'linear-gradient(180deg, #2A231C 0%, #171310 100%)'}}>
      {/* pendant lamps */}
      {[0, 1].map((l) => (
        <div key={l} style={{position: 'absolute', left: 480 + l * 900, top: 0, width: 5, height: 210, backgroundColor: 'rgba(217,110,63,0.3)', rotate: `${sway * (l ? -1 : 1)}deg`, transformOrigin: '50% 0'}}>
          <div style={{position: 'absolute', bottom: -40, left: -55, width: 115, height: 52, borderRadius: '14px 14px 90px 90px', backgroundColor: '#3A2E23', borderBottom: `6px solid ${LOC.base.accent}`}} />
          <div style={{position: 'absolute', bottom: -170, left: -160, width: 330, height: 330, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,110,63,0.22) 0%, rgba(217,110,63,0) 65%)'}} />
        </div>
      ))}
      {/* counter */}
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, backgroundColor: '#221C16', borderTop: '10px solid #3A2E23'}} />
      {/* tiles */}
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{position: 'absolute', inset: 0}}>
        {Array.from({length: 10}).map((_, t) => (
          <line key={t} x1={140 + t * 180} y1="180" x2={140 + t * 180} y2="740" stroke="rgba(243,237,230,0.05)" strokeWidth="3" />
        ))}
        {Array.from({length: 4}).map((_, t) => (
          <line key={`h${t}`} x1="140" y1={220 + t * 170} x2="1780" y2={220 + t * 170} stroke="rgba(243,237,230,0.05)" strokeWidth="3" />
        ))}
      </svg>
      <div style={{...fill, background: 'radial-gradient(ellipse at 50% 90%, rgba(217,110,63,0.1) 0%, rgba(23,19,16,0) 60%)'}} />
    </div>
  );
};

/** Frost creeping in from frame edges (summit/polar beats). */
export const FrostEdges: FC<{strength?: number}> = ({strength = 0.7}) => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 20], [0, strength], clampIn);
  return (
    <div
      style={{
        ...fill,
        boxShadow: `inset 0 0 ${160 * s}px ${60 * s}px rgba(223,240,250,${0.5 * s})`,
        background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 60%, rgba(223,240,250,0.12) 100%)',
        pointerEvents: 'none',
      }}
    />
  );
};
