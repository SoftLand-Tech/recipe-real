<?php

namespace App\Services\RecipeImport;

use App\Models\RecipeImport;
use App\Services\RecipeImport\Contracts\RecipeAiProvider;
use Illuminate\Support\Facades\Http;
use Throwable;

class HttpRecipeAiProvider implements RecipeAiProvider
{
    public function __construct(
        private readonly string $providerKey,
        private readonly array $config,
        private readonly RecipeImportStorage $storage,
    ) {}

    public function key(): string
    {
        return $this->providerKey;
    }

    public function model(): ?string
    {
        $model = trim((string) ($this->config['model'] ?? ''));

        return $model === '' ? null : $model;
    }

    public function extract(RecipeImport $import, array $source): array
    {
        $endpoint = trim((string) ($this->config['endpoint'] ?? ''));
        if ($endpoint === '') {
            throw new RecipeImportException(
                'No recipe AI endpoint is configured.',
                'provider_not_configured',
            );
        }

        $protocol = strtolower((string) ($this->config['protocol'] ?? 'generic'));
        $prompt = $this->prompt($import, $source);
        $body = $this->requestBody($protocol, $prompt, $source);

        try {
            $request = Http::timeout((int) ($this->config['timeout'] ?? 180))
                ->connectTimeout(15)
                ->acceptJson();
            $apiKey = trim((string) ($this->config['api_key'] ?? ''));

            if ($apiKey !== '') {
                $request = match ($protocol) {
                    'anthropic' => $request->withHeaders([
                        'x-api-key' => $apiKey,
                        'anthropic-version' => '2023-06-01',
                    ]),
                    'gemini' => $request->withHeaders(['x-goog-api-key' => $apiKey]),
                    default => $request->withToken($apiKey),
                };
            }

            $response = $request->post($endpoint, $body);
        } catch (Throwable $e) {
            throw new RecipeImportException(
                'The recipe AI provider could not be reached.',
                'provider_unreachable',
                true,
                $e,
            );
        }

        if (! $response->successful()) {
            $retryable = $response->status() === 429 || $response->serverError();
            throw new RecipeImportException(
                'The recipe AI provider returned HTTP '.$response->status().'.',
                'provider_http_error',
                $retryable,
            );
        }

        $json = $response->json();
        $content = $this->responseContent($protocol, $json, $response->body());
        $decoded = $this->decodeJson($content);

        if (! is_array($decoded)) {
            throw new RecipeImportException(
                'The recipe AI provider returned no JSON recipe draft.',
                'provider_invalid_response',
            );
        }

        return $decoded;
    }

