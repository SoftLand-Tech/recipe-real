#!/usr/bin/env node
/**
 * Generate per-scene VO + SFX.
 *
 * Providers:
 *   - elevenlabs (primary): eleven_v3 VO + sound-generation SFX
 *   - deepgram (fallback):  Aura-2 TTS (aura-asteria-en) when ElevenLabs quota
 *                           is exhausted; audio tags are stripped for it
 *   - SFX fallback:         Remotion SFX library wavs
 *
 * On quota_exceeded the script switches provider for the REST of the run, so a
 * full run is always voice-consistent. To swap everything back to ElevenLabs
 * after the quota resets:  node scripts/generate-vo.mjs --force
 *
 *   node scripts/generate-vo.mjs [--force] [--only=ThirtyMinuteLie] [--provider=deepgram]
 */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ADS } from "../src/scenes.ts";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const ONLY = args.find((a) => a.startsWith("--only="))?.slice(7);
const PROVIDER_ARG = args.find((a) => a.startsWith("--provider="))?.slice(11);

class QuotaError extends Error {}

function cleanKey(name, def) {
  if (def === undefined) throw new Error(`${name} not found`);
  return def.trim();
}

const env = {};
async function readKeys() {
  if (process.env.ELEVENLABS_API_KEY) env.elevenlabs = process.env.ELEVENLABS_API_KEY;
  if (process.env.DEEPGRAM_API_KEY) env.deepgram = process.env.DEEPGRAM_API_KEY;
  try {
    const local = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of local.split("\n")) {
      const m = line.match(/^([A-Z_]+)\s*=\s*(.+)/);
      if (m) env[m[1]] ??= m[2].trim();
    }
  } catch {
    /* no .env.local */
  }
  try {
    const dg = await readFile(path.join(ROOT, ".env.deepgram"), "utf8");
    for (const line of dg.split("\n")) {
      const m = line.match(/^([A-Z_]+)\s*=\s*(.+)/);
      if (m) env[m[1]] ??= m[2].trim();
    }
  } catch {
    /* no .env.deepgram */
  }
}
await readKeys();

const EL_KEY = cleanKey("ELEVENLABS_API_KEY", env.ELEVENLABS_API_KEY);
const DG_KEY = cleanKey("DEEPGRAM_API_KEY", env.DEEPGRAM_API_KEY);

// Free-tier ElevenLabs key: only the default narrator voice works.
const EL_VOICE = "cgSgspJ2msm6clMCkdW9";
const EL_MODEL = "eleven_v3";
const DG_VOICE = "aura-asteria-en";

const manifest = { vo: {}, sfx: {}, generatedAt: new Date().toISOString() };
try {
  Object.assign(manifest, JSON.parse(await readFile(path.join(ROOT, "src", "vo-manifest.json"), "utf8")));
} catch {
  /* fresh */
}

const stripTags = (t) =>
  t
    .replace(/\[pause\]/gi, "… ")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

async function fetchWithRetry(url, init, { label, accept }) {
  let waitMs = 3000;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await fetch(url, { ...init, headers: { ...init.headers, Accept: accept } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const text = await res.text().catch(() => "");
    if (res.status === 429 || res.status >= 500) {
      console.warn(`  ${label}: HTTP ${res.status}, backoff ${waitMs / 1000}s (${attempt}/6)`);
      await sleep(waitMs);
      waitMs = Math.min(waitMs * 2, 30000);
      continue;
    }
    if (text.includes("quota_exceeded")) {
      throw new QuotaError(`${label}: ${text.slice(0, 160)}`);
    }
    throw new Error(`${label}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  throw new Error(`${label}: exhausted retries`);
}

const ttsElevenLabs = (text, label) =>
  fetchWithRetry(
    `https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": EL_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: EL_MODEL,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, speed: 1.0 },
      }),
    },
    { label, accept: "audio/mpeg" },
  );

