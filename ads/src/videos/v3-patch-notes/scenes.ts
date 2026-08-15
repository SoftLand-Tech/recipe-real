// "Recipe Patch Notes v2.0" — scene table (audio-first: written before any component code).
// VO lines are deliberately terse (2–6 words): 40 scenes must fit 1500 frames,
// and scene boundaries are driven by measured VO clip durations.

export type SfxName =
  | 'sfx-error'
  | 'sfx-click'
  | 'sfx-typing'
  | 'sfx-clack'
  | 'sfx-stamp'
  | 'sfx-whoosh'
  | 'sfx-ding'
  | 'sfx-fanfare'
  | 'sfx-swoosh'
  | 'sfx-chime'
  | 'sfx-buzz';

export interface Scene {
  /** zero-padded scene id, s01..s40 */
  id: string;
  /** VO text as spoken (null = SFX-only punch scene). On-screen text may differ. */
  vo: string | null;
  sfx: SfxName;
  /** one-line art direction */
  visual: string;
}

export const SCENES: Scene[] = [
  // ── ACT 1 · CRASH (hook) ────────────────────────────────────────────────
  {
    id: 's01',
    vo: 'Dinner dot exe has crashed.',
    sfx: 'sfx-error',
    visual:
      'OS crash dialog slams onto dark desktop, scale 1.3→1 with damped wobble; title bar "dinner.exe", body "recipe_v1 (blog) is not responding".',
  },
  {
    id: 's02',
    vo: null,
    sfx: 'sfx-click',
    visual:
      'SFX-only punch: cursor arrow glides from [Wait] to [Force quit], click flash, dialog collapses away.',
  },
  {
    id: 's03',
    vo: 'Stack trace never lies.',
    sfx: 'sfx-typing',
    visual:
      'Terminal window, mono text types in fast: "Traceback (most recent dinner): at preheat (missing) / at chop (4 claimed, 10 actual) / at cleanup (not implemented)".',
  },
  {
    id: 's04',
    vo: 'Reported fifteen, actual forty-three.',
    sfx: 'sfx-buzz',
    visual:
      'Terminal dump panel: "reported 15:00" gray strikethrough vs "actual 43:00" terracotta slam; horizontal bars 15 vs 43 scale in, red delta chip "+28:00".',
  },

  // ── ACT 2 · BUG TRACKER ─────────────────────────────────────────────────
  {
    id: 's05',
    vo: 'Three open bugs.',
    sfx: 'sfx-whoosh',
    visual:
      'Bug tracker board wipes in: "recipe-repo / issues — 3 open", three stub rows fly in with red SEV badges, count badge ticks 0→3.',
  },
  {
    id: 's06',
    vo: 'One-oh-one: chopping.',
    sfx: 'sfx-clack',
    visual:
      'Issue card #101 slides from right: "chopping: labeled 4 min — takes 10", labels [timing][SEV-1], reporter "you, hungry".',
  },
  {
    id: 's07',
    vo: 'Labeled four, takes ten.',
    sfx: 'sfx-typing',
    visual:
      'Repro-steps panel types in; step 2 "chop onions" carries a mini timer that snaps 4:00 → 10:00 in red with a shake.',
  },
  {
    id: 's08',
    vo: 'Confirmed. By everyone.',
    sfx: 'sfx-stamp',
    visual:
      'Card #101 gets CONFIRMED rubber stamp, scale 2→1 rotate -12°, shake on impact, sub-badge "repro: 10,406 cooks".',
  },
  {
    id: 's09',
    vo: 'One-oh-two: preheat missing.',
    sfx: 'sfx-clack',
    visual:
      'Issue card #102: "preheat step missing", repro "step 3: bake — oven still cold", temp readout 23°C gray vs 180°C ghosted.',
  },
  {
    id: 's10',
    vo: null,
    sfx: 'sfx-clack',
    visual:
      'SFX-only punch: issue card #103 "cleanup not implemented", repro "step 9: dishes — while(true)", cursor blinks at end.',
  },
  {
    id: 's11',
    vo: 'Severity: dinner-breaking.',
    sfx: 'sfx-stamp',
    visual:
      'Three mini issue cards in a row, CONFIRMED stamps cascade across them; red banner slides down "severity: DINNER-BREAKING".',
  },

  // ── ACT 3 · THE COMMUNITY PATCH ─────────────────────────────────────────
  {
    id: 's12',
    vo: 'First, git blame.',
    sfx: 'sfx-typing',
    visual: 'Terminal: prompt types "git blame dinner.md", caret blinks, Enter flash.',
  },
  {
    id: 's13',
    vo: 'Blame: a blog template.',
    sfx: 'sfx-buzz',
    visual:
      'Blame output lines: "blog_template.html · 2009 · serves 4, ready in 15" highlighted terracotta; author line gray.',
  },
  {
    id: 's14',
    vo: 'So we open-sourced dinner.',
    sfx: 'sfx-whoosh',
    visual:
      'Repo banner moment: "recipereal/recipes" wordmark, fork counter spins up 0→10,000, "open source" chip pops.',
  },
  {
    id: 's15',
    vo: 'Ten thousand cooks submitted fixes.',
    sfx: 'sfx-whoosh',
    visual:
      'PR feed: rows slide in and merge left with green flash; contributor counter ticks 9,998 → 10,000, "and counting" pulses.',
  },
  {
    id: 's16',
    vo: 'Re-timed by four thousand cooks.',
    sfx: 'sfx-clack',
    visual:
      'PR detail card "PR #481 — re-time: chop": diff chip "+10 min" green, avatar row of cook circles, merge check draws on.',
  },
  {
    id: 's17',
    vo: 'Continuous integration, for dinner.',
    sfx: 'sfx-ding',
    visual:
      'CI pipeline rail: [chop]→[simmer]→[plate] nodes; first node spinner snaps to green check, header "CI · every step verified".',
  },
  {
    id: 's18',
    vo: null,
    sfx: 'sfx-ding',
    visual:
      'SFX-only punch: remaining CI nodes cascade green (preheat ✓, cleanup ✓), connection lines fill green left→right.',
  },
  {
    id: 's19',
    vo: 'Plus preheat: five minutes.',
    sfx: 'sfx-typing',
    visual:
      'Diff view panel, tab "steps.yaml": line "− preheat: omitted" red, "+ preheat: 5 min, verified" green slides in with commit hash.',
  },
  {
    id: 's20',
    vo: 'Plus cleanup: twenty.',
    sfx: 'sfx-typing',
    visual:
      'Diff view continues, tab "cleanup.ts": "− cleanup: not implemented" / "+ cleanup: 20 min", green bar longer than red.',
  },
  {
    id: 's21',
    vo: 'Twelve thousand lines fixed.',
    sfx: 'sfx-whoosh',
    visual:
      'Diffstat: "+12,440" green bar and "−9,881" red bar grow proportionally, mono numerals count up.',
  },
  {
    id: 's22',
    vo: 'Reviewed by actual cooks.',
    sfx: 'sfx-click',
    visual:
      'Code review card: comment bubble "LGTM. Cooked it myself. Twice." from @maria_cooks with avatar circle, approve check pops.',
  },
  {
    id: 's23',
    vo: 'Merged. Ready to ship.',
    sfx: 'sfx-whoosh',
    visual:
      'Branch graph: two SVG lines merge into main, "merged into main" chip, tag "v2.0-rc" stamps on in terracotta.',
  },

  // ── ACT 4 · RELEASE ─────────────────────────────────────────────────────
  {
    id: 's24',
    vo: 'Version two point oh.',
    sfx: 'sfx-fanfare',
    visual:
      'Version badge morph: gray v1.0 badge shrinks/strikes, terracotta v2.0 badge pops huge (Bebas), radial pulse behind.',
  },
  {
    id: 's25',
    vo: 'Fixed: fifteen to forty-three.',
    sfx: 'sfx-clack',
    visual:
      'Changelog panel header "CHANGELOG · v2.0": entry "fixed: 15 → 43" with red 15 struck, green 43, hash #a41f.',
  },
  {
    id: 's26',
    vo: 'Added cleanup, honest minutes.',
    sfx: 'sfx-clack',
    visual:
      'Changelog entry: "added: cleanup (+20 min, honest)" with "+20:00" chip ticking up.',
  },
  {
    id: 's27',
    vo: 'Removed: lying dependencies.',
    sfx: 'sfx-buzz',
    visual:
      'Changelog entry: "removed: lying dependencies" — dependency chips strike out and fall away one by one.',
  },
  {
    id: 's28',
    vo: 'Cook mode, auto timers.',
    sfx: 'sfx-ding',
    visual:
      'Changelog entry: "added: Cook Mode — auto timers" with tiny dial that rotates and dings a check.',
  },
  {
    id: 's29',
    vo: 'Recipes work offline.',
    sfx: 'sfx-click',
    visual:
      'Changelog entry: "added: offline-first recipes" with signal bars that get slashed, recipe card stays solid.',
  },
  {
    id: 's30',
    vo: 'Breaking change: dinner works.',
    sfx: 'sfx-fanfare',
    visual:
      'Full-width Bebas banner: "BREAKING CHANGE" terracotta strip, "DINNER NOW WORKS" slams beneath, subtle shake.',
  },
  {
    id: 's31',
    vo: 'No more fantasy estimates.',
    sfx: 'sfx-error',
    visual:
      'Full-bleed statement on near-black: huge Bebas "NO MORE FANTASY ESTIMATES." words slam in one by one.',
  },

  // ── ACT 5 · DEPLOY ──────────────────────────────────────────────────────
  {
    id: 's32',
    vo: 'Deploy to the kitchen.',
    sfx: 'sfx-swoosh',
    visual:
      'Phone mockup: update banner "RecipeReal 2.0 — ready to install" drops in, [Install] button pulses, cursor taps it.',
  },
  {
    id: 's33',
    vo: null,
    sfx: 'sfx-typing',
    visual:
      'SFX-only punch: install progress bar fills 0→100%, label "installing honesty…", percentage ticks, green check at end.',
  },
  {
    id: 's34',
    vo: 'Cook mode, forty-three verified.',
    sfx: 'sfx-ding',
    visual:
      'Phone Cook Mode screen: giant 43:00 with progress ring sweeping, chip "verified by 10,406 cooks", green accents.',
  },
  {
    id: 's35',
    vo: 'Timers run themselves.',
    sfx: 'sfx-click',
    visual:
      'Phone step list auto-advances: rows collect green checks staggered, mini timer chips cascade down.',
  },
  {
    id: 's36',
    vo: 'Dinner: passing.',
    sfx: 'sfx-chime',
    visual:
      'CI build card: "dinner — passing ✓" with big check drawing on, "build #8,402 · 0 failed · 1 eaten".',
  },
  {
    id: 's37',
    vo: 'Ship dinner. Not excuses.',
    sfx: 'sfx-fanfare',
    visual:
      'Statement card: Bebas "SHIP DINNER. NOT EXCUSES." terracotta on near-black, scale punch + underline swipe.',
  },

  // ── ACT 6 · END CARD ────────────────────────────────────────────────────
  {
    id: 's38',
    vo: 'Recipe Real. Version two of every recipe.',
    sfx: 'sfx-chime',
    visual:
      'RecipeReal wordmark inside terracotta release badge, v2.0 chip, ring ripple expands, faint terminal grid behind.',
  },
  {
    id: 's39',
    vo: 'Cook the truth.',
    sfx: 'sfx-ding',
    visual:
      'Tagline lockup: "v2.0 of every recipe." small mono, "COOK THE TRUTH." huge Bebas, underline draws.',
  },
  {
    id: 's40',
    vo: 'Download free.',
    sfx: 'sfx-click',
    visual:
      'End card: badge logo top, CTA button "Download free" pulsing, "App Store" / "Google Play" text badges beneath. Absorbs remainder.',
  },
];

export const SCENE_COUNT = SCENES.length;
