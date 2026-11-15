/**
 * Full-screen cook mode (namespace `cook.*`) — OWNED BY SLICE RECIPE.
 * Vocabulary mirrors mobile's cook.* keys (mobile/src/i18n/en.ts); web-only
 * keys (notifications copy, tab-visibility notice) follow the same voice.
 */
export const en: Record<string, string> = {
  "cook.pageTitle": "Cook Mode",
  "cook.stepOf": "STEP {current} / {total}",
  "cook.stepTypeActive": "Active",
  "cook.stepTypePassive": "Passive",
  "cook.stepTypeCleanup": "Cleanup",

  // ---- Controls ----
  "cook.startCooking": "Start cooking",
  "cook.pauseCooking": "Pause",
  "cook.resumeCooking": "Resume",
  "cook.finishCooking": "Finish",
  "cook.previous": "Previous step",
  "cook.next": "Next step",
  "cook.nextStep": "Next",
  "cook.closeA11y": "Close cook mode",
  "cook.largeText": "Large text",
  "cook.largeTextOn": "Large text on",

  // ---- Status hints ----
  "cook.hintIdle": "Press start when you begin cooking",
  "cook.hintRunning": "Timing your whole cook…",
  "cook.hintPaused": "Paused",
  "cook.hintHandsOff": "Hands-off — you can step away",
  "cook.tapCardNext": "Tap card for next step",

  // ---- Per-step pace bar (teal = measured) ----
  "cook.stepExpected": "This step: ~{n}m",
  "cook.stepExpectedForYou": "This step: ~{n}m at your pace",
  "cook.stepOver": "{n}m over the estimate",
  "cook.stepPaceA11y": "Time on this step",

  // ---- Step alarm (Web Audio beep + Notification) ----
  "cook.alarmChip": "⏲ {minutes} min",
  "cook.alarmSet": "Set {minutes} min alarm",
  "cook.alarmArmed": "alarm on",
  "cook.alarmCancel": "cancel",
  "cook.alarmDoneTitle": "RecipeReal",
  "cook.alarmDoneBody": "Step {n}: your {minutes} minutes are up",

  // ---- Confirmations ----
  "cook.finishTitle": "Finish cooking?",
  "cook.finishMessage": "Your stopwatch time will be saved as your real cook time.",
  "cook.finishRemainingOne":
    "You still have 1 step left. Finish early and log your elapsed cook time?",
  "cook.finishRemainingMany":
    "You still have {n} steps left. Finish early and log your elapsed cook time?",
  "cook.finishLogTime": "Finish & log time",
  "cook.keepCooking": "Keep cooking",
  "cook.discardTitle": "Leave Cook Mode?",
  "cook.discardMessage":
    "Your stopwatch and step timings for this cook will be lost.",
  "cook.discardExitBtn": "Discard & exit",

  // ---- Feedback phase ----
  "cook.youCooked": "You cooked it!",
  "cook.yourTime": "Your time",
  "cook.publisherEst": "Publisher est.",
  "cook.cleanupEstimate": "Cleanup estimate: ~{n} min",
  "cook.cleanupLabel": "Cleanup: {time}",
  "cook.feedbackPrompt": "How did it feel vs. the estimate?",
  "cook.faster": "Faster",
  "cook.fasterSub": "Finished ahead of the estimate",
  "cook.asExpected": "As expected",
  "cook.asExpectedSub": "Right around the expected time",
  "cook.slower": "Slower",
  "cook.slowerSub": "Took longer than listed",
  "cook.skip": "Skip",
  "cook.done": "Done",

  // ---- Submission ----
  "cook.saving": "Saving…",
  "cook.saved": "Saved.",
  "cook.saveFailed": "Could not save. Please try again later.",
  "cook.pacePending": "Your pace calibration updates in the background.",
  "cook.savedSignedOut":
    "This cook wasn't saved. Sign in before finishing to log your time and calibrate your pace.",
  "cook.signInToSave": "Sign in to save",

  // ---- Manual time adjustment ----
  "cook.adjustTime": "Adjust time",
  "cook.adjustHint": "Forgot to pause? Set the time it really took.",
  "cook.adjustUse": "Use this time",
  "cook.adjustMinus": "One minute less",
  "cook.adjustPlus": "One minute more",
  "cook.adjustedNote": "Measured {measured} · adjusted to {adjusted}",

  // ---- States ----
  "cook.noSteps": "This recipe has no steps to cook yet.",
  "cook.loadFailed": "Couldn't load this recipe.",
  "cook.tabHiddenNotice":
    "Welcome back — the stopwatch kept timing while you were away.",
  "cook.alarmFiredTitle": "Time's up!",
  "cook.alarmFiredBody": "Step {n}: your {minutes} minutes are up",
};
