// Timeline constants for "One Recipe, Three Cooks".
// All values are absolute composition frames @ 30fps (1500 frames total).

import {at} from '../../shared/theme';

export const SCENES = {
  hookEnd: at(2.833), // 85 — hard cut to black
  freezeStart: 85, // frozen "30 MIN" card on black
  freezeEnd: 110, // black ends, canvas returns
  panelsStart: 110, // panels re-enter, card lifts to hover
  mergeStart: 900, // panels slide away, card starts transforming
  uiStart: 930, // RecipeReal estimate UI enters
  outroStart: 1297, // narrator ends here (12.72s line from 915)
  total: 1500,
} as const;

/** Hook shouts — start 4–8 frames apart so they overlap. Durations = real TTS lengths. */
export const HOOK_SHOUTS = [
  {file: 'shout-optimist.mp3', from: 14, dur: 33}, // 1.07s
  {file: 'shout-realist.mp3', from: 22, dur: 52}, // 1.72s
  {file: 'shout-beginner.mp3', from: 30, dur: 33}, // 1.07s
] as const;

/** Panels re-enter one at a time (3–10s beat). */
export const PANEL_ENTER = [111, 144, 177] as const;

/** Scripted voice lines + the exact window each cook is "speaking".
 *  Durations are the measured lengths of the real TTS renders. */
export const LINES = {
  optimist: {file: 'line-optimist.mp3', from: 300, dur: 67}, // 2.23s — 10.0–12.2s
  realist: {file: 'line-realist.mp3', from: 486, dur: 92}, // 3.07s — 16.2–19.3s
  beginner: {file: 'line-beginner.mp3', from: 690, dur: 60}, // 2.0s — 23.0–25.0s
  narrator: {file: 'line-narrator.mp3', from: 915, dur: 382}, // 12.72s — 30.5–43.2s
} as const;

export const SPEAKING = {
  optimist: [LINES.optimist.from, LINES.optimist.from + LINES.optimist.dur] as const,
  realist: [LINES.realist.from, LINES.realist.from + LINES.realist.dur] as const,
  beginner: [LINES.beginner.from, LINES.beginner.from + LINES.beginner.dur] as const,
};

/** Realist's clock sprouts extra ticks, each with a tick SFX. */
export const REALIST_TICKS = [501, 516, 531, 546] as const;

/** Beginner's card tilts with question-mark pops (boing lands at line start). */
export const Q_POPS = [702, 722, 742] as const;

/** Per-cook prop visibility windows (line ± a beat of padding). */
export const PROP_WINDOWS = {
  optimist: [292, 400] as const,
  realist: [478, 640] as const,
  beginner: [682, 800] as const,
};

/** "For you" estimates counting up, then the unified chime. */
export const ESTIMATES = [
  {start: 990, end: 1050, target: 30},
  {start: 1002, end: 1062, target: 42},
  {start: 1014, end: 1074, target: 51},
] as const;

export const COUNT_TICKS = [1000, 1012, 1024, 1036, 1048, 1060, 1072] as const;
export const CHIME_AT = 1076;
export const FOOTER_AT = 1140;

/** Outro: staggered nods, then everyone, then the wink.
 *  Outro starts after the (longer) narrator line ends at 1297. */
export const NOD_WINDOWS = {
  optimist: [[1310, 1348], [1366, 1404]] as const,
  realist: [[1328, 1366], [1366, 1404]] as const,
  beginner: [[1346, 1384], [1366, 1404]] as const,
};

export const WINK_AT = 1420;

export const AUDIO_DIR = 'audio/v4';

export const audio = (file: string): string => `${AUDIO_DIR}/${file}`;

/** Voice level ≈ -3 dB. */
export const VOICE_VOLUME = 0.71;

export type Window2 = readonly [number, number];
