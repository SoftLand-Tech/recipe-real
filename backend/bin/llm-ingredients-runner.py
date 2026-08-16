#!/usr/bin/env python3
"""Stage B ingredient-quantity LLM runner (opencode zen free models).

Batches 8 recipes per opencode call, runs 6 workers in parallel, rotates
through the zen free models on errors. Reads exported needs-llm JSONL.gz,
writes fixes JSONL.gz for the server-side apply step. Resumable (skips ids
already present in the output).
"""
import gzip, json, subprocess, sys, time, re, threading
from concurrent.futures import ThreadPoolExecutor, as_completed

MODELS = [
    "opencode/deepseek-v4-flash-free",
    "opencode/nemotron-3.5-lightning-free",
    "opencode/mimo-v2.5-free",
    "opencode/hy3-free",
    "opencode/laguna-s-2.1-free",
    "opencode/nemotron-3-ultra-free",
]
UNITS = {"cup","tablespoon","teaspoon","ounce","pound","gram","kilogram","ml","liter",
         "quart","pint","gallon","clove","can","package","envelope","box","jar","stick",
         "pinch","dash","drop","slice","sprig","leaf","stalk","bunch","head","piece",
         "whole","to_taste"}
BATCH = 10
WORKERS = 8

in_path, out_path = sys.argv[1], sys.argv[2]
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9

model_lock = threading.Lock()
model_idx = 0
stats = {"batches": 0, "lines_fixed": 0, "lines_gave_up": 0, "model_errors": 0}
stats_lock = threading.Lock()
out_lock = threading.Lock()


def next_model():
    global model_idx
    with model_lock:
        m = MODELS[model_idx]
        return m


def rotate_model(bad: str):
    global model_idx
    with model_lock:
        if MODELS[model_idx] == bad:
            model_idx = (model_idx + 1) % len(MODELS)
        return MODELS[model_idx]


def call_llm(prompt: str) -> str | None:
    """One opencode call; rotate models on failure. Returns raw text or None."""
    for _ in range(len(MODELS)):
        model = next_model()
        try:
            r = subprocess.run(
                ["opencode", "run", "-m", model, prompt],
                capture_output=True, text=True, timeout=240)
            out = (r.stdout or "").strip()
            if r.returncode == 0 and out and len(out) > 5:
                return out
            with stats_lock:
                stats["model_errors"] += 1
            print(f"  [model] {model} rc={r.returncode}: {((r.stderr or '') + out)[:120]}")
        except subprocess.TimeoutExpired:
            with stats_lock:
                stats["model_errors"] += 1
            print(f"  [model] {model} timeout")
        model = rotate_model(model)
        time.sleep(1)
    return None


