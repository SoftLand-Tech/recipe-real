// DINNER LEAGUE FINAL — scene table (audio-first contract).
// Match: YOU vs BLOGGERS FC ("a 15-minute recipe").
// VO speakers: 'pbp' = play-by-play (energetic, Deepgram aura-orion-en),
//              'color' = color analyst (deep + dry, Deepgram aura-zeus-en).
// VO lines are written to a measured words-per-second budget (~0.2s/word orion,
// ~0.35s/word zeus) so 40 scenes fit 1500 frames with the end card absorbing slack.
// score [you, bloggers] becomes this value from the scene's first frame.

export type Speaker = 'pbp' | 'color' | null;

export interface SceneSpec {
  id: string; // s01..s40
  vo: string | null; // null = SFX-only punch scene (3 max)
  speaker: Speaker;
  sfx: string | null; // file stem in public/audio/v2/, e.g. 'whistle'
  visual: string; // one-line art direction
  score?: [number, number]; // scoreboard [YOU, BLOG] from this scene on
}

export const SCENES: SceneSpec[] = [
  // ---------- ACT 1 — HOOK (kickoff) ----------
  {
    id: 's01',
    vo: 'Live, from kitchen stadium!',
    speaker: 'pbp',
    sfx: 'crowd',
    visual:
      'Cold open on deep navy: red LIVE bug slams in, KITCHEN STADIUM headline in Bebas, floodlight beams sweep, crowd bokeh dots.',
  },
  {
    id: 's02',
    vo: "We're under way in the kitchen!",
    speaker: 'pbp',
    sfx: 'blip',
    visual:
      'Diagonal L-to-R broadcast wipe reveals stadium kitchen set (chalk pitch floor, counters, stove); scoreboard bug drops in top-left.',
  },
  {
    id: 's03',
    vo: 'You, against a fifteen-minute recipe.',
    speaker: 'pbp',
    sfx: 'blip',
    visual:
      'Matchup lineup card over dim pitch: YOU in terracotta vs BLOGGERS FC in gray, chalk halfway line behind.',
  },
  {
    id: 's04',
    vo: 'Fifteen minutes. They promise.',
    speaker: 'color',
    sfx: 'scribble',
    visual:
      'Recipe card closeup slams down: WEEKNIGHT PASTA — READY IN 15:00 with gray stamp underline and torn paper edge.',
  },
  {
    id: 's05',
    vo: null,
    speaker: null,
    sfx: 'whistle',
    visual:
      'KICK-OFF flash card + whistle; chalk center circle pops on pitch floor, pan block slides onto stove ring.',
  },

  // ---------- ACT 2 — EARLY DISASTER ----------
  {
    id: 's06',
    vo: 'Early possession: all theirs.',
    speaker: 'pbp',
    sfx: 'blip',
    visual:
      'Possession bar lower-third sweeps in: BLOGGERS FC 74% gray fill, YOU 26% sliver; match clock ticking.',
  },
  {
    id: 's07',
    vo: 'Step one: preheat the oven.',
    speaker: 'pbp',
    sfx: null,
    visual:
      'Step card "1. PREHEAT OVEN — 0:00 BUDGETED" beside dark oven block, cold blue pilot glow.',
    score: [0, 0],
  },
  {
    id: 's08',
    vo: 'Injury news: the preheat was forgotten.',
    speaker: 'pbp',
    sfx: 'crowd',
    visual:
      'INJURY NEWS lower-third slides in with red cross icon; scoreboard bug flashes OG — BLOGGERS FC lead.',
    score: [0, 1],
  },
  {
    id: 's09',
    vo: "Classic. The oven's still cold.",
    speaker: 'color',
    sfx: 'whoosh',
    visual:
      'REPLAY corner wipe: cold oven closeup, blue PREHEAT: FORGOTTEN tag, scanlines + REPLAY watermark, slight slow-mo zoom.',
  },
  {
    id: 's10',
    vo: 'Four minutes of chopping, they said.',
    speaker: 'pbp',
    sfx: null,
    visual:
      'Split clock graphic: RECIPE SAYS 4:00 (gray) vs REAL 9:30 (white), vertical divider, red drift arrow growing.',
  },
  {
    id: 's11',
    vo: 'The clock says ten.',
    speaker: 'pbp',
    sfx: 'tick',
    visual:
      'Knife chop burst over cutting board; big minute digits roll 4 to 10, possession still gray.',
  },
  {
    id: 's12',
    vo: 'Stoppage time already: plus five!',
    speaker: 'pbp',
    sfx: 'crowd',
    visual:
      'Fourth-official board rises from bottom edge: neon "+5" digits on navy, stoppage time label.',
  },
  {
    id: 's13',
    vo: 'Half-time. Twenty-four played. Fifteen promised.',
    speaker: 'color',
    sfx: 'whistle',
    visual:
      'HALF-TIME card wipes across: 24:00 PLAYED (white) vs 15:00 PROMISED (gray, struck through), whistle beat.',
  },

  // ---------- ACT 3 — SUBSTITUTION: COOK MODE ----------
  {
    id: 's14',
    vo: 'The manager makes the change. Cook Mode, on!',
    speaker: 'pbp',
    sfx: 'horn',
    visual:
      'Substitution lower-third slides in: GUESSWORK (gray arrow down, off) → COOK MODE (terracotta arrow on); terracotta wash floods the frame.',
    score: [0, 1],
  },
  {
    id: 's15',
    vo: 'Cook Mode takes the touchline.',
    speaker: 'pbp',
    sfx: 'blip',
    visual:
      'Phone UI held center: Cook Mode board with step list + per-step timers, terracotta header, steps ticking.',
  },
  {
    id: 's16',
    vo: 'Real times. Ten thousand cooks.',
    speaker: 'color',
    sfx: 'ding',
    visual:
      'Clock re-sync graphic: gray fantasy clock wipes out, green REAL TIMES clock snaps in with SYNCED badge.',
  },
  {
    id: 's17',
    vo: 'The crowd called it: forty-three minutes.',
    speaker: 'pbp',
    sfx: 'crowd',
    visual:
      'Crowd verdict card: 10,000 HOME COOKS CALLED IT ticker tape + big 43:00 verdict bar stamping in.',
  },
  {
    id: 's18',
    vo: 'Possession, flipping our way!',
    speaker: 'pbp',
    sfx: 'blip',
    visual:
      'Possession flip: terracotta YOU 71% bar sweeps over gray; pitch diagram dot animates across halfway line.',
  },
  {
    id: 's19',
    vo: 'Six minutes called. Six minutes played.',
    speaker: 'color',
    sfx: 'ding',
    visual:
      'Step card ONIONS — 6:00 PREDICTED / 6:00 ACTUAL with green check pulse; GOAL flash ties it 1-1.',
    score: [1, 1],
  },
  {
    id: 's20',
    vo: 'Onions in. Timer runs itself.',
    speaker: 'pbp',
    sfx: 'tick',
    visual:
      'Big auto-timer ring counts down beside knife-on-board; sizzle flash as onions hit the pan.',
  },
  {
    id: 's21',
    vo: null,
    speaker: null,
    sfx: 'crowd',
    visual:
      'GOAL card slam: SEAR — 4:00 / 4:00, score bug flashes 2-1, chalk net ripple (SFX-only punch).',
    score: [2, 1],
  },
  {
    id: 's22',
    vo: 'Look at that flip!',
    speaker: 'pbp',
    sfx: 'whoosh',
    visual:
      'REPLAY wipe: pan flip arc with chalk trajectory line and dotted apex, REPLAY watermark + scanlines.',
  },
  {
    id: 's23',
    vo: 'Sauce: eight. Dead on.',
    speaker: 'color',
    sfx: 'ding',
    visual:
      'Step card SAUCE — 8:00 PREDICTED / 8:00 ACTUAL, green check pulse, wooden spoon stir swirl, 3-1 flash.',
    score: [3, 1],
  },
  {
    id: 's24',
    vo: 'Pasta! Right on the minute!',
    speaker: 'pbp',
    sfx: 'crowd',
    visual:
      'Pasta drops into pot; step card PASTA — 7:00 / 7:00 lands with steam burst; score bug 4-1.',
    score: [4, 1],
  },
  {
    id: 's25',
    vo: 'No signal? Recipes still load.',
    speaker: 'pbp',
    sfx: null,
    visual:
      'Offline badge moment: wifi-off icon crossed, recipe list on phone keeps scrolling, OFFLINE-FIRST tag.',
  },

  // ---------- ACT 4 — HONEST EXTRA TIME + STATS ----------
  {
    id: 's26',
    vo: 'Four goals from honest clocks.',
    speaker: 'color',
    sfx: 'blip',
    visual:
      'Scoreboard closeup YOU 4 BLOGGERS FC 1 + chalk pitch diagram with green X marks at every landed step.',
  },
  {
    id: 's27',
    vo: 'Cleanup. Announced up front. Plus twenty.',
    speaker: 'pbp',
    sfx: 'scribble',
    visual:
      'Cleanup step card: +20:00 PRINTED UP FRONT with sponge + soap icons, chalk bracket around it.',
  },
  {
    id: 's28',
    vo: 'Blogs hide cleanup. We print it.',
    speaker: 'color',
    sfx: 'blip',
    visual:
      'Two receipts side by side: BLOG RECIPE with torn hidden CLEANUP ??? edge vs RECIPEREAL receipt printing +20:00.',
  },
  {
    id: 's29',
    vo: 'Fifteen promised. Forty-three played.',
    speaker: 'pbp',
    sfx: 'ding',
    visual:
      'STATS CARD lower-third: PROMISED 15:00 short gray bar vs ACTUAL 43:00 long white bar, red gap callout.',
  },
  {
    id: 's30',
    vo: 'Twenty-eight minutes, hidden.',
    speaker: 'color',
    sfx: null,
    visual:
      'Gap zoom: giant red +28:00 — THE HIDDEN TIME digits over darkened pitch, thin red rules.',
  },
  {
    id: 's31',
    vo: 'Every tick. On schedule.',
    speaker: 'pbp',
    sfx: 'tick',
    visual:
      'Tension montage: timer ticks landing as green pulses down a vertical schedule rail, clock hands sweeping.',
  },
  {
    id: 's32',
    vo: 'Plating. The final touch.',
    speaker: 'pbp',
    sfx: null,
    visual:
      'Plating closeup: pan tilt toward white plate, steam wisps curl, shallow depth vignette.',
  },
  {
    id: 's33',
    vo: 'The referee checks his watch.',
    speaker: 'pbp',
    sfx: null,
    visual:
      'Referee watch closeup: ticking seconds hand, crowd hush gradient, scoreboard bug glowing.',
  },

  // ---------- ACT 5 — FINAL WHISTLE + TROPHY ----------
  {
    id: 's34',
    vo: null,
    speaker: null,
    sfx: 'whistle-final',
    visual:
      'FINAL WHISTLE: FULL TIME flash card with triple whistle burst, frame shake (SFX-only punch).',
  },
  {
    id: 's35',
    vo: 'Dinner lifts the trophy!',
    speaker: 'pbp',
    sfx: 'fanfare',
    visual:
      'Trophy lift: plated dinner raised on a pedestal, confetti rain in terracotta + white, floodlight flares.',
    score: [5, 1],
  },
  {
    id: 's36',
    vo: 'Five goals. One lying recipe.',
    speaker: 'color',
    sfx: 'crowd',
    visual:
      'FT card: FULL TIME — YOU 5, BLOGGERS FC 1 with plated dish on podium plinth, chalk laurel.',
  },
  {
    id: 's37',
    vo: 'Full time: dinner. On time.',
    speaker: 'pbp',
    sfx: null,
    visual:
      'Tagline lockup: FULL TIME: DINNER. ON TIME. with chalk underline sweep and match clock frozen at 43:00.',
  },

  // ---------- ACT 6 — END CARD ----------
  {
    id: 's38',
    vo: 'RecipeReal.',
    speaker: 'color',
    sfx: 'scribble',
    visual:
      'RecipeReal wordmark forms from chalk strokes on navy, small timer glyph as the dot of the logo.',
  },
  {
    id: 's39',
    vo: 'Cook Mode. Every minute, on the clock.',
    speaker: 'pbp',
    sfx: 'blip',
    visual:
      'Tagline: COOK MODE. EVERY MINUTE ON THE CLOCK. with timer ring icon ticking beside wordmark.',
  },
  {
    id: 's40',
    vo: 'Download RecipeReal, free.',
    speaker: 'pbp',
    sfx: 'ding',
    visual:
      'End card: RecipeReal wordmark, DOWNLOAD FREE CTA bar, App Store / Google Play text badges, honest-times seal (absorbs remainder).',
  },
];

export const SCENE_COUNT = SCENES.length; // 40
