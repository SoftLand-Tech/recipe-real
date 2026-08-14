import {Easing} from 'remotion';

/** Shared easing curves. */
export const EASE_OUT_QUINT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_HARD = Easing.bezier(0.6, 0.02, 0.9, 0.2);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
/** Small overshoot, settles past target. */
export const EASE_OVERSHOOT = Easing.bezier(0.3, 1.36, 0.5, 1);
/** Bigger overshoot for bar growth / slams. */
export const EASE_SLAM = Easing.bezier(0.2, 1.2, 0.32, 1);
