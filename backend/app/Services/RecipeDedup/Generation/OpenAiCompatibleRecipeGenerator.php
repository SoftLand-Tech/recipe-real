<?php

namespace App\Services\RecipeDedup\Generation;

use App\Services\RecipeDedup\Contracts\RecipeCandidateGenerator;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\GenerationRequest;
use App\Services\RecipeDedup\GenerationException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Recipe generator adapter for the AI batch generation flow. Built from the
 * WHOLE config('recipe_dedup.generation') array (the locked binding in
 * RecipeDedupServiceProvider) — AI settings live in its nested
 * `generator` sub-array, `batch_size` is the default per-call count.
 *
 * Protocol `openai_compatible` is the primary and fully implemented one:
 * a chat/completions call whose reply must be a strict JSON array of recipe
 * drafts. `anthropic` and `gemini` mirror that same system+user content into
 * the sibling providers' host request/response shapes (GeminiEmbeddingProvider's
 * header + URL normalization, OpenAI-compatible token auth; when the merged
 * HTTP AI judge lands its exact shapes take precedence — kept thin here).
 *
 * Retries are MANUAL loop rounds (NOT Http::retry()): only transport-tier
 * errors and 429/5xx responses are retried; 4xx fail immediately — the
 * write-only retry policy keeps the semantics testable with Http::fake.
 * GenerationException is the ONLY exception type that escapes this class.
 */
final class OpenAiCompatibleRecipeGenerator implements RecipeCandidateGenerator
{
    public function __construct(private readonly array $generation) {}

    public function generate(GenerationRequest $request): array
    {
        $generator = is_array($this->generation['generator'] ?? null)
            ? $this->generation['generator']
            : [];

        // Config's batch_size is only the DEFAULT when a caller omits count.
        $count = $request->count > 0
            ? $request->count
            : max(1, (int) ($this->generation['batch_size'] ?? 10));

        [$system, $user] = $this->prompts($request, $count);

        $protocol = strtolower(trim((string) ($generator['protocol'] ?? 'openai_compatible')));

        $reply = match (true) {
            $protocol === 'anthropic' => $this->anthropic($generator, $system, $user, $count),
            $protocol === 'gemini' => $this->gemini($generator, $system, $user),
            // openai_compatible is primary; `generic` speaks the same
            // JSON-via-prompt chat shape, so it falls through too.
            default => $this->openAiCompatible($generator, $system, $user),
        };

        return $this->draftsFrom($reply, $count);
    }

    /**
     * The single shared prompt pair. System = role + strict-JSON demand;
     * user = brief, hints, schema, do-not-repeat list, language, iteration.
     *
     * @return array{0: string, 1: string}
     */
    private function prompts(GenerationRequest $request, int $count): array
    {
        $system = 'You are a master recipe developer generating ORIGINAL, complete, cookable recipes. '
            .'Output STRICT JSON only: a single JSON array of recipe objects. '
            .'No prose, no markdown fences, no explanations before or after.';

        $schema = '{"title": "string", "description": "string", "ingredients": '
            .'["1 cup flour" or {"item": "flour", "qty": 1, "unit": "cup", "prep": "sifted"}], '
            .'"steps": ["string"], "category": "string", "cuisine": "string", "keywords": ["string"], '
            .'"servings": 4, "prep_time_minutes": 15, "cook_time_minutes": 25}';

        $hints = [];
        if (filled($request->cuisine)) {
            $hints[] = 'Cuisine: '.$request->cuisine;
        }
        if (filled($request->dishFamily)) {
            $hints[] = 'Dish family: '.$request->dishFamily;
        }
        if (filled($request->category)) {
            $hints[] = 'Category: '.$request->category;
        }

        $avoid = $request->avoidTitles;

        $avoidBlock = $avoid === [] ? '' : "Do NOT repeat these existing titles — each is already published, so return clearly different dishes or regions:\n"
            .implode("\n", array_map(fn (string $title): string => '- "'.addcslashes($title, '"').'"', $avoid));

        $parts = [
            sprintf('Generate %d complete recipes for this brief: "%s".', $count, $request->brief),
            $hints === [] ? null : implode('. ', $hints).'.',
            'Each array element must be one recipe object with exactly this shape (ingredients may be plain strings or structured items):'
                ."\n".$schema,
            $avoidBlock === '' ? null : $avoidBlock,
            sprintf('Write every title, description, ingredient and step in language code "%s".', $request->language),
            sprintf(
                'This is variation #%d — explore different regions, ingredient bases and dishes not covered before.',
                $request->iteration + 1
            ),
            'Return ONLY the JSON array. No markdown fences, no commentary.',
        ];

        return [$system, implode("\n\n", array_filter($parts, fn (?string $part): bool => $part !== null && $part !== ''))];
    }

