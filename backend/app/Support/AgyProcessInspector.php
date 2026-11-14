<?php

namespace App\Support;

use Symfony\Component\Process\Process;
use Throwable;

/**
 * Best-effort inspector for live `agy` worker processes.
 *
 * The import pipeline shells out to the `agy` CLI once per extraction
 * (see AgyRecipeAiProvider). This reads `ps` output, keeps only processes
 * that look like recipe workers, and joins each one to its RecipeImport
 * via the `import_id` written into the workspace's recipe-source.json.
 *
 * Everything fails soft: any problem (no `ps`, parse error, unreadable
 * workspace) yields an empty list, never an exception — the admin page
 * must keep rendering.
 */
class AgyProcessInspector
{
    /**
     * @return list<array{pid: int, elapsed: string, cpu: string, mem: string, workspace: string|null, import_id: int|null, source_url: string|null}>
     */
    public function runningProcesses(): array
    {
        try {
            $process = new Process(['ps', '-eo', 'pid,etime,pcpu,pmem,args']);
            $process->setTimeout(5);
            $process->run();

            if (! $process->isSuccessful()) {
                return [];
            }

            return $this->parse($process->getOutput());
        } catch (Throwable) {
            return [];
        }
    }

    /**
     * @return list<array{pid: int, elapsed: string, cpu: string, mem: string, workspace: string|null, import_id: int|null, source_url: string|null}>
     */
    public function parse(string $psOutput): array
    {
        $rows = [];

        foreach (explode("\n", $psOutput) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, 'PID')) {
                continue;
            }

            // Only recipe workers: the agy CLI invoked with our disposable
            // workspace prompt (matches AgyRecipeAiProvider::command()).
            if (! str_contains($line, 'agy') || ! str_contains($line, 'recipe-instructions.txt')) {
                continue;
            }

            $parts = preg_split('/\s+/', $line, 5);
            if (! is_array($parts) || count($parts) < 5 || ! is_numeric($parts[0])) {
                continue;
            }

            $workspace = $this->workspaceFromArgs($parts[4]);
            $source = $workspace !== null ? $this->readSource($workspace) : ['import_id' => null, 'source_url' => null];

            $rows[] = [
                'pid' => (int) $parts[0],
                'elapsed' => $parts[1],
                'cpu' => $parts[2],
                'mem' => $parts[3],
                'workspace' => $workspace,
                'import_id' => $source['import_id'],
                'source_url' => $source['source_url'],
            ];
        }

        return $rows;
    }

    private function workspaceFromArgs(string $args): ?string
    {
        // ... --json-schema /tmp/recipereal-ai-imports/<ulid>/recipe-schema.json ...
        if (preg_match('#--json-schema\s+(\S+)/recipe-schema\.json#', $args, $m) !== 1) {
            return null;
        }

        return $m[1];
    }

    /** @return array{import_id: int|null, source_url: string|null} */
    private function readSource(string $workspace): array
    {
        try {
            $path = rtrim($workspace, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'recipe-source.json';
            if (! is_file($path)) {
                return ['import_id' => null, 'source_url' => null];
            }

            $decoded = json_decode((string) file_get_contents($path), true);
            if (! is_array($decoded)) {
                return ['import_id' => null, 'source_url' => null];
            }

            $importId = $decoded['import_id'] ?? null;
            $sourceUrl = $decoded['source_url'] ?? null;

            return [
                'import_id' => is_numeric($importId) ? (int) $importId : null,
                'source_url' => is_string($sourceUrl) && $sourceUrl !== '' ? $sourceUrl : null,
            ];
        } catch (Throwable) {
            return ['import_id' => null, 'source_url' => null];
        }
    }
}
