// SpeedrunTruth — scene table (audio-first: this table drives everything else).
// vo: text sent to TTS (null = SFX-only punch scene, max 4 per video).
// sfx: file name in public/audio/v1/sfx-<name>.mp3 (null = VO only).
// visual: one-line art direction.

export type Scene = {
  id: string;
  vo: string | null;
  sfx: string | null;
  visual: string;
};

export const SCENES: Scene[] = [
  // ---------- ACT 1 — HOOK: the failed run (s01–s05) ----------
  {
    id: 's01',
    vo: 'Dinner failed.',
    sfx: 'buzzer',
    visual:
      'Black; GAME OVER panel slams down scale 1.6→1 in 6 frames, red stamp FAILED, panel jitters under buzzer.',
  },
  {
    id: 's02',
    vo: 'The recipe promised fifteen.',
    sfx: 'blip',
    visual:
      'Blog recipe card mock: “Weeknight Chili — 15:00” with pretty photo frame; amber promise badge pops.',
  },
  {
    id: 's03',
    vo: 'Elapsed: forty three twelve.',
    sfx: 'tick',
    visual:
      'Huge VT323 run timer snaps 15:00 → 43:12 with screen shake, red glow, promised-time ghost behind.',
  },
  {
    id: 's04',
    vo: null, // SFX-only punch
    sfx: 'buzzer',
    visual:
      'Smash cut: giant Bebas headline “THAT TIME WAS A CHEATED RUN.” red, stamp texture, split-second glitch bars.',
  },
  {
    id: 's05',
    vo: 'Tonight, we run it for real.',
    sfx: 'whoosh',
    visual:
      'Title card slams in: ANY% COOK — THE SPEEDRUN, Bebas cream on navy, terracotta keyline, scanlines.',
  },

  // ---------- ACT 2 — the fantasy route (s06–s12) ----------
  {
    id: 's06',
    vo: 'Run starts now.',
    sfx: 'blip',
    visual:
      '3-2-1 countdown flips to GO!, route map polyline draws left→right, HUD chrome (timer + split rail) boots up.',
  },
  {
    id: 's07',
    vo: 'Chop split. Blog said four.',
    sfx: 'stamp',
    visual:
      'Split rail row CHOP slams with blog 4:00 claim; knife icon chopping grid of onion cells, timer runs.',
  },
  {
    id: 's08',
    vo: 'Real time? Ten.',
    sfx: 'stamp',
    visual:
      'Counter races 4:00 → 10:00, red +6:00 SLOWER badge pops on huge delta, split row goes red.',
  },
  {
    id: 's09',
    vo: 'Your wrists know.',
    sfx: 'tick',
    visual:
      'Macro: knife icon mid-chop, onion-cell grid cells splitting one per beat, timer ticking in corner.',
  },
  {
    id: 's10',
    vo: 'Preheat? Not in their route.',
    sfx: 'whoosh',
    visual:
      'Route map with a missing segment circled in red; oven flame icon sits off-route, dimmed.',
  },
  {
    id: 's11',
    vo: "That's five minutes they forgot.",
    sfx: 'stamp',
    visual:
      '+5:00 PENALTY stamp slams rotated −8deg, route gap fills red hatched, timer jumps.',
  },
  {
    id: 's12',
    vo: 'Nobody times the cleanup split.',
    sfx: 'stamp',
    visual:
      'Split row CLEANUP — claimed 0:00 replaced by big question mark; sponge + stacked dishes icons.',
  },

  // ---------- ACT 3 — RecipeReal, the new route (s13–s25) ----------
  {
    id: 's13',
    vo: null, // SFX-only punch
    sfx: 'whoosh',
    visual:
      'NEW ROUTE AVAILABLE modal drops from top, terracotta keyline, cursor-shaped caret blinks under it.',
  },
  {
    id: 's14',
    vo: 'RecipeReal re-timed every step.',
    sfx: 'blip',
    visual:
      'Phone-frame app UI: step list with per-step real durations counting in, terracotta header bar.',
  },
  {
    id: 's15',
    vo: 'Ten thousand home cooks ran it.',
    sfx: 'drop',
    visual:
      'Leaderboard rows stagger-drop: MamaRosa 43:09, DadCooksDaily 43:31, Batch3Brian 43:44… rank deltas green.',
  },
  {
    id: 's16',
    vo: 'Every split, re-verified.',
    sfx: 'tick',
    visual:
      'Split rail rows cascade green check marks top→bottom, each with tiny “n=10,000 runs” sub-label.',
  },
  {
    id: 's17',
    vo: 'Chop: ten real minutes.',
    sfx: 'blip',
    visual:
      'CHOP row recalibrates 4:00 → 10:00 flipping to green, knife icon now on-route, delta badge resets.',
  },
  {
    id: 's18',
    vo: 'Preheat: back in the route.',
    sfx: 'blip',
    visual:
      'Route gap re-draws as amber segment, oven flame icon lights, PREHEAT 5:00 row slots in.',
  },
  {
    id: 's19',
    vo: 'Cleanup: twelve. Honest.',
    sfx: 'stamp',
    visual:
      'CLEANUP row flips 0:00? → 12:00 green, sponge icon sparkles, question mark dissolves.',
  },
  {
    id: 's20',
    vo: 'The honest route is set.',
    sfx: 'tick',
    visual:
      'Full route map complete with 6 timed nodes, total banner 43:12 ETD in terracotta.',
  },
  {
    id: 's21',
    vo: 'Frame perfect? No.',
    sfx: 'blip',
    visual:
      'Zoom on timer face with tiny ±2s tolerance band drawn around target line, “no exploits” tag.',
  },
  {
    id: 's22',
    vo: 'Honest? Always.',
    sfx: 'chime',
    visual:
      'Split board all-green, delta column reads 00:00 across, green wash pulse over HUD.',
  },
  {
    id: 's23',
    vo: 'Cook Mode. Timers run themselves.',
    sfx: 'blip',
    visual:
      'Cook Mode screen: current step card with auto timer ring sweeping 10:00, next steps queued below.',
  },
  {
    id: 's24',
    vo: 'Works offline. Zero bars.',
    sfx: 'blip',
    visual:
      'Offline badge slams: crossed-out signal bars, “0 bars, 0 excuses” sub-label, recipes grid stays lit.',
  },
  {
    id: 's25',
    vo: 'New personal best incoming.',
    sfx: 'whoosh',
    visual:
      'Run reset: route nodes un-light, READY banner, PB target 43:12 ghosted behind starting line.',
  },

  // ---------- ACT 4 — the honest run (s26–s36) ----------
  {
    id: 's26',
    vo: 'The honest run starts now.',
    sfx: 'blip',
    visual:
      'GO! flash green, timer starts from 00:00, route node 1 lights, split rail resets to active.',
  },
  {
    id: 's27',
    vo: 'Chop lands at ten sharp.',
    sfx: 'stamp',
    visual:
      'Chop split lands exactly 10:00, delta badge +0:00 in green, tiny confetti sparks at the row.',
  },
  {
    id: 's28',
    vo: 'The timer starts itself.',
    sfx: 'tick',
    visual:
      'Cook Mode macro: timer ring sweeping, tick marks strobing, step card “Chop — 10:00” active.',
  },
  {
    id: 's29',
    vo: 'Preheat? Five on the dot.',
    sfx: 'stamp',
    visual:
      'Preheat split lands 15:00 cumulative, amber flame badge, route node 2 lights, delta still 00:00.',
  },
  {
    id: 's30',
    vo: 'Simmer: twenty. Auto-timed.',
    sfx: 'tick',
    visual:
      'Pot icon with rising bubble particles, timeline bar fills to 35:00, next-step queue advances.',
  },
  {
    id: 's31',
    vo: 'Delta hugging zero.',
    sfx: 'blip',
    visual:
      'Live delta flickers −00:04 → +00:02 → 00:00, oscilloscope-style line drawing through zero axis.',
  },
  {
    id: 's32',
    vo: 'Nothing left to guess.',
    sfx: 'tick',
    visual:
      'Split rail close-up pulsing, final two rows locked, timer rushing 35:00 → 42:50.',
  },
  {
    id: 's33',
    vo: 'Landing every split. On. The. Second.',
    sfx: 'stamp',
    visual:
      'Final split lands 43:12 exactly; row flashes gold split, screen flash, delta 00:00 big.',
  },
  {
    id: 's34',
    vo: 'Personal best: forty three twelve.',
    sfx: 'fanfare',
    visual:
      'PB banner slams with confetti burst from center, “NEW PB 43:12” gold on navy, confetti rains.',
  },
  {
    id: 's35',
    vo: 'Real. Verified.',
    sfx: 'pop',
    visual:
      'Terracotta VERIFIED stamp rotates in over the time, check seal ring, confetti still falling.',
  },
  {
    id: 's36',
    vo: "That's the run. That's dinner.",
    sfx: 'chime',
    visual:
      'Finish-line checkered banner wipes across, plate icon with steam curls, timer frozen 43:12.',
  },

  // ---------- ACT 5 — the comparison (s37–s41) ----------
  {
    id: 's37',
    vo: 'The blog promised fifteen.',
    sfx: 'blip',
    visual: 'Left card slams: FANTASY ROUTE — 15:00, red hatched texture, “cheated run” tag.',
  },
  {
    id: 's38',
    vo: 'Reality: forty three twelve.',
    sfx: 'stamp',
    visual: 'Right card slams: VERIFIED ROUTE — 43:12, terracotta, check seal, “n=10,000” tag.',
  },
  {
    id: 's39',
    vo: null, // SFX-only punch
    sfx: 'whoosh',
    visual:
      'Both cards collide center with VS burst; delta ribbon “+28:12 the blog never timed” stretches between.',
  },
  {
    id: 's40',
    vo: 'Stop running fantasy routes.',
    sfx: 'buzzer',
    visual:
      'Fantasy card shatters: cracks + fragments fly, red X stamps through 15:00, glitch bars.',
  },
  {
    id: 's41',
    vo: 'Run real ones.',
    sfx: 'chime',
    visual:
      'Verified card re-centers grown, big green check draws on, “43:12. every time you cook.” sub-line.',
  },

  // ---------- ACT 6 — end card (s42–s44) ----------
  {
    id: 's42',
    vo: 'RecipeReal. Honest times.',
    sfx: 'fanfare',
    visual:
      'Logo wordmark reveal: Recipe (cream) Real (terracotta), keyline underline draws, tagline types on.',
  },
  {
    id: 's43',
    vo: 'Download free. Start your run.',
    sfx: 'blip',
    visual:
      'CTA button pops in “DOWNLOAD FREE” terracotta pill, App Store / Google Play text badges below.',
  },
  {
    id: 's44',
    vo: null, // final hold (absorbs remainder)
    sfx: 'chime',
    visual:
      'Logo hold: subtle scanline drift, CTA pulse ring, tiny timer badge 43:12 VERIFIED bottom-right.',
  },
];
