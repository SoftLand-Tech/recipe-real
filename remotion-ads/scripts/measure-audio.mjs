#!/usr/bin/env node
/**
 * ffprobe every VO + SFX file, write src/audio-durations.json
 * (keys are staticFile()-relative), and print per-ad timing budgets.
 */
import { readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { ADS, FPS } from "../src/scenes.ts";

const execFileP = promisify(execFile);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function probe(file) {
  const { stdout } = await execFileP("ffprobe", [
    "-v",
    "quiet",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  return parseFloat(stdout.trim());
}

async function walk(dir, prefix = "") {
  if (!existsSync(dir)) return {};
  const out = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      Object.assign(out, await walk(path.join(dir, entry.name), `${prefix}${entry.name}/`));
    } else if (entry.name.endsWith(".mp3")) {
      out[`${prefix}${entry.name}`] = await probe(path.join(dir, entry.name));
    }
  }
  return out;
}

const durations = {
  ...(await walk(path.join(ROOT, "public", "audio"), "audio/")),
  ...(await walk(path.join(ROOT, "public", "sfx"), "sfx/")),
};

await writeFile(
  path.join(ROOT, "src", "audio-durations.json"),
  JSON.stringify(durations, null, 2) + "\n",
);

console.log("audio-durations.json written.\n");
let ok = true;
for (const ad of ADS) {
  let total = 0;
  const rows = [];
  for (const s of ad.scenes) {
    const d = durations[`audio/${ad.id}/${s.id}.mp3`];
    const lead = s.lead ?? 10;
    const tail = s.tail ?? 12;
    const sceneDur = d !== undefined ? lead + Math.ceil(d * FPS) + tail : null;
    rows.push({ id: s.id, vo: d, scene: sceneDur });
    total += sceneDur ?? 0;
    if (d === undefined) ok = false;
  }
  console.log(`[${ad.id}]`);
  for (const r of rows) {
    console.log(
      `  ${r.id.padEnd(10)} vo=${r.vo === undefined ? "MISSING" : r.vo.toFixed(2) + "s"}  scene=${r.scene === null ? "?" : (r.scene / FPS).toFixed(2) + "s"}`,
    );
  }
  console.log(
    `  TOTAL: ${(total / FPS).toFixed(1)}s  ${total / FPS >= 40 ? "(≥40s ✓)" : "(<40s ✗ — pad or extend copy)"}\n`,
  );
}
if (!ok) {
  console.error("WARNING: some VO files are missing — run scripts/generate-vo.mjs first.");
  process.exitCode = 1;
}
