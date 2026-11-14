<x-filament-panels::page>
    <div wire:poll.10s class="flex flex-col gap-6">
        <div class="text-sm text-gray-500">
            Live — refreshes every 10s. Last checked: {{ $checkedAt }}
        </div>

        <div>
            <h2 class="fi-section-header-heading text-base font-semibold">
                In-flight agy imports ({{ $imports->count() }})
            </h2>
            @if ($imports->isEmpty())
                <p class="mt-2 text-sm text-gray-500">No queued or processing agy imports right now.</p>
            @else
                <div class="mt-2 flex flex-col gap-2">
                    @foreach ($imports as $import)
                        <div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                            <div class="flex flex-wrap items-center gap-2">
                                <a
                                    href="{{ \App\Filament\Resources\RecipeImportResource::getUrl('view', ['record' => $import]) }}"
                                    class="font-semibold text-primary-600 hover:underline"
                                >
                                    #{{ $import->id }}
                                </a>
                                <span class="fi-badge fi-size-sm fi-color-warning">
                                    {{ $import->status }} · {{ $import->stage ?? '—' }} · {{ (int) $import->progress }}%
                                </span>
                                @if (in_array($import->id, $busyImportIds, true))
                                    <span class="fi-badge fi-size-sm fi-color-success">worker running</span>
                                @else
                                    <span class="fi-badge fi-size-sm fi-color-gray">waiting for worker</span>
                                @endif
                                <span class="ml-auto text-xs text-gray-500">
                                    updated {{ $import->updated_at?->diffForHumans() ?? '—' }}
                                </span>
                            </div>
                            @if ($import->source_url)
                                <div class="mt-1 truncate text-xs text-gray-500">{{ $import->source_url }}</div>
                            @endif
                        </div>
                    @endforeach
                </div>
            @endif
        </div>

        <div>
            <h2 class="fi-section-header-heading text-base font-semibold">
                OS worker processes ({{ count($processes) }})
            </h2>
            @if (empty($processes))
                <p class="mt-2 text-sm text-gray-500">No agy worker processes running on this machine.</p>
            @else
                <div class="mt-2 overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="text-left text-xs text-gray-500">
                                <th class="py-1 pr-4">PID</th>
                                <th class="py-1 pr-4">Elapsed</th>
                                <th class="py-1 pr-4">CPU%</th>
                                <th class="py-1 pr-4">MEM%</th>
                                <th class="py-1 pr-4">Import</th>
                                <th class="py-1">Workspace</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($processes as $row)
                                <tr class="border-t border-gray-100 dark:border-gray-800">
                                    <td class="py-1 pr-4 font-mono">{{ $row['pid'] }}</td>
                                    <td class="py-1 pr-4 font-mono">{{ $row['elapsed'] }}</td>
                                    <td class="py-1 pr-4 font-mono">{{ $row['cpu'] }}</td>
                                    <td class="py-1 pr-4 font-mono">{{ $row['mem'] }}</td>
                                    <td class="py-1 pr-4">
                                        @if ($row['import_id'] !== null)
                                            <a
                                                href="{{ \App\Filament\Resources\RecipeImportResource::getUrl('view', ['record' => $row['import_id']]) }}"
                                                class="font-semibold text-primary-600 hover:underline"
                                            >
                                                #{{ $row['import_id'] }}
                                            </a>
                                        @else
                                            <span class="text-gray-400">—</span>
                                        @endif
                                    </td>
                                    <td class="max-w-64 truncate py-1 font-mono text-xs text-gray-500">
                                        {{ $row['workspace'] ?? '—' }}
                                    </td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            @endif
        </div>
    </div>
</x-filament-panels::page>