    /**
     * openai_compatible: POST {endpoint}/{chat/completions} (the configured
     * value may already include the path — honored verbatim in that case).
     * Reply text at choices[0].message.content.
     */
    private function openAiCompatible(array $generator, string $system, string $user): string
    {
        $endpoint = trim((string) ($generator['endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new GenerationException('[openai_compatible] recipe generator endpoint is not configured.');
        }

        $url = str_ends_with($endpoint, '/chat/completions')
            ? $endpoint
            : rtrim($endpoint, '/').'/chat/completions';

        $apiKey = (string) ($generator['api_key'] ?? '');
        $payload = [
            'model' => (string) ($generator['model'] ?? ''),
            'temperature' => (float) ($generator['temperature'] ?? 0.8),
            'messages' => [
                ['role' => 'system', 'content' => $system],
                ['role' => 'user', 'content' => $user],
            ],
        ];

        $response = $this->send(
            $url,
            $payload,
            $apiKey === '' ? null : fn (PendingRequest $http): PendingRequest => $http->withToken($apiKey),
            $generator,
        );

        $content = $response->json('choices.0.message.content');

        return is_string($content) ? $content : '';
    }

    /**
     * anthropic: POST {endpoint}/v1/messages (used verbatim when it already
     * ends with /messages) with x-api-key + anthropic-version headers.
     * Reply text at content[*].text (assistant turn's blocks).
     */
    private function anthropic(array $generator, string $system, string $user, int $count): string
    {
        $endpoint = trim((string) ($generator['endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new GenerationException('[anthropic] recipe generator endpoint is not configured.');
        }

        $url = str_ends_with($endpoint, '/messages')
            ? $endpoint
            : rtrim($endpoint, '/').'/v1/messages';

        // Anthropic requires a token budget per request; the per-recipe
        // token estimate, request cap and floor are config knobs
        // (generation.generator.max_tokens / tokens_per_recipe).
        $maxTokens = min(
            max(1, (int) ($generator['max_tokens'] ?? 8_000)),
            max(1_024, (int) ($generator['tokens_per_recipe'] ?? 900) * max(1, $count)),
        );

        $payload = [
            'model' => (string) ($generator['model'] ?? ''),
            'max_tokens' => $maxTokens,
            'temperature' => (float) ($generator['temperature'] ?? 0.8),
            'system' => $system,
            'messages' => [
                ['role' => 'user', 'content' => $user],
            ],
        ];

        $headers = [
            'x-api-key' => (string) ($generator['api_key'] ?? ''),
            'anthropic-version' => '2023-06-01',
        ];

        $response = $this->send(
            $url,
            $payload,
            fn (PendingRequest $http): PendingRequest => $http->withHeaders($headers),
            $generator,
        );

        $blocks = $response->json('content');
        if (! is_array($blocks)) {
            return '';
        }

        $text = '';
        foreach ($blocks as $block) {
            if (is_array($block) && ($block['type'] ?? null) === 'text' && is_string($block['text'] ?? null)) {
                $text .= $block['text'];
            }
        }

        return $text;
    }

    /**
     * gemini: POST {endpoint}/models/{model}:generateContent (used verbatim
     * when it already ends with :generateContent) with the X-goog-api-key
     * header — unless the endpoint already carries ?key= — mirroring
     * GeminiEmbeddingProvider. Reply text at candidates[0].content.parts.
     */
    private function gemini(array $generator, string $system, string $user): string
    {
        $endpoint = trim((string) ($generator['endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new GenerationException('[gemini] recipe generator endpoint is not configured.');
        }

        $model = (string) ($generator['model'] ?? '');
        $url = str_ends_with($endpoint, ':generateContent')
            ? $endpoint
            : rtrim($endpoint, '/').'/models/'.rawurlencode($model).':generateContent';

        $payload = [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $user]]],
            ],
            'generationConfig' => [
                'temperature' => (float) ($generator['temperature'] ?? 0.8),
                'responseMimeType' => 'application/json',
            ],
        ];

        $apiKey = (string) ($generator['api_key'] ?? '');
        $useHeader = $apiKey !== '' && ! str_contains($url, '?key=');

        $response = $this->send(
            $url,
            $payload,
            $useHeader
                ? fn (PendingRequest $http): PendingRequest => $http->withHeaders(['X-goog-api-key' => $apiKey])
                : null,
            $generator,
        );

        $parts = $response->json('candidates.0.content.parts');
        if (! is_array($parts)) {
            return '';
        }

        $text = '';
        foreach ($parts as $part) {
            if (is_array($part) && is_string($part['text'] ?? null)) {
                $text .= $part['text'];
            }
        }

        return $text;
    }

    /**
     * The shared manual retry loop: ConnectionException-tier transport
     * failures and 429/5xx responses are retried; 4xx fail immediately.
     * GenerationException is the only outward exception.
     *
     * @param  (callable(PendingRequest): PendingRequest)|null  $authorize
     */
    private function send(string $url, array $payload, ?callable $authorize, array $generator): Response
    {
        $timeout = max(1, (int) ($generator['timeout'] ?? 240));
        $maxAttempts = max(1, (int) ($generator['retries'] ?? 0) + 1);

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $http = Http::acceptJson()->timeout($timeout);
                if ($authorize !== null) {
                    $http = $authorize($http);
                }

                $response = $http->post($url, $payload);
            } catch (\Throwable $e) {
                // Transport-level failure (timeout / DNS / refused). Retry,
                // else wrap — contract: only GenerationException escapes.
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new GenerationException(
                    sprintf('[recipe generator] request to %s failed after %d attempt(s): %s', $url, $attempt, $e->getMessage()),
                    0,
                    $e,
                );
            }

            if ($response->successful()) {
                return $response;
            }

            // 429/5xx are retryable; everything else (401/403/400) fails now.
            if ($response->status() === 429 || $response->status() >= 500) {
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new GenerationException(
                    sprintf('[recipe generator] request to %s got HTTP %d after %d attempt(s): %s', $url, $response->status(), $attempt, $this->excerpt($response)),
                );
            }

            throw new GenerationException(
                sprintf('[recipe generator] request rejected with HTTP %d by %s: %s', $response->status(), $url, $this->excerpt($response)),
            );
        }

        // Unreachable: the loop always returns or throws on its last round.
        throw new GenerationException(sprintf('[recipe generator] request loop to %s exhausted without a result.', $url));
    }

