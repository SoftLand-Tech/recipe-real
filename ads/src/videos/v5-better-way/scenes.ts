// Audio-first scene table for "There's Got To Be A Better Way" (BetterWay).
// Act 1-3: B/W 1950s infomercial melodrama. Act 4-6: full-color modern snap.
// vo = spoken copy (null = SFX/visual punch beat). sfx = sound effect slug or null.
// visual = one-line art direction for the scene component.

export type Scene = {
  id: string;
  vo: string | null;
  sfx: string | null;
  visual: string;
};

export const SCENES: Scene[] = [
  // ---------- ACT 1 - HOOK (B/W melodrama, ~0-4s) ----------
  {
    id: 's01',
    vo: 'It said fifteen minutes!',
    sfx: null,
    visual: 'B/W 50s kitchen, smoke wisps rising, cook clutching recipe card, zoom-punch onto horrified face',
  },
  {
    id: 's02',
    vo: null,
    sfx: 'alarm',
    visual: 'Smoke alarm Greek chorus on ceiling, rings radiating, cook below frozen in despair',
  },
  {
    id: 's03',
    vo: 'Tired of recipe lies?',
    sfx: null,
    visual: 'Burnt dinner on plate, fork slowly drooping, iris vignette tightens like bad news',
  },
  {
    id: 's04',
    vo: 'Forty-three minutes of betrayal.',
    sfx: null,
    visual: 'Recipe card close-up, "15 MIN" stamp pulsing, clock hands spinning violently to :43',
  },

  // ---------- ACT 2 - PROBLEM VIGNETTES (B/W, ~4-14s) ----------
  {
    id: 's05',
    vo: 'Dinner an hour late. Again.',
    sfx: null,
    visual: 'Wall clock spins 15 to 43 in horror, tiny cook waiting alone at table in dark',
  },
  {
    id: 's06',
    vo: null,
    sfx: 'sting',
    visual: 'Burnt charcoal chicken on platter under a single hard spotlight, smoke curl',
  },
  {
    id: 's07',
    vo: 'Is your chicken... crying?',
    sfx: null,
    visual: 'Chicken close-up, one giant tear rolling down the breast, kitchen bokeh sorrow',
  },
  {
    id: 's08',
    vo: 'Nobody told you to preheat.',
    sfx: null,
    visual: 'Oven dial panic, question marks multiplying around the cook head',
  },
  {
    id: 's09',
    vo: null,
    sfx: 'click',
    visual: 'Iris wipe to egg-timer dial spinning way past the numbers, motion lines',
  },
  {
    id: 's10',
    vo: 'Ten minutes of prep? Try forty.',
    sfx: null,
    visual: 'Recipe steps list where every time inflates 10 to 40, cook hands shaking',
  },
  {
    id: 's11',
    vo: 'And then... the cleanup.',
    sfx: null,
    visual: 'Mountain of dishes with dramatic long shadows, low-angle cinema framing',
  },
  {
    id: 's12',
    vo: null,
    sfx: 'trombone',
    visual: 'Sink avalanche of dishes, cook silhouette slides down the cabinet in defeat',
  },
  {
    id: 's13',
    vo: 'There has to be another way.',
    sfx: null,
    visual: 'Cook face in hands under one swinging bulb, shadow sweeping the wall',
  },

  // ---------- ACT 3 - RECORD SCRATCH (still B/W, ~14-17s) ----------
  {
    id: 's14',
    vo: null,
    sfx: 'scratch',
    visual: 'Freeze mid-scream, harsh zoom into the frozen despair face, film burn flicker',
  },
  {
    id: 's15',
    vo: "There's GOT to be a better way!",
    sfx: 'slam',
    visual: '50s title card slams in: ornamental border, Limelight type, shaking on impact',
  },
  {
    id: 's16',
    vo: null,
    sfx: 'iris',
    visual: '"A BETTER WAY?" echo card, iris closes to a black pinpoint',
  },

  // ---------- ACT 4 - FULL COLOR SNAP (~17-33s) ----------
  {
    id: 's17',
    vo: 'There is. RecipeReal.',
    sfx: 'whoosh',
    visual: 'Iris burst opens into FULL COLOR modern kitchen, color floods frame left to right',
  },
  {
    id: 's18',
    vo: 'Ten thousand cooks timed every step.',
    sfx: null,
    visual: 'Phone UI hero card, counter rolls up to 10,000 REAL COOKS, avatar dots',
  },
  {
    id: 's19',
    vo: null,
    sfx: 'pop',
    visual: 'Amber starburst slams: REAL NUMBERS, small check constellation',
  },
  {
    id: 's20',
    vo: 'Real minutes on every step.',
    sfx: null,
    visual: 'Recipe step list, minute badges ticking 6:40, 12:00, 8:20 beside each row',
  },
  {
    id: 's21',
    vo: null,
    sfx: 'ding',
    visual: 'Green checks cascade down the steps, each row locks with a soft pop',
  },
  {
    id: 's22',
    vo: 'It said fifteen. It took forty-three.',
    sfx: 'slam',
    visual: 'Truth sticker slams: 15 struck through, arrow, 43 stamped THE TRUTH',
  },
  {
    id: 's23',
    vo: null,
    sfx: 'pop',
    visual: 'Starburst punch: THE TRUTH, radiating speed lines',
  },
  {
    id: 's24',
    vo: 'Cleanup? Included. Twenty extra minutes.',
    sfx: null,
    visual: 'Dishes icon with plus-20-minutes badge, honest receipt style line items',
  },
  {
    id: 's25',
    vo: 'Cook Mode runs every timer.',
    sfx: null,
    visual: 'Phone Cook Mode UI, big dial timer, step rows auto-advancing',
  },
  {
    id: 's26',
    vo: null,
    sfx: 'ding',
    visual: 'Timer stack: preheat 8:00, flip 6:30, rest 5:00, all ringing green',
  },
  {
    id: 's27',
    vo: 'No signal? Keep cooking.',
    sfx: null,
    visual: 'Airplane-mode icon, bars collapse, recipe card stays bright and loaded',
  },
  {
    id: 's28',
    vo: null,
    sfx: 'click',
    visual: 'Cabin vignette, phone offline badge, green check: WORKS OFFLINE',
  },

  // ---------- ACT 5 - PRICE GAG (~33-41s) ----------
  {
    id: 's29',
    vo: 'How much would you pay?',
    sfx: 'slam',
    visual: 'Classic infomercial framing, price card $99 slams down on velvet ropes vibe',
  },
  {
    id: 's30',
    vo: null,
    sfx: 'cash',
    visual: '$99 gets struck through, $49 slams down harder',
  },
  {
    id: 's31',
    vo: 'Ninety-nine? Forty-nine? No.',
    sfx: 'slam',
    visual: 'Countdown digits slam away one by one, cards flying off frame',
  },
  {
    id: 's32',
    vo: "It's free.",
    sfx: 'pop',
    visual: 'Beat of nothing... then FREE. detonates in a giant amber starburst',
  },
  {
    id: 's33',
    vo: 'Free?!',
    sfx: null,
    visual: 'Stunned pause, FREE?! echo type, freeze-frame energy on color',
  },
  {
    id: 's34',
    vo: null,
    sfx: 'applause',
    visual: 'Applause sting, confetti burst + starburst shower, FREE holds center',
  },
  {
    id: 's35',
    vo: 'Download RecipeReal right now.',
    sfx: null,
    visual: 'Parody hotline sticker: DOWNLOAD NOW, blinking border, operators standing by gag',
  },

  // ---------- ACT 6 - END CARD (41-50s) ----------
  {
    id: 's36',
    vo: 'RecipeReal. Cook the truth.',
    sfx: 'slam',
    visual: 'Logo wordmark lockup on brand canvas, terracotta underline',
  },
  {
    id: 's37',
    vo: null,
    sfx: null,
    visual: 'Tagline underline sweeps, small whisk mark draws in',
  },
  {
    id: 's38',
    vo: 'Real times from ten thousand cooks.',
    sfx: null,
    visual: 'Stat line + three mini badges: real times, cook mode, offline',
  },
  {
    id: 's39',
    vo: null,
    sfx: null,
    visual: 'App Store / Google Play text badges slide in from sides',
  },
  {
    id: 's40',
    vo: null,
    sfx: 'ding',
    visual: 'Full CTA card pulses; ONE frame of B/W film grain winks over the color',
  },
  {
    id: 's41',
    vo: null,
    sfx: null,
    visual: 'Logo end hold, iris closes gently to black, wordmark last light',
  },
];

export const SCENE_COUNT = SCENES.length; // 41
