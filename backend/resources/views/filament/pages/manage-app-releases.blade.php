<x-filament-panels::page>
    <div class="fi-section">
        <div class="fi-section-content">
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
    </div>

    <x-filament::section>
        <x-slot:heading>
            Published releases
        </x-slot:heading>
        <x-slot:description>
            GET /download always serves the NEWEST row. Deleting a row removes its file too.
        </x-slot:description>

        <div class="overflow-hidden">
            <table class="rr-release-table">
                <thead>
                    <tr>
                        <th>Version</th>
                        <th>Size</th>
                        <th>SHA-256</th>
                        <th>Uploaded</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($releases as $release)
                        <tr>
                            <td>
                                <span style="font-weight: 800; color: var(--rr-ink);">v{{ $release->version }}</span>
                                @if ($latest !== null && $release->id === $latest->id)
                                    <span class="rr-live-pill">LIVE — /download</span>
                                @endif
                                @if ($release->notes)
                                    <div style="font-size: 12.5px; color: var(--rr-muted); margin-top: 4px;">{{ $release->notes }}</div>
                                @endif
                            </td>
                            <td style="white-space: nowrap; font-variant-numeric: tabular-nums;">{{ $release->humanSize() }}</td>
                            <td class="rr-sha" title="{{ $release->sha256 }}">
                                {{ str($release->sha256)->limit(16, '…') }}
                            </td>
                            <td style="white-space: nowrap;">{{ $release->created_at->diffForHumans() }}</td>
                            <td style="text-align: right; white-space: nowrap;">
                                <a href="{{ $release->downloadUrl() }}"
                                   class="fi-btn fi-btn-size-md fi-btn-color-gray fi-button"
                                   target="_blank" rel="noopener">Download</a>
                                <button type="button"
                                        wire:click="deleteRelease({{ $release->id }})"
                                        wire:confirm="Delete release v{{ $release->version }}? /download will fall back to the next-newest row."
                                        class="fi-btn fi-btn-size-md fi-btn-color-gray fi-button ml-2"
                                        style="color: var(--rr-danger); border-color: #e8c4bd;">
                                    Delete
                                </button>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" style="padding: 32px 16px; text-align: center; color: var(--rr-muted);">
                                No releases yet — upload the first APK above.
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    </x-filament::section>
</x-filament-panels::page>
