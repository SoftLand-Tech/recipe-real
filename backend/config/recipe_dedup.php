<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Recipe deduplication engine
    |--------------------------------------------------------------------------
    |
    | Central configuration for the three-layer duplicate detection engine
    | (exact fingerprints -> weighted structural/semantic scoring -> AI
    | verification) and the AI recipe generation batches that feed it.
    |
    | Every numeric switch below is documented with its rationale and the
    | test evidence that backs it. Values may be tuned per environment via
    | the DEDUP_* env vars without code changes.
    |
    */

    // Master switch. When false, generation batches re-accept everything
    // and the indexing hooks become no-ops (existing behaviour).
    'enabled' => (bool) env('DEDUP_ENABLED', true),

    /*
    | Layer thresholds (weighted similarity score, 0.0..1.0, produced by
    | SimilarityScorer). The defaults were validated against the
    | tests/Feature/DedupDetectionTest scenarios:
    |
    |   - >= auto_duplicate  AND corroborated (see 'corroboration')
    |         -> Layer 2 rejects as duplicate without any AI call.
    |   - >= verify          -> Layer 3: sent to the AI judge.
    |   - below verify       -> accepted (score still recorded for review).
    |
    | Rationale: 0.88 with corroboration only fires on near-identical
    | culinary identities (same dish family, high main-ingredient overlap,
    | shared techniques). Spicy vs classic Alfredo lands ~0.75 because the
    | flavor marker + sauce changes lower the vector and ingredient terms,
    | so it reaches the judge instead of being auto-rejected.
    */
    'thresholds' => [
        'auto_duplicate' => (float) env('DEDUP_AUTO_DUPLICATE_SCORE', 0.88),

        // At/above this score (and below auto_duplicate) the candidate is
        // sent to the AI judge instead of being accepted blindly.
        'verify' => (float) env('DEDUP_VERIFY_SCORE', 0.68),
    ],

    /*
    | Corroboration rule for Layer 2 auto-rejection: a high score ALONE
    | never rejects a recipe. It must also satisfy at least 'min_rules'
    | identity pillars shared with the matched recipe:
    |   - same dish family,
    |   - main-ingredient Jaccard >= main_ingredient_jaccard,
    |   - technique Jaccard >= technique_jaccard,
    |   - same canonical dish identity.
    */
    'corroboration' => [
        'min_rules' => (int) env('DEDUP_CORROBORATION_MIN_RULES', 2),
        'main_ingredient_jaccard' => (float) env('DEDUP_MAIN_INGREDIENT_JACCARD', 0.70),
        'technique_jaccard' => (float) env('DEDUP_TECHNIQUE_JACCARD', 0.60),
    ],

    /*
    | Feature weights for SimilarityScorer (relative, they are normalized
    | at runtime so they do not need to sum to 1). Vector cosine and main
    | ingredients dominate; text-lookup extras (title signature) never
    | contribute to the score by themselves.
    */
    'weights' => [
        'vector_cosine' => (float) env('DEDUP_W_VECTOR', 30),
        'main_ingredients_jaccard' => (float) env('DEDUP_W_MAIN_INGREDIENTS', 20),
        'all_ingredients_jaccard' => (float) env('DEDUP_W_ALL_INGREDIENTS', 10),
        'same_canonical_dish' => (float) env('DEDUP_W_CANONICAL_DISH', 15),
        'same_dish_family' => (float) env('DEDUP_W_DISH_FAMILY', 5),
        'techniques_jaccard' => (float) env('DEDUP_W_TECHNIQUES', 10),
        'same_sauce' => (float) env('DEDUP_W_SAUCE', 5),
        'same_form' => (float) env('DEDUP_W_FORM', 3),
        'same_prep_method' => (float) env('DEDUP_W_PREP_METHOD', 2),
    ],

    /*
    | Candidate retrieval (Layer 2 entry). Nothing here ever scans the
    | whole database: candidates come from exact fingerprint hits, indexed
    | signature lookups, and top-K vector search only.
    */
    'retrieval' => [
        'enabled' => (bool) env('DEDUP_CANDIDATE_RETRIEVAL_ENABLED', true),

        // Vector top-K per lookup.
        'top_k' => (int) env('DEDUP_TOP_K', 24),

        // Cosine floor for a vector candidate to be considered: below this
        // the cost of scoring outweighs any chance of duplication.
        'min_vector_score' => (float) env('DEDUP_MIN_VECTOR_SCORE', 0.55),

        // Cap on candidates pulled from one signature cluster.
        'signature_candidates' => (int) env('DEDUP_SIGNATURE_CANDIDATES', 24),

        // Filter vector searches by dish family / cuisine when known.
        'use_filters' => (bool) env('DEDUP_VECTOR_FILTERS', true),

        // Hard cap before layer 2 scoring (union of all sources).
        'max_candidates' => (int) env('DEDUP_MAX_CANDIDATES', 40),
    ],

    /*
    | AI duplicate verification (Layer 3). Only the candidate's structured
    | culinary identity plus up to max_candidates existing identities are
    | sent — never raw recipes, never the database.
    */
    'ai_judge' => [
        'enabled' => (bool) env('DEDUP_JUDGE_ENABLED', true),

        'protocol' => env('DEDUP_JUDGE_PROTOCOL', 'openai_compatible'), // openai_compatible|anthropic|gemini|generic
        'endpoint' => env('DEDUP_JUDGE_ENDPOINT', ''),
        'api_key' => env('DEDUP_JUDGE_API_KEY', ''),
        'model' => env('DEDUP_JUDGE_MODEL', ''),

        'timeout' => (int) env('DEDUP_JUDGE_TIMEOUT', 60),
        'retries' => (int) env('DEDUP_JUDGE_RETRIES', 1),

        // Candidates verified per judge call (batched into ONE request).
        'max_candidates' => (int) env('DEDUP_JUDGE_MAX_CANDIDATES', 5),

        // Judge confidence at/above this trusts the classification; below
        // it falls back to the score band (verified below review threshold).
        'min_auto_confidence' => (float) env('DEDUP_JUDGE_MIN_AUTO_CONFIDENCE', 0.85),

        // What happens when the judge is unreachable / invalid repeatedly:
        //   flag   - the candidate is accepted but flagged for review (default)
        //   accept - accepted without a note
        //   reject - treated as duplicate (discouraged: loses fresh content)
        'on_failure' => env('DEDUP_JUDGE_ON_FAILURE', 'flag'),
    ],

    /*
    | Embedding generation for the semantic layer. Embeddings are skipped
    | when the identity text hash did not change (no re-embedding of
    | unchanged recipes).
    */
    'embeddings' => [
        'enabled' => (bool) env('DEDUP_EMBEDDINGS_ENABLED', true),

        'protocol' => env('DEDUP_EMBEDDING_PROTOCOL', 'openai_compatible'), // openai_compatible|gemini|none
        'endpoint' => env('DEDUP_EMBEDDING_ENDPOINT', ''),
        'api_key' => env('DEDUP_EMBEDDING_API_KEY', ''),
        'model' => env('DEDUP_EMBEDDING_MODEL', ''),
        'dimensions' => (int) env('DEDUP_EMBEDDING_DIMENSIONS', 0), // 0 = provider default

        'batch_size' => (int) env('DEDUP_EMBEDDING_BATCH_SIZE', 64),
        'timeout' => (int) env('DEDUP_EMBEDDING_TIMEOUT', 30),
        'retries' => (int) env('DEDUP_EMBEDDING_RETRIES', 2),
    ],

    /*
    | Vector database. 'qdrant' talks HTTP to a Qdrant instance (no composer
    | package). 'none' disables vector search entirely — the engine still
    | runs on exact fingerprints + signature lookups.
    */
    'vector' => [
        'driver' => env('DEDUP_VECTOR_DRIVER', 'qdrant'), // qdrant|none

        'qdrant' => [
            'url' => env('DEDUP_QDRANT_URL', 'http://127.0.0.1:6333'),
            'api_key' => env('DEDUP_QDRANT_API_KEY', ''),
            'collection' => env('DEDUP_QDRANT_COLLECTION', 'recipe_embeddings'),
            'timeout' => (int) env('DEDUP_QDRANT_TIMEOUT_MS', 1500),
            'connect_timeout' => (int) env('DEDUP_QDRANT_CONNECT_TIMEOUT_MS', 700),
        ],
    ],

    /*
    | Backfill of existing recipes (chunked, queued, resumable).
    */
    'backfill' => [
        // Recipes per chunk job.
        'chunk' => (int) env('DEDUP_BACKFILL_CHUNK', 200),

        // Queue the chunk jobs run on (falls back to the default queue).
        'queue' => env('DEDUP_BACKFILL_QUEUE', null),

        // How many chunk jobs stay queued ahead of completion.
        'dispatch_ahead' => (int) env('DEDUP_BACKFILL_DISPATCH_AHEAD', 20),
    ],

    /*
    | Indexing hooks for NEW recipes (RecipePublisher and generation flow).
    */
    'indexing' => [
        'enabled' => (bool) env('DEDUP_INDEXING_ENABLED', true),
        'queue' => env('DEDUP_INDEXING_QUEUE', null),
        'embed_immediately' => (bool) env('DEDUP_EMBED_IMMEDIATELY', true),
    ],

    /*
    | AI recipe generation batches (recipereal:generate-batch).
    | The target is ACCEPTED recipes; rejected dupes are replaced until the
    | attempt caps below are hit, so the loop can never run forever.
    */
    'generation' => [
        // Recipes requested per generator call.
        'batch_size' => (int) env('DEDUP_GENERATION_BATCH_SIZE', 10),

        // Extra multiplier on requested_count for generator attempts
        // (e.g. 100 accepted target -> at most ~300 recipes generated).
        'default_max_attempt_multiplier' => (float) env('DEDUP_GENERATION_MAX_ATTEMPT_MULTIPLIER', 3),

        // Wall-clock ceiling for a batch run (safety net on top of caps).
        'max_wall_seconds' => (int) env('DEDUP_GENERATION_MAX_WALL_SECONDS', 3600),

        // Batch lease: a batch is claimed by exactly one worker; the lease
        // expires so crashed workers never deadlock the batch.
        'lease_seconds' => (int) env('DEDUP_GENERATION_LEASE_SECONDS', 900),

        'source_type' => env('DEDUP_GENERATION_SOURCE_TYPE', 'ai_batch'),

        // Optional owner email for generated recipes (defaults to the first
        // admin; recipes may otherwise have owner_id null like imports).
        'owner_email' => env('DEDUP_GENERATION_OWNER_EMAIL', ''),

        'generator' => [
            'protocol' => env('DEDUP_GENERATOR_PROTOCOL', 'openai_compatible'), // openai_compatible|anthropic|gemini|generic
            'endpoint' => env('DEDUP_GENERATOR_ENDPOINT', ''),
            'api_key' => env('DEDUP_GENERATOR_API_KEY', ''),
            'model' => env('DEDUP_GENERATOR_MODEL', ''),
            'timeout' => (int) env('DEDUP_GENERATOR_TIMEOUT', 240),
            'temperature' => (float) env('DEDUP_GENERATOR_TEMPERATURE', 0.8),
            'retries' => (int) env('DEDUP_GENERATOR_RETRIES', 2),

            // Anthropic token budget per request: floor, per-recipe estimate
            // and request cap only apply to protocols that require
            // max_tokens (anthropic).
            'max_tokens' => (int) env('DEDUP_GENERATOR_MAX_TOKENS', 8000),
            'tokens_per_recipe' => (int) env('DEDUP_GENERATOR_TOKENS_PER_RECIPE', 900),
        ],
    ],

    /*
    | Small TTL cache for inert lookups (vector ping, token counts).
    */
    'cache' => [
        'ttl_seconds' => (int) env('DEDUP_CACHE_TTL', 300),
    ],

];
