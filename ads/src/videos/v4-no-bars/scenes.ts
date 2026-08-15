// "No Bars. Full Dinner." — scene table (audio-first: this drives the whole build).
// VO lines ≤ 9 words, deadpan calm. vo=null marks SFX-only punch scenes (4 max).
// sfx names map to files in public/audio/v4/ (see audio.ts in this folder).

export type Scene = {
  id: string;
  vo: string | null;
  sfx: string | null;
  visual: string;
};

export const scenes: Scene[] = [
  // ---- ACT 1 · HOOK (0–3s) ----
  {
    id: 's01',
    vo: 'No bars.',
    sfx: 'blip-descend',
    visual: 'Four signal bars, tallest dies first with a descending blip, cold blue tint creeps in.',
  },
  {
    id: 's02',
    vo: 'No Wi-Fi.',
    sfx: 'blip-descend',
    visual: 'Two more bars flicker out with glitch jitter, tint deepens to subway blue.',
  },
  {
    id: 's03',
    vo: null,
    sfx: 'error-womp',
    visual: 'Last bar flatlines to a zero-bar icon, "Searching…" pulses under it.',
  },
  {
    id: 's04',
    vo: null,
    sfx: 'slam-boom',
    visual: 'HARD SLAM: "NO SIGNAL" fills frame, chromatic split, scanline shudder.',
  },
  {
    id: 's05',
    vo: "Dinner's still on.",
    sfx: 'plate-set',
    visual: 'Same frame pushes wide: the plated dinner was there all along, steam rising.',
  },

  // ---- ACT 2 · LOCATION MONTAGE 1 (3–12s): subway / summit / bunker ----
  {
    id: 's06',
    vo: 'Sixty feet under Manhattan.',
    sfx: 'tunnel-rumble',
    visual: 'SLAM "SUBWAY PLATFORM": tunnel arch, rails, tile wall, cold blue, light flicker.',
  },
  {
    id: 's07',
    vo: 'Zero bars. Obviously.',
    sfx: 'blip-descend',
    visual: 'Phone status bar close-up: bars die one by one into NO SERVICE.',
  },
  {
    id: 's08',
    vo: 'Step three. Simmer.',
    sfx: 'train-whoosh',
    visual: 'Train WHOOSH wipe across frame; timer HUD lands STEP 3 · SIMMER 08:00.',
  },
  {
    id: 's09',
    vo: 'The timer keeps counting.',
    sfx: 'step-ding',
    visual: 'HUD close-up: countdown ticks 07:59 → 07:44, terracotta progress ring.',
  },
  {
    id: 's10',
    vo: 'Ten thousand feet up.',
    sfx: 'wind-gust',
    visual: 'SLAM "SUMMIT": ice peaks white-blue, wind streaks, one lone bar waving.',
  },
  {
    id: 's11',
    vo: 'One bar. Waving goodbye.',
    sfx: 'blip-descend',
    visual: 'Signal icon close-up: single bar tilts, drops off the icon, wind streaks.',
  },
  {
    id: 's12',
    vo: 'Step four. Rest five.',
    sfx: 'step-ding',
    visual: 'Timer HUD STEP 4 · REST 05:00 with frost vignette creeping the edges.',
  },
  {
    id: 's13',
    vo: 'Zero bars in here since 1962.',
    sfx: 'tunnel-rumble',
    visual: 'SLAM "BASEMENT BUNKER": amber tungsten glow, can shelves, concrete pipes.',
  },
  {
    id: 's14',
    vo: 'The stew is unbothered.',
    sfx: 'bubble',
    visual: 'HUD STEP 5 · SEASON ticking in amber glow, tiny bubbles rise on the pot icon.',
  },

  // ---- ACT 3 · CLOUD APP GAG (12–22s) ----
  {
    id: 's15',
    vo: 'Meanwhile, a cloud recipe app.',
    sfx: 'spinner-strain',
    visual: 'Gray phone slides in: generic "CloudRecipe" app, spinner starts turning.',
  },
  {
    id: 's16',
    vo: 'Buffering step two of fourteen.',
    sfx: 'spinner-strain',
    visual: 'Spinner wobbles off-axis, sweat drop rolls down the phone, "0%".',
  },
  {
    id: 's17',
    vo: 'Zero percent. Still thinking.',
    sfx: 'error-womp',
    visual: 'Spinner strains slower and slower, stalls mid-turn, percent flickers 0%.',
  },
  {
    id: 's18',
    vo: "The cloud can't help down here.",
    sfx: 'error-womp',
    visual: 'Spinner gives up: gray error cloud with rain lines drips over the phone.',
  },
  {
    id: 's19',
    vo: "We don't need the internet.",
    sfx: 'snap-in',
    visual: 'RecipeReal phone snaps in instantly, crisp terracotta step card pops.',
  },
  {
    id: 's20',
    vo: 'Every step, already on the phone.',
    sfx: 'step-ding',
    visual: 'Step list renders instantly, checks cascade down all six rows.',
  },
  {
    id: 's21',
    vo: 'Offline-first, by design.',
    sfx: 'ui-tick',
    visual: 'WORKS OFFLINE badge stamps in, crossed-out cloud icon dissolves behind it.',
  },
  {
    id: 's22',
    vo: 'Back to dinner.',
    sfx: 'plate-set',
    visual: 'Hard cut: pot lid lifts, steam burst, ladle rises out of frame.',
  },

  // ---- ACT 4 · LOCATION MONTAGE 2 (22–36s): airplane / desert / polar ----
  {
    id: 's23',
    vo: 'Thirty-five thousand feet.',
    sfx: 'airplane-hum',
    visual: 'SLAM "35,000 FT": airplane window, wing, drifting cloud layers, navy tint.',
  },
  {
    id: 's24',
    vo: 'Airplane mode. Obviously.',
    sfx: 'ui-tick',
    visual: 'Airplane-mode icon slides ON in a status pill, bars cross out behind it.',
  },
  {
    id: 's25',
    vo: 'Step six. Reduce.',
    sfx: 'step-ding',
    visual: 'Timer HUD STEP 6 · REDUCE 04:00 floating over the window view.',
  },
  {
    id: 's26',
    vo: null,
    sfx: 'ui-tick',
    visual: 'Seatmate side-eye gag: passenger glances over, HUD reflects on the window.',
  },
  {
    id: 's27',
    vo: 'An open desert.',
    sfx: 'wind-gust',
    visual: 'SLAM "OPEN DESERT": dune curves, heat shimmer bands, sun glare, sand tint.',
  },
  {
    id: 's28',
    vo: 'Zero bars to the horizon.',
    sfx: 'wind-gust',
    visual: 'Signal icon melts and wavers in the heat shimmer above the dunes.',
  },
  {
    id: 's29',
    vo: 'Step seven. Sear hard.',
    sfx: 'sizzle',
    visual: 'Timer HUD STEP 7 · SEAR 03:00, pan icon throwing sparks.',
  },
  {
    id: 's30',
    vo: 'One hundred six in the shade.',
    sfx: 'sizzle',
    visual: 'Thermometer gag: 106°F needle pegged, sun beats on the HUD.',
  },
  {
    id: 's31',
    vo: 'Polar research station.',
    sfx: 'wind-gust',
    visual: 'SLAM "POLAR STATION −40°": aurora ribbons, hut silhouette, pale tint.',
  },
  {
    id: 's32',
    vo: 'Minus forty outside.',
    sfx: 'wind-gust',
    visual: 'Frost crackles across the frame edges, aurora ribbons shift overhead.',
  },
  {
    id: 's33',
    vo: 'Stew. Still perfect.',
    sfx: 'step-ding',
    visual: 'Timer HUD STEP 8 · SIMMER 10:00, steam fogs the frost from inside.',
  },
  {
    id: 's34',
    vo: 'Eight steps. Zero bars.',
    sfx: 'step-ding',
    visual: 'Step list 8/8: checks cascade down, "0 bars" stamped in the corner.',
  },

  // ---- ACT 5 · NOWHERE PLATING (36–44s) ----
  {
    id: 's35',
    vo: 'Plating in the middle of nowhere.',
    sfx: 'plate-set',
    visual: 'Wide shot: cook plates dinner at a lone table in an empty landscape.',
  },
  {
    id: 's36',
    vo: 'Cook times tested by thousands.',
    sfx: 'ui-tick',
    visual: 'Step list all checked, microcopy "calibrated by 4,212 home cooks".',
  },
  {
    id: 's37',
    vo: 'Cleanup included.',
    sfx: 'ui-tick',
    visual: 'Badge stamps in: CLEANUP 12 MIN · INCLUDED, sponge icon wink.',
  },
  {
    id: 's38',
    vo: null,
    sfx: 'bite-crunch',
    visual: 'Close on the fork: cook takes the bite. Pure crunch punch.',
  },
  {
    id: 's39',
    vo: 'Worth the walk.',
    sfx: 'wind-gust',
    visual: 'Satisfied cook nods once, enormous quiet landscape behind.',
  },
  {
    id: 's40',
    vo: 'Your recipes live on your phone.',
    sfx: 'step-ding',
    visual: 'Phone holds the full recipe library, crossed-cloud icon fades off it.',
  },

  // ---- ACT 6 · END CARD (44–50s) ----
  {
    id: 's41',
    vo: 'Not the cloud.',
    sfx: 'error-womp',
    visual: 'Wordmark reveal: "RecipeReal" assembles, gray cloud icon pops away.',
  },
  {
    id: 's42',
    vo: 'No bars. Full dinner.',
    sfx: 'plate-set',
    visual: 'Tagline lockup "NO BARS. FULL DINNER." over the final dinner tableau.',
  },
  {
    id: 's43',
    vo: 'Download free.',
    sfx: 'ui-tick',
    visual: 'CTA pill "Download free" + App Store / Google Play text badges.',
  },
  {
    id: 's44',
    vo: 'RecipeReal.',
    sfx: 'step-ding',
    visual: 'End card hold: wordmark, zero-bars icon winks on the dot of the R.',
  },
];
