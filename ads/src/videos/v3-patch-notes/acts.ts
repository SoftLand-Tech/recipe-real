// Scene id → component map.
import {type FC} from 'react';
import {S01, S02, S03, S04} from './Act1';
import {S05, S06, S07, S08, S09, S10, S11} from './Act2';
import {S12, S13, S14, S15, S16, S17, S18, S19, S20, S21, S22, S23} from './Act3';
import {S24, S25, S26, S27, S28, S29, S30, S31} from './Act4';
import {S32, S33, S34, S35, S36, S37} from './Act5';
import {S38, S39, S40} from './Act6';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SCENE_COMPONENTS: Record<string, FC<any>> = {
  s01: S01,
  s02: S02,
  s03: S03,
  s04: S04,
  s05: S05,
  s06: S06,
  s07: S07,
  s08: S08,
  s09: S09,
  s10: S10,
  s11: S11,
  s12: S12,
  s13: S13,
  s14: S14,
  s15: S15,
  s16: S16,
  s17: S17,
  s18: S18,
  s19: S19,
  s20: S20,
  s21: S21,
  s22: S22,
  s23: S23,
  s24: S24,
  s25: S25,
  s26: S26,
  s27: S27,
  s28: S28,
  s29: S29,
  s30: S30,
  s31: S31,
  s32: S32,
  s33: S33,
  s34: S34,
  s35: S35,
  s36: S36,
  s37: S37,
  s38: S38,
  s39: S39,
  s40: S40,
};