const ttsDeepgram = (text, label) =>
  fetchWithRetry(
    `https://api.deepgram.com/v1/speak?model=${DG_VOICE}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${DG_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    },
    { label, accept: "audio/*" },
  );

const SFX_EL = [
  ["whoosh", "Short fast airy whoosh transition, clean, no music", 1.0],
  ["tick", "Single soft analog clock tick", 0.4],
  ["ding", "Bright soft single-note notification ding", 1.0],
  ["pop", "Small playful bubble pop", 0.4],
  ["stamp", "Heavy rubber stamp thud onto paper", 0.6],
  ["buzzer", "Short low gentle error buzzer, not harsh", 0.6],
  ["chime", "Warm gentle two-note success chime", 1.4],
  ["drop", "Soft low wooden thunk", 0.6],
];

// Remotion SFX library fallbacks (https://github.com/remotiondev/sfx)
const SFX_FALLBACK_URL = {
  whoosh: "https://remotion.media/whoosh.wav",
  tick: "https://remotion.media/mouse-click.wav",
  ding: "https://remotion.media/ding.wav",
  pop: "https://remotion.media/switch.wav",
  stamp: "https://remotion.media/page-turn.wav",
  buzzer: "https://remotion.media/windows-xp-error.wav",
  chime: "https://remotion.media/ding.wav",
  drop: "https://remotion.media/fah.wav",
};

let voProvider = PROVIDER_ARG ?? "elevenlabs";
let sfxProvider = PROVIDER_ARG ?? "elevenlabs";
let calls = 0;

for (const ad of ADS) {
  if (ONLY && ad.id !== ONLY) continue;
  const dir = path.join(ROOT, "public", "audio", ad.id);
  await mkdir(dir, { recursive: true });
  console.log(`\n[${ad.id}] — voice: ${voProvider}`);
  for (const scene of ad.scenes) {
    const out = path.join(dir, `${scene.id}.mp3`);
    const rel = `${ad.id}/${scene.id}`;
    if (existsSync(out) && !FORCE) {
      console.log(`  · ${scene.id} (exists)`);
      continue;
    }
    if (voProvider === "elevenlabs") {
      try {
        await writeFile(out, await ttsElevenLabs(scene.vo, rel));
        manifest.vo[rel] = "elevenlabs";
        console.log(`  ✓ ${rel} [elevenlabs]`);
        calls++;
        await sleep(1200);
        continue;
      } catch (e) {
        if (!(e instanceof QuotaError)) throw e;
        console.warn(`  ⚠ ElevenLabs quota exhausted — switching VO to deepgram for the rest of this run.`);
        voProvider = "deepgram";
      }
    }
    await writeFile(out, await ttsDeepgram(stripTags(scene.vo), rel));
    manifest.vo[rel] = "deepgram";
    console.log(`  ✓ ${rel} [deepgram]`);
    calls++;
    await sleep(500);
  }
}

console.log(`\n[sfx] — provider: ${sfxProvider}`);
const sfxDir = path.join(ROOT, "public", "sfx");
await mkdir(sfxDir, { recursive: true });
for (const [id, prompt, dur] of SFX_EL) {
  const out = path.join(sfxDir, `${id}.mp3`);
  if (existsSync(out) && !FORCE) {
    console.log(`  · ${id} (exists)`);
    continue;
  }
  if (sfxProvider === "elevenlabs") {
    try {
      const buf = await fetchWithRetry(
        "https://api.elevenlabs.io/v1/sound-generation",
        {
          method: "POST",
          headers: { "xi-api-key": EL_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ text: prompt, duration_seconds: dur, prompt_influence: 0.3 }),
        },
        { label: `sfx/${id}`, accept: "audio/mpeg" },
      );
      await writeFile(out, buf);
      manifest.sfx[id] = "elevenlabs";
      console.log(`  ✓ sfx/${id} [elevenlabs]`);
      calls++;
      await sleep(1200);
      continue;
    } catch (e) {
      if (!(e instanceof QuotaError)) throw e;
      console.warn(`  ⚠ ElevenLabs quota exhausted — switching SFX to remotion-sfx fallback.`);
      sfxProvider = "remotion-sfx";
    }
  }
  const res = await fetch(SFX_FALLBACK_URL[id]);
  if (!res.ok) throw new Error(`sfx/${id} fallback download: HTTP ${res.status}`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  manifest.sfx[id] = "remotion-sfx";
  console.log(`  ✓ sfx/${id} [remotion-sfx fallback]`);
  calls++;
  await sleep(300);
}

manifest.lastRun = { provider: voProvider, sfxProvider, force: FORCE, at: new Date().toISOString() };
await writeFile(path.join(ROOT, "src", "vo-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`\nDone. ${calls} call(s). VO provider used: ${voProvider}. See src/vo-manifest.json.`);
if (voProvider !== "elevenlabs" || sfxProvider !== "elevenlabs") {
  console.log(
    `NOTE: ElevenLabs quota was exhausted — rerun with --force after reset to swap back: node scripts/generate-vo.mjs --force`,
  );
}