def extract_json_array(text: str):
    m = re.search(r"\[.*\]|\{.*\}", text, re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
        return d if isinstance(d, list) else [d]
    except Exception:
        return None


def process_batch(batch):
    """batch: list of recipe dicts {id, title, items}. Returns list of result dicts."""
    lines = []
    for rec in batch:
        for it in rec["items"]:
            lines.append({"rid": rec["id"], "i": it["i"], "raw": it["raw"],
                          "title": rec["title"]})
    prompt = (
        "You fix ingredient lines from recipes. For EVERY line below, infer quantity/unit "
        "(use the recipe title as context). Reply with ONLY a JSON array, one object per "
        'input line, in the same order: {"rid": <rid>, "i": <i>, "qty": number|null, '
        '"qty_display": string|null, "unit": <one of '
        "[cup, tablespoon, teaspoon, ounce, pound, gram, kilogram, ml, liter, quart, pint, "
        "gallon, clove, can, package, envelope, box, jar, stick, pinch, dash, drop, slice, "
        "sprig, leaf, stalk, bunch, head, piece, whole, to_taste]>|null, \"item\": string, "
        '"prep": string|null}. Rules: "2 flour" in a biscuit recipe → cups; "3 chicken '
        'breasts" → qty 3, unit "whole"; seasonings without amounts ("salt", "pepper") → '
        'qty null, unit "to_taste"; item = clean food name without qty/unit; prep = '
        "cutting/state words. No prose, just the JSON array.\n"
        "LINES:\n" + "\n".join(
            f'rid={l["rid"]} i={l["i"]} title="{l["title"]}" line="{l["raw"]}"' for l in lines)
    )
    out = call_llm(prompt)
    results = []
    gave_up = fixed = 0
    if out:
        arr = extract_json_array(out)
        if arr:
            by_key = {}
            for d in arr:
                if isinstance(d, dict) and "rid" in d and "i" in d:
                    by_key[(d["rid"], d["i"])] = d
            for l in lines:
                d = by_key.get((l["rid"], l["i"]))
                ok = (d and isinstance(d.get("item"), str) and d["item"].strip()
                      and (d.get("unit") is None or d["unit"] in UNITS)
                      and (d.get("qty") is None or isinstance(d.get("qty"), (int, float))))
                if ok:
                    fixed += 1
                    results.append({"rid": l["rid"], "i": l["i"], "qty": d.get("qty"),
                                    "qty_display": d.get("qty_display"),
                                    "unit": d.get("unit"),
                                    "item": d["item"].strip()[:120], "prep": d.get("prep")})
                else:
                    gave_up += 1
                    results.append({"rid": l["rid"], "i": l["i"], "qty": None,
                                    "qty_display": None, "unit": None,
                                    "item": l["raw"][:120], "prep": None})
    else:
        for l in lines:
            gave_up += 1
            results.append({"rid": l["rid"], "i": l["i"], "qty": None,
                            "qty_display": None, "unit": None, "item": l["raw"][:120],
                            "prep": None})
    with stats_lock:
        stats["batches"] += 1
        stats["lines_fixed"] += fixed
        stats["lines_gave_up"] += gave_up
    # regroup by recipe
    by_rec = {}
    for r in results:
        by_rec.setdefault(r["rid"], {"id": r["rid"], "items": []})["items"].append(
            {"i": r["i"], "qty": r["qty"], "qty_display": r["qty_display"],
             "unit": r["unit"], "item": r["item"], "prep": r["prep"]})
    return list(by_rec.values())


done_ids = set()
try:
    with gzip.open(out_path, "rt") as f:
        try:
            for line in f:
                try:
                    done_ids.add(json.loads(line)["id"])
                except Exception:
                    pass
        except (EOFError, OSError):
            # A previous run killed mid-write leaves the gzip without its
            # end-of-stream marker — everything before the cut is still
            # valid and counts; just stop reading at the truncation.
            print(f"[resume] output file was truncated by a hard kill — "
                  f"recovered {len(done_ids)} completed recipes from it")
except FileNotFoundError:
    pass

recipes = []
with gzip.open(in_path, "rt") as f:
    for line in f:
        try:
            rec = json.loads(line)
        except Exception:
            continue
        if rec["id"] in done_ids:
            continue
        recipes.append(rec)
        if len(recipes) >= limit:
            break

print(f"{len(recipes)} recipes to process ({len(done_ids)} already done)")

batches = [recipes[i:i + BATCH] for i in range(0, len(recipes), BATCH)]
with gzip.open(out_path, "at") as out:
    def run_batch(b):
        res = process_batch(b)
        with out_lock:
            for r in res:
                out.write(json.dumps(r, ensure_ascii=False) + "\n")
            out.flush()
        with stats_lock:
            s = dict(stats)
        print(f"  {s['batches']}/{len(batches)} batches | fixed {s['lines_fixed']} | gave up {s['lines_gave_up']} | model errors {s['model_errors']}")

    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(run_batch, b) for b in batches]
        for f in as_completed(futs):
            f.result()

print(f"DONE: {stats['batches']} batches, {stats['lines_fixed']} lines fixed, "
      f"{stats['lines_gave_up']} gave up, {stats['model_errors']} model errors -> {out_path}")
