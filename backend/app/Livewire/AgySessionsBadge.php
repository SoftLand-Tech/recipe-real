<?php

namespace App\Livewire;

use App\Models\RecipeImport;
use App\Support\AgyProcessInspector;
use Livewire\Component;

/**
 * Topbar pill showing live agy activity (rendered in the admin topbar next
 * to View site / Releases / APK). Re-renders every 3s via wire:poll — a
 * single COUNT(*) plus one `ps` scan, cheap enough to feel realtime.
 * Clicking jumps to the full Agy sessions page.
 */
class AgySessionsBadge extends Component
{
    public function render()
    {
        $active = RecipeImport::query()
            ->where('provider', 'agy')
            ->whereIn('status', ['queued', 'processing'])
            ->count();

        $running = $active > 0
            ? count(app(AgyProcessInspector::class)->runningProcesses())
            : 0;

        return view('livewire.agy-sessions-badge', [
            'active' => $active,
            'running' => $running,
        ]);
    }
}
