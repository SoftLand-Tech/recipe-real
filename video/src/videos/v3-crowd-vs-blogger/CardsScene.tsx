import type {FC} from 'react';
import {AbsoluteFill, Easing, interpolate, random, useCurrentFrame} from 'remotion';
import {brand} from '../../shared/theme';
import {anton, inter} from './fonts';
import {EASE_IN_OUT, EASE_OUT_QUINT} from './ui';

export const CARD_COUNT = 30;
export const HERO_INDEX = 8;

const NAMES = [
  'Shakshuka',
  'Margarita Pasta',
  'Weeknight Curry',
  '15-Min Stir-Fry',
  'Sheet-Pan Salmon',
  'Miso Ramen',
  'Cheese Quesadillas',
  'Garlic Butter Pasta',
  'One-Pan Pasta',
  'Smash Burgers',
  'Thai Basil Chicken',
  'Cacio e Pepe',
  'Chana Masala',
  'Blistered Green Beans',
  'Honey-Glazed Carrots',
  'Crispy Tofu Bowl',
  'Egg Fried Rice',
  'Tomato Soup',
  'Chicken Piccata',
  'Beef Tacos',
  'Roast Veg Tray',
  'Mushroom Risotto',
  'Pad Thai',
  'Gnocchi Pomodoro',
  'Lemon Herb Cod',
  'Black Bean Chili',
  'Pesto Gnocchi',
  'Ramen Eggs',
  'Skillet Cornbread',
  'Baked Feta Pasta',
];

export const fakeTimeOf = (index: number): number => {
  if (index === HERO_INDEX) {
    return 20;
  }
  return 10 + Math.floor(random(`fake-${index}`) * 16);
};

export const realTimeOf = (index: number): number => {
  if (index === HERO_INDEX) {
    return 38;
  }
  const fake = fakeTimeOf(index);
  return Math.min(55, Math.round(fake * (1.7 + random(`mult-${index}`) * 0.35)));
};

const enterFrame = (index: number): number => 10 + index * 3;
const flipFrame = (index: number): number => 132 + index * 4;

const CARD_W = 150;
const CARD_H = 188;
const GRID_LEFT = 60;
const GRID_TOP = 640;
// Hero card center inside the grid container (column 2, row 1).
const HERO_CX = 2 * (CARD_W + 12) + CARD_W / 2;
const HERO_CY = 1 * (CARD_H + 14) + CARD_H / 2;
// Hero card center on screen.
const HERO_SCREEN_X = GRID_LEFT + HERO_CX;
const HERO_SCREEN_Y = GRID_TOP + HERO_CY;

const PUSH_START = 360;
const PUSH_END = 405;

