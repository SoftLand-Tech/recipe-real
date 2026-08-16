export const FPS = 30;

export type SfxName =
  | "whoosh"
  | "tick"
  | "ding"
  | "pop"
  | "stamp"
  | "buzzer"
  | "chime"
  | "drop";

export interface SfxCue {
  name: SfxName;
  /** frames from scene start */
  at: number;
  volume?: number;
}

export interface SceneDef {
  id: string;
  /** VO text incl. eleven_v3 audio tags */
  vo: string;
  /** frames of hold before VO starts */
  lead?: number;
  /** frames of hold after VO ends */
  tail?: number;
  sfx?: SfxCue[];
}

export interface AdDef {
  id: string;
  title: string;
  scenes: SceneDef[];
}

/**
 * Ad 1 — "The 30-Minute Lie" (Persona 1: time-anxious beginner, empathetic, warm light).
 */
export const ThirtyMinuteLie: AdDef = {
  id: "ThirtyMinuteLie",
  title: "The 30-Minute Lie",
  scenes: [
    {
      id: "hook",
      vo: "It said thirty minutes. [pause] Ninety minutes later, you're still standing in the kitchen.",
      lead: 14,
      tail: 14,
      sfx: [
        { name: "stamp", at: 16, volume: 0.55 },
        { name: "buzzer", at: 78, volume: 0.45 },
      ],
    },
    {
      id: "notYou",
      vo: "You're not bad at cooking. [warm smile] That number was fiction.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "whoosh", at: 6, volume: 0.4 },
        { name: "whoosh", at: 68, volume: 0.35 },
      ],
    },
    {
      id: "why",
      vo: "Published times skip the prep, the preheat, the cleanup — everything that eats your evening.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "whoosh", at: 8, volume: 0.4 },
        { name: "stamp", at: 62, volume: 0.5 },
        { name: "stamp", at: 88, volume: 0.5 },
        { name: "stamp", at: 114, volume: 0.5 },
      ],
    },
    {
      id: "reveal",
      vo: "RecipeReal shows you the real time before you start — measured by real cooks, on real stopwatches.",
      lead: 12,
      tail: 14,
      sfx: [
        { name: "chime", at: 14, volume: 0.45 },
        { name: "pop", at: 96, volume: 0.4 },
      ],
    },
    {
      id: "three",
      vo: "Novice: forty-two minutes. Intermediate: thirty-two. Expert: twenty-five.",
      lead: 10,
      tail: 16,
      sfx: [
        { name: "pop", at: 14, volume: 0.5 },
        { name: "pop", at: 60, volume: 0.5 },
        { name: "pop", at: 104, volume: 0.5 },
      ],
    },
    {
      id: "cook",
      vo: "Cook along in guided mode. One tap per step, and it quietly times everything.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "tick", at: 40, volume: 0.5 },
        { name: "tick", at: 64, volume: 0.45 },
        { name: "ding", at: 116, volume: 0.4 },
      ],
    },
    {
      id: "learn",
      vo: "After a few dinners, it learns your pace — your onion dice, your sauté, your cleanup speed.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "pop", at: 72, volume: 0.5 },
        { name: "pop", at: 106, volume: 0.5 },
        { name: "pop", at: 140, volume: 0.5 },
      ],
    },
    {
      id: "total",
      vo: "And every total includes the dishes.",
      lead: 10,
      tail: 16,
      sfx: [
        { name: "drop", at: 44, volume: 0.55 },
        { name: "ding", at: 92, volume: 0.4 },
      ],
    },
    {
      id: "proof",
      vo: "The estimate said fifty-two minutes. Your kitchen said fifty-one.",
      lead: 12,
      tail: 14,
      sfx: [
        { name: "pop", at: 16, volume: 0.45 },
        { name: "pop", at: 74, volume: 0.45 },
        { name: "ding", at: 122, volume: 0.5 },
      ],
    },
    {
      id: "plan",
      vo: "Plan your evening around the truth.",
      lead: 12,
      tail: 18,
      sfx: [{ name: "whoosh", at: 10, volume: 0.4 }],
    },
    {
      id: "cta",
      vo: "RecipeReal. [warm smile] Real time. Real cooking. Free to start.",
      lead: 14,
      tail: 42,
      sfx: [{ name: "chime", at: 16, volume: 0.5 }],
    },
  ],
};

