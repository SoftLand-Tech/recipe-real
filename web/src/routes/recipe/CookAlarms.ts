/**
 * Web step-alarm plumbing for Cook Mode (slice RECIPE).
 *
 * The web twin of mobile's utils/cookAlarms.ts, on browser primitives:
 *   - a triple beep via Web Audio (an AudioContext created on the Start
 *     click, because browsers only allow audio after a user gesture);
 *   - a system Notification when the permission was granted (requested on
 *     Start, non-blocking — a refusal never blocks cooking);
 *   - formatCookElapsed, the H:MM:SS stopwatch readout.
 *
 * There is no OS alarm scheduler on the web: the armed alarm is a wall-clock
 * deadline (epoch ms) that the live 500ms tick checks, so a throttled
 * background tab still fires (late) the moment it wakes — and the stopwatch
 * itself never drifts because elapsed is always recomputed from timestamps.
 */

/** Format pause-adjusted elapsed ms as M:SS / H:MM:SS (mobile's readout). */
export function formatCookElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * UUID for the cook-session idempotency key: crypto.randomUUID when present,
 * else an RFC-4122-v4-shaped Math.random fallback (adequate for client-side
 * dedupe, same trade-off mobile makes).
 */
export function makeIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  const rnd = () =>
    Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${
    ((Math.random() * 0x4) | 0x8).toString(16)
  }${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}

// ---- Web Audio beep -----------------------------------------------------------

let audioCtx: AudioContext | null = null;

/**
 * Create/resume the AudioContext. MUST be called from a user gesture (the
 * Start button) — browsers refuse audio otherwise. Never throws.
 */
export function primeAudioContext(): void {
  try {
    if (audioCtx == null) {
      const Ctor =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {
        // Autoplay policy refused: alarms fall back to the visual state only.
      });
    }
  } catch {
    // No audio available — degrade silently.
  }
}

/** One short 880Hz tone; `at` schedules on the AudioContext clock. */
function tone(at: number): void {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(at);
  osc.stop(at + 0.2);
}

/** The step-alarm sound: three crisp beeps. Never throws. */
export function playAlarmBeep(): void {
  try {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    tone(now);
    tone(now + 0.28);
    tone(now + 0.56);
  } catch {
    // Degrade silently — the visual state change still communicates the alarm.
  }
}

// ---- Notification API -----------------------------------------------------------

/** Whether system notifications exist in this browser (they don't on iOS Safari). */
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Request notification permission (called on Start — a user gesture). Fire
 * and forget: a refusal or an unavailable API never blocks cooking, and the
 * in-app beep + chip state still work.
 */
export function requestAlarmPermission(): void {
  if (!notificationsSupported()) return;
  try {
    if (Notification.permission === "default") {
      void Notification.requestPermission().catch(() => {
        // Refused — degrade to beep-only alarms.
      });
    }
  } catch {
    // Some browsers throw on requestPermission without a gesture — ignore.
  }
}

/**
 * Show the step-alarm notification (only when previously granted). Never
 * throws; a missing/denied permission is a no-op.
 */
export function showAlarmNotification(title: string, body: string): void {
  if (!notificationsSupported()) return;
  try {
    if (Notification.permission === "granted") {
      new Notification(title, { body, tag: "rr-cook-alarm" });
    }
  } catch {
    // Constructing notifications can throw on some platforms — ignore.
  }
}