const Card: FC<{index: number; frame: number; dimmed: number}> = ({
  index,
  frame,
  dimmed,
}) => {
  const enter = enterFrame(index);
  const enterP = interpolate(frame, [enter, enter + 16], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_OUT_QUINT,
  });
  const flip = flipFrame(index);
  const flipP = interpolate(frame, [flip, flip + 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.3, 1.35, 0.45, 1),
  });
  const angle = flipP * 180;
  // Little lift while flipping.
  const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, flipP))) * 10;
  const fake = fakeTimeOf(index);
  const real = realTimeOf(index);
  const restRotation = (random(`rot-${index}`) - 0.5) * 2.4;
  const startRotation = restRotation + (random(`rot0-${index}`) - 0.5) * 6;

  if (enterP <= 0) {
    return <div style={{width: CARD_W, height: CARD_H}} />;
  }

  return (
    <div
      style={{
        width: CARD_W,
        height: CARD_H,
        perspective: 900,
        opacity: (enterP * (1 - dimmed)).toFixed(3),
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: `rotateY(${angle.toFixed(1)}deg)`,
          translate: `0px ${(-lift).toFixed(1)}px`,
          rotate: `${interpolate(enterP, [0, 1], [startRotation, restRotation]).toFixed(2)}deg`,
          scale: `${(0.92 + enterP * 0.08 + (lift / CARD_H) * 0.5).toFixed(3)}`,
        }}
      >
        {/* Front: the promise. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            backgroundColor: brand.darkSurface,
            border: '1px solid rgba(243,237,230,0.1)',
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: inter,
              fontWeight: 600,
              fontSize: 15,
              lineHeight: 1.25,
              color: brand.cream,
              maxHeight: 40,
              overflow: 'hidden',
            }}
          >
            {NAMES[index]}
          </div>
          <div>
            <div
              style={{
                fontFamily: inter,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: '0.22em',
                color: brand.creamFaint,
              }}
            >
              CLAIMS
            </div>
            <div
              style={{
                fontFamily: anton,
                fontSize: 40,
                color: brand.creamSecondary,
                lineHeight: 1.1,
              }}
            >
              {fake}
              <span style={{fontSize: 18}}> MIN</span>
            </div>
          </div>
        </div>

        {/* Back: the crowd-reported truth. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            backgroundColor: brand.darkSurfaceSoft,
            border: `1px solid rgba(217,110,63,${index === HERO_INDEX ? 0.85 : 0.4})`,
            borderRadius: 14,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: inter,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.22em',
              color: brand.accentBright,
            }}
          >
            REAL
          </div>
          <div>
            <div
              style={{
                fontFamily: anton,
                fontSize: 42,
                color: brand.accentBright,
                lineHeight: 1.1,
              }}
            >
              {real}
              <span style={{fontSize: 18}}> MIN</span>
            </div>
            <div
              style={{
                fontFamily: inter,
                fontWeight: 700,
                fontSize: 13,
                color: brand.dangerBright,
              }}
            >
              +{real - fake} MIN
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** 18-32s — 30 cards cascade in, flip fake -> real, then push into one. */
const CardsScene: FC = () => {
  const frame = useCurrentFrame();

  const push = interpolate(frame, [PUSH_START, PUSH_END], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE_IN_OUT,
  });
  const headerOpacity =
    interpolate(frame, [4, 24], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }) *
    (1 -
      interpolate(frame, [PUSH_START, PUSH_START + 22], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }));

  const flipped = new Array(CARD_COUNT)
    .fill(true)
    .reduce((acc, _, i) => acc + (frame >= flipFrame(i) + 13 ? 1 : 0), 0);

  return (
    <AbsoluteFill style={{backgroundColor: brand.darkCanvas}}>
      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 268,
          left: 60,
          right: 60,
          opacity: headerOpacity,
          translate: `0px ${((1 - headerOpacity) * 24).toFixed(1)}px`,
        }}
      >
        <div
          style={{
            fontFamily: inter,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: '0.4em',
            color: brand.creamFaint,
          }}
        >
          CROWD-REPORTED
        </div>
        <div
          style={{
            marginTop: 20,
            fontFamily: anton,
            fontSize: 84,
            lineHeight: 1.04,
            color: brand.cream,
          }}
        >
          EVERY RECIPE, <span style={{color: brand.accentBright}}>RE-TIMED</span>
        </div>
      </div>

      {/* Flip counter */}
      <div
        style={{
          position: 'absolute',
          top: 490,
          right: 64,
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          opacity: headerOpacity,
        }}
      >
        <span style={{fontFamily: anton, fontSize: 60, color: brand.cream}}>
          {flipped}
        </span>
        <span
          style={{
            fontFamily: anton,
            fontSize: 34,
            color: flipped >= CARD_COUNT ? brand.accentBright : brand.creamFaint,
          }}
        >
          /{CARD_COUNT} RE-TIMED
        </span>
      </div>

      {/* Grid; pushes into the hero card in the final beat. */}
      <div
        style={{
          position: 'absolute',
          left: GRID_LEFT,
          top: GRID_TOP,
          translate: `${(push * (540 - HERO_SCREEN_X)).toFixed(1)}px ${(
            push * (960 - HERO_SCREEN_Y)
          ).toFixed(1)}px`,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(6, ${CARD_W}px)`,
            columnGap: 12,
            rowGap: 14,
            transformOrigin: `${HERO_CX}px ${HERO_CY}px`,
            scale: `${(1 + push * 2.3).toFixed(3)}`,
          }}
        >
          {new Array(CARD_COUNT).fill(true).map((_, i) => (
            <Card
              key={i}
              index={i}
              frame={frame}
              dimmed={
                i === HERO_INDEX
                  ? 0
                  : interpolate(frame, [PUSH_START + 6, PUSH_START + 34], [0, 0.96], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    })
              }
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default CardsScene;
