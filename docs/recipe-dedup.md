# Recipe Deduplication Engine

Production-ready duplicate detection for a database of hundreds of thousands of
recipes (designed for millions), integrated into the AI recipe-generation
workflow. Detects duplicates by **culinary identity**, not by titles or raw text
similarity.

Merged in slices: contract layer (#56, #57), fingerprinting (#59), semantics
(#58), detection (#65), generation (#66), ops (#67).

Contents:

1. [Architecture overview](#1-architecture-overview)
2. [Database schema changes](#2-database-schema-changes)
3. [New services and classes](#3-new-services-and-classes)
4. [Configuration instructions](#4-configuration-instructions)
5. [Environment variables](#5-environment-variables)
6. [Qdrant setup](#6-qdrant-setup)
7. [Queue configuration](#7-queue-configuration)
8. [Artisan commands](#8-artisan-commands)
9. [Recipe-generation integration](#9-recipe-generation-integration)
10. [Test results](#10-test-results)
11. [Performance considerations](#11-performance-considerations)
12. [Known limitations and follow-ups](#12-known-limitations-and-follow-ups)

---

## 1. Architecture overview

```
                 ┌──────────────────────────── Generation batch ───────────────────────────┐
                 │  recipereal:generate-batch / queue                                      │
                 ▼                                                                          │
 generator probe ──► OpenAiCompatibleRecipeGenerator ──► HalalGate scan ──► RecipeRegistrar ◄┘
 (adapter)           (list<CandidateRecipe>)              (content fail)  (evaluate → INSERT, 1 tx)
                                                                              │
                                            ┌─────────────────────────────────┤
                                            ▼                                 ▼
                                        DuplicateDetectionService       recipe_* tables
                                            │                            (unchanged)
                       ┌────────────────────┼────────────────────┐
                       ▼                    ▼                    ▼
                  Layer 1: exact      Layer 2: scored        Layer 3: AI judge
                  fingerprint UNIQUE  candidate retrieval    only for verify band
                  + identity indexes  + weighted similarity
```

Three independent detection layers:

- **Layer 1 — exact matching (no AI, O(index lookup)).** A recipe's normalized
  culinary identity is hashed into a deterministic fingerprint
  (`recipe_fingerprints.fingerprint`, UNIQUE). An identical normalized identity
  — same canonical dish, form, cuisine, cooking/prep method, techniques, sauces,
  flavor markers, and quantity-binned ingredients — collides instantly on the
  unique index.
- **Layer 2 — structural + semantic scoring.**
  `CandidateRetriever` gathers candidates from indexed sources only (exact
  fingerprint, canonical-dish / ingredient-combo / main-ingredient hashes, dish
  family, title signature, plus top-K vector search). `SimilarityScorer` blends
  them with configured weights (vector cosine and main ingredients dominate),
  excluding missing features instead of scoring them 0. A **high score alone
  never rejects**: an auto-duplicate (≥ 0.88) additionally needs ≥ 2 identity
  pillars (same dish family, main-ingredient Jaccard ≥ 0.70, technique Jaccard
  ≥ 0.60, same canonical dish).
- **Layer 3 — AI judge for the verify band only.** Candidates scoring in
  [0.68, 0.88) — and auto-duplicate-uncertain cases — go to
  `HttpAiDuplicateJudge`. The judge receives ONLY the candidate's structured
  `CulinaryIdentity` plus the shortlist (≤ 5) of existing recipes' structured
  identities — never raw recipes, never the database. Structured JSON response,
  strict validation, hallucinated match-id guard, deterministic `on_failure`
  policy (default: `flag` → needs review, never silent accept/reject).

The registrar (`RecipeRegistrar`) is the *only* writer: evaluate() then INSERT
inside one transaction; accepted candidates are visible to the next candidate's
evaluation immediately, which is how in-batch duplicates are prevented with no
in-memory index (spec §6).

Decision records are append-only (`duplicate_checks`); confirmed human verdicts
are never regressed by engine re-runs.

## 2. Database schema changes

Six additive migrations (no existing table is modified; all deletes are
`cascadeOnDelete` on their own FKs):

| Migration | Table | Purpose |
|---|---|---|
| `2026_11_21_000001_create_recipe_fingerprints_table` | `recipe_fingerprints` | recipes ↔ fingerprint 1:1 (`recipe_id` UNIQUE, `fingerprint` UNIQUE, `identity_signature`, `ingredient_combo_hash`, `main_ingredient_hash`, `dish_family`, `cuisine`, `category`, `form`, `sauce`, `identity` JSON, `is_complete`; indexed signature/hash columns) |
| `2026_11_21_000002_create_recipe_embeddings_table` | `recipe_embeddings` | indexing status (`recipe_id` UNIQUE, `status` indexed/failed/skipped, `model`, `text_hash`, `attempts`, `last_error`) |
| `2026_11_21_000003_create_recipe_generation_batches_table` | `recipe_generation_batches` | batch tracking (requested/accepted/rejected/failed counts, `generation_attempts`, `max_attempts`, `status`, `lease_expires_at`, `params` JSON, `error`, `finished_at`) |
| `2026_11_21_000004_create_recipe_generation_batch_items_table` | `recipe_generation_batch_items` | per-candidate outcomes (accepted/duplicate/needs_review/generation_failed, `recipe_id`, `matched_recipe_id`, `check_id`, score, reason, candidate summary) |
| `2026_11_21_000005_create_duplicate_checks_table` | `duplicate_checks` | append-only detection history (layer, action, scores, classification, confidence, reason, source, status) |
| `2026_11_21_000006_create_recipe_duplicate_pairs_table` | `recipe_duplicate_pairs` | operative pair registry (`recipe_id`/`duplicate_of_recipe_id` UNIQUE pair, `status` flagged/confirmed_duplicate/confirmed_distinct, `source` engine/manual, `check_id`, `decided_by`, `decided_at`) |

Nothing destructive: no `down()` data loss beyond dropping the new tables, and
existing recipes are never updated or deleted by the engine. Backfill
collisions are **flagged, never resolved automatically**.

## 3. New services and classes

All engine code lives under `app/Services/RecipeDedup/` (small, single-purpose
classes; external systems behind interfaces):

| Area | Classes |
|---|---|
| Contracts (`Contracts/`) | `EmbeddingProvider`, `VectorStore`, `AiDuplicateJudge`, `RecipeCandidateGenerator` |
| Data (DTOs, `Data/`) | `CulinaryIdentity` (VERSION-stamped normalized identity), `FingerprintSet`, `CandidateRecipe` (+ `fromDraft`/`fromRecipe`), `DuplicateScore`, `DuplicateDecision`, `AiJudgeResponse`, `EmbeddingResult`, `GenerationRequest` |
| Exceptions (root) | `FingerprintCollisionException`, `EmbeddingException`, `VectorStoreException`, `AiJudgeException`, `GenerationException` |
| Fingerprinting (`Fingerprinting/`) | `IngredientNormalizer` (unit classes, additive synonyms; never merges genuinely different ingredients), `TechniqueDetector`, `CuisineDetector` (null when unsure), `CulinaryIdentityExtractor`, `FingerprintBuilder` (quantity bins), `FingerprintService` (register/lookup/serialize) |
| Semantics (`Embeddings/`) | `EmbeddingTextBuilder` (VERSION-stamped identity text, qty-free), `EmbeddingService` (fail-soft, text-hash skip), `OpenAiCompatibleEmbeddingProvider`, `GeminiEmbeddingProvider`, `NullEmbeddingProvider` |
| Vector (`Vector/`) | `QdrantVectorStore` (HTTP only, no composer package), `NullVectorStore` |
| Detection (`Detection/`) | `CandidateRetriever` (+ `CandidateRetrieval`), `SimilarityScorer`, `DuplicateDetectionService`, `RecipeRegistrar` (+ `RecipeRegistrationResult`) |
| Judge (`Judge/`) | `HttpAiDuplicateJudge` (4 protocols, retries, invalid-JSON handling) |
| Generation (`Generation/`) | `OpenAiCompatibleRecipeGenerator` (adapter), `BatchGenerationService` (bounded replacement loop, lease, caps) |
| Jobs (`app/Jobs/`) | `IndexRecipe` (single-recipe), `BackfillRecipesChunk` (chained chunks), `ProcessRecipeGenerationBatch` |
| Provider | `App\Providers\RecipeDedupServiceProvider` (config-driven interface bindings) |
| Filament | `DuplicateChecksResource` + pages (Community navigation group) |
| Model helpers | `RecipeDuplicatePair::flagFromEngine` (idempotent flagging that never regresses manual verdicts) |

Model additions: `RecipeFingerprint`, `RecipeEmbedding`,
`RecipeGenerationBatch` (lease claim/release), `RecipeGenerationBatchItem`,
`DuplicateCheck`, `RecipeDuplicatePair`.

## 4. Configuration instructions

Everything is centralized in `config/recipe_dedup.php`, every knob is an
`env()` default. Quick start:

1. `DEDUP_ENABLED=true` (master switch; `false` restores pre-engine behavior).
2. Embeddings: choose a protocol (`openai_compatible|gemini|none`), set
   `DEDUP_EMBEDDING_*` endpoint/key/model. `DEDUP_EMBEDDINGS_ENABLED=false` runs
   the engine on structural signals only.
3. Vector store: `DEDUP_VECTOR_DRIVER=qdrant|none` + `DEDUP_QDRANT_*` (§6).
4. AI judge: `DEDUP_JUDGE_ENABLED=true` + protocol/endpoint/key/model. Keep
   `DEDUP_JUDGE_ON_FAILURE=flag` (default) — outage semantics: candidates are
   flagged for review rather than silently accepted or rejected.
5. Backfill + indexing queues: `DEDUP_BACKFILL_QUEUE`, `DEDUP_INDEXING_QUEUE`
   (append `null` to run on the default queue, §7).
6. Generation: `DEDUP_GENERATOR_*` endpoint/key/model plus
   `DEDUP_GENERATION_OWNER_EMAIL` (recipe attribution), batch caps (§9).

Thresholds (`DEDUP_AUTO_DUPLICATE_SCORE=0.88`, `DEDUP_VERIFY_SCORE=0.68`),
corroboration and the full weight table are documented inline with the test
evidence that backs each default (§10). Tune any of them per environment
without code changes.

Note: `Cache` (default store) holds the backfill cursor — do not use a
per-request ephemeral store for `CACHE_STORE` in production (redis/database are
fine; `array` is test-only).

## 5. Environment variables

Full list (all optional; defaults in config):

| Variable | Default | Purpose |
|---|---|---|
| `DEDUP_ENABLED` | `true` | master switch |
| `DEDUP_AUTO_DUPLICATE_SCORE` | `0.88` | layer 2 auto-reject floor (with corroboration) |
| `DEDUP_VERIFY_SCORE` | `0.68` | layer 3 (AI judge) entry |
| `DEDUP_CORROBORATION_MIN_RULES` | `2` | pillars required for auto-reject |
| `DEDUP_MAIN_INGREDIENT_JACCARD` | `0.70` | main-ingredient pillar |
| `DEDUP_TECHNIQUE_JACCARD` | `0.60` | technique pillar |
| `DEDUP_W_VECTOR` … `DEDUP_W_PREP_METHOD` | see config | scorer weights |
| `DEDUP_CANDIDATE_RETRIEVAL_ENABLED` | `true` | layer 2 retrieval |
| `DEDUP_TOP_K` | `24` | vector top-K |
| `DEDUP_MIN_VECTOR_SCORE` | `0.55` | vector candidate floor |
| `DEDUP_SIGNATURE_CANDIDATES` | `24` | per-cluster cap |
| `DEDUP_VECTOR_FILTERS` | `true` | filter vector search by family/cuisine |
| `DEDUP_MAX_CANDIDATES` | `40` | hard cap before scoring |
| `DEDUP_JUDGE_ENABLED` | `true` | AI judge on/off |
| `DEDUP_JUDGE_PROTOCOL` | `openai_compatible` | `openai_compatible\|anthropic\|gemini\|generic` |
| `DEDUP_JUDGE_ENDPOINT` / `_API_KEY` / `_MODEL` | empty | judge credentials |
| `DEDUP_JUDGE_TIMEOUT` / `_RETRIES` | `60` / `1` | judge transport |
| `DEDUP_JUDGE_MAX_CANDIDATES` | `5` | shortlist cap per judge call |
| `DEDUP_JUDGE_MIN_AUTO_CONFIDENCE` | `0.85` | trust floor for auto-apply |
| `DEDUP_JUDGE_ON_FAILURE` | `flag` | `flag\|accept\|reject` |
| `DEDUP_EMBEDDINGS_ENABLED` | `true` | semantic layer on/off |
| `DEDUP_EMBEDDING_PROTOCOL` | `openai_compatible` | `openai_compatible\|gemini\|none` |
| `DEDUP_EMBEDDING_ENDPOINT` / `_API_KEY` / `_MODEL` | empty | embedder credentials |
| `DEDUP_EMBEDDING_DIMENSIONS` | `0` | 0 = provider default |
| `DEDUP_EMBEDDING_BATCH_SIZE` / `_TIMEOUT` / `_RETRIES` | `64` / `30` / `2` | transport + batching |
| `DEDUP_VECTOR_DRIVER` | `qdrant` | `qdrant\|none` |
| `DEDUP_QDRANT_URL` | `http://127.0.0.1:6333` | Qdrant HTTP |
| `DEDUP_QDRANT_API_KEY` | empty | Qdrant auth |
| `DEDUP_QDRANT_COLLECTION` | `recipe_embeddings` | one point per recipe (payload id = recipe id) |
| `DEDUP_QDRANT_TIMEOUT_MS` / `_CONNECT_TIMEOUT_MS` | `1500` / `700` | HTTP timeouts |
| `DEDUP_BACKFILL_CHUNK` | `200` | recipes per chunk job |
| `DEDUP_BACKFILL_QUEUE` | null | chunk job queue |
| `DEDUP_BACKFILL_DISPATCH_AHEAD` | `20` | reserved (chain is 1-ahead) |
| `DEDUP_INDEXING_ENABLED` | `true` | publish/generation hooks |
| `DEDUP_INDEXING_QUEUE` | null | `IndexRecipe` queue |
| `DEDUP_EMBED_IMMEDIATELY` | `true` | embed during publish-time indexing |
| `DEDUP_GENERATION_BATCH_SIZE` | `10` | recipes per generator call |
| `DEDUP_GENERATION_MAX_ATTEMPT_MULTIPLIER` | `3` | attempt cap = ceil(target × mult / batch) |
| `DEDUP_GENERATION_MAX_WALL_SECONDS` | `3600` | wall-clock ceiling |
| `DEDUP_GENERATION_LEASE_SECONDS` | `900` | batch worker lease |
| `DEDUP_GENERATION_SOURCE_TYPE` | `ai_batch` | `recipes.source_type` for generated rows |
| `DEDUP_GENERATION_OWNER_EMAIL` | empty | recipe attribution email |
| `DEDUP_GENERATOR_PROTOCOL` | `openai_compatible` | `openai_compatible\|anthropic\|gemini\|generic` |
| `DEDUP_GENERATOR_ENDPOINT` / `_API_KEY` / `_MODEL` | empty | generator credentials |
| `DEDUP_GENERATOR_TIMEOUT` / `_TEMPERATURE` / `_RETRIES` | `240` / `0.8` / `2` | generator transport |
| `DEDUP_GENERATOR_MAX_TOKENS` / `_TOKENS_PER_RECIPE` | `8000` / `900` | anthropic max_tokens budget |
| `DEDUP_CACHE_TTL` | `300` | inert-lookup cache (ping, token counts) |

## 6. Qdrant setup

No composer package — the store talks plain HTTP (`Http` facade).

```bash
# Docker (single node)
docker run -d --name qdrant -p 6333:6333 -v /data/qdrant:/qdrant/storage \
  qdrant/qdrant

# .env
DEDUP_VECTOR_DRIVER=qdrant
DEDUP_QDRANT_URL=http://127.0.0.1:6333
# DEDUP_QDRANT_API_KEY=...          # only if auth_enabled is on
DEDUP_QDRANT_COLLECTION=recipe_embeddings
```

Collection auto-creation: the store ensures the collection exists (dims come
from `DEDUP_EMBEDDING_DIMENSIONS` / provider response; payload recipe id +
cuisine/category/dish-family are stored for filtered search). Verify any time:

```bash
php artisan recipereal:dedup-check-vector   # exit 1 when unreachable
```

Vectors are keyed by recipe id and overwritten in place (never dropped) during
rebuilds; deleting a recipe cascades its `recipe_embeddings` row and the store
delete is best-effort (`VectorStoreException` logged, never fatal to the
request).

If a recipe's embedding row is `indexed` but the point went missing, the next
`ensureIndexed*` call repairs it (text-hash skip only short-circuits when the
status row is current).

## 7. Queue configuration

- `IndexRecipe` — small quick job after publish (dispatched with the queue from
  `DEDUP_INDEXING_QUEUE`; after-commit, fail-soft).
- `BackfillRecipesChunk` — the ONLY backfill executor; each chunk job dispatches
  the next chunk on completion (chained → naturally ~1 job in flight) on
  `DEDUP_BACKFILL_QUEUE`. `tries=3`, `backoff 30/120/300`, `timeout=900`.
- `ProcessRecipeGenerationBatch` — `tries=1`; the batch loop owns its own
  replacement attempts (a crashed job's lease expires and the next runner
  resumes from the DB).
- SQS/database/redis all work; set horizon/supervisor workers on the
  configured queue names. For production, keep backfill + generation on a
  dedicated low-concurrency queue so provider rate limits are respected.

Run a worker locally:

```bash
php artisan queue:work --queue="${DEDUP_INDEXING_QUEUE:-default},${DEDUP_BACKFILL_QUEUE:-default}"
```

## 8. Artisan commands

```
recipereal:generate-batch {requested_count} [--cuisine] [--dish-family] [--category]
                          [--brief] [--language=en] [--batch-size]
                          [--max-attempt-multiplier] [--sync]
recipereal:dedup-index    {--start-id=1} {--chunk=} {--sync} {--force}
recipereal:dedup-status
recipereal:dedup-reindex-recipe {recipe_id}
recipereal:dedup-rebuild-embeddings {--force}
recipereal:dedup-check-vector
recipereal:dedup-scan     {--field=identity_signature} {--chunk=50000}
recipereal:dedup-review   {check_id} {verdict: duplicate|distinct} {--user-email=}
```

- **Start/ resume indexing:** `dedup-index` (idempotent; a saved cursor resumes;
  `--force` overrides the active-chain guard after a crash). Walks by id-window
  chunks — never a full-table load.
- **Progress:** `dedup-status` (config, counts, backfill cursor + staleness,
  vector ping).
- **Single recipe:** `dedup-reindex-recipe` (after an edit) — re-extracts,
  re-registers, re-embeds.
- **Embeddings rebuild:** `dedup-rebuild-embeddings` (interactive confirm or
  `--force`) — wipes status rows only, re-runs the backfill chain; fingerprints/
  pairs/checks untouched; Qdrant points overwritten in place by recipe id.
- **Connectivity:** `dedup-check-vector` (exit 1 when the store is unreachable —
  cron-able).
- **Reference scan:** `dedup-scan` — clusters shared fingerprint hashes and
  flags one pair per cluster (idempotent; never touches recipes).
- **Manual review:** `dedup-review` — append-only verdict on a `needs_review`
  check; creates the confirmed pair + a `manual` check row; the original
  detection row is preserved (only its status flips to resolved). Same flows in
  the Filament `DuplicateChecks` resource with attribution.

## 9. Recipe-generation integration

The generation flow (spec §6–7) is built around accepted-count targeting:

```
requested=100
   │  (batch row created, lease claimed, attempts cap = ceil(100 × 3 / batch))
   ▼
loop:  generator(count = min(batch, 2 × remaining))          ── avoid-titles list
          ├─ empty title / halal terms  → content failure (no detection at all)
          ├─ generator/transport error  → failed call (NOT fatal), retry within caps
          └─ candidates ─► halal gate ─► RecipeRegistrar::register(candidate, batch, ownerId)
                                           ├─ accepted  → insert (recipe + fingerprint + indexing), count++
                                           ├─ duplicate → rejected, logged w/ matched id + scores
                                           └─ needs_review → never auto-accepted; consumes target
   until accepted == requested   → status=completed
   or caps hit (attempts / wall) → status=exhausted, error message explains
                                   'Accepted N of M … (duplicates: x, failed: y, review: z)'
```

CLI:

```bash
# Async (recommended): creates the batch + dispatches the job.
php artisan recipereal:generate-batch 100 --cuisine=italian \
    --category=Pasta --brief="Rotating Italian summer menus"

# Inline (CLI containers / one-offops).
php artisan recipereal:generate-batch 50 --sync --batch-size=10
```

Track a batch: `recipe_generation_batches` (status, counters, error) and its
`recipe_generation_batch_items` (per-candidate verdicts, check ids, reasons);
`owner_id` attribution comes from `DEDUP_GENERATION_OWNER_EMAIL` (falls back to
the first Filament admin, else null like imports).

To generate from your own code, bind
`App\Services\RecipeDedup\Contracts\RecipeCandidateGenerator` (return
`list<CandidateRecipe>` = `CandidateRecipe::fromDraft($draft)`) and call
`BatchGenerationService::run($batch)` — the dedup loop, caps, leases and
records are identical.

## 10. Test results

Integrated main (union of all six slices), full suite:

```
Tests: 436 passed, 1 skipped (2193 assertions)          # 1 skip pre-exists on main baseline
```

Dedup-specific coverage (deterministic fakes for embeddings/vector/judge —
`tests/Support/RecipeFixtures` provides realistic carbonara / alfredo / foul
/ shakshuka drafts):

| Suite | Scenarios |
|---|---|
| `Unit/RecipeDedup/IngredientNormalizer` + `TechniqueDetector` + `CuisineDetector` | synonyms w/o false merges; carbonara ≠ cream-based; cuisine null when unsure |
| `Unit/RecipeDedup/FingerprintBuilder` | quantity bins (<3→0.5, <15→1, <100→5, ≥100→25) incl. the layer-1↔2 flip cases (80 g vs 100 g pecorino) |
| `Unit/RecipeDedup/EmbeddingTextBuilder` | identity text, hash-stability, language |
| `Unit/RecipeDedup/HttpAiDuplicateJudge` | 4 protocols, invalid JSON, timeouts, hallucinated ids |
| `Unit/RecipeDedup/SimilarityScorer` | weights, feature exclusion, corroboration math |
| `Unit/RecipeDedup/OpenAiCompatibleRecipeGenerator` | draft parsing, retries, token budget |
| `Feature/RecipeDedup/FingerprintServiceTest` | registration, serialization, collisions |
| `Feature/RecipeDedup/CandidateRetrieverTest` | sources A–E + vector, caps, filters |
| `Feature/RecipeDedup/DuplicateDetectionServiceTest` | **the 18 calibration scenarios** (spec §12 items 1–10, 18), incl. |
| `Feature/RecipeDedup/RecipeRegistrarTest` | evaluate-then-insert, collision quiet-dup, race-safe unique handling |
| `Feature/RecipeDedup/EmbeddingServiceTest`, `EmbeddingProvidersTest`, `QdrantVectorStoreTest` | failures/retries/skip; provider protocols; store contract |
| `Feature/RecipeDedup/BatchGenerationTest` | §12 item 11 + 13: in-batch dup prevention, exhaustion, crash resume, leases, idempotency, commands |
| `Feature/RecipeDedup/BackfillTest`, `OpsCommandsTest`, `PublisherHookTest` | §12 items 12, 14–17: chunk/resume/collision handling, verdict preservation, start guards |

Calibration highlights (fake-embedder scores — see §12 for the real-embedder
caveat):

| Pair | Score | Outcome |
|---|---|---|
| carbonaraRaw vs carbonaraAlternate (reworded, different titles) | 0.9237 | layer-2 duplicate (fingerprints differ via qty bins) |
| alfredo classic vs spicy | 0.9225 | layer-2 duplicate |
| alfredo classic vs baked casserole variant | 0.7206 | verify band → AI judge |
| foul vs kupura (same beans, different dish) | 0.636 | below verify → accepted |

Performance was validated structurally (index-only retrieval, chunked backfill,
caps) — see §11; a large-scale synthetic benchmark is listed in follow-ups.

## 11. Performance considerations

- **No full-DB scans in any hot path.** Candidates come from unique/index
  lookups (`fingerprint`, `identity_signature`, `ingredient_combo_hash`,
  `main_ingredient_hash`, `dish_family`) and top-K vector search; union capped
  (`DEDUP_MAX_CANDIDATES=40`).
- **Layer 1 costs one indexed lookup** (INSERT-time unique violation) — no AI,
  no embeddings for exact collisions.
- **No unnecessary embeddings**: `recipe_embeddings.text_hash` skips
  re-embedding unchanged identities (model + text version participate in the
  hash); `EmbeddingService::ensureIndexedBatch` batches provider calls
  (64/call).
- **Backfill**: chunked by id window (`DEDUP_BACKFILL_CHUNK=200`), one chained
  job in flight, resumable cursor in cache, `LIMIT`-bounded queries only —
  hundreds of thousands of rows never land in memory, and the app is never
  blocked (queue-driven; `--sync` exists purely for ops).
- **Generation caps**: attempt cap `ceil(target × multiplier / batch)` and a
  wall-clock cap make every batch terminate; per-candidate work is one
  evaluate() (few indexed lookups + ≤ 40 scored candidates + ≤ 1 judge call).
- **Transactions**: registrar does evaluate-then-insert in ONE transaction;
  fingerprint/emnbedding status rows use unique constraints, so two concurrent
  registrars converge on a layer-1 duplicate instead of double-inserting.
- **Small write amplification per recipe**: 1 fingerprint row, 1 embedding
  status row, 1 check row per detection — all indexed, all append-only.

## 12. Known limitations and follow-ups

Known limitations (documented, not silently patched):

- **Fake-embedder calibration caveat.** `FakeEmbeddingProvider` cosines are
  aggressive: real text-embedding models land the alfredo
  classic-vs-spicy pair around ~0.75 (judge band), while the fake scores 0.9225
  (auto-reject band). Production thresholds must be calibrated against the REAL
  embedder during rollout — the thresholds are env-config precisely for this.
  Suggested rollout: run `dedup-scan` + review on a real batch before enabling
  auto-rejection in generation.
- **Quantity bins can flip layers.** 80 g vs 100 g pecorino is the same bin
  (fingerprint-identical → layer 1); 150 g vs 151 g can flip a bin and push the
  pair from layer 1 to layer 2 — scored, corroborated, still caught. Baked-in
  conversion units (e.g. "1/4 cup" not mapped to 60 ml) remain distinct bin
  inputs — layer 2/3 absorb them.
- **`canonical_dish` includes title-derived words** (e.g. "Persist carbonara
  B" → `persist spaghetti carbonara b`): cross-title reworded dupes usually do
  NOT collide at layer 1 — they are caught in layer 2 (with corroboration) or
  by the judge. Stop-word/dish-token refinement of `CulinaryIdentityExtractor`
  is a calibration follow-up, not an engine change.
- **Judge-failure default is `flag`.** Under an outage, verify-band candidates
  are accepted-and-flagged (or flagged) — never auto-rejected — but they DO
  consume the generation target; tune `DEDUP_JUDGE_ON_FAILURE` if the opposite
  is wanted.
- **Lease-steal race (follow-up).** `recipe_generation_batches` stores only
  `lease_expires_at` — no owner token — so after a lease expiry two drivers
  cannot distinguish "my live lease" from "someone else's"; the loser
  keeps-loop window is narrow but real. Follow-up: `lease_owner` token column +
  owner-checked renewal (schema-additive; flagged during review).
- **A large-scale performance benchmark on a production-sized synthetic set**
  (e.g. 500 k recipes + Qdrant 2 M points) is a follow-up: the design is
  index-bounded (§11) but end-to-end latency numbers are not yet measured.
- `DEDUP_BACKFILL_DISPATCH_AHEAD` is reserved (chain is strictly 1-ahead today).
- The generator/judge/embedder adapters assume OpenAI-compatible / Anthropic /
  Gemini HTTP shapes; new providers = one class + config protocol entry.