/**
 * Ad 2 — "It Learns You" (Persona 3: efficiency-minded cook, energetic, warm dark).
 */
export const ItLearnsYou: AdDef = {
  id: "ItLearnsYou",
  title: "It Learns You",
  scenes: [
    {
      id: "same",
      vo: "Every recipe app shows you a number. [pause] The same number, for everyone.",
      lead: 12,
      tail: 12,
      sfx: [{ name: "pop", at: 14, volume: 0.4 }],
    },
    {
      id: "you",
      vo: "But your dice takes seven minutes, and your pans run hot. You're not everyone.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "whoosh", at: 12, volume: 0.45 },
        { name: "whoosh", at: 96, volume: 0.4 },
      ],
    },
    {
      id: "intro",
      vo: "RecipeReal is the first app that actually learns your pace.",
      lead: 12,
      tail: 14,
      sfx: [{ name: "chime", at: 14, volume: 0.5 }],
    },
    {
      id: "three",
      vo: "Every recipe gets three verified estimates — novice, intermediate, expert — timed by real stopwatch sessions.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "pop", at: 14, volume: 0.5 },
        { name: "pop", at: 58, volume: 0.5 },
        { name: "pop", at: 100, volume: 0.5 },
      ],
    },
    {
      id: "cook",
      vo: "Cook with guided step timers. One tap per step, and it quietly logs everything.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "tick", at: 42, volume: 0.5 },
        { name: "ding", at: 108, volume: 0.45 },
      ],
    },
    {
      id: "profile",
      vo: "Every session sharpens your personal speed profile.",
      lead: 10,
      tail: 16,
      sfx: [
        { name: "tick", at: 20, volume: 0.45 },
        { name: "tick", at: 52, volume: 0.4 },
        { name: "tick", at: 84, volume: 0.35 },
      ],
    },
    {
      id: "numbers",
      vo: "Your sauté: four point eight minutes. Community: three point two. Stop guessing your buffers.",
      lead: 10,
      tail: 14,
      sfx: [
        { name: "pop", at: 14, volume: 0.5 },
        { name: "pop", at: 74, volume: 0.5 },
        { name: "ding", at: 118, volume: 0.4 },
      ],
    },
    {
      id: "cleanup",
      vo: "Cleanup? Baked into the total. Every single time.",
      lead: 10,
      tail: 16,
      sfx: [
        { name: "drop", at: 30, volume: 0.55 },
        { name: "ding", at: 88, volume: 0.4 },
      ],
    },
    {
      id: "smarter",
      vo: "The more you cook, the sharper every estimate gets.",
      lead: 10,
      tail: 16,
      sfx: [
        { name: "tick", at: 24, volume: 0.45 },
        { name: "tick", at: 56, volume: 0.4 },
        { name: "ding", at: 100, volume: 0.45 },
      ],
    },
    {
      id: "yours",
      vo: "Stop cooking with someone else's stopwatch.",
      lead: 12,
      tail: 16,
      sfx: [
        { name: "whoosh", at: 12, volume: 0.45 },
        { name: "pop", at: 66, volume: 0.5 },
      ],
    },
    {
      id: "cta",
      vo: "RecipeReal. It learns you. Free to start.",
      lead: 14,
      tail: 42,
      sfx: [{ name: "chime", at: 16, volume: 0.5 }],
    },
  ],
};

export const ADS: AdDef[] = [ThirtyMinuteLie, ItLearnsYou];
