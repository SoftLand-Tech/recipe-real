<x-filament-panels::page>
    <div x-data="{ tab: 'posts' }" class="flex flex-col gap-4">
        <div class="flex gap-2">
            <button
                type="button"
                @click="tab = 'posts'"
                :class="tab === 'posts' ? 'fi-btn-color-primary fi-btn' : 'fi-btn-color-gray fi-btn fi-btn-outlined'"
                class="fi-btn-size-md fi-btn"
            >
                Post reports ({{ $postReportsCount }})
            </button>
            <button
                type="button"
                @click="tab = 'comments'"
                :class="tab === 'comments' ? 'fi-btn-color-primary fi-btn' : 'fi-btn-color-gray fi-btn fi-btn-outlined'"
                class="fi-btn-size-md fi-btn"
            >
                Comment reports ({{ $commentReportsCount }})
            </button>
        </div>

        <div x-show="tab === 'posts'">
            <livewire:post-reports-table />
        </div>

        <div x-show="tab === 'comments'" x-cloak>
            <livewire:comment-reports-table />
        </div>
    </div>
</x-filament-panels::page>
