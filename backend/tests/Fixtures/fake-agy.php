<?php

$sourcePath = getcwd().'/recipe-source.json';
$schemaPath = null;

foreach ($argv as $index => $argument) {
    if ($argument === '--json-schema') {
        $schemaPath = $argv[$index + 1] ?? null;
        break;
    }
}

$source = is_file($sourcePath)
    ? json_decode((string) file_get_contents($sourcePath), true)
    : null;
$hasAsset = is_array($source) && is_array($source['local_assets'] ?? null)
    && $source['local_assets'] !== []
    && is_file(getcwd().'/media/asset-1.jpg');
$arguments = implode(' ', $argv);
$hasExpectedFlags = str_contains($arguments, '--model gemini-3.8-flash-high')
    && str_contains($arguments, '--effort high')
    && str_contains($arguments, '--dangerously-skip-permissions');

if (! $hasAsset || ! $hasExpectedFlags || ! is_string($schemaPath) || ! is_file($schemaPath)) {
    fwrite(STDERR, 'The fake agy worker did not receive the isolated workspace or expected flags.');
    exit(2);
}

$recipe = [
    'title' => 'Harness recipe',
    'ingredients' => [
        ['raw' => '1 tomato', 'quantity' => 1, 'item' => 'tomato'],
    ],
    'steps' => [
        ['description' => 'Chop the tomato.', 'minutes_estimated' => 5],
    ],
    'total_time_minutes' => 5,
    'overall_confidence' => 0.88,
];

echo json_encode([
    'conversation_id' => 'test-conversation',
    'status' => 'SUCCESS',
    'response' => json_encode($recipe),
    'structured_output' => $recipe,
]);