    /** @param array<string, mixed> $source */
    private function prompt(RecipeImport $import, array $source): string
    {
        return implode("\n", [
            'You are a recipe extraction system.',
            'Inspect every supplied image and video frame. If the source has speech, transcribe it; if it has no speech, infer the recipe from visible ingredients, text overlays, and actions.',
            'Do not invent quantities when they are not visible. Leave uncertain values null and add a concise warning.',
            'Return JSON only. Use English for the primary fields. Always include Arabic translations: title_ar, description_ar for every step, and raw_ar plus item_ar for every ingredient, even when the source has no Arabic text. Write all Arabic in Modern Standard Arabic (Fusha): convert dialectal expressions from the source (for example Omani/Gulf نحمس البصل becomes MSA نقلب البصل على النار) instead of copying them literally.',
            'The source may be a TikTok, Facebook, Instagram, or X URL. Keep the original URL as attribution.',
            'Required JSON shape: title, title_ar, description, language, servings, prep_time_minutes, cook_time_minutes, total_time_minutes, ingredients, steps, category, keywords, nutrition, cover_image_url, author_name, author_url, overall_confidence, confidence, warnings.',
            'Each ingredient may contain raw, raw_ar, quantity, quantity_display, unit, item, item_ar, prep, optional, group, confidence.',
            'Each step may contain description, description_ar, minutes_estimated, literal_minutes, step_type (active, passive, cleanup), confidence.',
            'Source URL: '.($import->source_url ?: 'none').'.',
            'Detected platform: '.($import->source_platform ?: 'unknown').'.',
            'Resolver metadata: '.json_encode($source['metadata'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'Resolver transcript (if any): '.($source['transcript'] ?? 'none'),
        ]);
    }

    /** @param array<string, mixed> $source @return array<string, mixed> */
    private function requestBody(string $protocol, string $prompt, array $source): array
    {
        $assets = is_array($source['assets'] ?? null) ? $source['assets'] : [];
        $inlineImages = [];
        $inlineAnthropicImages = [];
        $inlineParts = [];

        foreach ($assets as $asset) {
            if (! is_array($asset)) {
                continue;
            }

            $mime = (string) ($asset['mime_type'] ?? 'application/octet-stream');
            $data = $asset['data_base64'] ?? null;
            $url = $asset['url'] ?? null;

            if (str_starts_with($mime, 'image/') && is_string($data) && $data !== '') {
                $dataUrl = 'data:'.$mime.';base64,'.$data;
                $inlineImages[] = ['type' => 'image_url', 'image_url' => ['url' => $dataUrl]];
                $inlineAnthropicImages[] = [
                    'type' => 'image',
                    'source' => ['type' => 'base64', 'media_type' => $mime, 'data' => $data],
                ];
                $inlineParts[] = ['inline_data' => ['mime_type' => $mime, 'data' => $data]];
            } elseif (str_starts_with($mime, 'video/') && is_string($data) && $data !== '') {
                // Gemini accepts inline video parts and can inspect frames and
                // audio. Other protocols receive the asset through the
                // provider-neutral generic payload below.
                $inlineParts[] = ['inline_data' => ['mime_type' => $mime, 'data' => $data]];
            } elseif ($url) {
                $inlineImages[] = ['type' => 'image_url', 'image_url' => ['url' => $url]];
            }
        }

        $sourceSummary = [
            'source_url' => $source['source_url'] ?? null,
            'platform' => $source['platform'] ?? null,
            'metadata' => $source['metadata'] ?? [],
            'media' => $source['media'] ?? [],
            'transcript' => $source['transcript'] ?? null,
            'warnings' => $source['warnings'] ?? [],
        ];

        return match ($protocol) {
            'openai', 'openai_compatible' => [
                'model' => $this->model(),
                'temperature' => 0,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Return only a valid JSON object matching the requested recipe shape.',
                    ],
                    [
                        'role' => 'user',
                        'content' => array_merge(
                            [['type' => 'text', 'text' => $prompt."\nSource context: ".json_encode($sourceSummary, JSON_UNESCAPED_SLASHES)]],
                            $inlineImages,
                        ),
                    ],
                ],
            ],
            'anthropic' => [
                'model' => $this->model(),
                'max_tokens' => 6000,
                'temperature' => 0,
                'system' => 'Return only a valid JSON object matching the requested recipe shape.',
                'messages' => [[
                    'role' => 'user',
                    'content' => array_merge(
                        [['type' => 'text', 'text' => $prompt."\nSource context: ".json_encode($sourceSummary, JSON_UNESCAPED_SLASHES)]],
                        $inlineAnthropicImages,
                    ),
                ]],
            ],
            'gemini' => [
                'contents' => [[
                    'parts' => array_merge(
                        [['text' => $prompt."\nSource context: ".json_encode($sourceSummary, JSON_UNESCAPED_SLASHES)]],
                        $inlineParts,
                    ),
                ]],
                'generationConfig' => [
                    'temperature' => 0,
                    'responseMimeType' => 'application/json',
                ],
            ],
            default => [
                'schema_version' => 1,
                'instructions' => $prompt,
                'response_schema' => $this->responseSchema(),
                'source' => [
                    'url' => $source['source_url'] ?? null,
                    'platform' => $source['platform'] ?? null,
                    'metadata' => $source['metadata'] ?? [],
                    'media' => $source['media'] ?? [],
                    'transcript' => $source['transcript'] ?? null,
                    'assets' => $assets,
                ],
            ],
        };
    }

    private function responseContent(string $protocol, mixed $json, string $body): string
    {
        if (! is_array($json)) {
            return $body;
        }

        $content = match ($protocol) {
            'openai', 'openai_compatible' => $json['choices'][0]['message']['content']
                ?? $json['output_text']
                ?? $json['output'][0]['content'][0]['text']
                ?? null,
            'anthropic' => $json['content'][0]['text'] ?? null,
            'gemini' => collect($json['candidates'][0]['content']['parts'] ?? [])
                ->pluck('text')
                ->filter()
                ->implode("\n"),
            default => $json['recipe'] ?? $json['data'] ?? $json['result'] ?? $json,
        };

        if (is_string($content)) {
            return $content;
        }

        return json_encode($content, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: $body;
    }

    /** @return array<string, mixed>|null */
    private function decodeJson(string $content): ?array
    {
        $content = trim($content);
        $content = preg_replace('/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/i', '', $content) ?? $content;
        $decoded = json_decode($content, true);

        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start === false || $end === false || $end <= $start) {
            return null;
        }

        $decoded = json_decode(substr($content, $start, $end - $start + 1), true);

        return is_array($decoded) ? $decoded : null;
    }

    /** @return array<string, mixed> */
    private function responseSchema(): array
    {
        return [
            'type' => 'object',
            'required' => ['title', 'ingredients', 'steps', 'total_time_minutes'],
            'properties' => [
                'title' => ['type' => ['string', 'null']],
                'title_ar' => ['type' => ['string', 'null']],
                'description' => ['type' => ['string', 'null']],
                'servings' => ['type' => ['integer', 'null']],
                'prep_time_minutes' => ['type' => ['integer', 'null']],
                'cook_time_minutes' => ['type' => ['integer', 'null']],
                'total_time_minutes' => ['type' => ['integer', 'null']],
                'ingredients' => ['type' => 'array'],
                'steps' => ['type' => 'array'],
                'warnings' => ['type' => 'array'],
            ],
        ];
    }
}
