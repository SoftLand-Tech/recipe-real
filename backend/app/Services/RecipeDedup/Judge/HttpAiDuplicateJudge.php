<?php

namespace App\Services\RecipeDedup\Judge;

use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Data\AiJudgeResponse;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Layer 3 HTTP client for the AI duplicate judge (the container binding
 * referenced from RecipeDedupServiceProvider).
 *
 * Four wire protocols are supported via config('recipe_dedup.ai_judge.protocol'):
 *
 *  - openai_compatible (default): POST {endpoint}/chat/completions with a
 *    system + user chat message, temperature 0, response_format
 *    json_object. Verdict text at choices[0].message.content.
 *  - anthropic: POST {endpoint}/messages with a `system` field + one user
 *    message, max_tokens 1024 (plus the mandatory anthropic-version
 *    header). Verdict text at content[0].text.
 *  - gemini: POST {endpoint}/models/{model}:generateContent with
 *    generationConfig.responseMimeType json (auth via the X-goog-api-key
 *    HEADER — never the ?key= query param, which leaks into access logs;
 *    house style from the embeddings slice). Verdict text at
 *    candidates[0].content.parts[0].text. The doctrine rides along as
 *    systemInstruction (Gemini's system-prompt slot) since `contents`
 *    only carries the user turn.
 *  - generic: POST {endpoint} with body {title, identity} and expect the
 *    AiJudgeResponse-shaped verdict JSON back directly (minimal pass-
 *    through for internal verdict services; the existing list is NOT
 *    sent — an endpoint of this kind must hold its own recipe context).
 *
 * The interface contract is honored: AiJudgeException is the ONLY thing
 * this class throws. Retries are MANUAL loop rounds (NOT Http::retry()),
 * the house pattern from the embeddings slice: transport errors
 * (ConnectionException — timeouts included) and 429/5xx responses are
 * retried; 4xx fail immediately. The config `enabled` flag is guarded
 * HERE TOO (the detection service checks it first and never calls).
 *
 * Response parsing is deliberately paranoid: markdown fences are
 * stripped, then the FIRST balanced {...} JSON object is extracted by a
 * quote-aware brace scan (prose before/after the JSON is tolerated),
 * decoded and passed through the strict AiJudgeResponse::fromArray()
 * validation. A judge claiming `duplicate` for an id it was never
 * offered is treated as a hallucination (matched id nulled); the
 * detection service then decides.
 */
final class HttpAiDuplicateJudge implements AiDuplicateJudge
{
    private const SYSTEM_PROMPT = <<<'PROMPT'
        You are a recipe duplicate arbiter. You receive the structured
        culinary identity of a CANDIDATE recipe and the identities of
        EXISTING recipes, and decide for each whether the candidate
        duplicates it.

        Doctrine (apply in this order):
        - Different titles or wording do not make a recipe unique. Judge
          the culinary identity, not phrasing.
        - Quantity, unit or garnish differences do not make a recipe unique.
        - Shared ingredients alone do not make duplicates: many distinct
          dishes share ingredients.
        - Genuine regional or traditional variations of a dish deserve
          separate identities.
        - A different cooking technique or dish structure can justify a
          separate recipe.

        classification is exactly one of:
          duplicate            - the same recipe.
          meaningful_variation - same dish, but a genuine regional, traditional
                                 or structural variation worth keeping.
          distinct             - a different dish.
          uncertain            - you cannot decide from the identities.

        Reply with STRICT JSON ONLY (no prose, no markdown, no extra keys):
        {"classification": "duplicate|meaningful_variation|distinct|uncertain",
          "is_duplicate": true|false,
          "matched_recipe_id": <an id from the offered EXISTING recipes, or null>,
          "confidence": <0.0..1.0>,
          "reason": "<one short sentence>",
          "differences": ["<short difference notes, when meaningful>"]}
        Only set matched_recipe_id when classification is duplicate and
        is_duplicate is true, and ONLY to an id present in the EXISTING list.
        PROMPT;

    public function __construct(private readonly array $config) {}

    /**
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     *
     * @throws AiJudgeException
     */
    public function judge(
        CandidateRecipe $candidate,
        CulinaryIdentity $candidateIdentity,
        array $existing,
    ): AiJudgeResponse {
        if (array_key_exists('enabled', $this->config) && ! (bool) $this->config['enabled']) {
            // The detection service checks config('recipe_dedup.ai_judge.enabled')
            // first and never calls when disabled; this is the second guard.
            throw new AiJudgeException('The AI duplicate judge is disabled by config.');
        }

        $existing = $this->capExisting($existing);
        $protocol = (string) ($this->config['protocol'] ?? 'openai_compatible');
        $timeout = max(1, (int) ($this->config['timeout'] ?? 60));
        $maxAttempts = max(1, (int) ($this->config['retries'] ?? 0) + 1);

        $text = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $response = $this->request($protocol, $candidate, $candidateIdentity, $existing, $timeout);
            } catch (Throwable $e) {
                // Transport-level failure (timeout / DNS / refused). Retry,
                // else wrap — contract: only AiJudgeException escapes.
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new AiJudgeException(
                    sprintf('[%s] judge request failed after %d attempt(s): %s', $protocol, $attempt, $e->getMessage()),
                    0,
                    $e,
                );
            }

            if ($response->successful()) {
                $text = $this->verdictText($response, $protocol);

                break;
            }

            // 429/5xx are retryable; everything else (401/403/422/...) fails now.
            if ($response->status() === 429 || $response->status() >= 500) {
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new AiJudgeException(
                    sprintf('[%s] judge request got HTTP %d after %d attempt(s): %s', $protocol, $response->status(), $attempt, self::excerpt($response)),
                );
            }

            throw new AiJudgeException(
                sprintf('[%s] judge request rejected with HTTP %d: %s', $protocol, $response->status(), self::excerpt($response)),
            );
        }

        if ($text === null) {
            // Unreachable: the loop always returns a text or throws on its
            // last round. Guarded for future per-protocol short-circuits.
            throw new AiJudgeException(sprintf('[%s] judge loop exhausted without a verdict.', $protocol));
        }

        return $this->parse($text, $existing);
    }

    /**
     * The judge verifies at most max_candidates existing identities per
     * call; the detection service pre-sorts by score, so the FIRST
     * max_candidates entries are kept (documented guard — the interface
     * only receives the final list).
     *
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     * @return list<array{id:int, title:string, identity:CulinaryIdentity}>
     */
    private function capExisting(array $existing): array
    {
        $existing = array_values($existing);
        $cap = (int) ($this->config['max_candidates'] ?? 0);

        if ($cap >= 1 && count($existing) > $cap) {
            return array_slice($existing, 0, $cap);
        }

        return $existing;
    }

    /**
     * The user message: candidate + existing identities as compact JSON.
     * Ingredient arrays are mapped to NAME-ONLY lists (raw lines dropped)
     * to cut tokens — the arbiter reasons over identity, not wording.
     *
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     * @return array<string, mixed>
     */
    private function payload(CandidateRecipe $candidate, CulinaryIdentity $candidateIdentity, array $existing): array
    {
        return [
            'candidate' => [
                'title' => $candidate->title,
                'identity' => self::compactIdentity($candidateIdentity),
            ],
            'existing' => array_map(fn (array $entry): array => [
                'id' => (int) $entry['id'],
                'title' => (string) $entry['title'],
                'identity' => self::compactIdentity($entry['identity']),
            ], array_values($existing)),
        ];
    }

    /**
     * The identity with raw ingredient lines stripped: main_ingredients /
     * supporting_ingredients become plain name lists.
     *
     * @return array<string, mixed>
     */
    private static function compactIdentity(CulinaryIdentity $identity): array
    {
        $array = $identity->toArray();
        $array['main_ingredients'] = $identity->mainIngredientNames();
        $array['supporting_ingredients'] = $identity->supportingIngredientNames();

        return $array;
    }

    /**
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     *
     * @throws Throwable transport errors propagate for the retry loop
     */
    private function request(
        string $protocol,
        CandidateRecipe $candidate,
        CulinaryIdentity $candidateIdentity,
        array $existing,
        int $timeout,
    ): Response {
        return match ($protocol) {
            'openai_compatible' => $this->requestOpenAiCompatible($candidate, $candidateIdentity, $existing, $timeout),
            'anthropic' => $this->requestAnthropic($candidate, $candidateIdentity, $existing, $timeout),
            'gemini' => $this->requestGemini($candidate, $candidateIdentity, $existing, $timeout),
            'generic' => $this->requestGeneric($candidate, $candidateIdentity, $timeout),
            default => throw new AiJudgeException(sprintf('Unknown AI judge protocol [%s].', $protocol)),
        };
    }

    /**
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     */
    private function requestOpenAiCompatible(
        CandidateRecipe $candidate,
        CulinaryIdentity $candidateIdentity,
        array $existing,
        int $timeout,
    ): Response {
        $endpoint = (string) ($this->config['endpoint'] ?? '');
        $url = str_ends_with($endpoint, '/chat/completions')
            ? $endpoint
            : rtrim($endpoint, '/').'/chat/completions';

        $payload = [
            'model' => (string) ($this->config['model'] ?? ''),
            'messages' => [
                ['role' => 'system', 'content' => self::SYSTEM_PROMPT],
                ['role' => 'user', 'content' => self::jsonPayload($this->payload($candidate, $candidateIdentity, $existing))],
            ],
            'temperature' => 0,
            'response_format' => ['type' => 'json_object'],
        ];

        return $this->httpClient()
            ->when((string) ($this->config['api_key'] ?? '') !== '', fn (PendingRequest $http) => $http->withToken((string) $this->config['api_key']))
            ->timeout($timeout)
            ->post($url, $payload);
    }

    /**
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     */
    private function requestAnthropic(
        CandidateRecipe $candidate,
        CulinaryIdentity $candidateIdentity,
        array $existing,
        int $timeout,
    ): Response {
        $endpoint = (string) ($this->config['endpoint'] ?? '');
        $url = str_ends_with($endpoint, '/messages')
            ? $endpoint
            : rtrim($endpoint, '/').'/messages';

        $payload = [
            'model' => (string) ($this->config['model'] ?? ''),
            'max_tokens' => 1024,
            'system' => self::SYSTEM_PROMPT,
            'messages' => [
                ['role' => 'user', 'content' => self::jsonPayload($this->payload($candidate, $candidateIdentity, $existing))],
            ],
        ];

        return $this->httpClient()
            ->when((string) ($this->config['api_key'] ?? '') !== '', fn (PendingRequest $http) => $http->withHeaders([
                'x-api-key' => (string) $this->config['api_key'],
                'anthropic-version' => '2023-06-01', // the API rejects calls without it
            ]))
            ->timeout($timeout)
            ->post($url, $payload);
    }

    /**
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     */
    private function requestGemini(
        CandidateRecipe $candidate,
        CulinaryIdentity $candidateIdentity,
        array $existing,
        int $timeout,
    ): Response {
        $endpoint = (string) ($this->config['endpoint'] ?? '');
        $url = str_ends_with($endpoint, ':generateContent')
            ? $endpoint
            : rtrim($endpoint, '/').'/models/'.rawurlencode((string) ($this->config['model'] ?? '')).':generateContent';

        $payload = [
            'systemInstruction' => ['parts' => [['text' => self::SYSTEM_PROMPT]]],
            'contents' => [
                ['parts' => [['text' => self::jsonPayload($this->payload($candidate, $candidateIdentity, $existing))]]],
            ],
            'generationConfig' => ['temperature' => 0, 'responseMimeType' => 'application/json'],
        ];

        $client = $this->httpClient();

        if ((string) ($this->config['api_key'] ?? '') !== '' && ! str_contains($url, '?key=')) {
            $client = $client->withHeaders(['x-goog-api-key' => (string) $this->config['api_key']]);
        }

        return $client->timeout($timeout)->post($url, $payload);
    }

    private function requestGeneric(CandidateRecipe $candidate, CulinaryIdentity $candidateIdentity, int $timeout): Response
    {
        $payload = [
            'title' => $candidate->title,
            'identity' => self::compactIdentity($candidateIdentity),
        ];

        return $this->httpClient()
            ->when((string) ($this->config['api_key'] ?? '') !== '', fn (PendingRequest $http) => $http->withToken((string) $this->config['api_key']))
            ->timeout($timeout)
            ->post((string) ($this->config['endpoint'] ?? ''), $payload);
    }

    private function verdictText(Response $response, string $protocol): string
    {
        return match ($protocol) {
            'openai_compatible' => (string) $response->json('choices.0.message.content', ''),
            'anthropic' => (string) $response->json('content.0.text', ''),
            'gemini' => (string) $response->json('candidates.0.content.parts.0.text', ''),
            'generic' => trim((string) $response->body()), // the verdict IS the body
            default => '',
        };
    }

    /**
     * Extract + validate the verdict. Contract: only AiJudgeException
     * escapes.
     *
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $existing
     */
    private function parse(string $text, array $existing): AiJudgeResponse
    {
        $json = self::extractJson($text);

        if ($json === null) {
            throw new AiJudgeException('unparseable judge verdict: "'.self::clip($text).'"');
        }

        try {
            $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new AiJudgeException('unparseable judge verdict: "'.self::clip($text).'"');
        }

        if (! is_array($decoded)) {
            throw new AiJudgeException('unparseable judge verdict: the extracted payload is not a JSON object.');
        }

        $response = AiJudgeResponse::fromArray($decoded);

        // Hallucination guard: matched_recipe_id survives only inside a
        // duplicate verdict pointing at an id the judge was OFFERED.
        // Everything else decays to null; the detection service decides.
        $isDuplicateVerdict = $response->classification === AiJudgeResponse::CLASSIFICATION_DUPLICATE
            && $response->isDuplicate;
        $offered = array_map(fn (array $entry): int => (int) $entry['id'], array_values($existing));

        if ($response->matchedRecipeId !== null
            && (! $isDuplicateVerdict || ! in_array($response->matchedRecipeId, $offered, true))
        ) {
            $response = self::withoutMatchedId($response);
        }

        return $response;
    }

    /**
     * Quote-aware brace scan for the FIRST balanced {...} JSON object,
     * tolerating markdown code fences and prose around the JSON: braces
     * inside JSON string literals (and escaped quotes) never affect
     * nesting. Returns null when nothing balances (caller throws).
     */
    private static function extractJson(string $text): ?string
    {
        $text = trim((string) preg_replace('/```[a-zA-Z0-9_-]*/', '', $text));

        $length = strlen($text);
        $start = null; // byte offset of the first top-level '{'
        $depth = 0;
        $inString = false;
        $escaped = false;

        for ($i = 0; $i < $length; $i++) {
            $char = $text[$i];

            if ($inString) {
                if ($escaped) {
                    $escaped = false;

                    continue;
                }

                if ($char === '\\') {
                    $escaped = true;

                    continue;
                }

                if ($char === '"') {
                    $inString = false;
                }

                continue;
            }

            if ($char === '"') {
                $inString = true;

                continue;
            }

            if ($char === '{') {
                if ($depth === 0) {
                    $start = $i;
                }

                $depth++;

                continue;
            }

            if ($char === '}') {
                $depth--;

                if ($depth === 0 && $start !== null) {
                    return substr($text, $start, $i - $start + 1);
                }

                if ($depth < 0) {
                    // Stray closing brace before any open object: reset so a
                    // later well-formed object is still picked up.
                    $start = null;
                    $depth = 0;
                }
            }
        }

        return null;
    }

    /** AiJudgeResponse is a frozen readonly DTO — rebuild minus the match. */
    private static function withoutMatchedId(AiJudgeResponse $response): AiJudgeResponse
    {
        return new AiJudgeResponse(
            classification: $response->classification,
            isDuplicate: $response->isDuplicate,
            matchedRecipeId: null,
            confidence: $response->confidence,
            reason: $response->reason,
            differences: $response->differences,
        );
    }

    /** @param array<string, mixed> $payload */
    private static function jsonPayload(array $payload): string
    {
        return json_encode($payload, JSON_UNESCAPED_UNICODE);
    }

    /** Small prescribed backoff: 250ms per attempt, floored/capped. */
    private function backoff(int $attempt): void
    {
        usleep((int) min(1_000_000, max(50_000, 250_000 * $attempt)));
    }

    /** First 300 chars of a body — diagnosable, never a wall of HTML. */
    private static function excerpt(Response $response): string
    {
        return mb_substr(trim((string) $response->body()), 0, 300);
    }

    private static function clip(string $text): string
    {
        return mb_substr(trim($text), 0, 200);
    }

    private function httpClient(): PendingRequest
    {
        return Http::acceptJson();
    }
}
