// Generates one VO clip per voiced scene via Deepgram (speak.sh), trims leading
// silence, and writes durations.json used by timeline.ts.
// Usage: node gen-vo.mjs [--only s14]   (regenerate a single scene)
import {execSync} from 'node:child_process';
import {readFileSync, writeFileSync, existsSync, statSync} from 'node:fs';
import {parseArgs} from 'node:util';

const ROOT = '/home/mamoun/ai/recipe-meal/ads';
const OUT = `${ROOT}/public/audio/v2`;
const SPEAK = `${process.env.HOME}/.zcode/skills/deepgram-tts/scripts/speak.sh`;
const VOICE = {pbp: 'aura-orion-en', color: 'aura-zeus-en'};

const src = readFileSync(`${ROOT}/src/videos/v2-dinner-league/scenes.ts`, 'utf8');
const blocks = src.split(/\n  \{/).slice(1);
const unq = (m) => (m === 'null' ? null : m.slice(1, -1).replace(/\\'/g, "'"));
const scenes = blocks.map((b) => {
  const id = b.match(/id: '(s\d+)'/)[1];
  const vo = unq(b.match(/vo: (null|'[^']*'|"[^"]*")/)[1]);
  const speaker = unq(b.match(/speaker: (null|'[a-z]+')/)[1]);
  return {id, vo, speaker};
});

const {values} = parseArgs({options: {only: {type: 'string'}}});
const targets = values.only
  ? scenes.filter((s) => s.id === values.only)
  : scenes.filter((s) => s.vo);

// Uniform brisk word-rate targets (s/word) so 40 scenes fit 1500 frames.
const RATE = {pbp: 0.22, color: 0.27};
const RATE_OVERRIDE = {s38: 0.55}; // brand name: never rush it
const ATEMPO_MAX = 1.6;

const durations = {};

for (const s of targets) {
  if (!s.vo || !s.speaker) continue;
  const voice = VOICE[s.speaker];
  const words = s.vo.replace(/[^a-zA-Z' -]/g, ' ').trim().split(/\s+/).length;
  const target = words * (RATE_OVERRIDE[s.id] ?? RATE[s.speaker]);
  const raw = `${OUT}/raw-${s.id}.mp3`;
  const trimmed = `${OUT}/trim-${s.id}.mp3`;
  const fin = `${OUT}/vo-${s.id}.mp3`;
  execSync(`bash ${SPEAK} "${s.vo.replace(/"/g, '')}" ${raw} -m ${voice}`, {stdio: 'inherit'});
  if (statSync(raw).size < 100) throw new Error(`tiny raw clip for ${s.id}`);
  // keep 20ms head silence, strip the rest of the leading silence
  execSync(
    `ffmpeg -y -v error -i ${raw} -af "silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.02" -b:a 128k ${trimmed}`,
  );
  const dTrim = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${trimmed}`).toString().trim(),
  );
  // pitch-preserving speed-up to hit the uniform word rate (never slow down, cap for quality)
  const atempo = Math.min(ATEMPO_MAX, Math.max(1.0, dTrim / target)).toFixed(4);
  execSync(`ffmpeg -y -v error -i ${trimmed} -af "atempo=${atempo}" -b:a 128k ${fin}`);
  if (statSync(fin).size < 100) throw new Error(`tiny final clip for ${s.id}`);
  const d = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${fin}`).toString().trim(),
  );
  durations[s.id] = Math.round(d * 1000) / 1000;
  console.log(
    `${s.id} [${s.speaker}] ${d.toFixed(3)}s (raw ${dTrim.toFixed(2)}, atempo ${atempo}) "${s.vo}"`,
  );
}

writeFileSync(
  `${ROOT}/src/videos/v2-dinner-league/durations.json`,
  JSON.stringify(durations, null, 2) + '\n',
);
const total = Object.values(durations).reduce((a, b) => a + b, 0);
console.log(`\n${Object.keys(durations).length} clips, total VO ${total.toFixed(2)}s`);