    /**
     * Decode the reply into 0..$count CandidateRecipe drafts. Tolerates
     * markdown fences and surrounding prose; accepts a bare JSON array, a
     * {recipes: [...]} wrapper, or a single recipe object. Empty results
     * are a FAILURE for generation semantics (a batch call that returns
     * nothing has failed to do its job) — GenerationException, so the
     * caller counts one failed call and continues.
     *
     * @return list<CandidateRecipe>
     */
    private function draftsFrom(string $reply, int $count): array
    {
        $block = $this->firstBalancedJsonBlock($this->stripCodeFences($reply));

        if ($block === null) {
            throw new GenerationException('[recipe generator] response carries no parsable JSON array: '.mb_substr(trim($reply), 0, 300));
        }

        $decoded = json_decode($block, true);

        if (! is_array($decoded)) {
            throw new GenerationException('[recipe generator] response JSON did not decode to an array: '.mb_substr(trim($block), 0, 300));
        }

        $drafts = [];
        if (array_is_list($decoded)) {
            $drafts = $decoded;
        } elseif (is_array($decoded['recipes'] ?? null)) {
            $drafts = $decoded['recipes'];
        } elseif (is_array($decoded['data'] ?? null)) {
            // Common OpenAI-style wrapper seen in the wild for list payloads.
            $drafts = $decoded['data'];
        } elseif (is_string($decoded['title'] ?? null)) {
            // A single bare recipe object.
            $drafts = [$decoded];
        } else {
            throw new GenerationException('[recipe generator] response JSON has neither a draft array nor a recipes wrapper.');
        }

        $candidates = [];

        foreach ($drafts as $draft) {
            if (! is_array($draft)) {
                continue;
            }

            $candidates[] = CandidateRecipe::fromDraft($draft);

            if (count($candidates) >= $count) {
                break;
            }
        }

        if ($candidates === []) {
            throw new GenerationException(sprintf('[recipe generator] response returned 0 usable recipes (requested %d): %s', $count, mb_substr(trim($reply), 0, 300)));
        }

        return $candidates;
    }

    /** Removes ``` / ```json fence lines anywhere in the reply. */
    private function stripCodeFences(string $reply): string
    {
        $lines = [];

        foreach (explode("\n", $reply) as $line) {
            if (preg_match('/^\s*```/', $line) === 1) {
                continue;
            }

            $lines[] = $line;
        }

        return implode("\n", $lines);
    }

    /**
     * The FIRST balanced [...] or {...} block of $text, string-aware
     * (quotes + backslash escapes) on the way there. null when none.
     */
    private function firstBalancedJsonBlock(string $text): ?string
    {
        $depth = 0;
        $start = null;
        $inString = false;
        $escaped = false;
        $length = mb_strlen($text);

        for ($i = 0; $i < $length; $i++) {
            $char = mb_substr($text, $i, 1);

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

            if ($char === '[' || $char === '{') {
                if ($depth === 0) {
                    $start = $i;
                }

                $depth++;

                continue;
            }

            if ($char === ']' || $char === '}') {
                $depth--;

                if ($depth === 0 && $start !== null) {
                    return mb_substr($text, $start, $i - $start + 1);
                }

                if ($depth < 0) {
                    // A closer without an opener (prose) — reset the scan.
                    $depth = 0;
                }
            }
        }

        return null;
    }

    /**
     * The prescribed small backoff: 250ms per attempt, floored at 50ms,
     * capped at 1s so a wedged provider can't stall a worker long.
     */
    private function backoff(int $attempt): void
    {
        usleep((int) min(1_000_000, max(50_000, 250_000 * $attempt)));
    }

    /** First 300 chars of an error body — enough to diagnose, unreadable-internal-data safe. */
    private function excerpt(Response $response): string
    {
        return mb_substr(trim((string) $response->body()), 0, 300);
    }
}
