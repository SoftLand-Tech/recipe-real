<x-filament-panels::page>
    <div class="fi-section">
        <form wire:submit="publish" class="fi-form grid gap-6">
            {{ $this->form }}

            <div class="flex justify-start">
                <button type="submit"
                        class="fi-btn fi-btn-size-lg fi-btn-color-primary fi-button">
                    Publish release
                </button>
            </div>
        </form>
    </div>

    <x-filament::section>
        <x-slot:heading>
            Published releases
        </x-slot:heading>
        <x-slot:description>
            GET /download always serves the NEWEST row. Deleting a row removes its file too.
        </x-slot:description>

        <div class="fi-ta-ctn rounded-xl border overflow-hidden">
            <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-900/50 text-left">
                    <tr>
                        <th class="px-4 py-3 font-semibold">Version</th>
                        <th class="px-4 py-3 font-semibold">Size</th>
                        <th class="px-4 py-3 font-semibold">SHA-256</th>
                        <th class="px-4 py-3 font-semibold">Uploaded</th>
                        <th class="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y">
                    @forelse ($releases as $release)
                        <tr>
                            <td class="px-4 py-3">
                                <span class="font-semibold">v{{ $release->version }}</span>
                                @if ($latest !== null && $release->id === $latest->id)
                                    <span class="ml-2 inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-xs font-semibold text-success-700">LIVE — /download</span>
                                @endif
                                @if ($release->notes)
                                    <div class="text-xs text-gray-500 mt-0.5">{{ $release->notes }}</div>
                                @endif
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">{{ $release->humanSize() }}</td>
                            <td class="px-4 py-3 font-mono text-xs" title="{{ $release->sha256 }}">
                                {{ str($release->sha256)->limit(16, '…') }}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">{{ $release->created_at->diffForHumans() }}</td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <a href="{{ $release->downloadUrl() }}"
                                   class="fi-btn fi-btn-size-md fi-btn-color-gray fi-button"
                                   target="_blank" rel="noopener">Download</a>
                                <button type="button"
                                        wire:click="deleteRelease({{ $release->id }})"
                                        wire:confirm="Delete release v{{ $release->version }}? /download will fall back to the next-newest row."
                                        class="fi-btn fi-btn-size-md fi-btn-color-danger fi-button fi-btn-outline ml-2">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="px-4 py-8 text-center text-gray-500">
                                No releases yet — upload the first APK above.
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </x-filament::section>
</x-filament-panels::page>
